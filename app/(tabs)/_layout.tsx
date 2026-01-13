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
    if (Platform.OS === 'web') {
      // On web, use window.confirm for better compatibility
      const confirmed = window.confirm('Are you sure you want to log out?');
      if (confirmed) {
        logoutMutation.mutate();
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
          },
          {
            text: 'Log Out',
            style: 'destructive',
            onPress: () => {
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
        tabBarInactiveTintColor: '#6B7485', // graphite-400 - force dark
        tabBarStyle: {
          backgroundColor: '#0E1116', // carbon-950 - force dark
          borderTopColor: '#353D4B', // graphite-700 - force dark
          borderTopWidth: 1,
          paddingBottom: Platform.OS === 'ios' ? 24 : 12,
          paddingTop: 8,
          height: Platform.OS === 'ios' ? 88 : 72,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: '#0E1116', // carbon-950 - force dark
        },
        headerTintColor: '#E6E8EB', // graphite-100 - force dark
        headerTitleStyle: {
          fontWeight: '700',
          color: '#E6E8EB', // Ensure header text is light
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
          headerShown: false, // Hide header - we have our own in the component
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
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'people' : 'people-outline'} color={color} focused={focused} />
          ),
          headerTitle: 'Social Feed',
        }}
      />
    </Tabs>
  );
}
