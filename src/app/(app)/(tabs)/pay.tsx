import { router } from 'expo-router';
import { Image, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { paymentQrApi } from '@/api';
import { useAuth } from '@/auth/AuthContext';
import { colors, radius, space } from '@/components/theme';
import { Button, EmptyState, Loading } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';

/** Full-screen payment QR that staff turn around and show the customer. */
export default function PayScreen() {
  const { user, can } = useAuth();
  const qr = useQuery(() => paymentQrApi.get(), [], { staleMs: 5 * 60_000 });
  const { width, height } = useWindowDimensions();
  // As large as fits, leaving room for the heading and note; capped so tablets don't overdo it.
  const size = Math.min(width - space.xl * 2 - space.lg * 2, height * 0.55, 520);

  if (qr.loading) return <Loading />;

  return (
    <ScrollView
      contentContainerStyle={s.container}
      refreshControl={<RefreshControl refreshing={qr.refreshing} onRefresh={qr.refresh} />}>
      {qr.data ? (
        <View style={s.card}>
          <Text style={s.scan}>Scan to pay</Text>
          <Text style={s.name}>{user?.carWash?.name}</Text>
          <Image
            source={{ uri: qr.data.image }}
            style={{ width: size, height: size, marginTop: space.lg }}
            resizeMode="contain"
            accessibilityLabel={`Payment QR code for ${user?.carWash?.name ?? 'this car wash'}`}
          />
          {qr.data.note ? (
            <View style={s.note}>
              <Text style={s.noteText} selectable>
                {qr.data.note}
              </Text>
            </View>
          ) : null}
        </View>
      ) : (
        <EmptyState
          icon="qr-code-outline"
          title="No payment QR yet"
          message={
            can('CAR_WASH_UPDATE')
              ? 'Upload your UPI or bank QR code so staff can show it to customers.'
              : 'Ask the owner to upload the car wash’s payment QR from their Profile.'
          }
          action={
            can('CAR_WASH_UPDATE') ? (
              <Button title="Upload payment QR" icon="cloud-upload-outline" onPress={() => router.push('/profile')} />
            ) : undefined
          }
        />
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: space.xl },
  card: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: radius.lg + 8,
    padding: space.lg,
    paddingTop: space.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  scan: { fontSize: 14, fontWeight: '700', color: colors.primary, textTransform: 'uppercase', letterSpacing: 1 },
  name: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 4, textAlign: 'center' },
  note: {
    marginTop: space.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  noteText: { fontSize: 16, fontWeight: '700', color: colors.primaryDark },
});
