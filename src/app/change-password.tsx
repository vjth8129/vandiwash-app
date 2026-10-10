import { router } from 'expo-router';

import { ChangePasswordForm } from '@/components/ChangePasswordForm';

/** Change your own password, opened from Profile. */
export default function ChangePasswordScreen() {
  return <ChangePasswordForm forced={false} onDone={() => router.back()} />;
}
