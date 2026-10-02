import type { BookingStatus, OrderStatus } from '@/api';

export function formatMoney(value: string | number | null | undefined, currency = 'INR') {
  const n = typeof value === 'string' ? parseFloat(value) : value ?? 0;
  const amount = Number.isFinite(n) ? (n as number) : 0;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Local date as YYYY-MM-DD. */
export function toDateString(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local time as HH:mm. */
export function toTimeString(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "10:00:00" -> "10:00 AM" */
export function formatClock(time: string | null | undefined) {
  if (!time) return '';
  const [hh, mm] = time.split(':').map(Number);
  if (!Number.isFinite(hh)) return time;
  const suffix = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${pad(mm || 0)} ${suffix}`;
}

/** "2026-09-13" -> "Today" / "Tomorrow" / "Sun, 13 Sep" */
export function formatDay(date: string | null | undefined) {
  if (!date) return '';
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (date === toDateString(today)) return 'Today';
  if (date === toDateString(tomorrow)) return 'Tomorrow';
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export function formatTimestamp(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  const day = formatDay(toDateString(d));
  return `${day}, ${formatClock(toTimeString(d))}`;
}

// ---- order workflow ---------------------------------------------------------

type StatusMeta = { label: string; color: string; bg: string };

export const ORDER_STATUS: Record<OrderStatus, StatusMeta> = {
  CREATED: { label: 'Waiting', color: '#6B5B00', bg: '#FFF4C2' },
  WASHING: { label: 'Washing', color: '#5A2DA0', bg: '#ECE3FF' },
  READY: { label: 'Ready', color: '#0E6B3A', bg: '#D6F5E3' },
  COMPLETED: { label: 'Completed', color: '#3F4A56', bg: '#E6EAEE' },
  CANCELLED: { label: 'Cancelled', color: '#9B1C1C', bg: '#FDE2E2' },
};

export const BOOKING_STATUS: Record<BookingStatus, StatusMeta> = {
  PENDING: { label: 'Pending', color: '#6B5B00', bg: '#FFF4C2' },
  CONFIRMED: { label: 'Confirmed', color: '#0B4A8F', bg: '#DCEBFF' },
  IN_PROGRESS: { label: 'In progress', color: '#5A2DA0', bg: '#ECE3FF' },
  COMPLETED: { label: 'Completed', color: '#3F4A56', bg: '#E6EAEE' },
  CANCELLED: { label: 'Cancelled', color: '#9B1C1C', bg: '#FDE2E2' },
  NO_SHOW: { label: 'No show', color: '#9B1C1C', bg: '#FDE2E2' },
};

/** Valid forward step for each order status: Waiting (CREATED)→WASHING→READY→COMPLETED. */
export const NEXT_STEP: Partial<
  Record<OrderStatus, { status: Exclude<OrderStatus, 'CREATED'>; action: string }>
> = {
  CREATED: { status: 'WASHING', action: 'Start washing' },
  WASHING: { status: 'READY', action: 'Mark as ready' },
  READY: { status: 'COMPLETED', action: 'Complete & hand over' },
};

export const ORDER_FLOW: OrderStatus[] = ['CREATED', 'WASHING', 'READY', 'COMPLETED'];

export const isActiveOrder = (s: OrderStatus) => s !== 'COMPLETED' && s !== 'CANCELLED';

/** Display form of a stored E.164 number: +919876543210 -> "+91 98765 43210". */
export function formatPhone(phone: string | null | undefined) {
  if (!phone) return '';
  const india = /^\+91(\d{5})(\d{5})$/.exec(phone);
  return india ? `+91 ${india[1]} ${india[2]}` : phone;
}
