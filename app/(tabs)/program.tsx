import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';
import {
  useActiveTrainingBlock,
  useTrainingBlock,
  useBlockProgress,
} from '@/hooks/useTrainingBlocks';
import type { Workout } from '@/types/database';

export default function ProgramScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Fetch active training block
  const { data: activeBlock, isLoading: blockLoading } = useActiveTrainingBlock();

  // Fetch block details with workouts
  const { data: blockWithWorkouts, isLoading: workoutsLoading } = useTrainingBlock(
    activeBlock?.id || ''
  );

  // Get block progress
  const { data: progress } = useBlockProgress(activeBlock?.id || '');

  // Group workouts by week
  const workoutsByWeek = blockWithWorkouts?.workouts?.reduce((acc, workout) => {
    const week = workout.week_number || 1;
    if (!acc[week]) {
      acc[week] = [];
    }
    acc[week].push(workout);
    return acc;
  }, {} as Record<number, Workout[]>) || {};

  // Find the next incomplete workout (queue-based, not date-based)
  const nextWorkout = blockWithWorkouts?.workouts
    ?.filter((w) => !w.date_completed)
    ?.sort((a, b) => {
      const weekDiff = (a.week_number || 0) - (b.week_number || 0);
      if (weekDiff !== 0) return weekDiff;
      return (a.day_number || 0) - (b.day_number || 0);
    })?.[0];

  // Current week is based on next workout, not calendar
  const currentWeek = nextWorkout?.week_number || 1;

  // Check if loading
  const isLoading = blockLoading || workoutsLoading;

  // No active block state
  if (!isLoading && !activeBlock) {
    return (
      <SafeAreaView
        className={`flex-1 ${isDark ? 'bg-steel-950' : 'bg-steel-50'}`}
        edges={['left', 'right']}
      >
        <View className="flex-1 items-center justify-center px-6">
          <View
            className={`w-20 h-20 rounded-full items-center justify-center mb-4 ${
              isDark ? 'bg-steel-800' : 'bg-steel-100'
            }`}
          >
            <Ionicons
              name="calendar-outline"
              size={40}
              color={isDark ? '#ed7411' : '#de5a09'}
            />
          </View>
          <Text
            className={`text-xl font-bold text-center mb-2 ${
              isDark ? 'text-steel-100' : 'text-steel-900'
            }`}
          >
            No Active Program
          </Text>
          <Text
            className={`text-center mb-6 ${isDark ? 'text-steel-400' : 'text-steel-500'}`}
          >
            Generate a training block with AI or create one manually to get started
          </Text>
          <Link href="/block-builder" asChild>
            <Pressable className="px-6 py-3 rounded-xl bg-forge-500">
              <View className="flex-row items-center">
                <Ionicons name="sparkles" size={20} color="#ffffff" />
                <Text className="text-white font-semibold ml-2">
                  Build with AI
                </Text>
              </View>
            </Pressable>
          </Link>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      className={`flex-1 ${isDark ? 'bg-steel-950' : 'bg-steel-50'}`}
      edges={['left', 'right']}
    >
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#ed7411" />
        </View>
      ) : (
        <ScrollView className="flex-1">
          {/* Current Block Header */}
          <View className="px-4 pt-4 pb-2">
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-1">
                <Text
                  className={`text-xl font-bold ${
                    isDark ? 'text-steel-100' : 'text-steel-900'
                  }`}
                >
                  {activeBlock?.name || 'Training Block'}
                </Text>
                <Text
                  className={`text-sm ${isDark ? 'text-steel-400' : 'text-steel-500'}`}
                >
                  Week {currentWeek} of {activeBlock?.duration_weeks || 0}
                  {activeBlock?.description ? ` • ${activeBlock.description.slice(0, 30)}...` : ''}
                </Text>
              </View>
              <Link href="/block-builder" asChild>
                <Pressable className="p-2">
                  <Ionicons
                    name="add-circle"
                    size={28}
                    color={isDark ? '#ed7411' : '#de5a09'}
                  />
                </Pressable>
              </Link>
            </View>

            {/* Progress Bar */}
            {progress && (
              <View
                className={`h-2 rounded-full ${
                  isDark ? 'bg-steel-800' : 'bg-steel-200'
                } mt-2`}
              >
                <View
                  className="h-full rounded-full bg-forge-500"
                  style={{ width: `${progress.percentage}%` }}
                />
              </View>
            )}
            {progress && (
              <Text
                className={`text-xs mt-1 ${isDark ? 'text-steel-500' : 'text-steel-400'}`}
              >
                {progress.completed} of {progress.total} workouts completed
              </Text>
            )}
          </View>

          {/* Week Sections */}
          {Object.entries(workoutsByWeek)
            .sort(([a], [b]) => parseInt(a) - parseInt(b))
            .map(([weekNum, workouts]) => {
              const week = parseInt(weekNum);
              const isCurrentWeek = week === currentWeek;

              return (
                <View key={week} className="mb-4">
                  <View className="px-4 py-3 flex-row items-center">
                    <View
                      className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${
                        isCurrentWeek
                          ? 'bg-forge-500'
                          : isDark
                          ? 'bg-steel-700'
                          : 'bg-steel-200'
                      }`}
                    >
                      <Text
                        className={`font-bold text-sm ${
                          isCurrentWeek
                            ? 'text-white'
                            : isDark
                            ? 'text-steel-300'
                            : 'text-steel-600'
                        }`}
                      >
                        W{week}
                      </Text>
                    </View>
                    <Text
                      className={`font-semibold ${
                        isDark ? 'text-steel-200' : 'text-steel-800'
                      }`}
                    >
                      Week {week}
                    </Text>
                    {isCurrentWeek && (
                      <View className="ml-2 px-2 py-0.5 rounded-full bg-forge-500/20">
                        <Text className="text-forge-500 text-xs font-semibold">
                          Current
                        </Text>
                      </View>
                    )}
                  </View>

                  <View className="px-4 gap-2">
                    {workouts
                      .sort((a, b) => (a.day_number || 0) - (b.day_number || 0))
                      .map((workout) => {
                        const isCompleted = !!workout.date_completed;
                        const isNext = workout.id === nextWorkout?.id;

                        return (
                          <Pressable
                            key={workout.id}
                            className={`p-4 rounded-xl flex-row items-center ${
                              isDark ? 'bg-steel-800' : 'bg-white'
                            } border ${
                              isNext
                                ? 'border-forge-500'
                                : isDark
                                ? 'border-steel-700'
                                : 'border-steel-200'
                            }`}
                            onPress={() => router.push(`/workout/${workout.id}`)}
                          >
                            <View
                              className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
                                isCompleted
                                  ? 'bg-success-500'
                                  : isNext
                                  ? 'bg-forge-500'
                                  : isDark
                                  ? 'bg-steel-700'
                                  : 'bg-steel-200'
                              }`}
                            >
                              {isCompleted ? (
                                <Ionicons name="checkmark" size={20} color="#ffffff" />
                              ) : (
                                <Text
                                  className={`font-bold ${
                                    isNext
                                      ? 'text-white'
                                      : isDark
                                      ? 'text-steel-400'
                                      : 'text-steel-500'
                                  }`}
                                >
                                  {workout.day_number || 1}
                                </Text>
                              )}
                            </View>
                            <View className="flex-1">
                              <Text
                                className={`font-semibold ${
                                  isDark ? 'text-steel-100' : 'text-steel-900'
                                }`}
                              >
                                Day {workout.day_number}: {workout.focus}
                              </Text>
                              <Text
                                className={`text-sm ${
                                  isDark ? 'text-steel-400' : 'text-steel-500'
                                }`}
                              >
                                {isCompleted
                                  ? `Completed ${new Date(workout.date_completed!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                                  : isNext
                                  ? 'Up next in your queue'
                                  : 'Pending'}
                              </Text>
                            </View>
                            {isNext && (
                              <View className="px-3 py-1 rounded-full bg-forge-500 mr-2">
                                <Text className="text-white text-xs font-semibold">
                                  Up Next
                                </Text>
                              </View>
                            )}
                            <Ionicons
                              name="chevron-forward"
                              size={20}
                              color={isDark ? '#808fb0' : '#607296'}
                            />
                          </Pressable>
                        );
                      })}
                  </View>
                </View>
              );
            })}

          {/* Empty state for no workouts */}
          {Object.keys(workoutsByWeek).length === 0 && (
            <View className="px-4 py-8 items-center">
              <Text className={`${isDark ? 'text-steel-400' : 'text-steel-500'}`}>
                No workouts scheduled for this block
              </Text>
            </View>
          )}

          {/* Bottom spacing */}
          <View className="h-8" />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
