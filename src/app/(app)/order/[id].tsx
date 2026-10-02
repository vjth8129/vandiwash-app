import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { errorMessage, ordersApi, type Order, type OrderStatus } from '@/api';
import { useAuth } from '@/auth/AuthContext';
import { colors, space } from '@/components/theme';
import { Badge, Button, Card, EmptyState, Loading, Row, SectionTitle } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { confirm, notify } from '@/lib/confirm';
import {
  formatClock,
  formatDay,
  formatMoney,
  formatTimestamp,
  isActiveOrder,
  NEXT_STEP,
  ORDER_FLOW,
  ORDER_STATUS,
} from '@/lib/format';
import { bookingAmount, isTaxiBooking } from '@/lib/pricing';

const STEP_TIME: Partial<Record<OrderStatus, keyof Order>> = {
  CREATED: 'createdAt',
  WASHING: 'washStartedAt',
  READY: 'readyAt',
  COMPLETED: 'completedAt',
};

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { can, config } = useAuth();
  const [busy, setBusy] = useState<'advance' | 'cancel' | null>(null);

  const { data: order, error, loading, refreshing, refresh, setData } = useQuery(() => ordersApi.get(id), [id]);

  const update = async (status: Parameters<typeof ordersApi.setStatus>[1], kind: 'advance' | 'cancel') => {
    if (!order) return;
    setBusy(kind);
    try {
      const updated = await ordersApi.setStatus(order.id, status);
      // Keep the booking details we already have if the PATCH response omits them.
      setData({ ...order, ...updated, booking: updated.booking ?? order.booking });
    } catch (e) {
      notify('Could not update job', errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <Loading />;
  if (!order) {
    return (
      <EmptyState
        icon="alert-circle-outline"
        title={error ? 'Couldn’t load this job' : 'Job not found'}
        action={error ? <Button title="Try again" onPress={refresh} /> : undefined}
      />
    );
  }

  const b = order.booking;
  const next = NEXT_STEP[order.status];
  const canUpdate = can('ORDERS_UPDATE');
  const currentIndex = ORDER_FLOW.indexOf(order.status);

  const onCancel = async () => {
    if (await confirm('Cancel this job?', 'The linked booking will be cancelled too.', 'Cancel job', true)) {
      update('CANCELLED', 'cancel');
    }
  };

  return (
    <ScrollView
      contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <Card style={{ marginBottom: space.lg }}>
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.reg}>{b?.vehicle?.registrationNumber ?? 'Vehicle'}</Text>
            <Text style={s.muted}>{b?.service?.name}</Text>
          </View>
          <Badge {...ORDER_STATUS[order.status]} />
        </View>
        {canUpdate && next && (
          <Button
            title={next.action}
            icon="arrow-forward-circle-outline"
            onPress={() => update(next.status, 'advance')}
            loading={busy === 'advance'}
            disabled={busy !== null}
            style={{ marginTop: space.lg }}
          />
        )}
        {order.status === 'COMPLETED' && (
          <View style={s.doneBox}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={{ color: colors.success, fontWeight: '700' }}>Car handed over</Text>
          </View>
        )}
      </Card>

      <SectionTitle>Progress</SectionTitle>
      <Card style={{ marginBottom: space.lg }}>
        {order.status === 'CANCELLED' ? (
          <Row icon="close-circle-outline" label="Cancelled" value={formatTimestamp(order.cancelledAt)} />
        ) : (
          ORDER_FLOW.map((step, i) => {
            const reached = i <= currentIndex;
            const key = STEP_TIME[step];
            const at = key ? (order[key] as string | null) : null;
            return (
              <View key={step} style={s.step}>
                <View style={s.stepRail}>
                  <View style={[s.dot, reached && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                    {reached && <Ionicons name="checkmark" size={12} color="#fff" />}
                  </View>
                  {i < ORDER_FLOW.length - 1 && (
                    <View style={[s.line, i < currentIndex && { backgroundColor: colors.primary }]} />
                  )}
                </View>
                <View style={{ flex: 1, paddingBottom: space.md }}>
                  <Text style={[s.stepLabel, !reached && { color: colors.muted }]}>{ORDER_STATUS[step].label}</Text>
                  {reached && at && <Text style={s.stepTime}>{formatTimestamp(at)}</Text>}
                </View>
              </View>
            );
          })
        )}
      </Card>

      <SectionTitle>Booking</SectionTitle>
      <Card style={{ marginBottom: space.lg }}>
        <Row icon="person-outline" label="Customer" value={b?.customer?.name} />
        <Row icon="call-outline" label="Phone" value={b?.customer?.phone} />
        <Row icon="car-outline" label="Car" value={b?.vehicle?.registrationNumber} />
        <Row icon="water-outline" label="Service" value={b?.service?.name} />
        <Row icon="car-sport-outline" label="Vehicle use" value={b ? (isTaxiBooking(b) ? 'Taxi' : 'Private') : undefined} />
        <Row icon="cash-outline" label="Price" value={b && bookingAmount(b) !== undefined ? formatMoney(bookingAmount(b), config?.currency) : undefined} />
        <Row
          icon="calendar-outline"
          label="Slot"
          value={b ? `${formatDay(b.bookingDate)}, ${formatClock(b.startTime)}–${formatClock(b.endTime)}` : undefined}
        />
        {!!b?.notes && <Row icon="document-text-outline" label="Notes" value={b.notes} />}
      </Card>

      {canUpdate && isActiveOrder(order.status) && (
        <Button
          title="Cancel job"
          variant="danger"
          icon="close-circle-outline"
          onPress={onCancel}
          loading={busy === 'cancel'}
          disabled={busy !== null}
        />
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  reg: { fontSize: 24, fontWeight: '800', color: colors.text, letterSpacing: 0.8 },
  muted: { color: colors.muted, fontSize: 15, marginTop: 2 },
  doneBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: space.lg,
    backgroundColor: colors.successSoft,
    padding: space.md,
    borderRadius: 10,
  },
  step: { flexDirection: 'row', gap: space.md },
  stepRail: { alignItems: 'center', width: 22 },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: { width: 2, flex: 1, backgroundColor: colors.border, marginVertical: 2 },
  stepLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  stepTime: { fontSize: 13, color: colors.muted, marginTop: 2 },
});
