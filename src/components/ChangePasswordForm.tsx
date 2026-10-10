import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { errorMessage } from '@/api';
import { useAuth } from '@/auth/AuthContext';
import { PASSWORD_RULES } from '@/lib/password';
import { confirmPasswordError, firstError, newPasswordError } from '@/lib/validation';
import { colors, space } from './theme';
import { toast } from './Toast';
import { Button, PasswordField } from './ui';

type Props = {
  /** First sign-in with an admin-set password: shown full screen with a greeting and Log out. */
  forced: boolean;
  /** Called once the password was changed (not used when forced — the route guard moves on). */
  onDone?: () => void;
};

/**
 * Change your own password. Layout depends only on `forced` (a prop, not auth state), so the
 * screen doesn't rearrange itself while the app navigates away after a successful change.
 */
export function ChangePasswordForm({ forced, onDone }: Props) {
  const { user, changePassword, signOut } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmNext, setConfirmNext] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const nextRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const errors = {
    current: current ? null : forced ? 'Enter the password you were given.' : 'Enter your current password.',
    next: newPasswordError(next) ?? (next && next === current ? 'Choose a password different from the current one.' : null),
    confirm: confirmPasswordError(next, confirmNext),
  };

  const submit = async () => {
    if (saving) return;
    setShowErrors(true);
    const problem = firstError(errors);
    if (problem) return toast.error(problem);
    Keyboard.dismiss();
    setSaving(true);
    try {
      await changePassword(current, next);
      if (forced) {
        // The set-password route's guard turns off and Expo Router opens the app.
        toast.success('Welcome! Use your new password next time you sign in.', { title: 'Password set' });
      } else {
        toast.success('Use your new password next time you sign in.', { title: 'Password changed' });
        setSaving(false);
        onDone?.();
      }
    } catch (e) {
      toast.error(errorMessage(e));
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior="padding">
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        {forced && (
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
          label={forced ? 'Password you were given' : 'Current password'}
          value={current}
          onChangeText={setCurrent}
          error={showErrors ? errors.current : null}
          returnKeyType="next"
          onSubmitEditing={() => nextRef.current?.focus()}
        />
        <PasswordField
          ref={nextRef}
          label="New password"
          value={next}
          onChangeText={setNext}
          error={showErrors ? errors.next : null}
          returnKeyType="next"
          onSubmitEditing={() => confirmRef.current?.focus()}
          hint={PASSWORD_RULES}
        />
        <PasswordField
          ref={confirmRef}
          label="Confirm new password"
          value={confirmNext}
          onChangeText={setConfirmNext}
          error={showErrors ? errors.confirm : null}
          returnKeyType="go"
          onSubmitEditing={submit}
        />

        <Button title="Save new password" icon="checkmark" onPress={submit} loading={saving} style={{ marginTop: space.sm }} />
        {forced && <Button title="Log out" variant="ghost" onPress={signOut} disabled={saving} style={{ marginTop: space.md }} />}
      </ScrollView>
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
