/**
 * Notifications Screen
 *
 * View and manage all notifications.
 * Features:
 * - List all notifications
 * - Mark as read
 * - Mark all as read
 * - Navigate to related content
 */

import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDeleteNotification,
} from '@/hooks/useSocial';
import type { NotificationWithActor, NotificationType } from '@/types/database';

const NOTIFICATION_ICONS: Record<NotificationType, { name: string; color: string }> = {
  like: { name: 'heart', color: Colors.regression[400] },
  comment: { name: 'chatbubble', color: Colors.signal[400] },
  comment_reply: { name: 'arrow-undo', color: Colors.signal[300] },
  follow: { name: 'person-add', color: Colors.emerald[400] },
  mention: { name: 'at', color: Colors.oxide[400] },
  pr_achieved: { name: 'trophy', color: Colors.oxide[500] },
  streak_milestone: { name: 'flame', color: Colors.regression[400] },
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { data: notifications = [], isLoading, refetch, isRefetching } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const deleteNotification = useDeleteNotification();

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleNotificationPress = useCallback(async (notification: NotificationWithActor) => {
    // Mark as read
    if (!notification.is_read) {
      await markRead.mutateAsync(notification.id);
    }

    // Navigate based on type
    if (notification.post_id) {
      // For now, navigate to feed - could add deep linking to specific post later
      router.push('/(tabs)/feed');
    } else if (notification.type === 'follow' && notification.actor_id) {
      router.push(`/profile/${notification.actor_id}`);
    }
  }, [markRead, router]);

  const handleMarkAllRead = useCallback(async () => {
    try {
      await markAllRead.mutateAsync();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  }, [markAllRead]);

  const handleDelete = useCallback(async (notificationId: string) => {
    try {
      await deleteNotification.mutateAsync(notificationId);
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  }, [deleteNotification]);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Notifications',
          headerStyle: { backgroundColor: Colors.void[900] },
          headerTintColor: Colors.graphite[50],
          headerRight: () =>
            unreadCount > 0 ? (
              <TouchableOpacity
                onPress={handleMarkAllRead}
                disabled={markAllRead.isPending}
                style={{ marginRight: 8 }}
              >
                <Text style={{ color: Colors.signal[400], fontSize: 14, fontWeight: '600' }}>
                  Mark all read
                </Text>
              </TouchableOpacity>
            ) : null,
        }}
      />
      <View style={{ flex: 1, backgroundColor: Colors.void[900] }}>
        {/* Ambient Background Glows */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -60,
            right: -100,
            width: 260,
            height: 260,
            backgroundColor: 'rgba(37, 99, 235, 0.06)',
            borderRadius: 130,
          }}
        />

        <SafeAreaView style={{ flex: 1 }} edges={['left', 'right', 'bottom']}>
          {isLoading ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color={Colors.signal[500]} />
            </View>
          ) : notifications.length === 0 ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
              <Ionicons name="notifications-off-outline" size={64} color={Colors.graphite[600]} />
              <Text
                style={{
                  marginTop: 16,
                  fontSize: 18,
                  fontWeight: '600',
                  color: Colors.graphite[300],
                  textAlign: 'center',
                }}
              >
                No notifications yet
              </Text>
              <Text
                style={{
                  marginTop: 8,
                  fontSize: 14,
                  color: Colors.graphite[500],
                  textAlign: 'center',
                }}
              >
                When someone likes or comments on your workouts, you'll see it here.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={{ flex: 1 }}
              refreshControl={
                <RefreshControl
                  refreshing={isRefetching}
                  onRefresh={refetch}
                  tintColor={Colors.signal[500]}
                />
              }
            >
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onPress={() => handleNotificationPress(notification)}
                  onDelete={() => handleDelete(notification.id)}
                />
              ))}
            </ScrollView>
          )}
        </SafeAreaView>
      </View>
    </>
  );
}

interface NotificationItemProps {
  notification: NotificationWithActor;
  onPress: () => void;
  onDelete: () => void;
}

function NotificationItem({ notification, onPress, onDelete }: NotificationItemProps) {
  const iconConfig = NOTIFICATION_ICONS[notification.type] || NOTIFICATION_ICONS.like;
  const timeAgo = getTimeAgo(new Date(notification.created_at));
  const actorName = notification.actor?.display_name || notification.actor?.email?.split('@')[0] || 'Someone';

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.glass.white[5],
        backgroundColor: notification.is_read ? 'transparent' : Colors.glass.blue[5],
      }}
    >
      {/* Icon */}
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: Colors.glass.white[10],
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: 12,
        }}
      >
        <Ionicons name={iconConfig.name as any} size={20} color={iconConfig.color} />
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, color: Colors.graphite[100], lineHeight: 20 }}>
          <Text style={{ fontWeight: '600' }}>{actorName}</Text>{' '}
          {getNotificationAction(notification.type)}
        </Text>

        {notification.body && (
          <Text
            style={{
              marginTop: 4,
              fontSize: 13,
              color: Colors.graphite[400],
              lineHeight: 18,
            }}
            numberOfLines={2}
          >
            "{notification.body}"
          </Text>
        )}

        <Text style={{ marginTop: 6, fontSize: 12, color: Colors.graphite[500] }}>{timeAgo}</Text>
      </View>

      {/* Unread indicator */}
      {!notification.is_read && (
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: Colors.signal[500],
            marginLeft: 8,
            marginTop: 6,
          }}
        />
      )}

      {/* Delete button */}
      <TouchableOpacity
        onPress={onDelete}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={{ padding: 4, marginLeft: 8 }}
      >
        <Ionicons name="close" size={16} color={Colors.graphite[500]} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function getNotificationAction(type: NotificationType): string {
  switch (type) {
    case 'like':
      return 'liked your workout';
    case 'comment':
      return 'commented on your workout';
    case 'comment_reply':
      return 'replied to your comment';
    case 'follow':
      return 'started following you';
    case 'mention':
      return 'mentioned you';
    case 'pr_achieved':
      return 'You set a new PR!';
    case 'streak_milestone':
      return 'You hit a streak milestone!';
    default:
      return 'sent you a notification';
  }
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
