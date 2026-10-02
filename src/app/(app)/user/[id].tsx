import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { errorMessage, rolesApi, USER_STATUSES, usersApi, type User, type UserStatus } from '@/api';
import { useAuth } from '@/auth/AuthContext';
import { RolePicker } from '@/components/RolePicker';
import { colors, space } from '@/components/theme';
import { toast } from '@/components/Toast';
import { Badge, Button, Card, Chip, EmptyState, Loading, Row, SectionTitle, TextField, PasswordField } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { confirm } from '@/lib/confirm';
import { formatPhone, formatTimestamp } from '@/lib/format';
import { roleLabel, USER_STATUS } from '@/lib/roles';

export default function UserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { can, user: me } = useAuth();
  const isSelf = me?.id === id;
  const canEdit = can('USERS_UPDATE');

  const user = useQuery(() => usersApi.get(id), [id]);
  const roles = useQuery(() => (canEdit ? rolesApi.list().then((r) => r.items) : Promise.resolve([])));

  if (user.loading) return <Loading />;
  if (!user.data) {
    return (
      <EmptyState
        icon="person-outline"
        title={user.error ? 'Couldn’t load this user' : 'User not found'}
        action={user.error ? <Button title="Try again" onPress={user.refresh} /> : undefined}
      />
    );
  }

  return (
    <UserEditor
      key={user.data.id}
      user={user.data}
      roles={roles.data ?? []}
      isSelf={isSelf}
      canEdit={canEdit}
      canDelete={can('USERS_DELETE') && !isSelf}
      onChanged={(u) => user.setData({ ...user.data!, ...u })}
    />
  );
}

type EditorProps = {
  user: User;
  roles: Awaited<ReturnType<typeof rolesApi.list>>['items'];
  isSelf: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onChanged: (u: Partial<User>) => void;
};

function UserEditor({ user, roles, isSelf, canEdit, canDelete, onChanged }: EditorProps) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email ?? '');
  const [phone, setPhone] = useState(user.phone ?? '');
  const [roleId, setRoleId] = useState(user.roleId);
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const dirty =
    name.trim() !== user.name ||
    email.trim() !== (user.email ?? '') ||
    phone.trim() !== (user.phone ?? '') ||
    roleId !== user.roleId;

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const saveDetails = () =>
    run('save', async () => {
      if (!name.trim()) throw new Error('Name is required.');
      if (user.phone && !phone.trim()) throw new Error('Mobile number is required — they sign in with it.');
      const updated = await usersApi.update(user.id, {
        name: name.trim(),
        email: email.trim() || null,
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        ...(roleId !== user.roleId ? { roleId } : {}),
      });
      const role = roles.find((r) => r.id === roleId);
      onChanged({ ...updated, role: updated.role ?? (role ? { id: role.id, name: role.name } : user.role) });
      toast.success(`${name.trim()}'s details were updated.`, { title: 'Saved' });
    });

  const changeStatus = (status: UserStatus) =>
    run('status', async () => {
      if (status !== 'ACTIVE') {
        const ok = await confirm(
          `${status === 'SUSPENDED' ? 'Suspend' : 'Deactivate'} ${user.name}?`,
          `${user.name} won't be able to sign in until reactivated.`,
          USER_STATUS[status].label,
          true,
        );
        if (!ok) return;
      }
      const updated = await usersApi.setStatus(user.id, status);
      onChanged({ status: updated?.status ?? status });
    });

  const resetPassword = () =>
    run('password', async () => {
      if (!newPassword) throw new Error('Enter a new password.');
      await usersApi.resetPassword(user.id, newPassword);
      setNewPassword('');
      toast.success(`Share the new password with ${user.name} privately. They’ll be asked to change it when they next sign in.`, {
        title: 'Password reset',
      });
    });

  const remove = () =>
    run('delete', async () => {
      if (!(await confirm('Remove user?', `${user.name} will lose access to the app.`, 'Remove', true))) return;
      await usersApi.remove(user.id);
      router.back();
    });

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Card style={{ marginBottom: space.xl }}>
          <View style={s.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{user.name}</Text>
              <Text style={s.sub}>{user.phone ? `${formatPhone(user.phone)} · @${user.username}` : `@${user.username}`}</Text>
            </View>
            <Badge {...USER_STATUS[user.status]} />
          </View>
          <Row icon="shield-checkmark-outline" label="Role" value={roleLabel(user.role?.name)} />
          <Row icon="time-outline" label="Last login" value={user.lastLoginAt ? formatTimestamp(user.lastLoginAt) : 'Never'} />
        </Card>

        {canEdit && (
          <>
            <SectionTitle>Details</SectionTitle>
            <TextField label="Full name" value={name} onChangeText={setName} autoCapitalize="words" />
            <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <TextField
              label="Mobile number"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
              hint="They sign in with this number."
            />

            <SectionTitle>Role</SectionTitle>
            {isSelf && <Text style={[s.sub, { marginBottom: space.sm }]}>You can’t change your own role.</Text>}
            <RolePicker roles={roles} value={roleId} onChange={setRoleId} disabled={isSelf} />

            <Button
              title="Save changes"
              icon="checkmark"
              onPress={saveDetails}
              loading={busy === 'save'}
              disabled={!dirty || busy !== null}
              style={{ marginTop: space.md, marginBottom: space.xl }}
            />

            {!isSelf && (
              <>
                <SectionTitle>Account status</SectionTitle>
                <View style={[s.chips, { marginBottom: space.xl }]}>
                  {USER_STATUSES.map((st) => (
                    <Chip
                      key={st}
                      label={USER_STATUS[st].label}
                      selected={user.status === st}
                      onPress={() => user.status !== st && busy === null && changeStatus(st)}
                    />
                  ))}
                </View>
              </>
            )}

            <SectionTitle>Reset password</SectionTitle>
            <PasswordField
              label="New password"
              value={newPassword}
              onChangeText={setNewPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Button
              title="Set new password"
              variant="secondary"
              icon="key-outline"
              onPress={resetPassword}
              loading={busy === 'password'}
              disabled={!newPassword || busy !== null}
              style={{ marginBottom: space.xl }}
            />
          </>
        )}

        {canDelete && (
          <Button title="Remove user" variant="danger" icon="trash-outline" onPress={remove} loading={busy === 'delete'} disabled={busy !== null} />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, marginBottom: space.sm },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  sub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  chips: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
});
