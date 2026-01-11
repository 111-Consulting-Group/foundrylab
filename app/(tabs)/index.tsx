import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { View, Text, ScrollView, Pressable, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';
import { TemplatePicker } from '@/components/TemplatePicker';
import { useNextWorkout, useUpcomingWorkouts, usePushWorkouts, usePreviousPerformance, useWorkoutHistory } from '@/hooks/useWorkouts';
import { useRecentPRs } from '@/hooks/usePersonalRecords';
import { useActiveTrainingBlock } from '@/hooks/useTrainingBlocks';
import { useActiveGoals } from '@/hooks/useGoals';
import { useExerciseMemory } from '@/hooks/useExerciseMemory';
import { useWeekSummary } from '@/hooks/useWeekSummary';
import { useWorkoutTemplates } from '@/hooks/useWorkoutTemplates';
import { GoalCard } from '@/components/GoalCard';
import type { WorkoutTemplate } from '@/types/database';
import { suggestProgression } from '@/lib/autoProgress';
import { detectWorkoutContext, getContextInfo } from '@/lib/workoutContext';
import { calculateSetVolume } from '@/lib/utils';
import { useMemo } from 'react';
import type { WorkoutWithSets, Exercise } from '@/types/database';

export default function DashboardScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Modal states
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [showPushModal, setShowPushModal] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [showWeekSummary, setShowWeekSummary] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  // Quick recovery workout templates
  const recoveryTemplates = [
    {
      id: 'light-full-body',
      name: 'Light Full Body',
      description: 'Low intensity movement to prime your body',
      icon: 'body' as const,
      focus: 'Light Full Body',
    },
    {
      id: 'active-recovery',
      name: 'Active Recovery',
      description: 'Easy cardio and stretching',
      icon: 'walk' as const,
      focus: 'Active Recovery',
    },
    {
      id: 'mobility',
      name: 'Mobility Work',
      description: 'Joint mobility and flexibility',
      icon: 'fitness' as const,
      focus: 'Mobility',
    },
  ];

  // Fetch next workout in queue (flexible scheduling)
  const { data: nextWorkout, isLoading: workoutLoading } = useNextWorkout();
  const { data: upcomingWorkouts = [] } = useUpcomingWorkouts(5);
  const pushWorkouts = usePushWorkouts();
  const { data: activeBlock } = useActiveTrainingBlock();

  // Fetch recent PRs
  const { data: rawRecentPRs = [] } = useRecentPRs(3);

  // Fetch active goals
  const { data: activeGoals = [] } = useActiveGoals();

  // Fetch comprehensive week summary
  const { data: weekSummary } = useWeekSummary();

  // Fetch user's workout templates
  const { data: templates = [] } = useWorkoutTemplates();

  // Handler to start workout from template
  const handleStartFromTemplate = (template: WorkoutTemplate) => {
    // Navigate to new workout with template data in params
    // The workout screen will read these and populate exercises
    router.push({
      pathname: '/workout/new',
      params: {
        templateId: template.id,
        templateName: template.name,
        focus: template.focus || template.name,
      },
    });
    setShowTemplatePicker(false);
  };

  // Fetch workout history for weekly stats
  const { data: workoutHistory = [] } = useWorkoutHistory(50);

  // Calculate weekly stats
  const weeklyStats = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);
    
    const weekWorkouts = workoutHistory.filter((workout) => {
      if (!workout.date_completed) return false;
      const workoutDate = new Date(workout.date_completed);
      return workoutDate >= startOfWeek && workoutDate < endOfWeek;
    });
    
    let totalVolume = 0;
    const workoutDays = new Set<number>();
    
    weekWorkouts.forEach((workout) => {
      if (workout.date_completed) {
        const workoutDate = new Date(workout.date_completed);
        workoutDays.add(workoutDate.getDay());
        
        workout.workout_sets?.forEach((set) => {
          if (!set.is_warmup) {
            totalVolume += calculateSetVolume(set.actual_weight, set.actual_reps);
          }
        });
      }
    });
    
    return {
      completed: weekWorkouts.length,
      totalVolume,
      workoutDays: Array.from(workoutDays),
    };
  }, [workoutHistory]);

  // Memoize today's day of week (to avoid new Date() in render loop)
  const todayDayOfWeek = useMemo(() => new Date().getDay(), []);

  // Memoize unique exercises from next workout
  const nextWorkoutExercises = useMemo(() => {
    if (!nextWorkout?.workout_sets) return [];
    const uniqueExercises = new Map<string, Exercise>();
    nextWorkout.workout_sets.forEach((set) => {
      if (set.exercise && !uniqueExercises.has(set.exercise_id)) {
        uniqueExercises.set(set.exercise_id, set.exercise as Exercise);
      }
    });
    return Array.from(uniqueExercises.values()).slice(0, 2);
  }, [nextWorkout?.workout_sets]);

  // Handle starting a different workout from the queue
  const handleSwapWorkout = (workout: WorkoutWithSets) => {
    setShowSwapModal(false);
    router.push(`/workout/${workout.id}`);
  };

  // Handle pushing program forward
  const handlePushProgram = async (days: number) => {
    await pushWorkouts.mutateAsync({ days });
    setShowPushModal(false);
  };

  // Type assertion for PR data
  const recentPRs = rawRecentPRs as Array<{
    id: string;
    value: number;
    unit: string;
    achieved_at: string;
    exercise?: { name: string } | null;
  }>;

  // Format relative date
  const formatRelativeDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <SafeAreaView className={`flex-1 ${isDark ? 'bg-carbon-950' : 'bg-graphite-50'}`} edges={['left', 'right']}>
      <ScrollView className="flex-1 px-4">
        {/* Quick Actions */}
        <View className="mt-4 mb-6">
          <Text className={`text-lg font-bold mb-3 ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
            Quick Actions
          </Text>
          <View className="flex-row gap-3">
            <Link href="/block-builder" asChild>
              <Pressable className={`flex-1 p-4 rounded-xl ${isDark ? 'bg-signal-600' : 'bg-signal-500'}`}>
                <Ionicons name="sparkles" size={24} color="#ffffff" />
                <Text className="text-white font-semibold mt-2">AI Block Builder</Text>
                <Text className="text-graphite-50 text-sm mt-1">Generate program</Text>
              </Pressable>
            </Link>
            <Link href="/workout/new" asChild>
              <Pressable className={`flex-1 p-4 rounded-xl ${isDark ? 'bg-graphite-800' : 'bg-white'} border ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}>
                <Ionicons name="add-circle" size={24} color={isDark ? '#2F80ED' : '#2F80ED'} />
                <Text className={`font-semibold mt-2 ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
                  Quick Log
                </Text>
                <Text className={`text-sm mt-1 ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                  Log a workout
                </Text>
              </Pressable>
            </Link>
          </View>
          {/* Templates Section */}
          {templates.length > 0 && (
            <Pressable
              onPress={() => setShowTemplatePicker(true)}
              className={`flex-row items-center justify-between p-4 rounded-xl mt-3 ${isDark ? 'bg-graphite-800' : 'bg-white'} border ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}
            >
              <View className="flex-row items-center">
                <View className={`w-10 h-10 rounded-full items-center justify-center ${isDark ? 'bg-signal-500/20' : 'bg-signal-500/10'}`}>
                  <Ionicons name="bookmark" size={20} color="#2F80ED" />
                </View>
                <View className="ml-3">
                  <Text className={`font-semibold ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
                    From Template
                  </Text>
                  <Text className={`text-sm ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                    {templates.length} saved workout{templates.length > 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={isDark ? '#808fb0' : '#607296'} />
            </Pressable>
          )}
        </View>

        {/* Next Workout Card - Flexible Queue-Based */}
        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className={`text-lg font-bold ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
              Up Next
            </Text>
            {nextWorkout && (
              <Pressable
                onPress={() => setShowPushModal(true)}
                className="flex-row items-center"
              >
                <Ionicons name="calendar-outline" size={16} color={isDark ? '#808fb0' : '#607296'} />
                <Text className={`text-sm ml-1 ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                  Adjust Schedule
                </Text>
              </Pressable>
            )}
          </View>
          {nextWorkout ? (
            <View className={`rounded-xl ${isDark ? 'bg-graphite-800' : 'bg-white'} border ${isDark ? 'border-graphite-700' : 'border-graphite-200'} overflow-hidden`}>
              {/* Main workout info */}
              <Pressable
                className="p-5"
                onPress={() => router.push(`/workout/${nextWorkout.id}`)}
              >
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center">
                    <View className="w-10 h-10 rounded-full bg-signal-500 items-center justify-center mr-3">
                      <Text className="text-white font-bold">
                        W{nextWorkout.week_number || '1'}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2">
                        <Text className={`font-semibold ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
                          {nextWorkout.focus}
                        </Text>
                        {(() => {
                          const context = detectWorkoutContext(nextWorkout);
                          const contextInfo = getContextInfo(context);
                          return (
                            <View
                              className="px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: contextInfo.bgColor }}
                            >
                              <Text
                                className="text-xs font-semibold"
                                style={{ color: contextInfo.color }}
                              >
                                {contextInfo.label}
                              </Text>
                            </View>
                          );
                        })()}
                      </View>
                      <Text className={`text-sm ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                        {nextWorkout.week_number && nextWorkout.day_number
                          ? `Week ${nextWorkout.week_number} - Day ${nextWorkout.day_number}`
                          : 'Next in queue'}
                        {activeBlock && nextWorkout.week_number && activeBlock.duration_weeks && (
                          ` (${nextWorkout.week_number} of ${activeBlock.duration_weeks})`
                        )}
                      </Text>
                    </View>
                  </View>
                  <View className="bg-signal-500 px-3 py-1.5 rounded-full">
                    <Text className="text-white font-semibold text-sm">Start</Text>
                  </View>
                </View>
                <View className="flex-row flex-wrap gap-2 mb-3">
                  <View className={`px-3 py-1 rounded-full ${isDark ? 'bg-graphite-700' : 'bg-graphite-100'}`}>
                    <Text className={`text-sm ${isDark ? 'text-graphite-300' : 'text-graphite-600'}`}>
                      {nextWorkout.workout_sets?.length || 0} exercises
                    </Text>
                  </View>
                  {nextWorkout.duration_minutes && (
                    <View className={`px-3 py-1 rounded-full ${isDark ? 'bg-graphite-700' : 'bg-graphite-100'}`}>
                      <Text className={`text-sm ${isDark ? 'text-graphite-300' : 'text-graphite-600'}`}>
                        ~{nextWorkout.duration_minutes} min
                      </Text>
                    </View>
                  )}
                </View>
                
                {/* Progression Targets Preview - Show first 2 exercises */}
                {nextWorkoutExercises.length > 0 && (
                  <View className={`mt-3 pt-3 border-t ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}>
                    <Text className={`text-xs font-semibold mb-2 ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                      Key Exercises
                    </Text>
                    {nextWorkoutExercises.map((exercise) => (
                      <View key={exercise.id} className="mb-2">
                        <Text className={`text-sm ${isDark ? 'text-graphite-200' : 'text-graphite-800'}`}>
                          {exercise.name}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </Pressable>

              {/* Flexible action buttons */}
              <View className={`flex-row border-t ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}>
                <Pressable
                  className={`flex-1 flex-row items-center justify-center py-3 border-r ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}
                  onPress={() => setShowSwapModal(true)}
                >
                  <Ionicons name="swap-horizontal" size={18} color="#2F80ED" />
                  <Text className="text-signal-500 font-medium ml-2">Swap</Text>
                </Pressable>
                <Pressable
                  className="flex-1 flex-row items-center justify-center py-3"
                  onPress={() => setShowRecoveryModal(true)}
                >
                  <Ionicons name="fitness" size={18} color={isDark ? '#808fb0' : '#607296'} />
                  <Text className={`font-medium ml-2 ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                    Light Day
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              className={`p-5 rounded-xl ${isDark ? 'bg-graphite-800' : 'bg-white'} border border-dashed ${isDark ? 'border-graphite-600' : 'border-graphite-300'}`}
              onPress={() => router.push('/workout/new')}
            >
              <View className="items-center py-4">
                <Ionicons
                  name="checkmark-circle"
                  size={32}
                  color="#22c55e"
                />
                <Text className={`font-semibold mt-3 ${isDark ? 'text-graphite-300' : 'text-graphite-600'}`}>
                  No workouts in queue
                </Text>
                <Text className={`text-sm mt-1 ${isDark ? 'text-graphite-500' : 'text-graphite-400'}`}>
                  Build a new block or log a quick workout
                </Text>
              </View>
            </Pressable>
          )}
        </View>

        {/* Weekly Progress */}
        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className={`text-lg font-bold ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
              This Week
            </Text>
            <Pressable
              onPress={() => setShowWeekSummary(true)}
              className="flex-row items-center"
            >
              <Text className={`text-sm ${isDark ? 'text-signal-400' : 'text-signal-500'}`}>
                Details
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#2F80ED" />
            </Pressable>
          </View>
          <Pressable
            onPress={() => setShowWeekSummary(true)}
            className={`p-4 rounded-xl ${isDark ? 'bg-graphite-800' : 'bg-white'} border ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}
          >
            <View className="flex-row justify-between mb-4">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, dayIndex) => {
                const hasWorkout = (weekSummary?.workoutDays || weeklyStats.workoutDays).includes(dayIndex);
                const isToday = todayDayOfWeek === dayIndex;

                return (
                  <View key={dayIndex} className="items-center">
                    <Text className={`text-xs mb-2 ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                      {day}
                    </Text>
                    <View
                      className={`w-8 h-8 rounded-full items-center justify-center ${
                        hasWorkout
                          ? 'bg-progress-500'
                          : isToday
                          ? 'bg-signal-500'
                          : isDark
                          ? 'bg-graphite-700'
                          : 'bg-graphite-200'
                      }`}
                    >
                      {hasWorkout && <Ionicons name="checkmark" size={16} color="#ffffff" />}
                      {isToday && !hasWorkout && <Text className="text-white text-xs font-bold">!</Text>}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Stats Row */}
            <View className="flex-row justify-between mb-3">
              <View>
                <Text className={`text-2xl font-bold ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
                  {weekSummary?.workoutsCompleted || weeklyStats.completed}
                </Text>
                <Text className={`text-sm ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                  workouts
                </Text>
              </View>
              <View className="items-center">
                <Text className={`text-2xl font-bold text-signal-500`}>
                  {(weekSummary?.totalVolume || weeklyStats.totalVolume) >= 1000
                    ? `${((weekSummary?.totalVolume || weeklyStats.totalVolume) / 1000).toFixed(1)}k`
                    : Math.round(weekSummary?.totalVolume || weeklyStats.totalVolume).toLocaleString()}
                </Text>
                <Text className={`text-sm ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                  volume (lbs)
                </Text>
              </View>
              <View className="items-end">
                <Text className={`text-2xl font-bold text-oxide-500`}>
                  {weekSummary?.prsThisWeek.length || 0}
                </Text>
                <Text className={`text-sm ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                  PRs
                </Text>
              </View>
            </View>

            {/* Comparison badge */}
            {weekSummary?.comparison && weekSummary.comparison.volumeChange !== 0 && (
              <View className={`flex-row items-center justify-center py-2 rounded-lg ${
                weekSummary.comparison.isUp
                  ? 'bg-progress-500/10'
                  : 'bg-oxide-500/10'
              }`}>
                <Ionicons
                  name={weekSummary.comparison.isUp ? 'trending-up' : 'trending-down'}
                  size={16}
                  color={weekSummary.comparison.isUp ? '#22c55e' : '#EF4444'}
                />
                <Text className={`text-sm font-semibold ml-1 ${
                  weekSummary.comparison.isUp ? 'text-progress-500' : 'text-oxide-500'
                }`}>
                  {weekSummary.comparison.isUp ? '+' : ''}{weekSummary.comparison.volumeChange.toFixed(0)}% vs last week
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Active Goals */}
        {activeGoals.length > 0 && (
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-3">
              <Text className={`text-lg font-bold ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
                Goals
              </Text>
              <Pressable
                onPress={() => router.push('/goals')}
                className="flex-row items-center"
              >
                <Text className={`text-sm ${isDark ? 'text-signal-400' : 'text-signal-500'}`}>
                  View All
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#2F80ED" />
              </Pressable>
            </View>
            <View className="gap-3">
              {activeGoals.slice(0, 2).map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  onPress={() => router.push('/goals')}
                />
              ))}
            </View>
          </View>
        )}

        {/* Recent PRs */}
        <View className="mb-6">
          <Text className={`text-lg font-bold mb-3 ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
            Recent PRs
          </Text>
          {recentPRs.length > 0 ? (
            <View className="gap-2">
              {recentPRs.map((pr, index) => (
                <View
                  key={pr.id || index}
                  className={`p-4 rounded-xl flex-row items-center ${isDark ? 'bg-graphite-800' : 'bg-white'} border ${isDark ? 'border-oxide-500/30' : 'border-oxide-400/30'}`}
                >
                  <View className="w-10 h-10 rounded-full bg-oxide-500 items-center justify-center mr-3">
                    <Ionicons name="trophy" size={20} color="#ffffff" />
                  </View>
                  <View className="flex-1">
                    <Text className={`font-semibold ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
                      {pr.exercise?.name || 'Exercise'}
                    </Text>
                    <Text className={`text-sm ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                      {formatRelativeDate(pr.achieved_at)}
                    </Text>
                  </View>
                  <Text className="text-oxide-500 font-bold">
                    {pr.value} {pr.unit}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View className={`p-6 rounded-xl items-center ${isDark ? 'bg-graphite-800' : 'bg-white'} border ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}>
              <Ionicons
                name="trophy-outline"
                size={40}
                color={isDark ? '#607296' : '#808fb0'}
              />
              <Text className={`mt-3 font-medium ${isDark ? 'text-graphite-300' : 'text-graphite-600'}`}>
                No PRs yet
              </Text>
              <Text className={`text-sm mt-1 ${isDark ? 'text-graphite-500' : 'text-graphite-400'}`}>
                Start training to set some records!
              </Text>
            </View>
          )}
        </View>

        {/* Bottom spacing */}
        <View className="h-8" />
      </ScrollView>

      {/* Swap Workout Modal */}
      <Modal
        visible={showSwapModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSwapModal(false)}
      >
        <Pressable
          className="flex-1 bg-black/50 justify-end"
          onPress={() => setShowSwapModal(false)}
        >
          <Pressable
            className={`rounded-t-3xl ${isDark ? 'bg-graphite-900' : 'bg-white'} p-6`}
            onPress={(e) => e.stopPropagation()}
          >
            <View className="w-10 h-1 bg-graphite-400 rounded-full self-center mb-4" />
            <Text className={`text-xl font-bold mb-4 ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
              Choose a Workout
            </Text>
            <Text className={`mb-4 ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
              Pick any workout from your queue - do what feels right today.
            </Text>
            <View className="gap-2 mb-4">
              {upcomingWorkouts.map((workout, index) => (
                <Pressable
                  key={workout.id}
                  className={`p-4 rounded-xl flex-row items-center justify-between ${
                    index === 0
                      ? 'bg-signal-500/10 border border-signal-500/30'
                      : isDark
                      ? 'bg-graphite-800 border border-graphite-700'
                      : 'bg-graphite-50 border border-graphite-200'
                  }`}
                  onPress={() => handleSwapWorkout(workout)}
                >
                  <View className="flex-row items-center flex-1">
                    <View className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${
                      index === 0 ? 'bg-signal-500' : isDark ? 'bg-graphite-700' : 'bg-graphite-200'
                    }`}>
                      <Text className={`text-sm font-bold ${index === 0 ? 'text-white' : isDark ? 'text-graphite-300' : 'text-graphite-600'}`}>
                        {workout.day_number || index + 1}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className={`font-medium ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
                        {workout.focus}
                      </Text>
                      <Text className={`text-sm ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                        W{workout.week_number} D{workout.day_number} - {workout.workout_sets?.length || 0} exercises
                      </Text>
                    </View>
                  </View>
                  {index === 0 && (
                    <View className="bg-signal-500 px-2 py-0.5 rounded">
                      <Text className="text-white text-xs font-medium">Next</Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
            <Pressable
              className={`p-4 rounded-xl items-center ${isDark ? 'bg-graphite-800' : 'bg-graphite-100'}`}
              onPress={() => {
                setShowSwapModal(false);
                router.push('/workout/new');
              }}
            >
              <Text className={`font-medium ${isDark ? 'text-graphite-300' : 'text-graphite-600'}`}>
                + Start a Custom Workout
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Push Schedule Modal */}
      <Modal
        visible={showPushModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPushModal(false)}
      >
        <Pressable
          className="flex-1 bg-black/50 justify-end"
          onPress={() => setShowPushModal(false)}
        >
          <Pressable
            className={`rounded-t-3xl ${isDark ? 'bg-graphite-900' : 'bg-white'} p-6`}
            onPress={(e) => e.stopPropagation()}
          >
            <View className="w-10 h-1 bg-graphite-400 rounded-full self-center mb-4" />
            <Text className={`text-xl font-bold mb-2 ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
              Adjust Schedule
            </Text>
            <Text className={`mb-6 ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
              Push your remaining workouts forward. Life happens - your program adapts.
            </Text>
            <View className="gap-3">
              <Pressable
                className={`p-4 rounded-xl flex-row items-center justify-between ${isDark ? 'bg-graphite-800' : 'bg-graphite-50'} border ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}
                onPress={() => handlePushProgram(1)}
                disabled={pushWorkouts.isPending}
              >
                <View className="flex-row items-center">
                  <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${isDark ? 'bg-graphite-700' : 'bg-graphite-200'}`}>
                    <Ionicons name="add" size={20} color={isDark ? '#d3d8e4' : '#607296'} />
                  </View>
                  <View>
                    <Text className={`font-medium ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
                      Push 1 Day
                    </Text>
                    <Text className={`text-sm ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                      Take a rest day, resume tomorrow
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={isDark ? '#808fb0' : '#607296'} />
              </Pressable>
              <Pressable
                className={`p-4 rounded-xl flex-row items-center justify-between ${isDark ? 'bg-graphite-800' : 'bg-graphite-50'} border ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}
                onPress={() => handlePushProgram(3)}
                disabled={pushWorkouts.isPending}
              >
                <View className="flex-row items-center">
                  <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${isDark ? 'bg-graphite-700' : 'bg-graphite-200'}`}>
                    <Text className={`font-bold ${isDark ? 'text-graphite-300' : 'text-graphite-600'}`}>+3</Text>
                  </View>
                  <View>
                    <Text className={`font-medium ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
                      Push 3 Days
                    </Text>
                    <Text className={`text-sm ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                      Recovering from illness or travel
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={isDark ? '#808fb0' : '#607296'} />
              </Pressable>
              <Pressable
                className={`p-4 rounded-xl flex-row items-center justify-between ${isDark ? 'bg-graphite-800' : 'bg-graphite-50'} border ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}
                onPress={() => handlePushProgram(7)}
                disabled={pushWorkouts.isPending}
              >
                <View className="flex-row items-center">
                  <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${isDark ? 'bg-graphite-700' : 'bg-graphite-200'}`}>
                    <Text className={`font-bold ${isDark ? 'text-graphite-300' : 'text-graphite-600'}`}>+7</Text>
                  </View>
                  <View>
                    <Text className={`font-medium ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
                      Push 1 Week
                    </Text>
                    <Text className={`text-sm ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                      Deload week or extended break
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={isDark ? '#808fb0' : '#607296'} />
              </Pressable>
            </View>
            <Text className={`text-xs text-center mt-4 ${isDark ? 'text-graphite-500' : 'text-graphite-400'}`}>
              Your progress is based on workouts completed, not dates.
            </Text>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Recovery / Light Day Modal */}
      <Modal
        visible={showRecoveryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRecoveryModal(false)}
      >
        <Pressable
          className="flex-1 bg-black/50 justify-end"
          onPress={() => setShowRecoveryModal(false)}
        >
          <Pressable
            className={`rounded-t-3xl ${isDark ? 'bg-graphite-900' : 'bg-white'} p-6`}
            onPress={(e) => e.stopPropagation()}
          >
            <View className="w-10 h-1 bg-graphite-400 rounded-full self-center mb-4" />
            <Text className={`text-xl font-bold mb-2 ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
              Light Day Options
            </Text>
            <Text className={`mb-6 ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
              Not feeling 100%? That&apos;s okay. Pick something that works for today.
            </Text>
            <View className="gap-3">
              {recoveryTemplates.map((template) => (
                <Pressable
                  key={template.id}
                  className={`p-4 rounded-xl flex-row items-center ${isDark ? 'bg-graphite-800' : 'bg-graphite-50'} border ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}
                  onPress={() => {
                    setShowRecoveryModal(false);
                    router.push({
                      pathname: '/workout/[id]',
                      params: { id: 'new', focus: template.focus },
                    });
                  }}
                >
                  <View className={`w-12 h-12 rounded-full items-center justify-center mr-4 ${isDark ? 'bg-graphite-700' : 'bg-graphite-200'}`}>
                    <Ionicons name={template.icon} size={24} color={isDark ? '#d3d8e4' : '#607296'} />
                  </View>
                  <View className="flex-1">
                    <Text className={`font-semibold ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
                      {template.name}
                    </Text>
                    <Text className={`text-sm ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                      {template.description}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={isDark ? '#808fb0' : '#607296'} />
                </Pressable>
              ))}
            </View>
            <View className={`mt-4 pt-4 border-t ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}>
              <Pressable
                className={`p-4 rounded-xl items-center ${isDark ? 'bg-graphite-800' : 'bg-graphite-100'}`}
                onPress={() => {
                  setShowRecoveryModal(false);
                  router.push('/workout/new');
                }}
              >
                <Text className={`font-medium ${isDark ? 'text-graphite-300' : 'text-graphite-600'}`}>
                  Start from Scratch
                </Text>
              </Pressable>
            </View>
            <Text className={`text-xs text-center mt-4 ${isDark ? 'text-graphite-500' : 'text-graphite-400'}`}>
              Light days still count toward your progress.
            </Text>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Week Summary Modal */}
      <Modal
        visible={showWeekSummary}
        transparent
        animationType="slide"
        onRequestClose={() => setShowWeekSummary(false)}
      >
        <Pressable
          className="flex-1 bg-black/50 justify-end"
          onPress={() => setShowWeekSummary(false)}
        >
          <Pressable
            className={`rounded-t-3xl ${isDark ? 'bg-graphite-900' : 'bg-white'} p-6 max-h-[85%]`}
            onPress={(e) => e.stopPropagation()}
          >
            <View className="w-10 h-1 bg-graphite-400 rounded-full self-center mb-4" />
            <View className="flex-row items-center justify-between mb-4">
              <Text className={`text-xl font-bold ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
                Week Summary
              </Text>
              <Pressable onPress={() => setShowWeekSummary(false)}>
                <Ionicons name="close" size={24} color={isDark ? '#E6E8EB' : '#0E1116'} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Overview Stats */}
              <View className={`p-4 rounded-xl mb-4 ${isDark ? 'bg-graphite-800' : 'bg-graphite-50'}`}>
                <View className="flex-row justify-between">
                  <View className="items-center flex-1">
                    <Text className={`text-3xl font-bold ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
                      {weekSummary?.workoutsCompleted || 0}
                    </Text>
                    <Text className={`text-xs ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                      Workouts
                    </Text>
                  </View>
                  <View className="items-center flex-1">
                    <Text className={`text-3xl font-bold text-signal-500`}>
                      {weekSummary?.totalSets || 0}
                    </Text>
                    <Text className={`text-xs ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                      Sets
                    </Text>
                  </View>
                  <View className="items-center flex-1">
                    <Text className={`text-3xl font-bold text-progress-500`}>
                      {weekSummary?.totalDuration || 0}
                    </Text>
                    <Text className={`text-xs ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                      Minutes
                    </Text>
                  </View>
                </View>
              </View>

              {/* PRs This Week */}
              {weekSummary?.prsThisWeek && weekSummary.prsThisWeek.length > 0 && (
                <View className="mb-4">
                  <Text className={`text-sm font-semibold mb-2 ${isDark ? 'text-graphite-300' : 'text-graphite-600'}`}>
                    PRs This Week
                  </Text>
                  <View className="gap-2">
                    {weekSummary.prsThisWeek.map((pr, index) => (
                      <View
                        key={index}
                        className={`p-3 rounded-xl flex-row items-center ${isDark ? 'bg-oxide-500/10 border-oxide-500/30' : 'bg-oxide-500/10 border-oxide-500/30'} border`}
                      >
                        <Ionicons name="trophy" size={20} color="#EF4444" />
                        <View className="flex-1 ml-3">
                          <Text className={`font-medium ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
                            {pr.exerciseName}
                          </Text>
                          <Text className={`text-xs ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                            {pr.prType}
                          </Text>
                        </View>
                        <Text className="text-oxide-500 font-bold">
                          {pr.value} {pr.unit}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Muscle Groups Breakdown */}
              {weekSummary?.muscleGroups && weekSummary.muscleGroups.length > 0 && (
                <View className="mb-4">
                  <Text className={`text-sm font-semibold mb-2 ${isDark ? 'text-graphite-300' : 'text-graphite-600'}`}>
                    Volume by Muscle Group
                  </Text>
                  <View className="gap-2">
                    {weekSummary.muscleGroups.slice(0, 6).map((group, index) => {
                      const maxVolume = weekSummary.muscleGroups[0]?.volume || 1;
                      const percentage = (group.volume / maxVolume) * 100;

                      return (
                        <View key={index} className={`p-3 rounded-xl ${isDark ? 'bg-graphite-800' : 'bg-graphite-50'}`}>
                          <View className="flex-row items-center justify-between mb-1">
                            <Text className={`font-medium ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
                              {group.name}
                            </Text>
                            <Text className={`text-sm ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                              {group.sets} sets · {group.volume >= 1000 ? `${(group.volume / 1000).toFixed(1)}k` : group.volume} lbs
                            </Text>
                          </View>
                          <View className={`h-2 rounded-full ${isDark ? 'bg-graphite-700' : 'bg-graphite-200'}`}>
                            <View
                              className="h-2 rounded-full bg-signal-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Comparison to Last Week */}
              {weekSummary?.comparison && (
                <View className={`p-4 rounded-xl ${isDark ? 'bg-graphite-800' : 'bg-graphite-50'}`}>
                  <Text className={`text-sm font-semibold mb-3 ${isDark ? 'text-graphite-300' : 'text-graphite-600'}`}>
                    vs Last Week
                  </Text>
                  <View className="flex-row justify-between">
                    <View className="items-center flex-1">
                      <View className="flex-row items-center">
                        <Ionicons
                          name={weekSummary.comparison.isUp ? 'arrow-up' : 'arrow-down'}
                          size={16}
                          color={weekSummary.comparison.isUp ? '#22c55e' : '#EF4444'}
                        />
                        <Text className={`text-xl font-bold ml-1 ${
                          weekSummary.comparison.isUp ? 'text-progress-500' : 'text-oxide-500'
                        }`}>
                          {Math.abs(weekSummary.comparison.volumeChange).toFixed(0)}%
                        </Text>
                      </View>
                      <Text className={`text-xs ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                        Volume
                      </Text>
                    </View>
                    <View className="items-center flex-1">
                      <View className="flex-row items-center">
                        <Ionicons
                          name={weekSummary.comparison.workoutChange >= 0 ? 'arrow-up' : 'arrow-down'}
                          size={16}
                          color={weekSummary.comparison.workoutChange >= 0 ? '#22c55e' : '#EF4444'}
                        />
                        <Text className={`text-xl font-bold ml-1 ${
                          weekSummary.comparison.workoutChange >= 0 ? 'text-progress-500' : 'text-oxide-500'
                        }`}>
                          {Math.abs(weekSummary.comparison.workoutChange)}
                        </Text>
                      </View>
                      <Text className={`text-xs ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                        Workouts
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Empty State */}
              {!weekSummary || weekSummary.workoutsCompleted === 0 ? (
                <View className="items-center py-8">
                  <Ionicons
                    name="calendar-outline"
                    size={48}
                    color={isDark ? '#607296' : '#808fb0'}
                  />
                  <Text className={`mt-3 font-medium ${isDark ? 'text-graphite-300' : 'text-graphite-600'}`}>
                    No workouts this week yet
                  </Text>
                  <Text className={`text-sm mt-1 text-center ${isDark ? 'text-graphite-500' : 'text-graphite-400'}`}>
                    Start training to see your weekly stats!
                  </Text>
                </View>
              ) : null}

              <View className="h-6" />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Template Picker Modal */}
      <TemplatePicker
        visible={showTemplatePicker}
        onClose={() => setShowTemplatePicker(false)}
        onSelectTemplate={handleStartFromTemplate}
      />
    </SafeAreaView>
  );
}
