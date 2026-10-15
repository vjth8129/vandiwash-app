import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthContext';
import { colors, radius, space } from '@/components/theme';
import { Button } from '@/components/ui';

/**
 * Shown right after a car wash signs up, and whenever its owner tries to sign in before the
 * Vahanly team has activated it.
 */
export default function PendingScreen() {
  const { name } = useLocalSearchParams<{ name?: string }>();
  const { clearCarWashNotice } = useAuth();

  const backToSignIn = () => {
    clearCarWashNotice();
    if (router.canGoBack()) router.back();
    else router.replace('/login');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={s.container}>
        <View style={s.icon}>
          <Ionicons name="time-outline" size={48} color={colors.primary} />
        </View>
        <Text style={s.title}>Your details are under review</Text>
        <Text style={s.body}>
          {name ? `Thanks for signing up ${name}! ` : 'Thanks for signing up! '}
          Our team is checking your details. Your account will be activated within 2 hours.
        </Text>
        <Text style={s.body}>Once it’s active, sign in with your mobile number and the password you chose.</Text>
        <Button title="Back to sign in" onPress={backToSignIn} style={{ marginTop: space.xl, alignSelf: 'stretch' }} />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: space.xl,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  icon: {
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xl,
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: space.md },
  body: { fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 22, marginBottom: space.sm },
});
