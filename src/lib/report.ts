import { ordersApi, type Order } from '@/api';
import { toDateString } from './format';
import { bookingAmount, isTaxiBooking } from './pricing';

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

/** What the job was charged: the order's total if recorded, else the booking's rate. */
export const orderAmount = (o: Order) => {
  const n = Number(o.totalAmount ?? (o.booking ? bookingAmount(o.booking) : 0) ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export const isTaxiOrder = (o: Order) => !!o.booking && isTaxiBooking(o.booking);

export type Breakdown = { key: string; label: string; count: number; revenue: number };

export type Report = {
  orders: Order[];
  revenue: number;
  count: number;
  average: number;
  taxiRevenue: number;
  taxiCount: number;
  byService: Breakdown[];
  byDay: Breakdown[];
};

export type ReportFilters = { range: DateRange; serviceId: string | null; use: 'ALL' | 'PRIVATE' | 'TAXI' };

export function buildReport(all: Order[], { range, serviceId, use }: ReportFilters): Report {
  const orders = all
    .filter((o) => {
      const day = completedDay(o);
      if (day < range.from || day > range.to) return false;
      if (serviceId && o.booking?.serviceId !== serviceId) return false;
      if (use !== 'ALL' && isTaxiOrder(o) !== (use === 'TAXI')) return false;
      return true;
    })
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));

  const group = (keyOf: (o: Order) => string, labelOf: (o: Order) => string) => {
    const map = new Map<string, Breakdown>();
    for (const o of orders) {
      const key = keyOf(o);
      const row = map.get(key) ?? { key, label: labelOf(o), count: 0, revenue: 0 };
      row.count += 1;
      row.revenue += orderAmount(o);
      map.set(key, row);
    }
    return [...map.values()];
  };

  const revenue = orders.reduce((sum, o) => sum + orderAmount(o), 0);
  const taxi = orders.filter(isTaxiOrder);
  const taxiRevenue = taxi.reduce((sum, o) => sum + orderAmount(o), 0);

  return {
    orders,
    revenue,
    count: orders.length,
    average: orders.length ? revenue / orders.length : 0,
    taxiRevenue,
    taxiCount: taxi.length,
    byService: group(
      (o) => o.booking?.serviceId ?? '?',
      (o) => o.booking?.service?.name ?? 'Service',
    ).sort((a, b) => b.revenue - a.revenue),
    byDay: group(completedDay, completedDay).sort((a, b) => b.key.localeCompare(a.key)),
  };
}
