import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { rolesApi, usersApi, type Role, type User } from '@/api';
import { useAuth } from '@/auth/AuthContext';
import { colors, space } from '@/components/theme';
import { Badge, Card, EmptyState, Fab, Loading, SearchBar, Segmented } from '@/components/ui';
import { useDebounced, useQuery } from '@/hooks/useQuery';
import { formatPhone } from '@/lib/format';
import { roleLabel, USER_STATUS } from '@/lib/roles';

type Tab = 'users' | 'roles';

export default function TeamScreen() {
  const { can, user: me } = useAuth();
  const [tab, setTab] = useState<Tab>(can('USERS_VIEW') ? 'users' : 'roles');
  const [search, setSearch] = useState('');
  const q = useDebounced(search);

  const users = useQuery(
    () => (tab === 'users' ? usersApi.list({ search: q, limit: 100 }).then((r) => r.items) : Promise.resolve(undefined)),
    [tab, q],
  );
  const roles = useQuery(
    () => (tab === 'roles' ? rolesApi.list().then((r) => r.items) : Promise.resolve(undefined)),
    [tab],
  );

  const tabs = [
    ...(can('USERS_VIEW') ? ([['users', 'Users']] as const) : []),
    ...(can('ROLES_VIEW') ? ([['roles', 'Roles & permissions']] as const) : []),
  ];

  const header = (
    <View style={{ marginBottom: space.md }}>
      {tabs.length > 1 && <Segmented value={tab} onChange={setTab} options={tabs} />}
      {tab === 'users' && <SearchBar value={search} onChangeText={setSearch} placeholder="Search name, mobile or username" autoCapitalize="none" />}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      {tab === 'users' ? (
        <FlatList<User>
          data={users.data ?? []}
          keyExtractor={(u) => u.id}
          contentContainerStyle={s.list}
          ListHeaderComponent={header}
          refreshControl={<RefreshControl refreshing={users.refreshing} onRefresh={users.refresh} />}
          ListEmptyComponent={users.loading || users.data === undefined ? <Loading /> : <EmptyState icon="people-outline" title="No users found" />}
          renderItem={({ item }) => (
            <Card style={s.card} onPress={() => router.push({ pathname: '/user/[id]', params: { id: item.id } })}>
              <View style={s.row}>
                <View style={s.avatar}>
                  <Text style={s.avatarText}>{initials(item.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>
                    {item.name}
                    {item.id === me?.id ? <Text style={s.you}>  (you)</Text> : null}
                  </Text>
                  <Text style={s.sub}>{item.phone ? formatPhone(item.phone) : `@${item.username}`}</Text>
                  <View style={[s.row, { marginTop: 6, gap: 6 }]}>
                    <Badge label={roleLabel(item.role?.name)} color={colors.primaryDark} bg={colors.primarySoft} />
                    {item.status !== 'ACTIVE' && <Badge {...USER_STATUS[item.status]} />}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.muted} />
              </View>
            </Card>
          )}
        />
      ) : (
        <FlatList<Role>
          data={roles.data ?? []}
          keyExtractor={(r) => r.id}
          contentContainerStyle={s.list}
          ListHeaderComponent={header}
          refreshControl={<RefreshControl refreshing={roles.refreshing} onRefresh={roles.refresh} />}
          ListEmptyComponent={roles.loading || roles.data === undefined ? <Loading /> : <EmptyState icon="shield-outline" title="No roles" />}
          renderItem={({ item }) => (
            <Card style={s.card} onPress={() => router.push({ pathname: '/role/[id]', params: { id: item.id } })}>
              <View style={s.row}>
                <View style={[s.avatar, { backgroundColor: colors.primarySoft }]}>
                  <Ionicons name="shield-checkmark-outline" size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{roleLabel(item.name)}</Text>
                  <Text style={s.sub}>
                    {item.permissions.length} permission{item.permissions.length === 1 ? '' : 's'}
                    {item.isSystem ? (item.isCustomized ? ' · built-in, customised' : ' · built-in') : ' · custom'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.muted} />
              </View>
            </Card>
          )}
        />
      )}
      {tab === 'users' && can('USERS_CREATE') && (
        <Fab icon="person-add" label="Add user" onPress={() => router.push('/user/new')} />
      )}
      {tab === 'roles' && can('ROLES_CREATE') && (
        <Fab icon="add" label="New role" onPress={() => router.push({ pathname: '/role/[id]', params: { id: 'new' } })} />
      )}
    </View>
  );
}

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const s = StyleSheet.create({
  list: { padding: space.lg, paddingBottom: 100 },
  card: { marginBottom: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '800' },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  you: { fontSize: 13, color: colors.muted, fontWeight: '500' },
  sub: { fontSize: 13, color: colors.muted, marginTop: 2 },
});
