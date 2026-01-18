/**
 * Likers Modal
 *
 * Shows the list of users who liked a post.
 * Features:
 * - User list with avatars
 * - Navigate to user profile
 * - Follow/unfollow from modal
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';

import { Colors } from '@/constants/Colors';
import { usePostLikers, useFollow } from '@/hooks/useSocial';
import { useAppStore } from '@/stores/useAppStore';

interface LikersModalProps {
  visible: boolean;
  onClose: () => void;
  postId: string;
}

export function LikersModal({ visible, onClose, postId }: LikersModalProps) {
  const router = useRouter();
  const { data: likers = [], isLoading } = usePostLikers(postId);
  const follow = useFollow();
  const userId = useAppStore((state) => state.userId);

  const handleUserPress = useCallback((likerId: string) => {
    onClose();
    router.push(`/profile/${likerId}`);
  }, [onClose, router]);

  const handleFollow = useCallback(async (likerId: string, isFollowing: boolean) => {
    try {
      await follow.mutateAsync({ followingId: likerId, follow: !isFollowing });
    } catch (error) {
      console.error('Failed to follow/unfollow:', error);
    }
  }, [follow]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: Colors.void[900] }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: Colors.glass.white[10],
          }}
        >
          <View style={{ width: 60 }} />
          <Text style={{ fontSize: 17, fontWeight: '600', color: Colors.graphite[50] }}>
            Likes
          </Text>
          <TouchableOpacity onPress={onClose} style={{ width: 60, alignItems: 'flex-end' }}>
            <Ionicons name="close" size={24} color={Colors.graphite[300]} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        {isLoading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={Colors.signal[500]} />
          </View>
        ) : likers.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
            <Ionicons name="heart-outline" size={64} color={Colors.graphite[600]} />
            <Text
              style={{
                marginTop: 16,
                fontSize: 18,
                fontWeight: '600',
                color: Colors.graphite[300],
                textAlign: 'center',
              }}
            >
              No likes yet
            </Text>
            <Text
              style={{
                marginTop: 8,
                fontSize: 14,
                color: Colors.graphite[500],
                textAlign: 'center',
              }}
            >
              Be the first to like this workout!
            </Text>
          </View>
        ) : (
          <ScrollView style={{ flex: 1 }}>
            {likers.map((liker) => {
              const displayName = liker.display_name || liker.email?.split('@')[0] || 'User';
              const isOwnProfile = liker.id === userId;

              return (
                <TouchableOpacity
                  key={liker.id}
                  onPress={() => handleUserPress(liker.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16,
                    borderBottomWidth: 1,
                    borderBottomColor: Colors.glass.white[5],
                  }}
                >
                  {/* Avatar */}
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: Colors.signal[600],
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: 12,
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
                      {displayName.charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  {/* User info */}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: Colors.graphite[100] }}>
                      {displayName}
                    </Text>
                    {liker.email && liker.display_name && (
                      <Text style={{ fontSize: 13, color: Colors.graphite[500], marginTop: 2 }}>
                        {liker.email}
                      </Text>
                    )}
                  </View>

                  {/* Follow button (not shown for own profile) */}
                  {!isOwnProfile && (
                    <TouchableOpacity
                      onPress={() => handleFollow(liker.id, false)}
                      disabled={follow.isPending}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 14,
                        borderRadius: 16,
                        backgroundColor: Colors.signal[500],
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>
                        Follow
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Chevron */}
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={Colors.graphite[500]}
                    style={{ marginLeft: 8 }}
                  />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}
