import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorMessage, ordersApi, paymentQrApi, type Order, type PaymentMethod } from '@/api';
import { useQuery } from '@/hooks/useQuery';
import { formatMoney } from '@/lib/format';
import { bookingAmount } from '@/lib/pricing';
import { colors, radius, space } from './theme';
import { toast } from './Toast';
import { Button } from './ui';

type Props = {
  /** The job being paid for; the sheet is open while this is set. */
  order: Order | null;
  currency?: string;
  onClose: () => void;
  onPaid: (order: Order) => void;
};

/**
 * Shown when a wash is completed: the car wash's payment QR for the customer to scan, and
 * buttons to note how they paid. The app doesn't take payments — this only records them.
 */
export function PaymentSheet({ order, currency, onClose, onPaid }: Props) {
  const qr = useQuery(() => paymentQrApi.get(), [], { staleMs: 5 * 60_000 });
  const [saving, setSaving] = useState<PaymentMethod | null>(null);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const size = Math.min(width - space.xl * 2, height * 0.42, 360);

  const amount = order?.totalAmount ?? (order?.booking ? bookingAmount(order.booking) : undefined);

  const record = async (method: PaymentMethod) => {
    if (!order) return;
    setSaving(method);
    try {
      const updated = await ordersApi.recordPayment(order.id, method);
      toast.success(`${formatMoney(amount, currency)} received by ${method === 'UPI' ? 'UPI' : 'cash'}.`, {
        title: 'Payment noted',
      });
      onPaid({ ...order, ...updated, booking: updated.booking ?? order.booking });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(null);
    }
  };

  return (
    <Modal visible={!!order} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[s.sheet, { paddingBottom: space.xl + insets.bottom }]}>
        <ScrollView contentContainerStyle={{ alignItems: 'center' }} bounces={false}>
          <View style={s.headRow}>
            <Text style={s.title}>Collect payment</Text>
            <Ionicons name="close" size={24} color={colors.muted} onPress={onClose} accessibilityLabel="Close" />
          </View>
          <Text style={s.reg}>{order?.booking?.vehicle?.registrationNumber}</Text>
          {amount !== undefined && <Text style={s.amount}>{formatMoney(amount, currency)}</Text>}

          {qr.loading ? (
            <ActivityIndicator style={{ marginVertical: space.xl }} color={colors.primary} />
          ) : qr.data ? (
            <View style={s.qrCard}>
              <Text style={s.scan}>Scan to pay</Text>
              <Image
                source={{ uri: qr.data.image }}
                style={{ width: size, height: size, marginTop: space.sm }}
                resizeMode="contain"
                accessibilityLabel="Payment QR code"
              />
              {qr.data.note ? <Text style={s.note}>{qr.data.note}</Text> : null}
            </View>
          ) : (
            <Text style={s.noQr}>
              No payment QR uploaded yet — the owner can add one from Profile. You can still note a cash or UPI payment.
            </Text>
          )}

          <Text style={s.hint}>Once the customer has paid, note how:</Text>
          <View style={s.actions}>
            <Button
              title="Paid by UPI"
              icon="qr-code-outline"
              onPress={() => record('UPI')}
              loading={saving === 'UPI'}
              disabled={saving !== null}
              style={{ flex: 1 }}
            />
            <Button
              title="Paid cash"
              icon="cash-outline"
              variant="secondary"
              onPress={() => record('CASH')}
              loading={saving === 'CASH'}
              disabled={saving !== null}
              style={{ flex: 1 }}
            />
          </View>
          <Button title="Not paid yet" variant="ghost" onPress={onClose} disabled={saving !== null} style={{ alignSelf: 'stretch' }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,27,45,0.4)' },
  sheet: {
    maxHeight: '92%',
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space.lg,
  },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', alignSelf: 'stretch' },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  reg: { fontSize: 15, fontWeight: '700', color: colors.muted, marginTop: space.md, letterSpacing: 0.5 },
  amount: { fontSize: 34, fontWeight: '800', color: colors.text, marginTop: 2 },
  qrCard: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    marginTop: space.md,
  },
  scan: { fontSize: 13, fontWeight: '700', color: colors.primary, textTransform: 'uppercase', letterSpacing: 1 },
  note: { marginTop: space.sm, fontSize: 15, fontWeight: '700', color: colors.primaryDark },
  noQr: { color: colors.muted, textAlign: 'center', marginVertical: space.lg, fontSize: 14 },
  hint: { color: colors.muted, fontSize: 13, marginTop: space.lg, marginBottom: space.sm },
  actions: { flexDirection: 'row', gap: space.sm, alignSelf: 'stretch', marginBottom: space.sm },
});
