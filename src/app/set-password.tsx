import { SafeAreaView } from 'react-native-safe-area-context';

import { ChangePasswordForm } from '@/components/ChangePasswordForm';
import { colors } from '@/components/theme';

/**
 * First sign-in after an admin set the password: the user must choose their own before the
 * app opens. Only reachable while mustChangePassword is set (see the root layout's guards).
 */
export default function SetPasswordScreen() {
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ChangePasswordForm forced />
    </SafeAreaView>
  );
}
