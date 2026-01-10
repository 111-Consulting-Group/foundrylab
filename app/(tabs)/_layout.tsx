import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { Platform, TouchableOpacity, Alert } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import { useLogout } from '@/hooks/useAuth';

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
  const logoutMutation = useLogout();

  const handleLogout = () => {
    console.log('Logout button clicked');
    
    if (Platform.OS === 'web') {
      // On web, use window.confirm for better compatibility
      const confirmed = window.confirm('Are you sure you want to log out?');
      if (confirmed) {
        console.log('User confirmed logout (web), calling mutation');
        logoutMutation.mutate();
      } else {
        console.log('Logout cancelled (web)');
      }
    } else {
      // On native, use Alert.alert
      Alert.alert(
        'Log Out',
        'Are you sure you want to log out?',
        [
          { 
            text: 'Cancel', 
            style: 'cancel',
            onPress: () => console.log('Logout cancelled (native)'),
          },
          {
            text: 'Log Out',
            style: 'destructive',
            onPress: () => {
              console.log('User confirmed logout (native), calling mutation');
              logoutMutation.mutate();
            },
          },
        ]
      );
    }
  };

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#2F80ED', // signal-500
        tabBarInactiveTintColor: isDark ? '#6B7485' : '#525C6E', // graphite-400/500
        tabBarStyle: {
          backgroundColor: isDark ? '#0E1116' : '#ffffff',
          borderTopColor: isDark ? '#353D4B' : '#A5ABB6',
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
          backgroundColor: isDark ? '#0E1116' : '#ffffff',
        },
        headerTintColor: isDark ? '#E6E8EB' : '#0E1116',
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
          headerTitle: 'Foundry Lab',
          headerRight: () => (
            <TouchableOpacity
              onPress={handleLogout}
              style={{ marginRight: 16 }}
              disabled={logoutMutation.isPending}
            >
              <Ionicons
                name="log-out-outline"
                size={24}
                color={isDark ? '#E6E8EB' : '#0E1116'}
              />
            </TouchableOpacity>
          ),
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
