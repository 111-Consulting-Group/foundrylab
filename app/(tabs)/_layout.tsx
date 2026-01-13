import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter, Redirect } from 'expo-router';
import { Platform, TouchableOpacity, Alert, View, Pressable, Text } from 'react-native';
import { useEffect, useState } from 'react';
import { BlurView } from 'expo-blur';

import { useLogout } from '@/hooks/useAuth';
import { useAppStore } from '@/stores/useAppStore';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/Colors';

type TabIconName = React.ComponentProps<typeof Ionicons>['name'];

function TabBarIcon({ name, color, focused }: { name: TabIconName; color: string; focused: boolean }) {
  return (
    <Ionicons
      name={name}
      size={22}
      color={color}
      style={{
        opacity: focused ? 1 : 0.7,
        // Glow effect on focused
        ...(focused && {
          shadowColor: Colors.signal[500],
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.5,
          shadowRadius: 8,
        }),
      }}
    />
  );
}

export default function TabLayout() {
  const logoutMutation = useLogout();
  const userId = useAppStore((state) => state.userId);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  // Check Supabase session on mount
  useEffect(() => {
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession();
      setHasSession(!!session);
      setIsCheckingAuth(false);
    }
    checkSession();
  }, []);

  // Show nothing while checking
  if (isCheckingAuth) {
    return null;
  }

  // Redirect to login if not authenticated (check both store and session)
  if (!userId && !hasSession) {
    return <Redirect href="/login" />;
  }

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to log out?');
      if (confirmed) {
        logoutMutation.mutate();
      }
    } else {
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
        tabBarActiveTintColor: Colors.signal[500],
        tabBarInactiveTintColor: Colors.graphite[500],
        tabBarStyle: {
          position: 'absolute',
          bottom: Platform.OS === 'ios' ? 24 : 16,
          left: 20,
          right: 20,
          height: 72,
          backgroundColor: 'rgba(18, 18, 18, 0.9)',
          borderRadius: 32,
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.1)',
          paddingBottom: 0,
          paddingTop: 0,
          paddingHorizontal: 8,
          // Glass shadow effect
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 20 },
          shadowOpacity: 0.5,
          shadowRadius: 50,
          elevation: 20,
        },
        tabBarItemStyle: {
          paddingVertical: 8,
        },
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 1,
          marginTop: 4,
        },
        headerStyle: {
          backgroundColor: Colors.void[900],
          borderBottomWidth: 0,
          shadowOpacity: 0,
          elevation: 0,
        },
        headerTintColor: Colors.graphite[50],
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 16,
          letterSpacing: 0.5,
        },
        // Add padding to content so it doesn't get hidden behind floating nav
        sceneContainerStyle: {
          backgroundColor: Colors.void[900],
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Train',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'pulse' : 'pulse-outline'} color={color} focused={focused} />
          ),
          headerShown: false,
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
          title: 'Log',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? 'time' : 'time-outline'} color={color} focused={focused} />
          ),
          headerTitle: 'Workout History',
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Stats',
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
