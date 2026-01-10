import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';

type TabIconName = React.ComponentProps<typeof Ionicons>['name'];

function TabBarIcon({ name, color, focused }: { name: TabIconName; color: string; focused: boolean }) {
  return (
    <Ionicons
      name={name}
      size={24}
      color={color}
      style={{ opacity: focused ? 1 : 0.7 }}
    />
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#ed7411', // forge-500
        tabBarInactiveTintColor: isDark ? '#808fb0' : '#607296', // steel-400/500
        tabBarStyle: {
          backgroundColor: isDark ? '#1e232f' : '#ffffff',
          borderTopColor: isDark ? '#3e4965' : '#d3d8e4',
          borderTopWidth: 1,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          paddingTop: 8,
          height: Platform.OS === 'ios' ? 88 : 64,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: isDark ? '#1e232f' : '#ffffff',
        },
        headerTintColor: isDark ? '#f6f7f9' : '#1e232f',
        headerTitleStyle: {
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'home' : 'home-outline'} color={color} focused={focused} />
          ),
          headerTitle: 'Forged',
        }}
      />
      <Tabs.Screen
        name="program"
        options={{
          title: 'Program',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'calendar' : 'calendar-outline'} color={color} focused={focused} />
          ),
          headerTitle: 'Training Program',
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'time' : 'time-outline'} color={color} focused={focused} />
          ),
          headerTitle: 'Workout History',
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analytics',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'stats-chart' : 'stats-chart-outline'} color={color} focused={focused} />
          ),
          headerTitle: 'Analytics',
        }}
      />
    </Tabs>
  );
}
