import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { SalesRow, SalesTransaction, VehicleType } from '@/api';
import { formatTimestamp } from '@/lib/format';
import { bodyLabel } from '@/lib/report';
import { OTHER_COLOR, OTHER_KEY, SERIES, type Slice } from './Charts';
import { Delta } from './ReportBits';
import { colors, space } from './theme';
import { Badge, Card } from './ui';

// Pieces shared by the Today report and the Analytics screen (both built on GET /reports/sales).

/** Body types in the order their colours are assigned. */
export const BODY_ORDER: VehicleType[] = ['HATCHBACK', 'SEDAN', 'SUV', 'MOTORCYCLE', 'VAN', 'TRUCK', 'OTHER'];
const PAYMENT_COLOR: Record<string, string> = { UPI: SERIES[0], CASH: SERIES[2], NONE: colors.danger };

const slice = (r: SalesRow): Omit<Slice, 'color'> => ({
  key: r.key,
  label: r.label,
  value: r.revenue,
  sub: `${r.washes} wash${r.washes === 1 ? '' : 'es'}`,
});

/**
 * Rows → coloured slices. Colours follow `order` (the entity's fixed place), not the ranking,
 * so a slice keeps its colour as filters change. More than eight slices fold into "Other".
 */
export function toSlices(rows: SalesRow[], order: string[]): Slice[] {
  const keys = [...order, ...rows.map((r) => r.key).filter((k) => !order.includes(k))];
  const colorOf = (key: string) => SERIES[keys.indexOf(key)] ?? OTHER_COLOR;
  if (rows.length <= SERIES.length) return rows.map((r) => ({ ...slice(r), color: colorOf(r.key) }));
  const head = rows.slice(0, SERIES.length - 1);
  const rest = rows.slice(SERIES.length - 1);
  const washes = rest.reduce((n, r) => n + r.washes, 0);
  return [
    ...head.map((r) => ({ ...slice(r), color: colorOf(r.key) })),
    {
      key: OTHER_KEY,
      label: `Other (${rest.length})`,
      value: rest.reduce((n, r) => n + r.revenue, 0),
      sub: `${washes} wash${washes === 1 ? '' : 'es'}`,
      color: OTHER_COLOR,
    },
  ];
}

/** UPI / Cash / Not paid slices, with "Not paid" in the danger colour. */
export const paymentSlices = (rows: SalesRow[]): Slice[] =>
  rows.map((r) => ({ ...slice(r), color: PAYMENT_COLOR[r.key] ?? OTHER_COLOR }));

/** One completed wash; opens the job. With a service filter, only that service is listed. */
export function TransactionRow({
  t,
  money,
  serviceId = null,
}: {
  t: SalesTransaction;
  money: (n: number) => string;
  serviceId?: string | null;
}) {
  return (
    <Card onPress={() => router.push({ pathname: '/order/[id]', params: { id: t.id } })} style={s.tx}>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={s.titleRow}>
          <Text style={s.reg}>{t.registrationNumber}</Text>
          {t.category && t.category.code !== 'PRIVATE' && <Badge label={t.category.name} color="#7A4B00" bg="#FFE9B8" />}
          {t.paidAt ? (
            <Badge label={t.paymentMethod === 'CASH' ? 'Cash' : 'UPI'} color={colors.success} bg={colors.successSoft} />
          ) : (
            <Badge label="Not paid" color={colors.danger} bg={colors.dangerSoft} />
          )}
        </View>
        <Text style={s.sub} numberOfLines={1}>
          {[
            t.services
              .filter((x) => !serviceId || x.serviceId === serviceId)
              .map((x) => x.name)
              .join(' + '),
            t.customer.name,
          ].join(' · ')}
        </Text>
        <Text style={s.sub}>
          {formatTimestamp(t.completedAt)} · {bodyLabel(t.vehicleType)}
        </Text>
      </View>
      <Text style={s.amount}>{money(t.amount)}</Text>
    </Card>
  );
}

/** A figure tile; `delta` (vs the previous period) shows ▲/▼, or — when there's nothing to compare. */
export function Kpi({
  label,
  value,
  delta,
  tone,
  onPress,
}: {
  label: string;
  value: string;
  delta?: number | null;
  tone?: string;
  onPress?: () => void;
}) {
  return (
    <Card style={s.kpi} onPress={onPress}>
      <Text style={s.kpiLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[s.kpiValue, tone ? { color: tone } : null]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {delta !== undefined && (delta === null ? <Text style={s.kpiDeltaNone}>—</Text> : <Delta value={delta} onDark={false} />)}
    </Card>
  );
}

export const KpiGrid = ({ children }: { children: ReactNode }) => <View style={s.kpis}>{children}</View>;

export function Section({ title, note, right, children }: { title: string; note?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <Card style={s.section}>
      <View style={s.sectionHead}>
        <Text style={s.sectionTitle}>{title}</Text>
        {right}
      </View>
      {note ? <Text style={[s.sub, { marginBottom: space.sm, marginTop: -4 }]}>{note}</Text> : null}
      {children}
    </Card>
  );
}

export const salesStyles = StyleSheet.create({
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: space.sm },
  txHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: space.xl },
  sub: { fontSize: 13, color: colors.muted },
});

const s = StyleSheet.create({
  ...salesStyles,
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  kpi: { flexBasis: '31%', flexGrow: 1, paddingVertical: space.md, paddingHorizontal: space.md, gap: 2 },
  kpiLabel: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  kpiValue: { fontSize: 18, fontWeight: '800', color: colors.text },
  kpiDeltaNone: { fontSize: 12, color: colors.muted, marginTop: 2 },
  section: { marginTop: space.md },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  tx: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.sm, paddingVertical: space.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  reg: { fontSize: 16, fontWeight: '800', color: colors.text, letterSpacing: 0.5 },
  amount: { fontSize: 16, fontWeight: '800', color: colors.text },
});
