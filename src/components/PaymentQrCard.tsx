import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { errorMessage, paymentQrApi } from '@/api';
import { useQuery } from '@/hooks/useQuery';
import { confirm } from '@/lib/confirm';
import { formatTimestamp } from '@/lib/format';
import { pickQrImage } from '@/lib/paymentQr';
import { colors, radius, space } from './theme';
import { toast } from './Toast';
import { Button, Card, Loading, TextField } from './ui';

/** Owner-only: upload, replace or remove the QR every staff member shows from the Pay tab. */
export function PaymentQrCard() {
  const qr = useQuery(() => paymentQrApi.get(), []);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<'upload' | 'note' | 'remove' | null>(null);
  const savedNote = qr.data?.note ?? '';
  const noteValue = note ?? savedNote;

  const run = async (kind: NonNullable<typeof busy>, fn: () => Promise<void>) => {
    setBusy(kind);
    try {
      await fn();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const upload = () =>
    run('upload', async () => {
      const image = await pickQrImage();
      if (!image) return;
      qr.setData(await paymentQrApi.set(image, noteValue.trim() || undefined));
      setNote(null);
      toast.success('Staff can now show it from the Pay tab.', { title: 'Payment QR saved' });
    });

  const saveNote = () =>
    run('note', async () => {
      if (!qr.data) return;
      qr.setData(await paymentQrApi.set(qr.data.image, noteValue.trim() || undefined));
      setNote(null);
      toast.success('The note under the QR was updated.', { title: 'Saved' });
    });

  const remove = () =>
    run('remove', async () => {
      if (!(await confirm('Remove payment QR?', 'Staff won’t be able to show a QR to customers until you upload one again.', 'Remove', true))) return;
      await paymentQrApi.remove();
      qr.setData(null);
      setNote(null);
    });

  return (
    <Card style={{ marginBottom: space.xl }}>
      {qr.loading ? (
        <Loading />
      ) : (
        <>
          <View style={s.row}>
            {qr.data ? (
              <Image source={{ uri: qr.data.image }} style={s.thumb} resizeMode="contain" accessibilityLabel="Current payment QR" />
            ) : (
              <View style={[s.thumb, s.placeholder]}>
                <Text style={s.placeholderText}>No QR</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{qr.data ? 'Payment QR is live' : 'Add your payment QR'}</Text>
              <Text style={s.sub}>
                {qr.data
                  ? `Everyone at your car wash can show it from the Pay tab. Updated ${formatTimestamp(qr.data.updatedAt)}.`
                  : 'Upload the UPI or bank QR from your payments app (a screenshot works). Staff show it from the Pay tab.'}
              </Text>
            </View>
          </View>
          <TextField
            label="Note under the QR (optional)"
            value={noteValue}
            onChangeText={setNote}
            placeholder="e.g. UPI ID: sparkle@okicici"
            maxLength={100}
            autoCapitalize="none"
          />
          <View style={s.actions}>
            <Button
              title={qr.data ? 'Replace QR' : 'Upload QR'}
              icon="cloud-upload-outline"
              onPress={upload}
              loading={busy === 'upload'}
              disabled={busy !== null}
              style={{ flex: 1 }}
            />
            {qr.data && noteValue !== savedNote && (
              <Button title="Save note" variant="secondary" onPress={saveNote} loading={busy === 'note'} disabled={busy !== null} style={{ flex: 1 }} />
            )}
          </View>
          {qr.data && (
            <Button title="Remove QR" variant="ghost" onPress={remove} loading={busy === 'remove'} disabled={busy !== null} style={{ marginTop: space.sm }} />
          )}
        </>
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md, marginBottom: space.md, alignItems: 'center' },
  thumb: { width: 84, height: 84, borderRadius: radius.md, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
  placeholder: { alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' },
  placeholderText: { fontSize: 12, fontWeight: '700', color: colors.muted },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  sub: { fontSize: 13, color: colors.muted, marginTop: 2, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: space.sm },
});
