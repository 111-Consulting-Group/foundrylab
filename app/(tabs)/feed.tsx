import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';
import { useFeed, useLikePost, useSearchUsers } from '@/hooks/useSocial';
import { detectWorkoutContext, getContextInfo } from '@/lib/workoutContext';
import { formatDistanceToNow } from 'date-fns';
import type { WorkoutWithSets } from '@/types/database';

export default function FeedScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const { data: feed = [], isLoading, refetch } = useFeed(20);
  const likePostMutation = useLikePost();
  const [showDiscover, setShowDiscover] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { data: searchResults = [], isLoading: isSearching } = useSearchUsers(searchQuery);

  const handleLike = async (postId: string, isLiked: boolean) => {
    await likePostMutation.mutateAsync({ postId, like: !isLiked });
  };

  const formatDate = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
    } catch {
      return dateStr;
    }
  };

  return (
    <SafeAreaView className={`flex-1 ${isDark ? 'bg-carbon-950' : 'bg-graphite-50'}`} edges={['left', 'right']}>
      <ScrollView
        className="flex-1 px-4"
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => refetch()}
            tintColor={isDark ? '#2F80ED' : '#2F80ED'}
          />
        }
      >
        <View className="pt-4 pb-6">
          <View className="flex-row items-center justify-between mb-4">
            <Text className={`text-2xl font-bold ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
              Feed
            </Text>
            <Pressable
              onPress={() => setShowDiscover(true)}
              className="flex-row items-center px-3 py-2 rounded-full bg-signal-500"
            >
              <Ionicons name="person-add-outline" size={16} color="#ffffff" />
              <Text className="text-white font-semibold ml-2 text-sm">Discover</Text>
            </Pressable>
          </View>

          {isLoading && feed.length === 0 ? (
            <View className="items-center justify-center py-12">
              <ActivityIndicator size="large" color="#2F80ED" />
            </View>
          ) : feed.length === 0 ? (
            <View className="items-center justify-center py-12">
              <Ionicons
                name="people-outline"
                size={48}
                color={isDark ? '#808fb0' : '#607296'}
              />
              <Text className={`mt-4 text-center ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                Your feed is empty.{'\n'}Follow users to see their workouts here!
              </Text>
              <Pressable
                onPress={() => setShowDiscover(true)}
                className="mt-6 px-6 py-3 rounded-full bg-signal-500"
              >
                <Text className="text-white font-semibold">Discover Users</Text>
              </Pressable>
            </View>
          ) : (
            <View className="gap-4">
              {feed.map((post) => {
                const workout = post.workout as WorkoutWithSets | undefined;
                if (!workout) return null;

                const context = detectWorkoutContext(workout);
                const contextInfo = getContextInfo(context);

                // Calculate progression deltas (simplified - show first exercise with PR)
                const prSet = workout.workout_sets?.find((set) => set.is_pr && !set.is_warmup);
                const progressionText = prSet
                  ? `${prSet.exercise?.name}: ${prSet.actual_weight} × ${prSet.actual_reps} (PR)`
                  : null;

                return (
                  <Pressable
                    key={post.id}
                    className={`p-4 rounded-xl ${
                      isDark ? 'bg-graphite-800 border-graphite-700' : 'bg-white border-graphite-200'
                    } border`}
                    onPress={() => router.push(`/workout-summary/${workout.id}`)}
                  >
                    {/* User header */}
                    <View className="flex-row items-center mb-3">
                      <View className="w-10 h-10 rounded-full bg-signal-500 items-center justify-center mr-3">
                        <Text className="text-white font-bold text-sm">
                          {post.user?.display_name?.charAt(0).toUpperCase() || post.user?.email?.charAt(0).toUpperCase() || 'U'}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <Text className={`font-semibold ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
                          {post.user?.display_name || post.user?.email || 'User'}
                        </Text>
                        <Text className={`text-xs ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                          {formatDate(post.created_at)}
                        </Text>
                      </View>
                    </View>

                    {/* Workout content */}
                    <View className="mb-3">
                      <Text className={`text-lg font-bold mb-2 ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
                        {workout.focus}
                      </Text>
                      {progressionText && (
                        <Text className={`text-sm mb-2 ${isDark ? 'text-graphite-300' : 'text-graphite-700'}`}>
                          {progressionText}
                        </Text>
                      )}
                      {workout.week_number && workout.day_number && (
                        <View className="flex-row items-center gap-2 mb-2">
                          <View
                            className="px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: contextInfo.bgColor }}
                          >
                            <Text
                              className="text-xs font-semibold"
                              style={{ color: contextInfo.color }}
                            >
                              Week {workout.week_number} of block
                            </Text>
                          </View>
                        </View>
                      )}
                      {post.caption && (
                        <Text className={`text-sm mt-2 ${isDark ? 'text-graphite-300' : 'text-graphite-700'}`}>
                          {post.caption}
                        </Text>
                      )}
                    </View>

                    {/* Like button */}
                    <Pressable
                      className="flex-row items-center"
                      onPress={(e) => {
                        e.stopPropagation();
                        handleLike(post.id, post.is_liked || false);
                      }}
                    >
                      <Ionicons
                        name={post.is_liked ? 'heart' : 'heart-outline'}
                        size={20}
                        color={post.is_liked ? '#ef4444' : (isDark ? '#808fb0' : '#607296')}
                      />
                      <Text className={`ml-2 text-sm ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                        {post.like_count || 0} {post.like_count === 1 ? 'like' : 'likes'}
                      </Text>
                    </Pressable>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* User Discovery Modal */}
      <Modal
        visible={showDiscover}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDiscover(false)}
      >
        <SafeAreaView className={`flex-1 ${isDark ? 'bg-black/80' : 'bg-black/60'}`}>
          <Pressable
            className="flex-1"
            onPress={() => setShowDiscover(false)}
          >
            <Pressable
              className={`flex-1 mt-auto rounded-t-3xl ${isDark ? 'bg-graphite-900' : 'bg-white'} p-6`}
              onPress={(e) => e.stopPropagation()}
            >
              <View className="w-10 h-1 bg-graphite-400 rounded-full self-center mb-4" />
              <View className="flex-row items-center justify-between mb-4">
                <Text className={`text-xl font-bold ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
                  Discover Users
                </Text>
                <Pressable onPress={() => setShowDiscover(false)}>
                  <Ionicons name="close" size={24} color={isDark ? '#E6E8EB' : '#0E1116'} />
                </Pressable>
              </View>

              <View
                className={`flex-row items-center px-4 py-3 rounded-xl mb-4 ${
                  isDark ? 'bg-graphite-800' : 'bg-graphite-50'
                } border ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}
              >
                <Ionicons
                  name="search"
                  size={20}
                  color={isDark ? '#808fb0' : '#607296'}
                  style={{ marginRight: 10 }}
                />
                <TextInput
                  className={`flex-1 text-base ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}
                  placeholder="Search by name or email..."
                  placeholderTextColor={isDark ? '#808fb0' : '#607296'}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={20} color={isDark ? '#808fb0' : '#607296'} />
                  </Pressable>
                )}
              </View>

              {isSearching ? (
                <View className="items-center justify-center py-12">
                  <ActivityIndicator size="large" color="#2F80ED" />
                </View>
              ) : searchQuery.length >= 2 && searchResults.length === 0 ? (
                <View className="items-center justify-center py-12">
                  <Ionicons
                    name="person-outline"
                    size={48}
                    color={isDark ? '#808fb0' : '#607296'}
                  />
                  <Text className={`mt-4 text-center ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                    No users found
                  </Text>
                </View>
              ) : searchQuery.length >= 2 ? (
                <ScrollView className="flex-1">
                  <View className="gap-2">
                    {searchResults.map((user) => (
                      <Pressable
                        key={user.id}
                        className={`p-4 rounded-xl flex-row items-center justify-between ${
                          isDark ? 'bg-graphite-800 border-graphite-700' : 'bg-graphite-50 border-graphite-200'
                        } border`}
                        onPress={() => {
                          setShowDiscover(false);
                          router.push(`/profile/${user.id}`);
                        }}
                      >
                        <View className="flex-row items-center flex-1">
                          <View className="w-10 h-10 rounded-full bg-signal-500 items-center justify-center mr-3">
                            <Text className="text-white font-bold text-sm">
                              {user.display_name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U'}
                            </Text>
                          </View>
                          <View className="flex-1">
                            <Text className={`font-semibold ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
                              {user.display_name || user.email || 'User'}
                            </Text>
                            {user.display_name && user.email && (
                              <Text className={`text-sm ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                                {user.email}
                              </Text>
                            )}
                          </View>
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={20}
                          color={isDark ? '#808fb0' : '#607296'}
                        />
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              ) : (
                <View className="items-center justify-center py-12">
                  <Ionicons
                    name="search-outline"
                    size={48}
                    color={isDark ? '#808fb0' : '#607296'}
                  />
                  <Text className={`mt-4 text-center ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                    Start typing to search for users
                  </Text>
                </View>
              )}
            </Pressable>
          </Pressable>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
