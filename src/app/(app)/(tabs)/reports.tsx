import { router } from 'expo-router';
import { useCallback } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { reportsApi, type SalesRow } from '@/api';
import { useAuth } from '@/auth/AuthContext';
import { ShareBreakdown } from '@/components/Charts';
import { DownloadReport } from '@/components/DownloadReport';
import { Delta, SummaryCard } from '@/components/ReportBits';
import { Kpi, KpiGrid, paymentSlices, Section, salesStyles, toSlices, TransactionRow } from '@/components/SalesBits';
import { colors, space } from '@/components/theme';
import { Button, EmptyState, Loading } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { formatDay, formatMoney } from '@/lib/format';
import { percentChange } from '@/lib/report';
import { hourLabel, todayString } from '@/lib/sales';

/** Today's sales at a glance, compared with yesterday up to this time. Other periods and charts are in Analytics. */
export default function ReportsScreen() {
  const { config } = useAuth();
  const money = useCallback((n: number) => formatMoney(n, config?.currency), [config?.currency]);
  const today = todayString();

  const { data: report, refreshing, refresh } = useQuery(() => reportsApi.sales({ from: today, to: today, limit: 100 }), [today]);

  if (!report) return <Loading />;
  const { totals, previous: prev } = report;
  const busiestHour = report.byHour.reduce<SalesRow | undefined>((best, r) => (!best || r.washes > best.washes ? r : best), undefined);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={s.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <View style={s.toolbar}>
          <Text style={s.toolbarTitle}>Today</Text>
          <DownloadReport query={{ from: today, to: today }} description={`Today’s sales · ${formatDay(today)}`} />
        </View>
        <SummaryCard
          title={money(totals.revenue)}
          subtitle={`Today’s sales · ${new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}`}>
          <View style={s.deltaRow}>
            <Delta value={percentChange(totals.revenue, prev.revenue)} />
            <Text style={s.deltaNote}>
              {prev.washes ? `vs yesterday by this time (${money(prev.revenue)})` : 'No sales yesterday by this time'}
            </Text>
          </View>
        </SummaryCard>

        <KpiGrid>
          <Kpi label="Washes" value={String(totals.washes)} delta={percentChange(totals.washes, prev.washes)} />
          <Kpi label="Avg ticket" value={money(totals.average)} />
          <Kpi label="Customers" value={String(totals.customers)} />
          <Kpi label="Collected" value={money(totals.collected)} />
          <Kpi label={`Not paid · ${totals.unpaidWashes}`} value={money(totals.unpaid)} tone={totals.unpaid > 0 ? colors.danger : undefined} />
          <Kpi label="Busiest hour" value={busiestHour ? hourLabel(busiestHour.key) : '—'} />
        </KpiGrid>

        {totals.washes === 0 ? (
          <EmptyState icon="receipt-outline" title="No sales yet today" message="Completed washes show up here as they’re handed over." />
        ) : (
          <>
            <Section title="By service">
              <ShareBreakdown slices={toSlices(report.byService, report.options.services.map((o) => o.id))} format={money} />
            </Section>
            <Section title="By vehicle type">
              <ShareBreakdown slices={toSlices(report.byCategory, report.options.categories.map((o) => o.id))} format={money} />
            </Section>
            <Section title="By payment">
              <ShareBreakdown slices={paymentSlices(report.byPayment)} format={money} />
            </Section>

            <View style={salesStyles.txHead}>
              <Text style={salesStyles.sectionTitle}>Today’s washes</Text>
              <Text style={salesStyles.sub}>
                {report.transactions.length < totals.washes ? `Latest ${report.transactions.length} of ${totals.washes}` : totals.washes}
              </Text>
            </View>
            {report.transactions.map((t) => (
              <TransactionRow key={t.id} t={t} money={money} />
            ))}
          </>
        )}
      </ScrollView>

      <View style={s.bottomBar}>
        <Button title="Analytics" icon="analytics-outline" onPress={() => router.push('/report/analytics')} style={{ flex: 1 }} />
        <Button
          title="Promotions"
          icon="megaphone-outline"
          variant="secondary"
          onPress={() => router.push('/report/promotions')}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  list: { padding: space.lg, paddingBottom: 32 },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md },
  toolbarTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  deltaRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap', marginTop: 2 },
  deltaNote: { color: '#DCE8FF', fontSize: 12 },
  bottomBar: {
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
