import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';
import { StreakBadge, PRCountBadge, BlockContextBadge, AdherenceBadge } from '@/components/FeedBadges';
import { useFeed, useLikePost, useSearchUsers } from '@/hooks/useSocial';
import { detectWorkoutContext, getContextInfo } from '@/lib/workoutContext';
import { summarizeWorkoutExercises, formatExerciseForFeed, getProgressionBadge, getModalityIcon } from '@/lib/feedUtils';
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

                // Get all exercises with their progression summaries
                const exerciseSummaries = summarizeWorkoutExercises(workout.workout_sets || []);
                const prCount = exerciseSummaries.filter(e => e.isPR).length;

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
                      <View className="flex-row items-center gap-2">
                        {post.user_streak && post.user_streak.currentStreak >= 2 && (
                          <StreakBadge streak={post.user_streak.currentStreak} />
                        )}
                        <PRCountBadge count={prCount} />
                      </View>
                    </View>

                    {/* Workout title and context */}
                    <View className="mb-3">
                      <View className="flex-row items-center gap-2 mb-2">
                        <Text className={`text-lg font-bold ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
                          {workout.focus}
                        </Text>
                        <BlockContextBadge
                          blockName={workout.training_block?.name}
                          weekNumber={workout.week_number || undefined}
                          context={context}
                        />
                      </View>

                      {/* All exercises with progression */}
                      <View className="gap-2 mt-2">
                        {exerciseSummaries.slice(0, 5).map((summary) => {
                          const badge = getProgressionBadge(summary);
                          const iconName = getModalityIcon(summary.modality);

                          // Check if this exercise has an active goal
                          const matchingGoal = post.user_goals?.find(
                            (g) => g.exercise_id === summary.exerciseId
                          );
                          const goalProgress = matchingGoal && matchingGoal.target_value > 0
                            ? Math.min(100, Math.round(((matchingGoal.current_value || 0) / matchingGoal.target_value) * 100))
                            : null;

                          return (
                            <View key={summary.exerciseId}>
                              <View
                                className={`flex-row items-center justify-between py-1.5 px-2 rounded-lg ${
                                  isDark ? 'bg-graphite-700/50' : 'bg-graphite-100'
                                }`}
                              >
                                <View className="flex-row items-center flex-1 mr-2">
                                  <Ionicons
                                    name={iconName as any}
                                    size={14}
                                    color={isDark ? '#808fb0' : '#607296'}
                                    style={{ marginRight: 8 }}
                                  />
                                  <Text
                                    className={`text-sm flex-1 ${isDark ? 'text-graphite-200' : 'text-graphite-800'}`}
                                    numberOfLines={1}
                                  >
                                    {summary.exerciseName}
                                  </Text>
                                </View>
                                <View className="flex-row items-center">
                                  <Text className={`text-sm font-semibold mr-2 ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
                                    {formatExerciseForFeed(summary)}
                                  </Text>
                                  {badge && (
                                    <View
                                      className="px-1.5 py-0.5 rounded"
                                      style={{ backgroundColor: badge.bgColor }}
                                    >
                                      <Text
                                        className="text-xs font-semibold"
                                        style={{ color: badge.color }}
                                      >
                                        {badge.text}
                                      </Text>
                                    </View>
                                  )}
                                </View>
                              </View>
                              {/* Goal Progress Bar */}
                              {matchingGoal && goalProgress !== null && (
                                <View className="flex-row items-center mt-1 px-2">
                                  <Ionicons
                                    name="flag"
                                    size={10}
                                    color="#9B59B6"
                                    style={{ marginRight: 4 }}
                                  />
                                  <View className={`flex-1 h-1.5 rounded-full mr-2 ${isDark ? 'bg-graphite-700' : 'bg-graphite-200'}`}>
                                    <View
                                      className="h-1.5 rounded-full bg-purple-500"
                                      style={{ width: `${goalProgress}%` }}
                                    />
                                  </View>
                                  <Text className="text-xs text-purple-500 font-medium">
                                    {matchingGoal.current_value || 0}/{matchingGoal.target_value}
                                  </Text>
                                </View>
                              )}
                            </View>
                          );
                        })}
                        {exerciseSummaries.length > 5 && (
                          <Text className={`text-xs text-center ${isDark ? 'text-graphite-500' : 'text-graphite-400'}`}>
                            +{exerciseSummaries.length - 5} more exercises
                          </Text>
                        )}
                      </View>

                      {/* Caption */}
                      {post.caption && (
                        <Text className={`text-sm mt-3 ${isDark ? 'text-graphite-300' : 'text-graphite-700'}`}>
                          "{post.caption}"
                        </Text>
                      )}
                    </View>

                    {/* Footer: Like button + adherence */}
                    <View className="flex-row items-center justify-between pt-2 border-t border-graphite-700/30">
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
                      {post.user_streak && post.user_streak.weeklyAdherence >= 50 && (
                        <View className="flex-row items-center">
                          <AdherenceBadge percent={post.user_streak.weeklyAdherence} />
                        </View>
                      )}
                    </View>
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
