import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView } from 'react-native';

import { errorMessage, rolesApi, usersApi } from '@/api';
import { RolePicker } from '@/components/RolePicker';
import { space } from '@/components/theme';
import { toast } from '@/components/Toast';
import { Button, Loading, SectionTitle, TextField, PasswordField } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';

export default function NewUserScreen() {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [roleId, setRoleId] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const roles = useQuery(() => rolesApi.list().then((r) => r.items));

  const save = async () => {
    if (!name.trim() || !username.trim()) return toast.error('Enter a name and username.');
    if (phone.replace(/\D/g, '').length < 10) return toast.error('Enter their mobile number — they sign in with it.');
    if (!password) return toast.error('Enter a temporary password.');
    if (!roleId) return toast.error('Choose a role for this user.');
    setSaving(true);
    try {
      const user = await usersApi.create({
        name: name.trim(),
        username: username.trim(),
        password,
        roleId,
        email: email.trim() || undefined,
        phone: phone.trim(),
      });
      router.replace({ pathname: '/user/[id]', params: { id: user.id } });
    } catch (e) {
      toast.error(errorMessage(e));
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <SectionTitle>Details</SectionTitle>
        <TextField label="Full name *" value={name} onChangeText={setName} autoCapitalize="words" />
        <TextField
          label="Mobile number *"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          placeholder="e.g. 98765 43210"
          hint="They sign in to the app with this number."
        />
        <TextField
          label="Username *"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          hint="Shown on their profile. Also works for signing in."
        />
        <PasswordField
          label="Temporary password *"
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
          autoCorrect={false}
          hint="Share it privately. They’ll be asked to choose their own password when they first sign in."
        />
        <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

        <SectionTitle>Role</SectionTitle>
        {roles.loading ? <Loading /> : <RolePicker roles={roles.data ?? []} value={roleId} onChange={setRoleId} />}

        <Button title="Create user" icon="person-add" onPress={save} loading={saving} style={{ marginTop: space.lg }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
