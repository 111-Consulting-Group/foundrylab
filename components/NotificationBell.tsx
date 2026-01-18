/**
 * Notification Bell Component
 *
 * A bell icon with badge showing unread notification count.
 * Tapping navigates to the notifications screen.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';
import { useUnreadNotificationCount } from '@/hooks/useSocial';

interface NotificationBellProps {
  size?: number;
  color?: string;
}

export function NotificationBell({ size = 24, color = Colors.graphite[100] }: NotificationBellProps) {
  const router = useRouter();
  const { data: unreadCount = 0 } = useUnreadNotificationCount();

  const handlePress = () => {
    router.push('/notifications');
  };

  return (
    <TouchableOpacity onPress={handlePress} style={styles.container}>
      <Ionicons
        name={unreadCount > 0 ? 'notifications' : 'notifications-outline'}
        size={size}
        color={unreadCount > 0 ? Colors.signal[400] : color}
      />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    padding: 4,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.regression[500],
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});
