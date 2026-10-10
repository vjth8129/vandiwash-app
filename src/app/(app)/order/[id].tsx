import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { errorMessage, ordersApi, type Order, type OrderStatus } from '@/api';
import { useAuth } from '@/auth/AuthContext';
import { PAID_BADGE, UNPAID_BADGE } from '@/components/OrderCard';
import { PaymentSheet } from '@/components/PaymentSheet';
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
import { bookingAmount, bookingCategory, bookingItems, serviceNames } from '@/lib/pricing';

const STEP_TIME: Partial<Record<OrderStatus, keyof Order>> = {
  CREATED: 'createdAt',
  WASHING: 'washStartedAt',
  READY: 'readyAt',
  COMPLETED: 'completedAt',
};

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { can, config } = useAuth();
  const [busy, setBusy] = useState<'advance' | 'cancel' | 'unpay' | null>(null);
  const [paying, setPaying] = useState<Order | null>(null);

  const { data: order, error, loading, refreshing, refresh, setData } = useQuery(() => ordersApi.get(id), [id]);

  const update = async (status: Parameters<typeof ordersApi.setStatus>[1], kind: 'advance' | 'cancel') => {
    if (!order) return;
    setBusy(kind);
    try {
      const updated = await ordersApi.setStatus(order.id, status);
      // Keep the booking details we already have if the PATCH response omits them.
      const next = { ...order, ...updated, booking: updated.booking ?? order.booking };
      setData(next);
      // Handing the car over: show the QR so the customer can pay right away.
      if (status === 'COMPLETED' && !next.paidAt) setPaying(next);
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
  const items = b ? bookingItems(b) : [];
  const total = order.totalAmount ?? (b ? bookingAmount(b) : undefined);
  const money = (v: string | number | null | undefined) => formatMoney(v, config?.currency);

  const undoPayment = async () => {
    if (!(await confirm('Undo payment?', 'The job will show as not paid.', 'Undo', true))) return;
    setBusy('unpay');
    try {
      const updated = await ordersApi.recordPayment(order.id, null);
      setData({ ...order, ...updated, booking: updated.booking ?? order.booking });
    } catch (e) {
      notify('Could not update payment', errorMessage(e));
    } finally {
      setBusy(null);
    }
  };
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
            <Text style={s.muted}>{b ? serviceNames(b) : ''}</Text>
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
        {order.status === 'COMPLETED' && !order.paidAt && canUpdate && (
          <Button
            title="Collect payment"
            icon="qr-code-outline"
            onPress={() => setPaying(order)}
            style={{ marginTop: space.md }}
          />
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
        <Row icon="car-sport-outline" label="Vehicle type" value={b ? bookingCategory(b).name : undefined} />
        <Row
          icon="calendar-outline"
          label="Slot"
          value={b ? `${formatDay(b.bookingDate)}, ${formatClock(b.startTime)}–${formatClock(b.endTime)}` : undefined}
        />
        {!!b?.notes && <Row icon="document-text-outline" label="Notes" value={b.notes} />}
      </Card>

      <SectionTitle>Services</SectionTitle>
      <Card style={{ marginBottom: space.lg }}>
        {items.map((item) => (
          <View key={item.id} style={s.itemRow}>
            <Text style={s.lineName}>{item.name}</Text>
            <Text style={s.linePrice}>{money(item.price)}</Text>
          </View>
        ))}
        <View style={[s.itemRow, s.totalLine]}>
          <Text style={s.totalLabel}>Total</Text>
          <Text style={s.totalValue}>{total !== undefined ? money(total) : '—'}</Text>
        </View>
        <View style={[s.itemRow, { marginTop: space.sm }]}>
          <Text style={s.muted}>
            {order.paidAt
              ? `Paid by ${order.paymentMethod === 'CASH' ? 'cash' : 'UPI'} · ${formatTimestamp(order.paidAt)}`
              : order.status === 'CANCELLED'
                ? 'Cancelled — nothing to pay'
                : 'Not paid yet'}
          </Text>
          {order.status !== 'CANCELLED' && <Badge {...(order.paidAt ? PAID_BADGE : UNPAID_BADGE)} />}
        </View>
        {canUpdate && order.status !== 'CANCELLED' && (
          order.paidAt ? (
            <Button
              title="Undo payment"
              variant="ghost"
              onPress={undoPayment}
              loading={busy === 'unpay'}
              disabled={busy !== null}
              style={{ marginTop: space.sm }}
            />
          ) : order.status !== 'COMPLETED' ? (
            <Button
              title="Customer paid already"
              variant="ghost"
              icon="cash-outline"
              onPress={() => setPaying(order)}
              style={{ marginTop: space.sm }}
            />
          ) : null
        )}
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

      <PaymentSheet
        order={paying}
        currency={config?.currency}
        onClose={() => setPaying(null)}
        onPaid={(paid) => {
          setData(paid);
          setPaying(null);
        }}
      />
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
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm, paddingVertical: 6 },
  lineName: { flex: 1, fontSize: 15, color: colors.text },
  linePrice: { fontSize: 15, fontWeight: '600', color: colors.text },
  totalLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, marginTop: 4, paddingTop: space.sm },
  totalLabel: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.text },
  totalValue: { fontSize: 18, fontWeight: '800', color: colors.text },
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
