import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import { colors } from '@/components/theme';
import type { IconName } from '@/components/ui';

type TabIconProps = { color: ColorValue; size: number };

function TabIcon({ name, color, size }: TabIconProps & { name: IconName }) {
  return <Ionicons name={name} size={size} color={color} />;
}

export default function TabsLayout() {
  const { can, config } = useAuth();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        headerTitleStyle: { color: colors.text, fontWeight: '700' },
        sceneStyle: { backgroundColor: colors.bg },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Jobs',
          headerTitle: config?.appName ?? 'Jobs',
          tabBarIcon: (p: TabIconProps) => <TabIcon name="clipboard-outline" {...p} />,
          href: can('ORDERS_VIEW') ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="pay"
        options={{
          title: 'Pay',
          headerTitle: 'Payment QR',
          tabBarIcon: (p: TabIconProps) => <TabIcon name="qr-code-outline" {...p} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          tabBarIcon: (p: TabIconProps) => <TabIcon name="bar-chart-outline" {...p} />,
          href: can('REPORTS_VIEW') && can('ORDERS_VIEW') ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: 'Services',
          tabBarIcon: (p: TabIconProps) => <TabIcon name="water-outline" {...p} />,
          href: can('SERVICES_VIEW') ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="team"
        options={{
          title: 'Team',
          tabBarIcon: (p: TabIconProps) => <TabIcon name="people-outline" {...p} />,
          href: can('USERS_VIEW') || can('ROLES_VIEW') ? undefined : null,
        }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: (p: TabIconProps) => <TabIcon name="person-circle-outline" {...p} /> }} />
    </Tabs>
  );
}
