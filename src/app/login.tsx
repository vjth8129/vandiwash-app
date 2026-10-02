import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { errorMessage } from '@/api';
import { useAuth } from '@/auth/AuthContext';
import { AccountField, toAccountIdentifier, type AccountMode } from '@/components/AccountField';
import { colors, space } from '@/components/theme';
import { toast } from '@/components/Toast';
import { Button, PasswordField } from '@/components/ui';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [mode, setMode] = useState<AccountMode>('phone');
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const submit = async () => {
    if (!account.trim() || !password) {
      toast.error(mode === 'phone' ? 'Enter your mobile number and password.' : 'Enter your username and password.');
      return;
    }
    setSubmitting(true);
    try {
      await signIn(toAccountIdentifier(mode, account), password);
      // Protected routes switch to the app automatically once signed in.
    } catch (e) {
      toast.error(errorMessage(e));
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* "padding" on Android too: with edge-to-edge the window no longer resizes for the keyboard. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
          <Image source={require('../../assets/logo.png')} style={s.logo} accessibilityIgnoresInvertColors />
          <Text style={s.title}>VandiWash</Text>
          <Text style={s.subtitle}>Sign in to manage today&apos;s washes</Text>

          <AccountField
            mode={mode}
            onModeChange={setMode}
            value={account}
            onChangeText={setAccount}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <PasswordField
            ref={passwordRef}
            label="Password"
            value={password}
            onChangeText={setPassword}
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
            placeholder="Password"
          />

          <Button title="Sign in" onPress={submit} loading={submitting} style={{ marginTop: space.sm }} />

          <Link href="/forgot-password" style={s.link}>
            Forgot password?
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: space.xl, maxWidth: 480, width: '100%', alignSelf: 'center' },
  logo: { width: 104, height: 104, alignSelf: 'center', marginBottom: space.lg },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 15, color: colors.muted, textAlign: 'center', marginTop: 4, marginBottom: space.xl },
  link: { color: colors.primary, fontWeight: '600', textAlign: 'center', marginTop: space.lg, padding: space.sm },
});
