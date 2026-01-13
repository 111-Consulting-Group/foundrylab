import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';
import { useWorkoutHistory, useIncompleteWorkouts, useUncompleteWorkout } from '@/hooks/useWorkouts';
import { useRecentPRs } from '@/hooks/usePersonalRecords';
import { calculateSetVolume } from '@/lib/utils';
import type { WorkoutWithSets } from '@/types/database';

export default function HistoryScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [searchQuery, setSearchQuery] = useState('');
  const uncompleteMutation = useUncompleteWorkout();

  // Fetch real data
  const { data: completedWorkouts = [], isLoading: historyLoading } = useWorkoutHistory(50);
  const { data: incompleteWorkouts = [], isLoading: incompleteLoading } = useIncompleteWorkouts();
  const { data: recentPRs = [] } = useRecentPRs(100);

  // Calculate stats from real data
  const stats = useMemo(() => {
    const totalWorkouts = completedWorkouts.length;
    
    let totalVolume = 0;
    let exerciseSet = new Set<string>();
    
    completedWorkouts.forEach((workout) => {
      workout.workout_sets?.forEach((set) => {
        if (!set.is_warmup) {
          const volume = calculateSetVolume(set.actual_weight, set.actual_reps);
          if (volume > 0) {
            totalVolume += volume;
            exerciseSet.add(set.exercise_id);
          }
        }
      });
    });

    // Calculate PRs this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const prsThisMonth = recentPRs.filter((pr) => {
      const achievedAt = new Date(pr.achieved_at);
      return achievedAt >= startOfMonth;
    }).length;

    return {
      totalWorkouts,
      totalVolume,
      exerciseCount: exerciseSet.size,
      prsThisMonth,
    };
  }, [completedWorkouts, recentPRs]);

  // Process completed workouts for display
  const processedCompletedWorkouts = useMemo(() => {
    return completedWorkouts.map((workout) => {
      let totalVolume = 0;
      let exerciseSet = new Set<string>();
      let prCount = 0;

      workout.workout_sets?.forEach((set) => {
        if (!set.is_warmup) {
          const volume = calculateSetVolume(set.actual_weight, set.actual_reps);
          if (volume > 0) {
            totalVolume += volume;
            exerciseSet.add(set.exercise_id);
          }
        }
        if (set.is_pr) {
          prCount++;
        }
      });

      return {
        ...workout,
        totalVolume,
        exerciseCount: exerciseSet.size,
        prCount,
        date: workout.date_completed ? new Date(workout.date_completed) : new Date(),
      };
    });
  }, [completedWorkouts]);

  // Process incomplete workouts for display
  const processedIncompleteWorkouts = useMemo(() => {
    return incompleteWorkouts.map((workout) => {
      let totalVolume = 0;
      let exerciseSet = new Set<string>();
      let prCount = 0;

      workout.workout_sets?.forEach((set) => {
        if (!set.is_warmup) {
          const volume = calculateSetVolume(set.actual_weight, set.actual_reps);
          if (volume > 0) {
            totalVolume += volume;
            exerciseSet.add(set.exercise_id);
          }
        }
        if (set.is_pr) {
          prCount++;
        }
      });

      return {
        ...workout,
        totalVolume,
        exerciseCount: exerciseSet.size,
        prCount,
        date: workout.updated_at ? new Date(workout.updated_at) : new Date(workout.created_at),
      };
    });
  }, [incompleteWorkouts]);

  // Filter workouts
  const filteredCompleted = processedCompletedWorkouts.filter((workout) =>
    workout.focus.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const filteredIncomplete = processedIncompleteWorkouts.filter((workout) =>
    workout.focus.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isLoading = historyLoading || incompleteLoading;

  return (
    <SafeAreaView 
      className="flex-1 bg-carbon-950" 
      style={{ backgroundColor: '#0E1116' }}
      edges={['left', 'right']}
    >
      {/* Search Bar */}
      <View className="px-4 py-3">
        <View
          className="flex-row items-center px-4 py-3 rounded-xl bg-graphite-800 border border-graphite-700"
          style={{ backgroundColor: '#1A1F2E', borderColor: '#353D4B' }}
        >
          <Ionicons
            name="search"
            size={20}
            color={isDark ? '#808fb0' : '#607296'}
            style={{ marginRight: 10 }}
          />
          <TextInput
            className="flex-1 text-base text-graphite-100"
            style={{ color: '#E6E8EB' }}
            placeholder="Search workouts or exercises..."
            placeholderTextColor={isDark ? '#808fb0' : '#607296'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={isDark ? '#808fb0' : '#607296'} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Stats Summary */}
      <View className="px-4 mb-4">
        <View className="flex-row gap-3">
          <View
            className="flex-1 p-4 rounded-xl bg-graphite-800 border border-graphite-700"
            style={{ backgroundColor: '#1A1F2E', borderColor: '#353D4B' }}
          >
            <Text className="text-2xl font-bold text-graphite-100" style={{ color: '#E6E8EB' }}>
              {isLoading ? '...' : stats.totalWorkouts}
            </Text>
            <Text className="text-xs text-graphite-400" style={{ color: '#6B7485' }}>
              Total Workouts
            </Text>
          </View>
          <View
            className="flex-1 p-4 rounded-xl bg-graphite-800 border border-graphite-700"
            style={{ backgroundColor: '#1A1F2E', borderColor: '#353D4B' }}
          >
            <Text className={`text-2xl font-bold text-signal-500`}>
              {isLoading ? '...' : stats.totalVolume >= 1000 
                ? `${(stats.totalVolume / 1000).toFixed(1)}k` 
                : Math.round(stats.totalVolume).toString()}
            </Text>
            <Text className="text-xs text-graphite-400" style={{ color: '#6B7485' }}>
              Total Volume (lbs)
            </Text>
          </View>
          <View
            className="flex-1 p-4 rounded-xl bg-graphite-800 border border-graphite-700"
            style={{ backgroundColor: '#1A1F2E', borderColor: '#353D4B' }}
          >
            <Text className={`text-2xl font-bold text-oxide-500`}>
              {isLoading ? '...' : stats.prsThisMonth}
            </Text>
            <Text className="text-xs text-graphite-400" style={{ color: '#6B7485' }}>
              PRs This Month
            </Text>
          </View>
        </View>
      </View>

      {/* Workout List */}
      <ScrollView className="flex-1 px-4">
        {isLoading ? (
          <View className="flex-1 items-center justify-center py-12">
            <ActivityIndicator size="large" color="#2F80ED" />
          </View>
        ) : (
          <>
            {/* Incomplete Workouts Section */}
            {filteredIncomplete.length > 0 && (
              <View className="mb-6">
                <Text className="text-lg font-bold mb-3 text-graphite-100" style={{ color: '#E6E8EB' }}>
                  Continue Workout
                </Text>
                <View className="gap-2">
                  {filteredIncomplete.map((workout) => (
                    <Pressable
                      key={workout.id}
                      className="p-4 rounded-xl bg-graphite-800 border-2"
                      style={{ backgroundColor: '#1A1F2E', borderColor: 'rgba(47, 128, 237, 0.5)' }}
                      onPress={() => router.push(`/workout/${workout.id}`)}
                    >
                      <View className="flex-row items-start justify-between mb-2">
                        <View className="flex-row items-center">
                          <View
                            className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
                              workout.totalVolume > 0 ? 'bg-signal-500' : 'bg-progress-500'
                            }`}
                          >
                            <Ionicons
                              name={workout.totalVolume > 0 ? 'barbell' : 'heart'}
                              size={20}
                              color="#ffffff"
                            />
                          </View>
                          <View>
                            <View className="flex-row items-center">
                              <Text className="font-semibold text-graphite-100" style={{ color: '#E6E8EB' }}>
                                {workout.focus}
                              </Text>
                              <View className="ml-2 px-2 py-0.5 rounded-full bg-signal-500/20">
                                <Text className="text-signal-500 text-xs font-semibold">In Progress</Text>
                              </View>
                            </View>
                            <Text className="text-sm text-graphite-400" style={{ color: '#6B7485' }}>
                              Last updated {format(workout.date, 'MMM d')}
                            </Text>
                          </View>
                        </View>
                        {workout.prCount > 0 && (
                          <View className="flex-row items-center bg-oxide-500/20 px-2 py-1 rounded-full">
                            <Ionicons name="trophy" size={12} color="#F2994A" />
                            <Text className="text-oxide-500 text-xs font-semibold ml-1">
                              {workout.prCount} PR{workout.prCount > 1 ? 's' : ''}
                            </Text>
                          </View>
                        )}
                      </View>

                      <View className="flex-row gap-4">
                        <View className="flex-row items-center">
                          <Ionicons
                            name="fitness-outline"
                            size={14}
                            color={isDark ? '#808fb0' : '#607296'}
                          />
                          <Text className="text-sm ml-1 text-graphite-400" style={{ color: '#6B7485' }}>
                            {workout.exerciseCount} exercises
                          </Text>
                        </View>
                        {workout.totalVolume > 0 && (
                          <View className="flex-row items-center">
                            <Ionicons
                              name="trending-up"
                              size={14}
                              color={isDark ? '#808fb0' : '#607296'}
                            />
                            <Text className="text-sm ml-1 text-graphite-400" style={{ color: '#6B7485' }}>
                              {workout.totalVolume >= 1000 
                                ? `${(workout.totalVolume / 1000).toFixed(1)}k lbs`
                                : `${Math.round(workout.totalVolume)} lbs`}
                            </Text>
                          </View>
                        )}
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Completed Workouts Section */}
            <View>
              <Text className="text-lg font-bold mb-3 text-graphite-100" style={{ color: '#E6E8EB' }}>
                Recent Workouts
              </Text>

              {filteredCompleted.length === 0 ? (
                <View className="items-center justify-center py-12">
                  <Ionicons
                    name="barbell-outline"
                    size={48}
                    color={isDark ? '#808fb0' : '#607296'}
                  />
                  <Text className="mt-4 text-center text-graphite-400" style={{ color: '#6B7485' }}>
                    No completed workouts yet.{'\n'}Start your first workout to see it here!
                  </Text>
                </View>
              ) : (
                <View className="gap-2">
                  {filteredCompleted.map((workout) => (
                    <View
                      key={workout.id}
                      className="p-4 rounded-xl bg-graphite-800 border border-graphite-700"
                      style={{ backgroundColor: '#1A1F2E', borderColor: '#353D4B' }}
                    >
                      <Pressable
                        onPress={() => router.push(`/workout-summary/${workout.id}`)}
                      >
                      <View className="flex-row items-start justify-between mb-2">
                        <View className="flex-row items-center">
                          <View
                            className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
                              workout.totalVolume > 0 ? 'bg-signal-500' : 'bg-progress-500'
                            }`}
                          >
                            <Ionicons
                              name={workout.totalVolume > 0 ? 'barbell' : 'heart'}
                              size={20}
                              color="#ffffff"
                            />
                          </View>
                          <View>
                              <Text className="font-semibold text-graphite-100" style={{ color: '#E6E8EB' }}>
                                {workout.focus}
                              </Text>
                              <Text className="text-sm text-graphite-400" style={{ color: '#6B7485' }}>
                              {format(workout.date, 'EEEE, MMM d')}
                            </Text>
                          </View>
                        </View>
                        {workout.prCount > 0 && (
                          <View className="flex-row items-center bg-oxide-500/20 px-2 py-1 rounded-full">
                            <Ionicons name="trophy" size={12} color="#F2994A" />
                            <Text className="text-oxide-500 text-xs font-semibold ml-1">
                              {workout.prCount} PR{workout.prCount > 1 ? 's' : ''}
                            </Text>
                          </View>
                        )}
                      </View>

                      <View className="flex-row gap-4">
                        {workout.duration_minutes && (
                          <View className="flex-row items-center">
                            <Ionicons
                              name="time-outline"
                              size={14}
                              color={isDark ? '#808fb0' : '#607296'}
                            />
                            <Text className="text-sm ml-1 text-graphite-400" style={{ color: '#6B7485' }}>
                              {workout.duration_minutes} min
                            </Text>
                          </View>
                        )}
                        <View className="flex-row items-center">
                          <Ionicons
                            name="fitness-outline"
                            size={14}
                            color={isDark ? '#808fb0' : '#607296'}
                          />
                          <Text className="text-sm ml-1 text-graphite-400" style={{ color: '#6B7485' }}>
                            {workout.exerciseCount} exercises
                          </Text>
                        </View>
                        {workout.totalVolume > 0 && (
                          <View className="flex-row items-center">
                            <Ionicons
                              name="trending-up"
                              size={14}
                              color={isDark ? '#808fb0' : '#607296'}
                            />
                            <Text className="text-sm ml-1 text-graphite-400" style={{ color: '#6B7485' }}>
                              {workout.totalVolume >= 1000 
                                ? `${(workout.totalVolume / 1000).toFixed(1)}k lbs`
                                : `${Math.round(workout.totalVolume)} lbs`}
                            </Text>
                          </View>
                        )}
                      </View>
                      </Pressable>
                      
                      {/* Action Buttons */}
                      <View className={`flex-row gap-2 mt-3 pt-3 border-t ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}>
                        <Pressable
                          className={`flex-1 flex-row items-center justify-center py-2 rounded-lg ${
                            isDark ? 'bg-graphite-700' : 'bg-graphite-100'
                          }`}
                          onPress={() => {
                            Alert.alert(
                              'Uncomplete Workout',
                              'This will mark the workout as incomplete so you can reschedule it. Continue?',
                              [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                  text: 'Uncomplete',
                                  style: 'destructive',
                                  onPress: () => {
                                    uncompleteMutation.mutate(
                                      { id: workout.id },
                                      {
                                        onSuccess: () => {
                                          Alert.alert('Success', 'Workout marked as incomplete. You can now reschedule it.');
                                        },
                                        onError: (error) => {
                                          console.error('Uncomplete error:', error);
                                          Alert.alert('Error', `Failed to uncomplete workout: ${error instanceof Error ? error.message : 'Unknown error'}`);
                                        },
                                      }
                                    );
                                  },
                                },
                              ]
                            );
                          }}
                        >
                          <Ionicons name="refresh-outline" size={16} color="#2F80ED" />
                          <Text className="text-signal-500 font-medium ml-1 text-sm">Uncomplete</Text>
                        </Pressable>
                        <Pressable
                          className={`flex-1 flex-row items-center justify-center py-2 rounded-lg ${
                            isDark ? 'bg-graphite-700' : 'bg-graphite-100'
                          }`}
                          onPress={() => router.push(`/workout/${workout.id}`)}
                        >
                          <Ionicons name="create-outline" size={16} color="#2F80ED" />
                          <Text className="text-signal-500 font-medium ml-1 text-sm">Edit</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Bottom spacing */}
            <View className="h-8" />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
