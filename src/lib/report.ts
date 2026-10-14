import type { VehicleType } from '@/api';
import { formatDay, toDateString } from './format';
import { vehicleTypeLabel } from './vehicleCatalog';

// Date ranges and labels for the reports. The figures themselves come from the server
// (GET /reports/sales and /reports/customers).

export type Period = 'today' | 'yesterday' | 'week' | 'weeks' | 'month' | 'lastMonth' | 'custom';

export const PERIODS: readonly (readonly [Period, string])[] = [
  ['today', 'Today'],
  ['yesterday', 'Yesterday'],
  ['week', 'Last 7 days'],
  ['weeks', 'Weeks'],
  ['month', 'This month'],
  ['lastMonth', 'Last month'],
  ['custom', 'Custom'],
];

/** How many weeks back the "Weeks" period can reach. */
export const MAX_WEEKS = 12;

/** Inclusive local-date range as YYYY-MM-DD strings. */
export type DateRange = { from: string; to: string };

/** `weeks` is only used by the "Weeks" period: the last N weeks, ending today. */
export function periodRange(period: Exclude<Period, 'custom'>, weeks = 4, now = new Date()): DateRange {
  const day = (offset: number) => toDateString(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset));
  switch (period) {
    case 'today':
      return { from: day(0), to: day(0) };
    case 'yesterday':
      return { from: day(-1), to: day(-1) };
    case 'week':
      return { from: day(-6), to: day(0) };
    case 'weeks':
      return { from: day(-7 * weeks + 1), to: day(0) };
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

/** Percent change from `before` to `now`; null when there's nothing to compare with. */
export const percentChange = (now: number, before: number) => (before > 0 ? ((now - before) / before) * 100 : null);

export const formatRange = (r: DateRange) => (r.from === r.to ? formatDay(r.from) : `${formatDay(r.from)} – ${formatDay(r.to)}`);

/** Body type (scooter, car, ...) as shown in reports. */
export const bodyLabel = (b: VehicleType) => (b === 'MOTORCYCLE' ? 'Two-wheeler' : vehicleTypeLabel(b));
