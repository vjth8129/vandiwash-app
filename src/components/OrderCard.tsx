import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import type { Order } from '@/api';
import { formatClock, formatDay, formatMoney, ORDER_STATUS } from '@/lib/format';
import { bookingAmount, bookingCategory, isDefaultCategory, serviceNames } from '@/lib/pricing';
import { colors, space } from './theme';
import { Badge, Button, Card } from './ui';

type Props = {
  order: Order;
  currency?: string;
  onPress: () => void;
  /** Quick action for the next workflow step (shown on active jobs). */
  nextAction?: { label: string; onPress: () => void; loading?: boolean };
};

export const PAID_BADGE = { label: 'Paid', color: colors.success, bg: colors.successSoft };
export const UNPAID_BADGE = { label: 'Not paid', color: colors.danger, bg: colors.dangerSoft };

export function OrderCard({ order, currency, onPress, nextAction }: Props) {
  const b = order.booking;
  const meta = ORDER_STATUS[order.status];
  const category = b ? bookingCategory(b) : null;
  return (
    <Card onPress={onPress} style={{ marginBottom: space.md }}>
      <View style={s.top}>
        <View style={{ flex: 1 }}>
          <Text style={s.reg}>{b?.vehicle?.registrationNumber ?? 'Vehicle'}</Text>
          <Text style={s.customer}>{b?.customer?.name ?? ''}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Badge {...meta} />
          {category && !isDefaultCategory(category) && <Badge label={category.name} color="#7A4B00" bg="#FFE9B8" />}
          {order.status === 'COMPLETED' && (
            <Badge {...(order.paidAt ? PAID_BADGE : UNPAID_BADGE)} />
          )}
        </View>
      </View>
      <View style={s.meta}>
        <View style={s.metaItem}>
          <Ionicons name="water-outline" size={15} color={colors.muted} />
          <Text style={[s.metaText, { flexShrink: 1 }]} numberOfLines={2}>
            {b ? serviceNames(b) : 'Service'}
          </Text>
        </View>
        {b && bookingAmount(b) !== undefined && <Text style={s.price}>{formatMoney(bookingAmount(b), currency)}</Text>}
      </View>
      {b?.bookingDate && (
        <View style={s.metaItem}>
          <Ionicons name="time-outline" size={15} color={colors.muted} />
          <Text style={s.metaText}>
            {formatDay(b.bookingDate)} · {formatClock(b.startTime)}
          </Text>
        </View>
      )}
      {nextAction && (
        <Button
          title={nextAction.label}
          onPress={nextAction.onPress}
          loading={nextAction.loading}
          style={{ marginTop: space.md, minHeight: 42 }}
        />
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  reg: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: 0.5 },
  customer: { fontSize: 14, color: colors.muted, marginTop: 2 },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space.md,
    marginBottom: 4,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  metaText: { fontSize: 14, color: colors.text },
  price: { fontSize: 15, fontWeight: '700', color: colors.text },
});
