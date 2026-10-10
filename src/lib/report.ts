import { ordersApi, type Order } from '@/api';
import { toDateString } from './format';
import { bookingAmount, bookingCategory, bookingItems } from './pricing';

// The API only has an all-time revenue total (/reports/summary), so the finance report is built
// here from completed jobs: fetched newest first, then filtered and summed on the device.

export type Period = 'today' | 'yesterday' | 'week' | 'month' | 'lastMonth' | 'custom';

export const PERIODS: readonly (readonly [Period, string])[] = [
  ['today', 'Today'],
  ['yesterday', 'Yesterday'],
  ['week', 'Last 7 days'],
  ['month', 'This month'],
  ['lastMonth', 'Last month'],
  ['custom', 'Custom'],
];

/** Inclusive local-date range as YYYY-MM-DD strings. */
export type DateRange = { from: string; to: string };

export function periodRange(period: Exclude<Period, 'custom'>, now = new Date()): DateRange {
  const day = (offset: number) => toDateString(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset));
  switch (period) {
    case 'today':
      return { from: day(0), to: day(0) };
    case 'yesterday':
      return { from: day(-1), to: day(-1) };
    case 'week':
      return { from: day(-6), to: day(0) };
    case 'month':
      return { from: toDateString(new Date(now.getFullYear(), now.getMonth(), 1)), to: day(0) };
    case 'lastMonth':
      return {
        from: toDateString(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        to: toDateString(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const isValidDate = (s: string) => DATE_RE.test(s) && !Number.isNaN(new Date(`${s}T00:00:00`).getTime());

/** Jobs are created at check-in; one can be completed a while later (e.g. a car left overnight). */
const SLACK_DAYS = 31;
/** The API is rate-limited (~100 requests / 15 min), so cap how far back one report reaches. */
const MAX_PAGES = 10;
const PAGE_SIZE = 100;

export type CompletedFetch = { orders: Order[]; truncated: boolean };

/** Completed jobs that could have been completed on or after `from`. */
export async function fetchCompletedSince(from: string): Promise<CompletedFetch> {
  const cutoff = new Date(`${from}T00:00:00`);
  cutoff.setDate(cutoff.getDate() - SLACK_DAYS);
  const orders: Order[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { items, pagination } = await ordersApi.list({ status: 'COMPLETED', page, limit: PAGE_SIZE });
    orders.push(...items);
    const last = items[items.length - 1];
    const morePages = pagination ? page < pagination.totalPages : items.length === PAGE_SIZE;
    if (!morePages || !last || new Date(last.createdAt) < cutoff) return { orders, truncated: false };
  }
  return { orders, truncated: true };
}

export const completedDay = (o: Order) => toDateString(new Date(o.completedAt ?? o.updatedAt));

/** What the job was charged: the order's total if recorded, else the booking's total. */
export const orderAmount = (o: Order) => {
  const n = Number(o.totalAmount ?? (o.booking ? bookingAmount(o.booking) : 0) ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** The services in a job with the price charged for each. */
export const orderLines = (o: Order) => (o.booking ? bookingItems(o.booking) : []);

export const orderCategory = (o: Order) => (o.booking ? bookingCategory(o.booking) : null);
export const categoryKey = (c: { id: string; code: string }) => c.id || c.code;

export const PAYMENT_LABEL = { UPI: 'UPI', CASH: 'Cash', NONE: 'Not paid' } as const;
export type PaymentKey = keyof typeof PAYMENT_LABEL;
export const paymentKey = (o: Order): PaymentKey => (o.paidAt ? (o.paymentMethod === 'CASH' ? 'CASH' : 'UPI') : 'NONE');

export type Breakdown = { key: string; label: string; count: number; revenue: number };

export type Report = {
  orders: Order[];
  revenue: number;
  count: number;
  average: number;
  /** Revenue split by service (a job with two services counts toward both). */
  byService: Breakdown[];
  /** Split by vehicle type (Private, Taxi, ...). */
  byCategory: Breakdown[];
  /** Split by how it was paid: UPI, cash, or not recorded yet. */
  byPayment: Breakdown[];
  byDay: Breakdown[];
};

export type ReportFilters = { range: DateRange; serviceId: string | null; categoryKey: string | null };

export function buildReport(all: Order[], { range, serviceId, categoryKey: catKey }: ReportFilters): Report {
  const orders = all
    .filter((o) => {
      const day = completedDay(o);
      if (day < range.from || day > range.to) return false;
      if (serviceId && !orderLines(o).some((l) => l.serviceId === serviceId)) return false;
      const c = orderCategory(o);
      if (catKey && (!c || categoryKey(c) !== catKey)) return false;
      return true;
    })
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));

  // With a service filter, a job only counts the part of its bill for that service.
  const value = (o: Order) =>
    serviceId
      ? orderLines(o)
          .filter((l) => l.serviceId === serviceId)
          .reduce((sum, l) => sum + Number(l.price), 0)
      : orderAmount(o);

  const group = (keyOf: (o: Order) => string, labelOf: (o: Order) => string) => {
    const map = new Map<string, Breakdown>();
    for (const o of orders) {
      const key = keyOf(o);
      const row = map.get(key) ?? { key, label: labelOf(o), count: 0, revenue: 0 };
      row.count += 1;
      row.revenue += value(o);
      map.set(key, row);
    }
    return [...map.values()];
  };

  const services = new Map<string, Breakdown>();
  for (const o of orders) {
    for (const l of orderLines(o)) {
      if (serviceId && l.serviceId !== serviceId) continue;
      const row = services.get(l.serviceId) ?? { key: l.serviceId, label: l.name, count: 0, revenue: 0 };
      row.count += 1;
      row.revenue += Number(l.price) || 0;
      services.set(l.serviceId, row);
    }
  }

  const revenue = orders.reduce((sum, o) => sum + value(o), 0);

  return {
    orders,
    revenue,
    count: orders.length,
    average: orders.length ? revenue / orders.length : 0,
    byService: [...services.values()].sort((a, b) => b.revenue - a.revenue),
    byCategory: group(
      (o) => {
        const c = orderCategory(o);
        return c ? categoryKey(c) : '?';
      },
      (o) => orderCategory(o)?.name ?? 'Vehicle',
    ).sort((a, b) => b.revenue - a.revenue),
    byPayment: group(paymentKey, (o) => PAYMENT_LABEL[paymentKey(o)]).sort((a, b) => b.revenue - a.revenue),
    byDay: group(completedDay, completedDay).sort((a, b) => b.key.localeCompare(a.key)),
  };
}
