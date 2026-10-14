import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { errorMessage, promotionsApi, type PromotionRecipient } from '@/api';
import { colors, radius, space } from '@/components/theme';
import { toast } from '@/components/Toast';
import { Badge, Button, Card, EmptyState, Loading, SectionTitle } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { confirm } from '@/lib/confirm';
import { formatPhone, formatTimestamp } from '@/lib/format';
import { channelLabel, formatWhen, previewMessage, PROMOTION_STATUS, RECIPIENT_STATUS } from '@/lib/promotions';

/** One promotion: what it says, who it went to, and how each message went. */
export default function PromotionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: p, loading, refreshing, refresh, reload, setData } = useQuery(() => promotionsApi.get(id), [id]);
  const [cancelling, setCancelling] = useState(false);

  // While it's going out (or about to), keep the counts moving.
  useEffect(() => {
    const busy = !!p && (p.status === 'SENDING' || (p.status === 'SCHEDULED' && new Date(p.scheduledAt).getTime() < Date.now() + 60_000));
    if (!busy) return;
    const t = setInterval(reload, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p]);

  if (loading) return <Loading />;
  if (!p) return <EmptyState icon="megaphone-outline" title="Promotion not found" message="It may have been removed." />;

  const meta = PROMOTION_STATUS[p.status];
  const reachable = p.recipientCount - p.skippedCount;
  const waiting = Math.max(0, reachable - p.sentCount - p.failedCount);

  const cancel = async () => {
    if (!(await confirm('Cancel this promotion?', 'It won’t be sent to anyone. This can’t be undone.', 'Cancel promotion', true))) return;
    setCancelling(true);
    try {
      setData(await promotionsApi.cancel(p.id));
      toast.success('Nothing will be sent.', { title: 'Promotion cancelled' });
    } catch (e) {
      toast.error(errorMessage(e));
      reload();
    } finally {
      setCancelling(false);
    }
  };

  const timeline: [string, string][] = [
    ['Created', `${formatTimestamp(p.createdAt)}${p.createdBy ? ` by ${p.createdBy.name}` : ''}`],
    // "Send now" promotions are scheduled for the moment they were created; no need to repeat it.
    ...(new Date(p.scheduledAt).getTime() - new Date(p.createdAt).getTime() > 60_000
      ? [[p.status === 'SCHEDULED' ? 'Goes out' : 'Scheduled for', formatWhen(new Date(p.scheduledAt))] as [string, string]]
      : []),
    ...(p.startedAt ? [['Started sending', formatTimestamp(p.startedAt)] as [string, string]] : []),
    ...(p.finishedAt ? [['Finished', formatTimestamp(p.finishedAt)] as [string, string]] : []),
    ...(p.cancelledAt ? [['Cancelled', formatTimestamp(p.cancelledAt)] as [string, string]] : []),
  ];

  return (
    <ScrollView contentContainerStyle={s.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <Card style={s.hero}>
        <View style={s.statusRow}>
          <Ionicons name={meta.icon} size={18} color={meta.color} />
          <Badge label={meta.label} color={meta.color} bg={meta.bg} />
          <Text style={s.channel}>
            {channelLabel(p.channel)}
          </Text>
        </View>
        <Text style={s.title}>{p.title}</Text>
        {p.audienceLabel ? <Text style={s.audience}>{p.audienceLabel}</Text> : null}

        <View style={s.stats}>
          <Stat label="Customers" value={p.recipientCount} />
          <Stat label="Sent" value={p.sentCount} color={colors.success} />
          <Stat label="Failed" value={p.failedCount} color={p.failedCount ? colors.danger : undefined} />
          <Stat label={p.status === 'CANCELLED' ? 'Not sent' : 'Waiting'} value={waiting} />
        </View>
        {reachable > 0 && (
          <View style={s.track}>
            <View style={{ flex: p.sentCount, backgroundColor: colors.success }} />
            <View style={{ flex: p.failedCount, backgroundColor: colors.danger }} />
            <View style={{ flex: waiting }} />
          </View>
        )}
        {p.skippedCount > 0 && (
          <Text style={s.note}>
            {p.skippedCount} customer{p.skippedCount === 1 ? ' has' : 's have'} no phone number and {p.skippedCount === 1 ? 'was' : 'were'} skipped.
          </Text>
        )}
      </Card>

      {p.deliveryMode === 'console' && (
        <View style={s.testBanner}>
          <Ionicons name="flask-outline" size={18} color="#7A4B00" />
          <Text style={s.testText}>
            Test mode: the server logged these messages, but no SMS/WhatsApp provider is connected yet, so customers didn’t actually receive them.
          </Text>
        </View>
      )}

      <Card style={s.section}>
        <SectionTitle>Message</SectionTitle>
        <View style={[s.bubble, p.channel === 'SMS' && { backgroundColor: '#E9EEF6' }]}>
          <Text style={s.bubbleText}>{previewMessage(p.message, p.recipients[0]?.name)}</Text>
        </View>
        {p.message.includes('{name}') && <Text style={s.note}>Shown for {p.recipients[0]?.name ?? 'a customer'}; each customer sees their own first name.</Text>}
      </Card>

      <Card style={s.section}>
        <SectionTitle>Timeline</SectionTitle>
        {timeline.map(([label, value]) => (
          <View key={label} style={s.timelineRow}>
            <Text style={s.timelineLabel}>{label}</Text>
            <Text style={s.timelineValue}>{value}</Text>
          </View>
        ))}
      </Card>

      {p.status === 'SCHEDULED' && (
        <Button
          title="Cancel promotion"
          icon="close-circle-outline"
          variant="secondary"
          onPress={cancel}
          loading={cancelling}
          style={{ marginTop: space.md }}
        />
      )}

      <View style={{ marginTop: space.lg }}>
        <SectionTitle>Customers ({p.recipients.length})</SectionTitle>
      </View>
      {p.recipients.map((r) => (
        <RecipientRow key={r.id} r={r} />
      ))}
    </ScrollView>
  );
}

function RecipientRow({ r }: { r: PromotionRecipient }) {
  const meta = RECIPIENT_STATUS[r.status];
  return (
    <Card style={s.recipient}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={s.name} numberOfLines={1}>
          {r.name}
        </Text>
        <Text style={s.sub}>{formatPhone(r.phone) || 'No phone number'}</Text>
        {r.status === 'SENT' && r.sentAt ? <Text style={s.sub}>{formatTimestamp(r.sentAt)}</Text> : null}
        {r.error && r.status !== 'SKIPPED' ? (
          <Text style={[s.sub, { color: colors.danger }]} numberOfLines={2}>
            {r.error}
          </Text>
        ) : null}
      </View>
      <Badge label={meta.label} color={meta.color} bg={meta.bg} />
    </Card>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[s.statValue, color ? { color } : null]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  list: { padding: space.lg, paddingBottom: 32 },
  hero: { gap: 6 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  channel: { marginLeft: 'auto', fontSize: 13, fontWeight: '600', color: colors.muted },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  audience: { fontSize: 13, color: colors.primaryDark, fontWeight: '600' },
  stats: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 12, color: colors.muted },
  track: { flexDirection: 'row', height: 8, borderRadius: radius.pill, backgroundColor: colors.primarySoft, overflow: 'hidden', marginTop: space.sm },
  note: { fontSize: 12, color: colors.muted, marginTop: space.xs },
  testBanner: {
    flexDirection: 'row',
    gap: space.sm,
    backgroundColor: '#FFF4D6',
    borderRadius: radius.md,
    padding: space.md,
    marginTop: space.md,
  },
  testText: { flex: 1, fontSize: 13, color: '#7A4B00', lineHeight: 18 },
  section: { marginTop: space.md },
  bubble: { alignSelf: 'flex-start', maxWidth: '95%', backgroundColor: '#DCF8C6', borderRadius: radius.md, padding: space.md },
  bubbleText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  timelineRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md, paddingVertical: 6 },
  timelineLabel: { fontSize: 14, color: colors.muted },
  timelineValue: { fontSize: 14, color: colors.text, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  recipient: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.sm, paddingVertical: space.md },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  sub: { fontSize: 13, color: colors.muted },
});
