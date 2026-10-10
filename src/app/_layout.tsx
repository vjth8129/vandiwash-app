import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Text, View } from 'react-native';

import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { BottomInset } from '@/components/BottomInset';
import { colors } from '@/components/theme';
import { ToastHost } from '@/components/Toast';
import { Button, EmptyState } from '@/components/ui';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <RootNavigator />
      <ToastHost />
    </AuthProvider>
  );
}

function RootNavigator() {
  const { status, retry, signOut, bootError, mustChangePassword } = useAuth();

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hide();
  }, [status]);

  if (status === 'loading') return null; // splash stays visible

  if (status === 'offline') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg, padding: 24 }}>
        <EmptyState
          icon="cloud-offline-outline"
          title="Can't reach the server"
          message={bootError ?? 'Check your internet connection and try again.'}
          action={
            <>
              <Button title="Try again" onPress={retry} />
              <Text style={{ height: 12 }} />
              <Button title="Log out" variant="ghost" onPress={signOut} />
            </>
          }
        />
      </View>
    );
  }

  const signedIn = status === 'signedIn';
  return (
    <Stack
      // (app) and login handle the bottom inset themselves (tab bar / SafeAreaView).
      screenLayout={({ children, route }) =>
        route.name === '(app)' || route.name === 'login' ? (
          <>{children}</>
        ) : (
          <BottomInset>{children}</BottomInset>
        )
      }
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      {/* An admin-set password must be replaced before the rest of the app opens. */}
      {/* Separate screens for forced and voluntary changes: when the forced change succeeds,
          set-password's guard turns off and the router redirects into (app) by itself. */}
      <Stack.Protected guard={signedIn && !mustChangePassword}>
        <Stack.Screen name="(app)" />
        <Stack.Screen
          name="change-password"
          options={{ headerShown: true, title: 'Change password', headerBackTitle: 'Back' }}
        />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && mustChangePassword}>
        <Stack.Screen name="set-password" options={{ gestureEnabled: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" />
        <Stack.Screen
          name="forgot-password"
          options={{ headerShown: true, title: 'Reset password', headerBackTitle: 'Back' }}
        />
      </Stack.Protected>
    </Stack>
  );
}
