import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text } from 'react-native';

import { authApi, errorMessage } from '@/api';
import { AccountField, toAccountIdentifier, type AccountMode } from '@/components/AccountField';
import { colors, space } from '@/components/theme';
import { toast } from '@/components/Toast';
import { Button, Card, TextField, PasswordField } from '@/components/ui';
import { PASSWORD_RULES } from '@/lib/password';

// Two steps, matching the API: request a code for the account, then redeem it.
export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<'request' | 'reset' | 'done'>('request');
  const [mode, setMode] = useState<AccountMode>('phone');
  const [account, setAccount] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, next: typeof step) => {
    setBusy(true);
    try {
      await fn();
      setStep(next);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () =>
    run(async () => {
      await authApi.forgotPassword(toAccountIdentifier(mode, account));
      setNotice(`If ${account.trim()} has an account, a reset code has been sent.`);
    }, 'reset');

  const reset = () => {
    if (newPassword !== confirmPassword) {
      toast.error('The two passwords don’t match.');
      return;
    }
    run(() => authApi.resetPassword(toAccountIdentifier(mode, account), code.trim(), newPassword), 'done');
  };

  return (
    <ScrollView contentContainerStyle={{ padding: space.xl }} keyboardShouldPersistTaps="handled">
      {step === 'request' && (
        <>
          <Text style={{ color: colors.muted, marginBottom: space.lg, fontSize: 15 }}>
            Enter the mobile number you sign in with and we’ll send you a reset code.
          </Text>
          <AccountField mode={mode} onModeChange={setMode} value={account} onChangeText={setAccount} />
          <Button title="Send code" loading={busy} disabled={!account.trim()} onPress={sendCode} />
        </>
      )}

      {step === 'reset' && (
        <>
          {notice && <Text style={{ color: colors.muted, marginBottom: space.lg, fontSize: 15 }}>{notice}</Text>}
          <TextField
            label="Reset code"
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, ''))}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="6-digit code"
            hint={__DEV__ ? 'Testing: 1111 works on development servers.' : undefined}
          />
          <PasswordField
            label="New password"
            value={newPassword}
            onChangeText={setNewPassword}
            autoCapitalize="none"
            hint={PASSWORD_RULES}
          />
          <PasswordField
            label="Confirm new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            autoCapitalize="none"
          />
          <Button
            title="Set new password"
            loading={busy}
            disabled={code.length < 4 || !newPassword || !confirmPassword}
            onPress={reset}
          />
          <Button
            title="Send a new code"
            variant="ghost"
            onPress={() => {
              setCode('');
              sendCode();
            }}
            disabled={busy}
            style={{ marginTop: space.sm }}
          />
        </>
      )}

      {step === 'done' && (
        <Card>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: space.sm }}>
            Password updated
          </Text>
          <Text style={{ color: colors.muted, marginBottom: space.lg }}>You can now sign in with your new password.</Text>
          <Button title="Back to sign in" onPress={() => router.back()} />
        </Card>
      )}
    </ScrollView>
  );
}
