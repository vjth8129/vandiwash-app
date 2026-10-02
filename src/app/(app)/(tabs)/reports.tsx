import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import { colors, radius, space } from '@/components/theme';
import { Badge, Card, Chip, EmptyState, Loading, SectionTitle, Segmented, TextField } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { formatDay, formatMoney, formatTimestamp, toDateString } from '@/lib/format';
import {
  buildReport,
  completedDay,
  fetchCompletedSince,
  isTaxiOrder,
  isValidDate,
  orderAmount,
  PERIODS,
  periodRange,
  type Breakdown,
  type DateRange,
  type Period,
} from '@/lib/report';

type Use = 'ALL' | 'PRIVATE' | 'TAXI';

/** Finance report: revenue from completed washes, filtered by date, service and private/taxi. */
export default function ReportsScreen() {
  const { config } = useAuth();
  const money = (n: number) => formatMoney(n, config?.currency);

  const [period, setPeriod] = useState<Period>('today');
  const [customFrom, setCustomFrom] = useState(() => periodRange('month').from);
  const [customTo, setCustomTo] = useState(() => toDateString(new Date()));
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [use, setUse] = useState<Use>('ALL');

  const customError =
    period !== 'custom'
      ? null
      : !isValidDate(customFrom) || !isValidDate(customTo)
        ? 'Use dates like 2026-09-01'
        : customFrom > customTo
          ? 'Must be after “From”'
          : null;
  const range: DateRange =
    period === 'custom' ? (customError ? periodRange('month') : { from: customFrom, to: customTo }) : periodRange(period);

  const { data, loading, refreshing, refresh } = useQuery(() => fetchCompletedSince(range.from), [range.from]);

  const report = useMemo(
    () => buildReport(data?.orders ?? [], { range, serviceId, use }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, range.from, range.to, serviceId, use],
  );

  // Services that appear in the loaded jobs, for the service filter.
  const services = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of data?.orders ?? []) {
      if (o.booking?.serviceId) map.set(o.booking.serviceId, o.booking.service?.name ?? 'Service');
    }
    return [...map].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);

  const rangeLabel = range.from === range.to ? formatDay(range.from) : `${formatDay(range.from)} – ${formatDay(range.to)}`;
  const maxService = Math.max(1, ...report.byService.map((r) => r.revenue));
  const maxDay = Math.max(1, ...report.byDay.map((r) => r.revenue));

  const header = (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        {PERIODS.map(([key, label]) => (
          <Chip key={key} label={label} selected={period === key} onPress={() => setPeriod(key)} />
        ))}
      </ScrollView>

      {period === 'custom' && (
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <TextField
              label="From"
              value={customFrom}
              onChangeText={setCustomFrom}
              placeholder="2026-09-01"
              maxLength={10}
              keyboardType="numbers-and-punctuation"
              error={isValidDate(customFrom) ? null : 'Use YYYY-MM-DD'}
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextField
              label="To"
              value={customTo}
              onChangeText={setCustomTo}
              placeholder="2026-09-30"
              maxLength={10}
              keyboardType="numbers-and-punctuation"
              error={!isValidDate(customTo) ? 'Use YYYY-MM-DD' : customError}
            />
          </View>
        </View>
      )}

      <Segmented
        value={use}
        onChange={setUse}
        options={[
          ['ALL', 'All cars'],
          ['PRIVATE', 'Private'],
          ['TAXI', 'Taxi'],
        ]}
      />

      {services.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          <Chip label="All services" selected={!serviceId} onPress={() => setServiceId(null)} />
          {services.map(([id, name]) => (
            <Chip key={id} label={name} selected={serviceId === id} onPress={() => setServiceId(serviceId === id ? null : id)} />
          ))}
        </ScrollView>
      )}

      {/* Totals */}
      <Card style={s.totalCard}>
        <Text style={s.totalLabel}>Revenue · {rangeLabel}</Text>
        <Text style={s.total}>{money(report.revenue)}</Text>
        <View style={s.statsRow}>
          <Stat label="Washes" value={String(report.count)} />
          <Stat label="Average" value={money(report.average)} />
          <Stat label="Taxi" value={`${money(report.taxiRevenue)} · ${report.taxiCount}`} />
        </View>
      </Card>

      {data?.truncated && (
        <Text style={s.note}>Showing the most recent 1,000 completed washes — older ones aren’t included.</Text>
      )}

      {report.byService.length > 0 && (
        <Card style={s.section}>
          <SectionTitle>By service</SectionTitle>
          {report.byService.map((r) => (
            <BarRow key={r.key} row={r} max={maxService} money={money} />
          ))}
        </Card>
      )}

      {report.byDay.length > 1 && (
        <Card style={s.section}>
          <SectionTitle>By day</SectionTitle>
          {report.byDay.map((r) => (
            <BarRow key={r.key} row={{ ...r, label: formatDay(r.key) }} max={maxDay} money={money} />
          ))}
        </Card>
      )}

      <View style={{ marginTop: space.lg }}>
        <SectionTitle>Completed washes ({report.count})</SectionTitle>
      </View>
    </View>
  );

  if (loading) return <Loading />;

  return (
    <FlatList
      data={report.orders}
      keyExtractor={(o) => o.id}
      contentContainerStyle={s.list}
      ListHeaderComponent={header}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      ListEmptyComponent={<EmptyState icon="receipt-outline" title="No completed washes" message={`Nothing was completed ${period === 'today' ? 'today' : 'in this period'}.`} />}
      renderItem={({ item: o }) => {
        const b = o.booking;
        return (
          <Card onPress={() => router.push({ pathname: '/order/[id]', params: { id: o.id } })} style={s.item}>
            <View style={{ flex: 1 }}>
              <View style={[s.row, { alignItems: 'center' }]}>
                <Text style={s.reg}>{b?.vehicle?.registrationNumber ?? 'Vehicle'}</Text>
                {isTaxiOrder(o) && <Badge label="Taxi" color="#7A4B00" bg="#FFE9B8" />}
              </View>
              <Text style={s.sub} numberOfLines={1}>
                {[b?.service?.name, b?.customer?.name].filter(Boolean).join(' · ')}
              </Text>
              <View style={[s.row, { alignItems: 'center', gap: 4, marginTop: 4 }]}>
                <Ionicons name="checkmark-done" size={14} color={colors.success} />
                <Text style={s.sub}>{o.completedAt ? formatTimestamp(o.completedAt) : formatDay(completedDay(o))}</Text>
              </View>
            </View>
            <Text style={s.amount}>{money(orderAmount(o))}</Text>
          </Card>
        );
      }}
    />
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function BarRow({ row, max, money }: { row: Breakdown; max: number; money: (n: number) => string }) {
  return (
    <View style={{ marginBottom: space.md }}>
      <View style={[s.row, { justifyContent: 'space-between' }]}>
        <Text style={s.barLabel} numberOfLines={1}>
          {row.label} <Text style={s.sub}>· {row.count}</Text>
        </Text>
        <Text style={s.barValue}>{money(row.revenue)}</Text>
      </View>
      <View style={s.track}>
        <View style={[s.bar, { width: `${Math.max(2, (row.revenue / max) * 100)}%` }]} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  list: { padding: space.lg, paddingBottom: 48 },
  chips: { gap: space.sm, paddingBottom: space.md },
  row: { flexDirection: 'row', gap: space.sm },
  totalCard: { backgroundColor: colors.primary, borderColor: colors.primary },
  totalLabel: { color: '#DCE8FF', fontSize: 13, fontWeight: '600' },
  total: { color: '#fff', fontSize: 34, fontWeight: '800', marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  statValue: { color: '#fff', fontSize: 15, fontWeight: '700' },
  statLabel: { color: '#DCE8FF', fontSize: 12, marginTop: 2 },
  note: { color: colors.muted, fontSize: 12, marginTop: space.sm },
  section: { marginTop: space.md, paddingBottom: space.xs },
  barLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
  barValue: { fontSize: 14, fontWeight: '700', color: colors.text },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.primarySoft, marginTop: 6, overflow: 'hidden' },
  bar: { height: 8, borderRadius: radius.pill, backgroundColor: colors.primary },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.sm, paddingVertical: space.md },
  reg: { fontSize: 16, fontWeight: '800', color: colors.text, letterSpacing: 0.5 },
  sub: { fontSize: 13, color: colors.muted },
  amount: { fontSize: 16, fontWeight: '800', color: colors.text },
});
