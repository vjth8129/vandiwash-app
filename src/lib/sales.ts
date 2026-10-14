import type { SalesBucket } from '@/api';
import { formatDay, toDateString } from './format';
import type { DateRange } from './report';

// Periods for the sales report: a day, a week (Mon–Sun) or a calendar month that can be stepped
// back and forward, or a custom From–To range. The server does the summing (GET /reports/sales).

export type SalesMode = 'day' | 'week' | 'month' | 'custom';

export const SALES_MODES: readonly (readonly [SalesMode, string])[] = [
  ['day', 'Day'],
  ['week', 'Week'],
  ['month', 'Month'],
  ['custom', 'Custom'],
];

const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const shiftDays = (s: string, n: number) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return toDateString(d);
};
const monday = (s: string) => shiftDays(s, -((parse(s).getDay() + 6) % 7));

export const todayString = () => toDateString(new Date());

/** The day, week or month that `anchor` falls in. */
export function modeRange(mode: Exclude<SalesMode, 'custom'>, anchor: string): DateRange {
  switch (mode) {
    case 'day':
      return { from: anchor, to: anchor };
    case 'week': {
      const from = monday(anchor);
      return { from, to: shiftDays(from, 6) };
    }
    case 'month': {
      const d = parse(anchor);
      return {
        from: toDateString(new Date(d.getFullYear(), d.getMonth(), 1)),
        to: toDateString(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
      };
    }
  }
}

/** The anchor of the previous (-1) or next (+1) day, week or month. */
export function stepAnchor(mode: Exclude<SalesMode, 'custom'>, anchor: string, dir: -1 | 1) {
  if (mode === 'day') return shiftDays(anchor, dir);
  if (mode === 'week') return shiftDays(anchor, 7 * dir);
  const d = parse(anchor);
  return toDateString(new Date(d.getFullYear(), d.getMonth() + dir, 1));
}

const shortDay = (s: string) => parse(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const monthName = (s: string) => parse(s).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

/** "Today", "This week", "October 2026", "6 – 12 Oct" ... */
export function periodTitle(mode: SalesMode, r: DateRange) {
  const today = todayString();
  const current = r.from <= today && today <= r.to;
  if (mode === 'day') return formatDay(r.from) === 'Today' ? 'Today' : r.from === shiftDays(today, -1) ? 'Yesterday' : formatDay(r.from);
  if (mode === 'week') return current ? 'This week' : `${shortDay(r.from)} – ${shortDay(r.to)}`;
  if (mode === 'month') return current ? `This month · ${monthName(r.from)}` : monthName(r.from);
  return r.from === r.to ? formatDay(r.from) : `${shortDay(r.from)} – ${shortDay(r.to)}`;
}

/** What the comparison is against, e.g. "yesterday", "last week", "Sep 2026". */
export function previousTitle(mode: SalesMode, prev: DateRange, cutAtNow: boolean) {
  const suffix = cutAtNow ? ' by this time' : '';
  if (mode === 'day') return (prev.from === shiftDays(todayString(), -1) ? 'yesterday' : formatDay(prev.from)) + suffix;
  if (mode === 'week') return `the week before${suffix}`;
  if (mode === 'month') return `${parse(prev.from).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}${suffix}`;
  return `${shortDay(prev.from)} – ${shortDay(prev.to)}${suffix}`;
}

const hour12 = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`;

/** Short x-axis tick for a chart bucket. */
export function bucketTick(bucket: SalesBucket, key: string) {
  switch (bucket) {
    case 'hour': {
      const h = Number(key);
      return `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'a' : 'p'}`;
    }
    case 'day':
      return String(parse(key).getDate());
    case 'week':
      return shortDay(key);
    case 'month':
      return parse(`${key}-01`).toLocaleDateString(undefined, { month: 'short' });
  }
}

/** Full label for the selected bar. */
export function bucketLabel(bucket: SalesBucket, key: string) {
  switch (bucket) {
    case 'hour': {
      const h = Number(key);
      return `${hour12(h)} – ${hour12((h + 1) % 24)}`;
    }
    case 'day':
      return formatDay(key);
    case 'week':
      return `Week of ${shortDay(key)}`;
    case 'month':
      return monthName(`${key}-01`);
  }
}

export const hourLabel = (key: string) => hour12(Number(key));

/** Axis-sized money: ₹950, ₹1.2k, ₹3.4L (lakh) for rupees; k / M otherwise. */
export function compactMoney(n: number, currency = 'INR') {
  const inr = currency === 'INR';
  const sym = inr ? '₹' : '';
  const trim = (v: number) => (v >= 10 ? Math.round(v).toString() : v.toFixed(1).replace(/\.0$/, ''));
  if (inr && n >= 1e7) return `${sym}${trim(n / 1e7)}Cr`;
  if (inr && n >= 1e5) return `${sym}${trim(n / 1e5)}L`;
  if (!inr && n >= 1e6) return `${trim(n / 1e6)}M`;
  if (n >= 1e3) return `${sym}${trim(n / 1e3)}k`;
  return `${sym}${Math.round(n)}`;
}
