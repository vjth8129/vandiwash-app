import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { promotionsApi, type Promotion } from '@/api';
import { colors, radius, space } from '@/components/theme';
import { Badge, Button, Card, EmptyState, Fab, Loading } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { formatTimestamp } from '@/lib/format';
import { channelLabel, formatWhen, previewMessage, PROMOTION_STATUS } from '@/lib/promotions';

/** Every promotion, newest first, with how far its sending has got. */
export default function PromotionsScreen() {
  const { data, loading, refreshing, refresh, reload } = useQuery(() => promotionsApi.list({ limit: 100 }), []);
  const items = data?.items ?? [];

  // While something is going out (or is about to), keep the statuses moving.
  useEffect(() => {
    const busy = items.some(
      (p) => p.status === 'SENDING' || (p.status === 'SCHEDULED' && new Date(p.scheduledAt).getTime() < Date.now() + 60_000),
    );
    if (!busy) return;
    const t = setInterval(reload, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (loading) return <Loading />;

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListEmptyComponent={
          <EmptyState
            icon="megaphone-outline"
            title="No promotions yet"
            message="Pick a group of customers — say, last week’s Basic Wash customers — and send them an offer now or at a time you choose."
            action={<Button title="Create promotion" icon="add" onPress={() => router.push('/promotion/new')} />}
          />
        }
        renderItem={({ item }) => <PromotionCard p={item} />}
      />
      {items.length > 0 && <Fab icon="add" label="Create promotion" onPress={() => router.push('/promotion/new')} />}
    </View>
  );
}

function PromotionCard({ p }: { p: Promotion }) {
  const meta = PROMOTION_STATUS[p.status];
  const reachable = p.recipientCount - p.skippedCount;
  const done = p.sentCount + p.failedCount;
  const when =
    p.status === 'SCHEDULED'
      ? `Sends ${formatWhen(new Date(p.scheduledAt))}`
      : p.status === 'SENDING'
        ? `Sending… ${done} of ${reachable}`
        : p.status === 'CANCELLED'
          ? `Cancelled ${formatTimestamp(p.cancelledAt)}`
          : `${p.status === 'FAILED' ? 'Tried' : 'Sent'} ${formatTimestamp(p.finishedAt ?? p.scheduledAt)}`;

  return (
    <Card style={s.card} onPress={() => router.push({ pathname: '/promotion/[id]', params: { id: p.id } })}>
      <View style={s.head}>
        <Text style={s.title} numberOfLines={1}>
          {p.title}
        </Text>
        <Badge label={meta.label} color={meta.color} bg={meta.bg} />
      </View>
      <Text style={s.message} numberOfLines={2}>
        {previewMessage(p.message, 'Customer')}
      </Text>

      {(p.status === 'SENDING' || p.status === 'SENT' || p.status === 'FAILED') && reachable > 0 && (
        <View style={s.track}>
          <View style={[s.fill, { flex: p.sentCount, backgroundColor: colors.success }]} />
          <View style={[s.fill, { flex: p.failedCount, backgroundColor: colors.danger }]} />
          <View style={{ flex: Math.max(0, reachable - done) }} />
        </View>
      )}

      <View style={s.metaRow}>
        <Meta icon={meta.icon} text={when} />
      </View>
      <View style={s.metaRow}>
        <Meta icon="people-outline" text={`${p.recipientCount} customer${p.recipientCount === 1 ? '' : 's'}`} />
        <Meta icon={p.channel === 'SMS' ? 'chatbox-outline' : 'logo-whatsapp'} text={channelLabel(p.channel)} />
        {p.status === 'SENT' || p.status === 'FAILED' ? (
          <Meta icon="checkmark-done" text={`${p.sentCount} sent${p.failedCount ? ` · ${p.failedCount} failed` : ''}`} />
        ) : null}
      </View>
      {p.audienceLabel ? (
        <Text style={s.audience} numberOfLines={1}>
          {p.audienceLabel}
        </Text>
      ) : null}
    </Card>
  );
}

function Meta({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  return (
    <View style={s.meta}>
      <Ionicons name={icon} size={14} color={colors.muted} />
      <Text style={s.metaText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  list: { padding: space.lg, paddingBottom: 96, flexGrow: 1 },
  card: { marginBottom: space.md, gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.text },
  message: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  track: { flexDirection: 'row', height: 6, borderRadius: radius.pill, backgroundColor: colors.primarySoft, overflow: 'hidden', marginTop: 2 },
  fill: { height: 6 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.md, rowGap: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 13, color: colors.muted },
  audience: { fontSize: 12, color: colors.primaryDark, fontWeight: '600' },
});
