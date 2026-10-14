import type { IconName } from '@/components/ui';
import type { PromotionChannel, PromotionStatus, RecipientStatus } from '@/api';
import { colors } from '@/components/theme';
import { formatTimestamp, toDateString, toTimeString } from './format';
import { isValidDate } from './report';

type StatusMeta = { label: string; color: string; bg: string; icon: IconName };

export const PROMOTION_STATUS: Record<PromotionStatus, StatusMeta> = {
  SCHEDULED: { label: 'Scheduled', color: '#7A4B00', bg: '#FFE9B8', icon: 'time-outline' },
  SENDING: { label: 'Sending', color: colors.primaryDark, bg: colors.primarySoft, icon: 'paper-plane-outline' },
  SENT: { label: 'Sent', color: colors.success, bg: colors.successSoft, icon: 'checkmark-done' },
  FAILED: { label: 'Failed', color: colors.danger, bg: colors.dangerSoft, icon: 'alert-circle-outline' },
  CANCELLED: { label: 'Cancelled', color: colors.muted, bg: '#EEF1F5', icon: 'close-circle-outline' },
};

export const RECIPIENT_STATUS: Record<RecipientStatus, Omit<StatusMeta, 'icon'>> = {
  PENDING: { label: 'Waiting', color: '#7A4B00', bg: '#FFE9B8' },
  SENT: { label: 'Sent', color: colors.success, bg: colors.successSoft },
  FAILED: { label: 'Failed', color: colors.danger, bg: colors.dangerSoft },
  SKIPPED: { label: 'Skipped', color: colors.muted, bg: '#EEF1F5' },
};

export const CHANNELS: readonly (readonly [PromotionChannel, string])[] = [
  ['WHATSAPP', 'WhatsApp'],
  ['SMS', 'SMS'],
];
export const channelLabel = (c: PromotionChannel) => (c === 'SMS' ? 'SMS' : 'WhatsApp');

export const DISCOUNTS = [5, 10, 15, 20];

/** A ready-made offer message; {name} becomes each customer's first name. */
export function offerTemplate(discount: number, service: string | null, carWash?: string) {
  const what = service ? `your next ${service}` : 'your next wash';
  return `Hi {name}, we miss you! Get ${discount}% off ${what} this week.${carWash ? ` – ${carWash}` : ''}`;
}

export const previewMessage = (message: string, name = 'Rahul') =>
  message.replaceAll('{name}', name.trim().split(/\s+/)[0] || 'there');

// ---- scheduling ----------------------------------------------------------------

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;
export const isValidTime = (s: string) => TIME_RE.test(s.trim());

/** Local date + HH:mm → Date, or null when either part is malformed. */
export function scheduleDate(day: string, time: string): Date | null {
  if (!isValidDate(day) || !isValidTime(time)) return null;
  const [y, m, d] = day.split('-').map(Number);
  const [hh, mm] = time.trim().split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

/** Quick picks for "Schedule": label + the date/time they fill in. */
export function scheduleShortcuts(now = new Date()): { label: string; day: string; time: string }[] {
  const at = (offsetDays: number) => toDateString(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays));
  const inAnHour = new Date(now.getTime() + 60 * 60_000);
  const toSaturday = ((6 - now.getDay() + 7) % 7) || 7;
  return [
    { label: 'In 1 hour', day: toDateString(inAnHour), time: toTimeString(inAnHour) },
    { label: 'Tomorrow 9 AM', day: at(1), time: '09:00' },
    { label: 'Tomorrow 6 PM', day: at(1), time: '18:00' },
    { label: 'Saturday 9 AM', day: at(toSaturday), time: '09:00' },
  ];
}

/** "Tomorrow, 9:00 AM" style label for a schedule. */
export const formatWhen = (d: Date) => formatTimestamp(d.toISOString());
