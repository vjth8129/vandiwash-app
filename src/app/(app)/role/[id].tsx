import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { errorMessage, permissionsApi, rolesApi, type Permission, type Role } from '@/api';
import { useAuth } from '@/auth/AuthContext';
import { colors, space } from '@/components/theme';
import { toast } from '@/components/Toast';
import { Button, Card, EmptyState, Loading, SectionTitle, TextField } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { confirm } from '@/lib/confirm';
import { groupByModule, roleLabel } from '@/lib/roles';

/** View / edit a role, or create one when id is "new". */
export default function RoleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { can } = useAuth();

  const data = useQuery(async () => {
    const [role, catalog] = await Promise.all([
      isNew ? Promise.resolve(null) : rolesApi.get(id),
      can('PERMISSIONS_VIEW') ? permissionsApi.list().then((r) => r.items) : Promise.resolve(null),
    ]);
    return { role, catalog };
  }, [id]);

  if (data.loading) return <Loading />;
  if (!data.data || (!isNew && !data.data.role)) {
    return (
      <EmptyState
        icon="shield-outline"
        title={data.error ? 'Couldn’t load this role' : 'Role not found'}
        action={data.error ? <Button title="Try again" onPress={data.refresh} /> : undefined}
      />
    );
  }
  const { role, catalog } = data.data;

  return (
    <>
      <Stack.Screen options={{ title: isNew ? 'New role' : roleLabel(role?.name) }} />
      <RoleEditor key={id} role={role} catalog={catalog ?? role?.permissions ?? []} />
    </>
  );
}

function RoleEditor({ role, catalog }: { role: Role | null; catalog: Permission[] }) {
  const { can, user } = useAuth();
  const mine = new Set(user?.permissions ?? []);
  const isNew = role === null;
  const isOwnRole = !!role && role.id === user?.role.id;
  const isSuperAdminRole = role?.name === 'SUPER_ADMIN';
  // Built-in roles: permissions only, per car wash. Nobody can edit their own role
  // (an owner could otherwise lock themselves out) or SUPER_ADMIN.
  const readOnly =
    isOwnRole || isSuperAdminRole || !(isNew ? can('ROLES_CREATE') : can('ROLES_UPDATE'));
  const editDetails = !readOnly && !role?.isSystem;

  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [selected, setSelected] = useState(() => new Set(role?.permissions.map((p) => p.id) ?? []));
  const [busy, setBusy] = useState<'save' | 'delete' | 'reset' | null>(null);

  const toggle = (permId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) next.delete(permId);
      else next.add(permId);
      return next;
    });

  const toggleModule = (items: Permission[]) => {
    const grantable = items.filter((p) => mine.has(p.key));
    const allOn = grantable.every((p) => selected.has(p.id));
    setSelected((prev) => {
      const next = new Set(prev);
      grantable.forEach((p) => (allOn ? next.delete(p.id) : next.add(p.id)));
      return next;
    });
  };

  const save = async () => {
    if (editDetails && !name.trim()) return toast.error('Give the role a name.');
    setBusy('save');
    try {
      const permissionIds = [...selected];
      if (isNew) {
        await rolesApi.create({ name: name.trim(), description: description.trim() || undefined, permissionIds });
      } else if (role.isSystem) {
        await rolesApi.update(role.id, { permissionIds });
      } else {
        await rolesApi.update(role.id, { name: name.trim(), description: description.trim() || undefined, permissionIds });
      }
      router.back();
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(null);
    }
  };

  const resetDefaults = async () => {
    if (!role || !(await confirm('Reset to default?', `${roleLabel(role.name)} will get its standard permissions back for your car wash.`, 'Reset'))) {
      return;
    }
    setBusy('reset');
    try {
      const updated = await rolesApi.reset(role.id);
      setSelected(new Set(updated.permissions.map((p) => p.id)));
      setBusy(null);
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!role || !(await confirm('Delete role?', 'Roles can only be deleted when no users are assigned to them.', 'Delete', true))) return;
    setBusy('delete');
    try {
      await rolesApi.remove(role.id);
      router.back();
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(null);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {(isOwnRole || isSuperAdminRole || role?.isSystem) && (
          <Card style={[s.note, { marginBottom: space.lg }]}>
            <Ionicons
              name={readOnly ? 'lock-closed-outline' : 'information-circle-outline'}
              size={18}
              color={colors.muted}
            />
            <Text style={s.noteText}>
              {isOwnRole
                ? 'This is your own role, so you can’t change its permissions.'
                : isSuperAdminRole
                  ? 'The platform administrator role can’t be changed.'
                  : role?.isCustomized
                    ? 'Built-in role, customised for your car wash. Changes apply only to your car wash.'
                    : 'Built-in role. Changes apply only to your car wash.'}
            </Text>
          </Card>
        )}

        {!editDetails ? (
          !!role?.description && <Text style={[s.sub, { marginBottom: space.lg }]}>{role.description}</Text>
        ) : (
          <>
            <TextField label="Role name *" value={name} onChangeText={setName} placeholder="e.g. Receptionist" />
            <TextField label="Description" value={description} onChangeText={setDescription} placeholder="Optional" />
          </>
        )}

        <SectionTitle right={<Text style={s.sub}>{selected.size} selected</Text>}>Permissions</SectionTitle>
        {groupByModule(catalog).map(({ module, items }) => (
          <Card key={module} style={{ marginBottom: space.md, paddingVertical: space.sm }}>
            <View style={s.moduleRow}>
              <Text style={s.module}>{module}</Text>
              {!readOnly && items.some((p) => mine.has(p.key)) && (
                <Text style={s.link} onPress={() => toggleModule(items)}>
                  {items.filter((p) => mine.has(p.key)).every((p) => selected.has(p.id)) ? 'None' : 'All'}
                </Text>
              )}
            </View>
            {items.map((p) => {
              const grantable = mine.has(p.key);
              return (
                <View key={p.id} style={s.permRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.permName, !grantable && !readOnly && { color: colors.muted }]}>{p.name}</Text>
                    {!!p.description && <Text style={s.sub}>{p.description}</Text>}
                    {!grantable && !readOnly && <Text style={s.sub}>You don’t have this permission</Text>}
                  </View>
                  <Switch
                    value={selected.has(p.id)}
                    onValueChange={() => toggle(p.id)}
                    // You can always remove a permission; you can only add ones you hold.
                    disabled={readOnly || (!grantable && !selected.has(p.id))}
                    trackColor={{ true: colors.primary }}
                  />
                </View>
              );
            })}
          </Card>
        ))}

        {!readOnly && (
          <Button
            title={isNew ? 'Create role' : 'Save role'}
            icon="checkmark"
            onPress={save}
            loading={busy === 'save'}
            disabled={busy !== null}
            style={{ marginTop: space.md }}
          />
        )}
        {!readOnly && role?.isSystem && role.isCustomized && (
          <Button
            title="Reset to default permissions"
            variant="secondary"
            icon="refresh-outline"
            onPress={resetDefaults}
            loading={busy === 'reset'}
            disabled={busy !== null}
            style={{ marginTop: space.md }}
          />
        )}
        {!isNew && !role.isSystem && can('ROLES_DELETE') && (
          <Button
            title="Delete role"
            variant="danger"
            icon="trash-outline"
            onPress={remove}
            loading={busy === 'delete'}
            disabled={busy !== null}
            style={{ marginTop: space.md }}
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  note: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: '#EEF1F5' },
  noteText: { flex: 1, color: colors.muted, fontSize: 14 },
  moduleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: space.sm },
  module: { fontSize: 15, fontWeight: '800', color: colors.text },
  link: { color: colors.primary, fontWeight: '700' },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  permName: { fontSize: 15, fontWeight: '600', color: colors.text },
  sub: { fontSize: 12, color: colors.muted, marginTop: 2 },
});
