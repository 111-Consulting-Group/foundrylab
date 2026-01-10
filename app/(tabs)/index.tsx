import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { View, Text, ScrollView, Pressable, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';
import { useNextWorkout, useUpcomingWorkouts, usePushWorkouts } from '@/hooks/useWorkouts';
import { useRecentPRs } from '@/hooks/usePersonalRecords';
import type { WorkoutWithSets } from '@/types/database';

export default function DashboardScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Modal states
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [showPushModal, setShowPushModal] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);

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

  // Fetch recent PRs
  const { data: rawRecentPRs = [] } = useRecentPRs(3);

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
                    <View>
                      <Text className={`font-semibold ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
                        {nextWorkout.focus}
                      </Text>
                      <Text className={`text-sm ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                        {nextWorkout.week_number && nextWorkout.day_number
                          ? `Week ${nextWorkout.week_number} - Day ${nextWorkout.day_number}`
                          : 'Next in queue'}
                      </Text>
                    </View>
                  </View>
                  <View className="bg-signal-500 px-3 py-1.5 rounded-full">
                    <Text className="text-white font-semibold text-sm">Start</Text>
                  </View>
                </View>
                <View className="flex-row flex-wrap gap-2">
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
          <Text className={`text-lg font-bold mb-3 ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
            This Week
          </Text>
          <View className={`p-4 rounded-xl ${isDark ? 'bg-graphite-800' : 'bg-white'} border ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}>
            <View className="flex-row justify-between mb-4">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
                <View key={index} className="items-center">
                  <Text className={`text-xs mb-2 ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                    {day}
                  </Text>
                  <View
                    className={`w-8 h-8 rounded-full items-center justify-center ${
                      index < 3
                        ? 'bg-progress-500'
                        : index === 3
                        ? 'bg-signal-500'
                        : isDark
                        ? 'bg-graphite-700'
                        : 'bg-graphite-200'
                    }`}
                  >
                    {index < 3 && <Ionicons name="checkmark" size={16} color="#ffffff" />}
                    {index === 3 && <Text className="text-white text-xs font-bold">!</Text>}
                  </View>
                </View>
              ))}
            </View>
            <View className="flex-row justify-between">
              <View>
                <Text className={`text-2xl font-bold ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
                  3/5
                </Text>
                <Text className={`text-sm ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                  workouts completed
                </Text>
              </View>
              <View className="items-end">
                <Text className={`text-2xl font-bold text-signal-500`}>12,450</Text>
                <Text className={`text-sm ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                  total volume (lbs)
                </Text>
              </View>
            </View>
          </View>
        </View>

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
    </SafeAreaView>
  );
}
