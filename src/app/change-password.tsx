import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { errorMessage } from '@/api';
import { useAuth } from '@/auth/AuthContext';
import { colors, space } from '@/components/theme';
import { toast } from '@/components/Toast';
import { Button, PasswordField } from '@/components/ui';
import { PASSWORD_RULES } from '@/lib/password';

/**
 * Change your own password. Forced (no way back into the app) when an admin set the
 * password; otherwise opened from Profile.
 */
export default function ChangePasswordScreen() {
  const { user, mustChangePassword, changePassword, signOut } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmNext, setConfirmNext] = useState('');
  const [saving, setSaving] = useState(false);
  const nextRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const submit = async () => {
    if (!current || !next) return toast.error('Fill in your current and new password.');
    if (next !== confirmNext) return toast.error('The two new passwords don’t match.');
    if (next === current) return toast.error('Choose a password different from the current one.');
    setSaving(true);
    try {
      const wasForced = mustChangePassword;
      await changePassword(current, next);
      if (wasForced) {
        // First sign-in done: go into the app.
        router.replace('/');
      } else {
        toast.success('Use your new password next time you sign in.', { title: 'Password changed' });
        router.back();
      }
    } catch (e) {
      toast.error(errorMessage(e));
      setSaving(false);
    }
  };

  const form = (
    <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
      {mustChangePassword && (
        <View style={{ alignItems: 'center', marginBottom: space.xl }}>
          <View style={s.icon}>
            <Ionicons name="key-outline" size={34} color="#fff" />
          </View>
          <Text style={s.title}>Choose your own password</Text>
          <Text style={s.subtitle}>
            Hi {user?.name?.split(' ')[0] ?? 'there'} — you signed in with a temporary password. Pick your own to
            continue.
          </Text>
        </View>
      )}

      <PasswordField
        label={mustChangePassword ? 'Password you were given' : 'Current password'}
        value={current}
        onChangeText={setCurrent}
        autoCapitalize="none"
        returnKeyType="next"
        onSubmitEditing={() => nextRef.current?.focus()}
      />
      <PasswordField
        ref={nextRef}
        label="New password"
        value={next}
        onChangeText={setNext}
        autoCapitalize="none"
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
        hint={PASSWORD_RULES}
      />
      <PasswordField
        ref={confirmRef}
        label="Confirm new password"
        value={confirmNext}
        onChangeText={setConfirmNext}
        autoCapitalize="none"
        returnKeyType="go"
        onSubmitEditing={submit}
      />

      <Button title="Save new password" icon="checkmark" onPress={submit} loading={saving} style={{ marginTop: space.sm }} />
      {mustChangePassword && (
        <Button title="Log out" variant="ghost" onPress={signOut} style={{ marginTop: space.md }} />
      )}
    </ScrollView>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior="padding">
      {mustChangePassword ? <SafeAreaView edges={['top']} style={{ flex: 1 }}>{form}</SafeAreaView> : form}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: space.xl, maxWidth: 480, width: '100%', alignSelf: 'center' },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.lg,
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 15, color: colors.muted, textAlign: 'center', marginTop: 6 },
});
