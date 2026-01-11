/**
 * Goals Page
 *
 * View, create, and manage fitness goals
 */

import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, Modal, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';
import { GoalCard } from '@/components/GoalCard';
import {
  useAllGoals,
  useCreateGoal,
  useUpdateGoalStatus,
  useDeleteGoal,
  type GoalType,
  type FitnessGoal,
  calculateGoalProgress,
} from '@/hooks/useGoals';
import { useMainLiftPRs } from '@/hooks/usePersonalRecords';

export default function GoalsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const { data: goals = [], isLoading } = useAllGoals();
  const { data: mainLiftPRs = [] } = useMainLiftPRs();
  const createGoal = useCreateGoal();
  const updateStatus = useUpdateGoalStatus();
  const deleteGoal = useDeleteGoal();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<{ id: string; name: string; currentPR: number | null } | null>(null);
  const [targetValue, setTargetValue] = useState('');
  const [targetDate, setTargetDate] = useState('');

  // Memoize filtered goals to avoid recomputation on every render
  const activeGoals = useMemo(() => goals.filter((g) => g.status === 'active'), [goals]);
  const achievedGoals = useMemo(() => goals.filter((g) => g.status === 'achieved'), [goals]);

  // Memoize exercise options (main lifts with their current PRs)
  const exerciseOptions = useMemo(() => mainLiftPRs.map((lift) => ({
    id: lift.exerciseId,
    name: lift.exerciseName,
    currentPR: lift.e1rm,
  })), [mainLiftPRs]);

  const handleCreateGoal = async () => {
    if (!selectedExercise || !targetValue) return;

    try {
      await createGoal.mutateAsync({
        exercise_id: selectedExercise.id,
        goal_type: 'e1rm' as GoalType,
        target_value: parseFloat(targetValue),
        target_unit: 'lbs',
        starting_value: selectedExercise.currentPR || undefined,
        current_value: selectedExercise.currentPR || undefined,
        target_date: targetDate || undefined,
      });

      setShowCreateModal(false);
      setSelectedExercise(null);
      setTargetValue('');
      setTargetDate('');
    } catch (error) {
      console.error('Failed to create goal:', error);
    }
  };

  const handleAbandonGoal = async (goalId: string) => {
    try {
      await updateStatus.mutateAsync({ goalId, status: 'abandoned' });
    } catch (error) {
      console.error('Failed to abandon goal:', error);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Goals',
          headerStyle: { backgroundColor: isDark ? '#0E1116' : '#ffffff' },
          headerTintColor: isDark ? '#E6E8EB' : '#0E1116',
        }}
      />
      <SafeAreaView className={`flex-1 ${isDark ? 'bg-carbon-950' : 'bg-graphite-50'}`} edges={['left', 'right']}>
        <ScrollView className="flex-1 px-4">
          {/* Header */}
          <View className="flex-row items-center justify-between mt-4 mb-6">
            <View>
              <Text className={`text-2xl font-bold ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
                Your Goals
              </Text>
              <Text className={`text-sm mt-1 ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                Track progress toward your targets
              </Text>
            </View>
            <Pressable
              onPress={() => setShowCreateModal(true)}
              className="flex-row items-center px-4 py-2 rounded-full bg-signal-500"
            >
              <Ionicons name="add" size={20} color="#ffffff" />
              <Text className="text-white font-semibold ml-1">New Goal</Text>
            </Pressable>
          </View>

          {isLoading ? (
            <View className="items-center justify-center py-12">
              <ActivityIndicator size="large" color="#2F80ED" />
            </View>
          ) : activeGoals.length === 0 && achievedGoals.length === 0 ? (
            <View className={`p-8 rounded-xl items-center ${isDark ? 'bg-graphite-800' : 'bg-white'} border ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}>
              <Ionicons
                name="flag-outline"
                size={64}
                color={isDark ? '#353D4B' : '#A5ABB6'}
              />
              <Text className={`mt-4 text-lg font-semibold ${isDark ? 'text-graphite-200' : 'text-graphite-800'}`}>
                No Goals Yet
              </Text>
              <Text className={`mt-2 text-center ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                Set a goal to track your progress.{'\n'}
                What do you want to achieve?
              </Text>
              <Pressable
                onPress={() => setShowCreateModal(true)}
                className="mt-6 px-6 py-3 rounded-full bg-signal-500"
              >
                <Text className="text-white font-semibold">Set Your First Goal</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {/* Active Goals */}
              {activeGoals.length > 0 && (
                <View className="mb-6">
                  <Text className={`text-lg font-bold mb-3 ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
                    Active Goals
                  </Text>
                  <View className="gap-3">
                    {activeGoals.map((goal) => (
                      <GoalCard key={goal.id} goal={goal} />
                    ))}
                  </View>
                </View>
              )}

              {/* Achieved Goals */}
              {achievedGoals.length > 0 && (
                <View className="mb-6">
                  <Text className={`text-lg font-bold mb-3 ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
                    Achieved
                  </Text>
                  <View className="gap-3">
                    {achievedGoals.map((goal) => (
                      <GoalCard key={goal.id} goal={goal} />
                    ))}
                  </View>
                </View>
              )}
            </>
          )}

          <View className="h-8" />
        </ScrollView>

        {/* Create Goal Modal */}
        <Modal
          visible={showCreateModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowCreateModal(false)}
        >
          <Pressable
            className="flex-1 bg-black/50 justify-end"
            onPress={() => setShowCreateModal(false)}
          >
            <Pressable
              className={`rounded-t-3xl ${isDark ? 'bg-graphite-900' : 'bg-white'} p-6`}
              onPress={(e) => e.stopPropagation()}
            >
              <View className="w-10 h-1 bg-graphite-400 rounded-full self-center mb-4" />
              <Text className={`text-xl font-bold mb-2 ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
                Set a New Goal
              </Text>
              <Text className={`mb-6 ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                What do you want to achieve?
              </Text>

              {/* Exercise Selection */}
              <Text className={`text-sm font-semibold mb-2 ${isDark ? 'text-graphite-300' : 'text-graphite-700'}`}>
                Exercise
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                <View className="flex-row gap-2">
                  {exerciseOptions.map((exercise) => (
                    <Pressable
                      key={exercise.id}
                      className={`px-4 py-3 rounded-xl border ${
                        selectedExercise?.id === exercise.id
                          ? 'bg-signal-500/20 border-signal-500'
                          : isDark
                          ? 'bg-graphite-800 border-graphite-700'
                          : 'bg-graphite-50 border-graphite-200'
                      }`}
                      onPress={() => setSelectedExercise(exercise)}
                    >
                      <Text
                        className={`font-medium ${
                          selectedExercise?.id === exercise.id
                            ? 'text-signal-500'
                            : isDark
                            ? 'text-graphite-200'
                            : 'text-graphite-800'
                        }`}
                      >
                        {exercise.name}
                      </Text>
                      {exercise.currentPR && (
                        <Text className={`text-xs mt-1 ${isDark ? 'text-graphite-500' : 'text-graphite-400'}`}>
                          Current: {exercise.currentPR} lbs
                        </Text>
                      )}
                    </Pressable>
                  ))}
                </View>
              </ScrollView>

              {/* Target Value */}
              <Text className={`text-sm font-semibold mb-2 ${isDark ? 'text-graphite-300' : 'text-graphite-700'}`}>
                Target (lbs)
              </Text>
              <View
                className={`flex-row items-center px-4 py-3 rounded-xl mb-4 ${
                  isDark ? 'bg-graphite-800' : 'bg-graphite-50'
                } border ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}
              >
                <TextInput
                  className={`flex-1 text-lg font-semibold ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}
                  placeholder="405"
                  placeholderTextColor={isDark ? '#808fb0' : '#A5ABB6'}
                  value={targetValue}
                  onChangeText={setTargetValue}
                  keyboardType="numeric"
                />
                <Text className={`text-lg ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>lbs</Text>
              </View>

              {/* Current vs Target */}
              {selectedExercise?.currentPR && targetValue && (
                <View className={`p-4 rounded-xl mb-4 ${isDark ? 'bg-graphite-800' : 'bg-graphite-100'}`}>
                  <View className="flex-row items-center justify-between">
                    <View>
                      <Text className={`text-xs ${isDark ? 'text-graphite-500' : 'text-graphite-400'}`}>
                        Current
                      </Text>
                      <Text className={`text-xl font-bold ${isDark ? 'text-graphite-300' : 'text-graphite-700'}`}>
                        {selectedExercise.currentPR}
                      </Text>
                    </View>
                    <Ionicons name="arrow-forward" size={24} color="#2F80ED" />
                    <View className="items-end">
                      <Text className={`text-xs ${isDark ? 'text-graphite-500' : 'text-graphite-400'}`}>
                        Target
                      </Text>
                      <Text className="text-xl font-bold text-signal-500">
                        {targetValue}
                      </Text>
                    </View>
                  </View>
                  <Text className={`text-sm mt-2 text-center ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                    +{(parseFloat(targetValue) - selectedExercise.currentPR).toFixed(0)} lbs to go
                  </Text>
                </View>
              )}

              {/* Action Buttons */}
              <View className="flex-row gap-3 mt-2">
                <Pressable
                  className={`flex-1 py-4 rounded-xl items-center ${isDark ? 'bg-graphite-800' : 'bg-graphite-100'}`}
                  onPress={() => setShowCreateModal(false)}
                >
                  <Text className={`font-semibold ${isDark ? 'text-graphite-300' : 'text-graphite-600'}`}>
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  className={`flex-1 py-4 rounded-xl items-center ${
                    selectedExercise && targetValue ? 'bg-signal-500' : 'bg-graphite-400'
                  }`}
                  onPress={handleCreateGoal}
                  disabled={!selectedExercise || !targetValue || createGoal.isPending}
                >
                  <Text className="text-white font-semibold">
                    {createGoal.isPending ? 'Creating...' : 'Set Goal'}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </>
  );
}
