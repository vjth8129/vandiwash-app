import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView } from 'react-native';

import { errorMessage, rolesApi, usersApi } from '@/api';
import { RolePicker } from '@/components/RolePicker';
import { space } from '@/components/theme';
import { toast } from '@/components/Toast';
import { Button, Loading, SectionTitle, TextField, PasswordField } from '@/components/ui';
import { useQuery } from '@/hooks/useQuery';
import { PASSWORD_RULES } from '@/lib/password';
import { emailError, firstError, nameError, newPasswordError, phoneError, usernameError } from '@/lib/validation';

export default function NewUserScreen() {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [roleId, setRoleId] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const roles = useQuery(() => rolesApi.list().then((r) => r.items));

  const errors = {
    name: nameError(name, 'full name'),
    phone: phoneError(phone),
    username: usernameError(username),
    password: newPasswordError(password),
    email: emailError(email),
    role: roleId ? null : 'Choose a role for this user.',
  };
  const shown = (key: keyof typeof errors) => (showErrors ? errors[key] : null);

  const save = async () => {
    setShowErrors(true);
    const problem = firstError(errors);
    if (problem || !roleId) return toast.error(problem ?? 'Choose a role for this user.');
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
        <TextField
          label="Full name *"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          maxLength={150}
          error={shown('name')}
        />
        <TextField
          label="Mobile number *"
          value={phone}
          onChangeText={(t) => setPhone(t.replace(/[^\d+\s-]/g, ''))}
          keyboardType="phone-pad"
          autoComplete="tel"
          placeholder="e.g. 98765 43210"
          maxLength={18}
          error={shown('phone')}
          hint="They sign in to the app with this number."
        />
        <TextField
          label="Username *"
          value={username}
          onChangeText={(t) => setUsername(t.replace(/\s/g, ''))}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={100}
          error={shown('username')}
          hint="Shown on their profile. Also works for signing in."
        />
        <PasswordField
          label="Temporary password *"
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
          autoCorrect={false}
          hint={`${PASSWORD_RULES} Share it privately — they’ll choose their own when they first sign in.`}
          error={shown('password')}
        />
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          error={shown('email')}
        />

        <SectionTitle>Role</SectionTitle>
        {roles.loading ? <Loading /> : <RolePicker roles={roles.data ?? []} value={roleId} onChange={setRoleId} />}

        <Button title="Create user" icon="person-add" onPress={save} loading={saving} style={{ marginTop: space.lg }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
