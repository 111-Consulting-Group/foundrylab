import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';
import { useWorkoutHistory, useIncompleteWorkouts } from '@/hooks/useWorkouts';
import { useRecentPRs } from '@/hooks/usePersonalRecords';
import { calculateSetVolume } from '@/lib/utils';
import type { WorkoutWithSets } from '@/types/database';

export default function HistoryScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [searchQuery, setSearchQuery] = useState('');

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
    <SafeAreaView className={`flex-1 ${isDark ? 'bg-carbon-950' : 'bg-graphite-50'}`} edges={['left', 'right']}>
      {/* Search Bar */}
      <View className="px-4 py-3">
        <View
          className={`flex-row items-center px-4 py-3 rounded-xl ${
            isDark ? 'bg-graphite-800' : 'bg-white'
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
            className={`flex-1 p-4 rounded-xl ${
              isDark ? 'bg-graphite-800' : 'bg-white'
            } border ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}
          >
            <Text className={`text-2xl font-bold ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
              {isLoading ? '...' : stats.totalWorkouts}
            </Text>
            <Text className={`text-xs ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
              Total Workouts
            </Text>
          </View>
          <View
            className={`flex-1 p-4 rounded-xl ${
              isDark ? 'bg-graphite-800' : 'bg-white'
            } border ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}
          >
            <Text className={`text-2xl font-bold text-signal-500`}>
              {isLoading ? '...' : stats.totalVolume >= 1000 
                ? `${(stats.totalVolume / 1000).toFixed(1)}k` 
                : Math.round(stats.totalVolume).toString()}
            </Text>
            <Text className={`text-xs ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
              Total Volume (lbs)
            </Text>
          </View>
          <View
            className={`flex-1 p-4 rounded-xl ${
              isDark ? 'bg-graphite-800' : 'bg-white'
            } border ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}
          >
            <Text className={`text-2xl font-bold text-oxide-500`}>
              {isLoading ? '...' : stats.prsThisMonth}
            </Text>
            <Text className={`text-xs ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
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
                <Text className={`text-lg font-bold mb-3 ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
                  Continue Workout
                </Text>
                <View className="gap-2">
                  {filteredIncomplete.map((workout) => (
                    <Pressable
                      key={workout.id}
                      className={`p-4 rounded-xl ${
                        isDark ? 'bg-graphite-800' : 'bg-white'
                      } border-2 ${isDark ? 'border-signal-500/50' : 'border-signal-500/50'}`}
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
                              <Text className={`font-semibold ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
                                {workout.focus}
                              </Text>
                              <View className="ml-2 px-2 py-0.5 rounded-full bg-signal-500/20">
                                <Text className="text-signal-500 text-xs font-semibold">In Progress</Text>
                              </View>
                            </View>
                            <Text className={`text-sm ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
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
                          <Text className={`text-sm ml-1 ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
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
                            <Text className={`text-sm ml-1 ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
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
              <Text className={`text-lg font-bold mb-3 ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
                Recent Workouts
              </Text>

              {filteredCompleted.length === 0 ? (
                <View className="items-center justify-center py-12">
                  <Ionicons
                    name="barbell-outline"
                    size={48}
                    color={isDark ? '#808fb0' : '#607296'}
                  />
                  <Text className={`mt-4 text-center ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                    No completed workouts yet.{'\n'}Start your first workout to see it here!
                  </Text>
                </View>
              ) : (
                <View className="gap-2">
                  {filteredCompleted.map((workout) => (
                    <Pressable
                      key={workout.id}
                      className={`p-4 rounded-xl ${
                        isDark ? 'bg-graphite-800' : 'bg-white'
                      } border ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}
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
                            <Text className={`font-semibold ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
                              {workout.focus}
                            </Text>
                            <Text className={`text-sm ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
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
                            <Text className={`text-sm ml-1 ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
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
                          <Text className={`text-sm ml-1 ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
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
                            <Text className={`text-sm ml-1 ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
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
