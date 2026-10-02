import { Stack } from 'expo-router';

import { BottomInset } from '@/components/BottomInset';
import { colors } from '@/components/theme';

export default function AppLayout() {
  return (
    <Stack
      // Keep pushed screens above the Android navigation bar; (tabs) handles it itself.
      screenLayout={({ children, route }) =>
        route.name === '(tabs)' ? <>{children}</> : <BottomInset>{children}</BottomInset>
      }
      screenOptions={{
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text, fontWeight: '700' },
        headerBackTitle: 'Back',
        contentStyle: { backgroundColor: colors.bg },
      }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="order/[id]" options={{ title: 'Job details' }} />
      <Stack.Screen name="wash/new" options={{ title: 'New wash' }} />
      <Stack.Screen name="user/new" options={{ title: 'Add user' }} />
      <Stack.Screen name="user/[id]" options={{ title: 'User' }} />
      <Stack.Screen name="role/[id]" options={{ title: 'Role' }} />
      <Stack.Screen name="service/[id]" options={{ title: 'Service' }} />
    </Stack>
  );
}
