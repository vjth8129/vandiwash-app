import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { reportsApi, type SalesRow, type VehicleType } from '@/api';
import { useAuth } from '@/auth/AuthContext';
import { BarChart, ShareBreakdown } from '@/components/Charts';
import { DownloadReport } from '@/components/DownloadReport';
import { BODY_ORDER, KpiGrid, Kpi, paymentSlices, Section, toSlices, TransactionRow } from '@/components/SalesBits';
import { Delta, SummaryCard } from '@/components/ReportBits';
import { colors, radius, space } from '@/components/theme';
import { Button, Card, Chip, EmptyState, Loading, Segmented, TextField } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { formatMoney } from '@/lib/format';
import { bodyLabel, isValidDate, percentChange, type DateRange } from '@/lib/report';
import {
  bucketLabel,
  bucketTick,
  compactMoney,
  hourLabel,
  modeRange,
  periodTitle,
  previousTitle,
  SALES_MODES,
  stepAnchor,
  todayString,
  type SalesMode,
} from '@/lib/sales';

type Metric = 'revenue' | 'washes';
type Paid = 'PAID' | 'UNPAID' | null;

const PAGE = 30;

/**
 * Sales analytics for the owner: pick a day, week, month or custom range, see the trend chart,
 * and how sales split by service, vehicle type, body type and payment, down to each transaction.
 * Everything is summed on the server (GET /reports/sales). Opens on the current week.
 */
export default function AnalyticsScreen() {
  const { config } = useAuth();
  const currency = config?.currency;
  const money = useCallback((n: number) => formatMoney(n, currency), [currency]);

  const [mode, setMode] = useState<SalesMode>('week');
  const [anchor, setAnchor] = useState(todayString);
  const [customFrom, setCustomFrom] = useState(() => modeRange('month', todayString()).from);
  const [customTo, setCustomTo] = useState(todayString);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [vehicleType, setVehicleType] = useState<VehicleType | null>(null);
  const [paid, setPaid] = useState<Paid>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [metric, setMetric] = useState<Metric>('revenue');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);

  const customError =
    mode !== 'custom'
      ? null
      : !isValidDate(customFrom) || !isValidDate(customTo)
        ? 'Use dates like 2026-09-01'
        : customFrom > customTo
          ? 'Must be after “From”'
          : null;
  const range: DateRange =
    mode === 'custom' ? (customError ? modeRange('month', todayString()) : { from: customFrom, to: customTo }) : modeRange(mode, anchor);
  const today = todayString();
  const canGoForward = mode !== 'custom' && stepAnchor(mode, anchor, 1) <= today && modeRange(mode, stepAnchor(mode, anchor, 1)).from <= today;

  const { data, refreshing, refresh } = useQuery(
    () => reportsApi.sales({ ...range, serviceId, categoryId, vehicleType, paymentStatus: paid, limit }),
    [range.from, range.to, serviceId, categoryId, vehicleType, paid, limit],
  );

  // Reset what's selected / paged whenever the question changes.
  const changePeriod = (apply: () => void) => {
    apply();
    setSelectedKey(null);
    setLimit(PAGE);
  };
  const toggleFilter = <T,>(current: T | null, value: T, set: (v: T | null) => void) =>
    changePeriod(() => set(current === value ? null : value));

  const report = data;
  const totals = report?.totals;
  const prev = report?.previous;

  const serviceName = report?.options.services.find((s) => s.id === serviceId)?.name ?? report?.byService.find((s) => s.key === serviceId)?.label;
  const categoryName = report?.options.categories.find((c) => c.id === categoryId)?.name;
  const activeFilters: { label: string; clear: () => void }[] = [
    serviceId && { label: serviceName ?? 'Service', clear: () => setServiceId(null) },
    categoryId && { label: categoryName ?? 'Vehicle type', clear: () => setCategoryId(null) },
    vehicleType && { label: bodyLabel(vehicleType), clear: () => setVehicleType(null) },
    paid && { label: paid === 'PAID' ? 'Paid' : 'Not paid', clear: () => setPaid(null) },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  const chart = useMemo(
    () =>
      (report?.series ?? []).map((r) => ({
        key: r.key,
        tick: bucketTick(report!.groupBy, r.key),
        value: metric === 'revenue' ? r.revenue : r.washes,
      })),
    [report, metric],
  );
  const selectedIndex = selectedKey ? chart.findIndex((d) => d.key === selectedKey) : -1;
  const selectedRow = selectedIndex >= 0 ? report?.series[selectedIndex] : undefined;
  const peak = report?.series.reduce<SalesRow | undefined>((best, r) => (!best || r.revenue > best.revenue ? r : best), undefined);

  const serviceSlices = useMemo(
    () => (report ? toSlices(report.byService, report.options.services.map((s) => s.id)) : []),
    [report],
  );
  const categorySlices = useMemo(
    () => (report ? toSlices(report.byCategory, report.options.categories.map((c) => c.id)) : []),
    [report],
  );
  const bodySlices = useMemo(() => (report ? toSlices(report.byVehicleType, BODY_ORDER) : []), [report]);
  const payment = useMemo(() => paymentSlices(report?.byPayment ?? []), [report]);
  const busiestHour = report?.byHour.reduce<SalesRow | undefined>((best, r) => (!best || r.washes > best.washes ? r : best), undefined);

  if (!report || !totals || !prev) return <Loading />;

  const cutAtNow = range.to >= today && range.from <= today;
  const showHours = report.groupBy !== 'hour' && report.byHour.length > 1;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={s.list}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        {/* ---- period ---- */}
        <Segmented options={SALES_MODES} value={mode} onChange={(m) => changePeriod(() => setMode(m))} />

        {mode === 'custom' ? (
          <View style={s.customRow}>
            <View style={{ flex: 1 }}>
              <TextField
                label="From"
                value={customFrom}
                onChangeText={(v) => changePeriod(() => setCustomFrom(v))}
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
                onChangeText={(v) => changePeriod(() => setCustomTo(v))}
                placeholder="2026-09-30"
                maxLength={10}
                keyboardType="numbers-and-punctuation"
                error={!isValidDate(customTo) ? 'Use YYYY-MM-DD' : customError}
              />
            </View>
          </View>
        ) : (
          <View style={s.stepper}>
            <StepButton icon="chevron-back" label="Previous" onPress={() => changePeriod(() => setAnchor(stepAnchor(mode, anchor, -1)))} />
            <Pressable
              style={{ flex: 1 }}
              onPress={() => changePeriod(() => setAnchor(today))}
              accessibilityRole="button"
              accessibilityHint="Jump back to the current period">
              <Text style={s.periodTitle} numberOfLines={1}>
                {periodTitle(mode, range)}
              </Text>
              {mode !== 'day' && (
                <Text style={s.periodSub} numberOfLines={1}>
                  {periodTitle('custom', range)}
                </Text>
              )}
            </Pressable>
            <StepButton
              icon="chevron-forward"
              label="Next"
              disabled={!canGoForward}
              onPress={() => changePeriod(() => setAnchor(stepAnchor(mode, anchor, 1)))}
            />
          </View>
        )}

        {/* ---- filters ---- */}
        <View style={s.toolbar}>
          <ScrollView style={{ flex: 1 }} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterBar}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowFilters((v) => !v)}
              style={[s.filterButton, (showFilters || activeFilters.length > 0) && s.filterButtonOn]}>
              <Ionicons name="options-outline" size={16} color={colors.primary} />
              <Text style={s.filterButtonText}>Filter{activeFilters.length ? ` · ${activeFilters.length}` : ''}</Text>
            </Pressable>
            {activeFilters.map((f) => (
              <Pressable key={f.label} onPress={() => changePeriod(f.clear)} style={s.activeChip} accessibilityLabel={`Remove filter ${f.label}`}>
                <Text style={s.activeChipText}>{f.label}</Text>
                <Ionicons name="close" size={14} color="#fff" />
              </Pressable>
            ))}
          </ScrollView>
          <DownloadReport
            query={{ ...range, serviceId, categoryId, vehicleType, paymentStatus: paid }}
            description={[periodTitle('custom', range), ...activeFilters.map((f) => f.label)].join(' · ')}
          />
        </View>

        {showFilters && (
          <Card style={s.filters}>
            <FilterRow label="Service">
              {report.options.services.map((o) => (
                <Chip key={o.id} label={o.name} selected={serviceId === o.id} onPress={() => toggleFilter(serviceId, o.id, setServiceId)} />
              ))}
            </FilterRow>
            <FilterRow label="Vehicle type">
              {report.options.categories.map((o) => (
                <Chip key={o.id} label={o.name} selected={categoryId === o.id} onPress={() => toggleFilter(categoryId, o.id, setCategoryId)} />
              ))}
            </FilterRow>
            <FilterRow label="Body">
              {BODY_ORDER.map((b) => (
                <Chip key={b} label={bodyLabel(b)} selected={vehicleType === b} onPress={() => toggleFilter(vehicleType, b, setVehicleType)} />
              ))}
            </FilterRow>
            <FilterRow label="Payment">
              <Chip label="Paid" selected={paid === 'PAID'} onPress={() => toggleFilter<Paid>(paid, 'PAID', setPaid)} />
              <Chip label="Not paid" selected={paid === 'UNPAID'} onPress={() => toggleFilter<Paid>(paid, 'UNPAID', setPaid)} />
            </FilterRow>
          </Card>
        )}

        {/* ---- headline ---- */}
        <SummaryCard title={money(totals.revenue)} subtitle={serviceName ? `${serviceName} sales` : 'Total sales'}>
          <View style={s.deltaRow}>
            <Delta value={percentChange(totals.revenue, prev.revenue)} />
            <Text style={s.deltaNote}>
              {prev.washes
                ? `vs ${previousTitle(mode, prev, cutAtNow)} (${money(prev.revenue)})`
                : `No sales ${previousTitle(mode, prev, cutAtNow)}`}
            </Text>
          </View>
        </SummaryCard>

        <KpiGrid>
          <Kpi label="Washes" value={String(totals.washes)} delta={percentChange(totals.washes, prev.washes)} />
          <Kpi label="Avg ticket" value={money(totals.average)} delta={percentChange(totals.average, prev.average)} />
          <Kpi label="Customers" value={String(totals.customers)} delta={percentChange(totals.customers, prev.customers)} />
          <Kpi label="Collected" value={money(totals.collected)} />
          <Kpi
            label={`Not paid · ${totals.unpaidWashes}`}
            value={money(totals.unpaid)}
            tone={totals.unpaid > 0 ? colors.danger : undefined}
            onPress={totals.unpaidWashes ? () => toggleFilter<Paid>(paid, 'UNPAID', setPaid) : undefined}
          />
          <Kpi
            label="Busiest hour"
            value={busiestHour ? hourLabel(busiestHour.key) : '—'}
          />
        </KpiGrid>

        {/* ---- trend ---- */}
        <Card style={s.section}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>{report.groupBy === 'hour' ? 'Sales by hour' : `Sales by ${report.groupBy}`}</Text>
            <View style={s.metricToggle}>
              {(['revenue', 'washes'] as const).map((m) => (
                <Text
                  key={m}
                  onPress={() => setMetric(m)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: metric === m }}
                  style={[s.metricItem, metric === m && s.metricActive]}>
                  {m === 'revenue' ? 'Amount' : 'Washes'}
                </Text>
              ))}
            </View>
          </View>
          <View style={s.readout}>
            {selectedRow ? (
              <>
                <Text style={s.readoutLabel}>{bucketLabel(report.groupBy, selectedRow.key)}</Text>
                <Text style={s.readoutValue}>
                  {money(selectedRow.revenue)} · {selectedRow.washes} wash{selectedRow.washes === 1 ? '' : 'es'}
                </Text>
              </>
            ) : peak && peak.revenue > 0 ? (
              <>
                <Text style={s.readoutLabel}>Best: {bucketLabel(report.groupBy, peak.key)}</Text>
                <Text style={s.readoutValue}>
                  {money(peak.revenue)} · {peak.washes} wash{peak.washes === 1 ? '' : 'es'}
                </Text>
              </>
            ) : (
              <Text style={s.readoutLabel}>No completed washes in this period yet</Text>
            )}
          </View>
          <BarChart
            data={chart}
            axis={metric === 'revenue' ? (n) => compactMoney(n, currency) : (n) => String(Math.round(n * 10) / 10)}
            selected={selectedIndex >= 0 ? selectedIndex : null}
            onSelect={(i) => setSelectedKey(i === null ? null : chart[i].key)}
          />
          <Text style={s.hint}>Tap a bar for its figures</Text>
        </Card>

        {totals.washes === 0 ? (
          <EmptyState
            icon="analytics-outline"
            title="No sales"
            message={activeFilters.length ? 'No completed washes match these filters.' : 'Completed washes show up here once they’re handed over.'}
          />
        ) : (
          <>
            <Section title="By service" note="A wash with two services counts toward both">
              <ShareBreakdown
                slices={serviceSlices}
                format={money}
                selectedKey={serviceId}
                onPress={(sl) => toggleFilter(serviceId, sl.key, setServiceId)}
              />
            </Section>
            <Section title="By vehicle type">
              <ShareBreakdown
                slices={categorySlices}
                format={money}
                selectedKey={categoryId}
                onPress={(sl) => toggleFilter(categoryId, sl.key, setCategoryId)}
              />
            </Section>
            <Section title="By body type">
              <ShareBreakdown
                slices={bodySlices}
                format={money}
                selectedKey={vehicleType}
                onPress={(sl) => toggleFilter(vehicleType, sl.key as VehicleType, setVehicleType)}
              />
            </Section>
            <Section title="By payment">
              <ShareBreakdown
                slices={payment}
                format={money}
                selectedKey={paid === 'UNPAID' ? 'NONE' : null}
                onPress={(sl) => toggleFilter<Paid>(paid, sl.key === 'NONE' ? 'UNPAID' : 'PAID', setPaid)}
              />
            </Section>
            {showHours && (
              <Section title="Busiest hours" note="Washes handed over in each hour, across the period">
                <BarChart
                  data={hourSeries(report.byHour)}
                  axis={(n) => String(Math.round(n * 10) / 10)}
                  selected={null}
                  onSelect={() => {}}
                  height={110}
                />
              </Section>
            )}

            <View style={s.txHead}>
              <Text style={s.sectionTitle}>Transactions</Text>
              <Text style={s.sub}>
                {report.transactions.length < totals.washes ? `Latest ${report.transactions.length} of ${totals.washes}` : `${totals.washes}`}
              </Text>
            </View>
            {report.transactions.map((t) => (
              <TransactionRow key={t.id} t={t} money={money} serviceId={serviceId} />
            ))}
            {report.transactions.length < totals.washes && limit < 500 && (
              <Button
                title="Show more"
                variant="secondary"
                icon="chevron-down"
                onPress={() => setLimit((n) => Math.min(500, n + 50))}
                style={{ marginTop: space.sm }}
              />
            )}
          </>
        )}
      </ScrollView>

    </View>
  );
}

/** Washes per hour of day, roughly opening hours, with quiet hours as zero. */
function hourSeries(rows: SalesRow[]) {
  const byKey = new Map(rows.map((r) => [Number(r.key), r.washes]));
  const hours = [...byKey.keys()];
  const out = [];
  for (let h = Math.min(7, ...hours); h <= Math.max(20, ...hours); h++) {
    const key = String(h).padStart(2, '0');
    out.push({ key, tick: bucketTick('hour', key), value: byKey.get(h) ?? 0 });
  }
  return out;
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View>
      <Text style={s.filterLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        {children}
      </ScrollView>
    </View>
  );
}

function StepButton({ icon, label, onPress, disabled }: { icon: 'chevron-back' | 'chevron-forward'; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [s.stepButton, (pressed || disabled) && { opacity: disabled ? 0.3 : 0.7 }]}>
      <Ionicons name={icon} size={20} color={colors.primary} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  list: { padding: space.lg, paddingBottom: 32 },
  customRow: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md },
  stepButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodTitle: { fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' },
  periodSub: { fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 2 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  filterBar: { gap: space.sm, paddingVertical: space.md, alignItems: 'center' },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  filterButtonOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  filterButtonText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  activeChipText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  filters: { marginBottom: space.md, paddingBottom: 0 },
  filterLabel: { fontSize: 12, fontWeight: '700', color: colors.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  chips: { gap: space.sm, paddingBottom: space.md },
  deltaRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap', marginTop: 2 },
  deltaNote: { color: '#DCE8FF', fontSize: 12 },
  section: { marginTop: space.md },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: space.sm },
  metricToggle: { flexDirection: 'row', backgroundColor: colors.bg, borderRadius: radius.pill, padding: 2, marginBottom: space.sm },
  metricItem: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, fontSize: 12, fontWeight: '600', color: colors.muted, overflow: 'hidden' },
  metricActive: { backgroundColor: colors.card, color: colors.primary },
  readout: { marginBottom: space.md, minHeight: 38 },
  readoutLabel: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  readoutValue: { fontSize: 17, fontWeight: '800', color: colors.text, marginTop: 2 },
  hint: { fontSize: 11, color: colors.muted, textAlign: 'center', marginTop: space.sm },
  txHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: space.xl },
  sub: { fontSize: 13, color: colors.muted },
});
