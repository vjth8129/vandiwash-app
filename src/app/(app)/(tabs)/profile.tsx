import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import { PaymentQrCard } from '@/components/PaymentQrCard';
import { colors, radius, space } from '@/components/theme';
import { Button, Card, Row, SectionTitle, type IconName } from '@/components/ui';
import { formatPhone } from '@/lib/format';

type Tone = { fg: string; bg: string; icon: IconName };

const ACTION_TONES: Record<string, Tone> = {
  VIEW: { fg: colors.primaryDark, bg: colors.primarySoft, icon: 'eye-outline' },
  CREATE: { fg: colors.success, bg: colors.successSoft, icon: 'add-circle-outline' },
  UPDATE: { fg: '#B54708', bg: '#FEF0C7', icon: 'create-outline' },
  DELETE: { fg: colors.danger, bg: colors.dangerSoft, icon: 'trash-outline' },
};
const NEUTRAL_TONE: Tone = { fg: colors.text, bg: '#EEF1F5', icon: 'checkmark-circle-outline' };
const ACTION_ORDER = Object.keys(ACTION_TONES);

/** Splits codes like ORDERS_UPDATE into module → actions; menu-only codes are hidden. */
function groupPermissions(codes: string[]) {
  const groups = new Map<string, string[]>();
  for (const code of codes) {
    if (code.startsWith('MENU_')) continue;
    const cut = code.lastIndexOf('_');
    const action = code.slice(cut + 1);
    // Codes without a known action suffix (e.g. SUPER_ADMIN) get their own group.
    const [module, label] = cut > 0 && action in ACTION_TONES ? [code.slice(0, cut), action] : ['OTHER', code];
    groups.set(module, [...(groups.get(module) ?? []), label]);
  }
  const rank = (a: string) => (ACTION_ORDER.includes(a) ? ACTION_ORDER.indexOf(a) : ACTION_ORDER.length);
  return [...groups.entries()]
    .sort(([a], [b]) => (a === 'OTHER' ? 1 : b === 'OTHER' ? -1 : a.localeCompare(b)))
    .map(([module, actions]) => [module, actions.sort((a, b) => rank(a) - rank(b))] as const);
}

const titleCase = (code: string) => code.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function ProfileScreen() {
  const { user, signOut, can } = useAuth();
  const initials = (user?.name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const permissionGroups = groupPermissions(user?.permissions ?? []);

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg }}>
      <View style={{ alignItems: 'center', marginBottom: space.xl }}>
        <View
          style={{
            width: 76,
            height: 76,
            borderRadius: 38,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800' }}>{initials}</Text>
        </View>
        <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, marginTop: space.md }}>{user?.name}</Text>
        <Text style={{ color: colors.muted }}>@{user?.username}</Text>
        {user?.carWash && (
          <View style={s.carWash}>
            <Ionicons name="business" size={14} color={colors.primaryDark} />
            <Text style={s.carWashText}>{user.carWash.name}</Text>
          </View>
        )}
      </View>

      <SectionTitle>Account</SectionTitle>
      <Card style={{ marginBottom: space.xl }}>
        <Row icon="shield-checkmark-outline" label="Role" value={user?.role.name} />
        <Row icon="business-outline" label="Car wash" value={user?.carWash?.name} />
        <Row icon="mail-outline" label="Email" value={user?.email} />
        <Row icon="call-outline" label="Mobile" value={formatPhone(user?.phone) || null} />
      </Card>

      {can('CAR_WASH_UPDATE') && (
        <>
          <SectionTitle>Payment QR</SectionTitle>
          <PaymentQrCard />
        </>
      )}

      <SectionTitle>What your role can do</SectionTitle>
      <Card style={{ marginBottom: space.xl }}>
        {permissionGroups.length === 0 ? (
          <Text style={{ color: colors.muted }}>—</Text>
        ) : (
          permissionGroups.map(([module, actions], i) => (
            <View key={module} style={[s.group, i > 0 && s.groupDivider]}>
              <Text style={s.module}>{titleCase(module)}</Text>
              <View style={s.chips}>
                {actions.map((action) => {
                  const tone = ACTION_TONES[action] ?? NEUTRAL_TONE;
                  return (
                    <View key={action} style={[s.chip, { backgroundColor: tone.bg }]}>
                      <Ionicons name={tone.icon} size={13} color={tone.fg} />
                      <Text style={[s.chipText, { color: tone.fg }]}>{titleCase(action)}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ))
        )}
      </Card>

      <Button
        title="Change password"
        variant="secondary"
        icon="key-outline"
        onPress={() => router.push('/change-password')}
        style={{ marginBottom: space.md }}
      />
      <Button title="Log out" variant="danger" icon="log-out-outline" onPress={signOut} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  carWash: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: space.sm,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  carWashText: { fontSize: 13, fontWeight: '700', color: colors.primaryDark },
  group: { paddingVertical: space.sm },
  groupDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  module: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  chipText: { fontSize: 12, fontWeight: '700' },
});
