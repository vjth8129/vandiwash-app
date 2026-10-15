import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, router } from 'expo-router';
import { useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, errorMessage } from '@/api';
import { useAuth } from '@/auth/AuthContext';
import { AccountField, accountError, toAccountIdentifier, type AccountMode } from '@/components/AccountField';
import { colors, radius, space } from '@/components/theme';
import { toast } from '@/components/Toast';
import { Button, PasswordField } from '@/components/ui';
import { firstError } from '@/lib/validation';

export default function LoginScreen() {
  const { signIn, carWashNotice } = useAuth();
  const [mode, setMode] = useState<AccountMode>('phone');
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const errors = {
    account: accountError(mode, account),
    password: password ? null : 'Enter your password.',
  };

  const submit = async () => {
    setShowErrors(true);
    const problem = firstError(errors);
    if (problem) return toast.error(problem);
    setSubmitting(true);
    try {
      await signIn(toAccountIdentifier(mode, account), password);
      // Protected routes switch to the app automatically once signed in.
    } catch (e) {
      setSubmitting(false);
      if (e instanceof ApiError && e.code === 'CAR_WASH_PENDING') return router.push('/pending');
      // Suspended / deactivated car washes get a banner (from carWashNotice) rather than a toast.
      if (!(e instanceof ApiError && e.code.startsWith('CAR_WASH_'))) toast.error(errorMessage(e));
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* "padding" on Android too: with edge-to-edge the window no longer resizes for the keyboard. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
          <Image source={require('../../assets/logo.png')} style={s.logo} accessibilityIgnoresInvertColors />
          <Text style={s.title}>Vahanly</Text>
          <Text style={s.subtitle}>Sign in to manage today&apos;s washes</Text>

          {carWashNotice && carWashNotice.code !== 'CAR_WASH_PENDING' && (
            <View style={s.notice} accessibilityRole="alert">
              <Ionicons
                name={carWashNotice.code === 'CAR_WASH_SUSPENDED' ? 'pause-circle' : 'alert-circle'}
                size={22}
                color={colors.danger}
              />
              <View style={{ flex: 1 }}>
                <Text style={s.noticeTitle}>
                  {carWashNotice.code === 'CAR_WASH_SUSPENDED' ? 'Account suspended' : 'Car wash not active'}
                </Text>
                <Text style={s.noticeText}>{carWashNotice.message}</Text>
              </View>
            </View>
          )}

          <AccountField
            mode={mode}
            onModeChange={setMode}
            value={account}
            onChangeText={setAccount}
            error={showErrors ? errors.account : null}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <PasswordField
            ref={passwordRef}
            label="Password"
            value={password}
            onChangeText={setPassword}
            error={showErrors ? errors.password : null}
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

          <View style={s.signup}>
            <Text style={s.signupText}>New car wash on Vahanly?</Text>
            <Link href="/signup" style={[s.link, { marginTop: 0 }]}>
              Sign up your car wash
            </Link>
          </View>
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
  notice: {
    flexDirection: 'row',
    gap: space.md,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.lg,
  },
  noticeTitle: { color: colors.danger, fontWeight: '700', fontSize: 15, marginBottom: 2 },
  noticeText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  signup: {
    alignItems: 'center',
    marginTop: space.xl,
    paddingTop: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  signupText: { color: colors.muted, fontSize: 14 },
});
