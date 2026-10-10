import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { servicesApi, type ServiceStatus } from '@/api';
import { useAuth } from '@/auth/AuthContext';
import { colors, space } from '@/components/theme';
import { Card, EmptyState, Fab, Loading, SearchBar, Segmented } from '@/components/ui';
import { useDebounced, useQuery } from '@/hooks/useQuery';
import { useVehicleCategories } from '@/hooks/useVehicleCategories';
import { formatDuration, formatMoney } from '@/lib/format';
import { hasOwnRate, isDefaultCategory, rateFor } from '@/lib/pricing';

export default function ServicesScreen() {
  const { config, can } = useAuth();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ServiceStatus>('ACTIVE');
  const q = useDebounced(search);

  const { data, loading, refreshing, refresh } = useQuery(
    () => servicesApi.list({ status, limit: 100, search: q }).then((r) => r.items),
    [q, status],
  );

  const currency = config?.currency;
  const { categories } = useVehicleCategories();

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={data ?? []}
        keyExtractor={(x) => x.id}
        contentContainerStyle={{ padding: space.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListHeaderComponent={
          <View style={{ marginBottom: space.md }}>
            {can('SERVICES_UPDATE') && (
              <Segmented
                value={status}
                onChange={setStatus}
                options={[
                  ['ACTIVE', 'Active'],
                  ['INACTIVE', 'Inactive'],
                ]}
              />
            )}
            <SearchBar value={search} onChangeText={setSearch} placeholder="Search services" />
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <Loading />
          ) : (
            <EmptyState icon="water-outline" title={status === 'ACTIVE' ? 'No services found' : 'No inactive services'} />
          )
        }
        renderItem={({ item }) => (
          <Card
            style={{ marginBottom: space.md }}
            onPress={() => router.push({ pathname: '/service/[id]', params: { id: item.id } })}>
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{item.name}</Text>
                {!!item.description && (
                  <Text style={s.desc} numberOfLines={2}>
                    {item.description}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </View>
            <View style={s.rates}>
              {(categories.length ? categories : [null]).map((c) => (
                <View key={c?.id ?? 'base'} style={s.rate}>
                  <Text style={s.rateLabel} numberOfLines={1}>
                    {c?.name ?? 'Rate'}
                  </Text>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={[s.price, c && !isDefaultCategory(c) && !hasOwnRate(item, c.id) && { color: colors.muted }]}>
                    {formatMoney(c ? rateFor(item, c.id) : item.price, currency)}
                  </Text>
                </View>
              ))}
              <View style={[s.rate, { alignItems: 'flex-end' }]}>
                <Text style={s.rateLabel}>Time</Text>
                <Text style={s.duration}>{formatDuration(item.durationMinutes)}</Text>
              </View>
            </View>
          </Card>
        )}
      />
      {can('SERVICES_CREATE') && (
        <Fab icon="add" label="Add service" onPress={() => router.push({ pathname: '/service/[id]', params: { id: 'new' } })} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { fontSize: 17, fontWeight: '700', color: colors.text },
  desc: { color: colors.muted, marginTop: 4, fontSize: 14 },
  rates: {
    flexDirection: 'row',
    gap: space.xs,
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rate: { flex: 1, minWidth: 0 },
  rateLabel: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  price: { fontSize: 17, fontWeight: '800', color: colors.primary, marginTop: 2 },
  duration: { fontSize: 15, fontWeight: '600', color: colors.text, marginTop: 3 },
});
