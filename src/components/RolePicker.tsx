import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import type { Role } from '@/api';
import { useAuth } from '@/auth/AuthContext';
import { canAssignRole, roleLabel } from '@/lib/roles';
import { colors, space } from './theme';
import { Card } from './ui';

type Props = {
  roles: Role[];
  value: string | undefined;
  onChange: (roleId: string) => void;
  disabled?: boolean;
};

/** Radio list of roles; roles with permissions the caller doesn't hold are shown but locked. */
export function RolePicker({ roles, value, onChange, disabled }: Props) {
  const { user } = useAuth();
  const mine = new Set(user?.permissions ?? []);

  return (
    <View>
      {roles.map((role) => {
        const allowed = canAssignRole(role, mine);
        const selected = role.id === value;
        const locked = disabled || !allowed;
        return (
          <Card
            key={role.id}
            onPress={locked ? undefined : () => onChange(role.id)}
            style={[s.option, selected && s.selected, !allowed && { opacity: 0.55 }]}>
            <Ionicons
              name={!allowed ? 'lock-closed-outline' : selected ? 'radio-button-on' : 'radio-button-off'}
              size={22}
              color={selected ? colors.primary : colors.muted}
            />
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{roleLabel(role.name)}</Text>
              <Text style={s.sub} numberOfLines={2}>
                {allowed
                  ? `${role.permissions.length} permissions${role.description && !role.isSystem ? ` · ${role.description}` : ''}`
                  : 'Has permissions you don’t have — can’t assign'}
              </Text>
            </View>
          </Card>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  option: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.sm, paddingVertical: space.md },
  selected: { borderColor: colors.primary, borderWidth: 1.5 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  sub: { fontSize: 13, color: colors.muted, marginTop: 2 },
});
