import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { bookingsApi, errorMessage, ordersApi, type Booking, type Order, type OrderStatus } from '@/api';
import { useAuth } from '@/auth/AuthContext';
import { OrderCard } from '@/components/OrderCard';
import { colors, space } from '@/components/theme';
import { Badge, Button, Card, Chip, EmptyState, Fab, Loading, Segmented } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { notify } from '@/lib/confirm';
import { bookingAmount } from '@/lib/pricing';
import {
  BOOKING_STATUS,
  formatClock,
  formatDay,
  formatMoney,
  isActiveOrder,
  NEXT_STEP,
  ORDER_STATUS,
} from '@/lib/format';

type Tab = 'active' | 'bookings' | 'done';
const ACTIVE_FILTERS: (OrderStatus | 'ALL')[] = ['ALL', 'CREATED', 'WASHING', 'READY'];

export default function JobsScreen() {
  const { can, config } = useAuth();
  const currency = config?.currency;
  const [tab, setTab] = useState<Tab>('active');
  const [filter, setFilter] = useState<OrderStatus | 'ALL'>('ALL');
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, loading, refreshing, refresh, reload } = useQuery(async () => {
    const [orders, bookings] = await Promise.all([
      ordersApi.list({ limit: 100 }),
      can('BOOKINGS_VIEW') ? bookingsApi.list({ limit: 100 }) : Promise.resolve({ items: [] as Booking[] }),
    ]);
    return { orders: orders.items, bookings: bookings.items };
  });

  const { active, done, awaiting, counts } = useMemo(() => {
    const orders = data?.orders ?? [];
    const withOrder = new Set(orders.map((o) => o.bookingId));
    const byNewest = (a: Order, b: Order) => b.updatedAt.localeCompare(a.updatedAt);
    const active = orders.filter((o) => isActiveOrder(o.status)).sort(byNewest);
    const counts = Object.fromEntries(
      ACTIVE_FILTERS.map((f) => [f, f === 'ALL' ? active.length : active.filter((o) => o.status === f).length]),
    ) as Record<OrderStatus | 'ALL', number>;
    return {
      active,
      counts,
      done: orders.filter((o) => !isActiveOrder(o.status)).sort(byNewest),
      awaiting: (data?.bookings ?? [])
        .filter((b) => (b.status === 'PENDING' || b.status === 'CONFIRMED') && !withOrder.has(b.id))
        .sort((a, b) => `${a.bookingDate}${a.startTime}`.localeCompare(`${b.bookingDate}${b.startTime}`)),
    };
  }, [data]);

  const advance = async (order: Order) => {
    const step = NEXT_STEP[order.status];
    if (!step) return;
    setBusyId(order.id);
    try {
      await ordersApi.setStatus(order.id, step.status);
      await reload();
    } catch (e) {
      notify('Could not update job', errorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const checkIn = async (booking: Booking) => {
    setBusyId(booking.id);
    try {
      const order = await ordersApi.checkIn(booking.id);
      await reload();
      router.push({ pathname: '/order/[id]', params: { id: order.id } });
    } catch (e) {
      notify('Could not add the car to the queue', errorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const canUpdate = can('ORDERS_UPDATE');
  const orders = tab === 'active' ? active.filter((o) => filter === 'ALL' || o.status === filter) : done;

  const header = (
    <View>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          ['active', `Active (${active.length})`],
          ['bookings', `Booked (${awaiting.length})`],
          ['done', 'Done'],
        ]}
      />
      {tab === 'active' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {ACTIVE_FILTERS.map((f) => (
            <Chip
              key={f}
              label={f === 'ALL' ? 'All' : ORDER_STATUS[f].label}
              count={counts[f]}
              selected={filter === f}
              onPress={() => setFilter(f)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );

  if (loading) return <Loading />;

  const refreshControl = <RefreshControl refreshing={refreshing} onRefresh={refresh} />;

  return (
    <View style={{ flex: 1 }}>
      {tab === 'bookings' ? (
        <FlatList
          data={awaiting}
          keyExtractor={(b) => b.id}
          contentContainerStyle={s.list}
          ListHeaderComponent={header}
          refreshControl={refreshControl}
          ListEmptyComponent={
            <EmptyState icon="calendar-outline" title="No upcoming bookings" message="Booked cars that haven't arrived yet show here." />
          }
          renderItem={({ item: b }) => (
            <Card style={{ marginBottom: space.md }}>
              <View style={s.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={s.reg}>{b.vehicle?.registrationNumber}</Text>
                  <Text style={s.muted}>{b.customer?.name}</Text>
                </View>
                <Badge {...BOOKING_STATUS[b.status]} />
              </View>
              <View style={[s.rowBetween, { marginTop: space.md }]}>
                <Text style={s.text}>
                  {b.service?.name} · {formatDay(b.bookingDate)} {formatClock(b.startTime)}
                </Text>
                {bookingAmount(b) !== undefined && <Text style={s.price}>{formatMoney(bookingAmount(b), currency)}</Text>}
              </View>
              {can('ORDERS_CREATE') && (
                <Button
                  title="Car arrived · add to queue"
                  icon="log-in-outline"
                  onPress={() => checkIn(b)}
                  loading={busyId === b.id}
                  style={{ marginTop: space.md, minHeight: 42 }}
                />
              )}
            </Card>
          )}
        />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          contentContainerStyle={s.list}
          ListHeaderComponent={header}
          refreshControl={refreshControl}
          ListEmptyComponent={
            tab === 'active' ? (
              <EmptyState icon="water-outline" title="No active jobs" message="Tap “New wash” to add a car to a service." />
            ) : (
              <EmptyState icon="checkmark-done-outline" title="Nothing completed yet" />
            )
          }
          renderItem={({ item }) => {
            const step = NEXT_STEP[item.status];
            return (
              <OrderCard
                order={item}
                currency={currency}
                onPress={() => router.push({ pathname: '/order/[id]', params: { id: item.id } })}
                nextAction={
                  canUpdate && step
                    ? { label: step.action, onPress: () => advance(item), loading: busyId === item.id }
                    : undefined
                }
              />
            );
          }}
        />
      )}
      {can('BOOKINGS_CREATE') && can('ORDERS_CREATE') && (
        <Fab icon="add" label="New wash" onPress={() => router.push('/wash/new')} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  list: { padding: space.lg, paddingBottom: 100 },
  chips: { gap: space.sm, paddingBottom: space.md },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  reg: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: 0.5 },
  muted: { color: colors.muted, fontSize: 14, marginTop: 2 },
  text: { color: colors.text, fontSize: 14, flex: 1 },
  price: { fontWeight: '700', color: colors.text },
});
