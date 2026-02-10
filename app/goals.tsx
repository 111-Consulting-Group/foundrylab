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

import { GoalCard } from '@/components/GoalCard';
import { Colors } from '@/constants/Colors';
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
          headerStyle: { backgroundColor: Colors.void[900] },
          headerTintColor: Colors.graphite[50],
        }}
      />
      <View style={{ flex: 1, backgroundColor: Colors.void[900] }}>
        {/* Ambient Background Glows */}
        <View pointerEvents="none" style={{ position: 'absolute', top: -60, right: -100, width: 260, height: 260, backgroundColor: 'rgba(37, 99, 235, 0.06)', borderRadius: 130 }} />
        <View pointerEvents="none" style={{ position: 'absolute', bottom: 100, left: -80, width: 220, height: 220, backgroundColor: 'rgba(37, 99, 235, 0.04)', borderRadius: 110 }} />

        <SafeAreaView style={{ flex: 1 }} edges={['left', 'right']}>
          <ScrollView style={{ flex: 1, paddingHorizontal: 16 }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 24 }}>
              <View>
                <Text style={{ fontSize: 24, fontWeight: '700', color: Colors.graphite[50] }}>
                  Your Goals
                </Text>
                <Text style={{ fontSize: 14, marginTop: 4, color: Colors.graphite[400] }}>
                  Track progress toward your targets
                </Text>
              </View>
              <Pressable
                onPress={() => setShowCreateModal(true)}
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 24, backgroundColor: Colors.signal[500] }}
              >
                <Ionicons name="add" size={20} color="#ffffff" />
                <Text style={{ color: '#fff', fontWeight: '600', marginLeft: 4 }}>New Goal</Text>
              </Pressable>
            </View>

            {isLoading ? (
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
                <ActivityIndicator size="large" color={Colors.signal[500]} />
              </View>
            ) : activeGoals.length === 0 && achievedGoals.length === 0 ? (
              <View
                style={{
                  padding: 32,
                  borderRadius: 16,
                  alignItems: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                }}
              >
                <Ionicons name="flag-outline" size={64} color={Colors.graphite[600]} />
                <Text style={{ marginTop: 16, fontSize: 18, fontWeight: '600', color: Colors.graphite[200] }}>
                  No Goals Yet
                </Text>
                <Text style={{ marginTop: 8, textAlign: 'center', color: Colors.graphite[400] }}>
                  Set a goal to track your progress.{'\n'}
                  What do you want to achieve?
                </Text>
                <Pressable
                  onPress={() => setShowCreateModal(true)}
                  style={{ marginTop: 24, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, backgroundColor: Colors.signal[500] }}
                >
                  <Text style={{ color: '#fff', fontWeight: '600' }}>Set Your First Goal</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {/* Active Goals */}
                {activeGoals.length > 0 && (
                  <View style={{ marginBottom: 24 }}>
                    <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 12, color: Colors.graphite[50] }}>
                      Active Goals
                    </Text>
                    <View style={{ gap: 12 }}>
                      {activeGoals.map((goal) => (
                        <GoalCard key={goal.id} goal={goal} />
                      ))}
                    </View>
                  </View>
                )}

                {/* Achieved Goals */}
                {achievedGoals.length > 0 && (
                  <View style={{ marginBottom: 24 }}>
                    <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 12, color: Colors.graphite[50] }}>
                      Achieved
                    </Text>
                    <View style={{ gap: 12 }}>
                      {achievedGoals.map((goal) => (
                        <GoalCard key={goal.id} goal={goal} />
                      ))}
                    </View>
                  </View>
                )}
              </>
            )}

            <View style={{ height: 32 }} />
          </ScrollView>

          {/* Create Goal Modal */}
          <Modal
            visible={showCreateModal}
            transparent
            animationType="slide"
            onRequestClose={() => setShowCreateModal(false)}
          >
            <Pressable
              style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' }}
              onPress={() => setShowCreateModal(false)}
            >
              <Pressable
                style={{
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  backgroundColor: Colors.void[800],
                  padding: 24,
                  borderWidth: 1,
                  borderBottomWidth: 0,
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                }}
                onPress={(e) => e.stopPropagation()}
              >
                <View style={{ width: 40, height: 4, backgroundColor: Colors.graphite[600], borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />
                <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 8, color: Colors.graphite[50] }}>
                  Set a New Goal
                </Text>
                <Text style={{ marginBottom: 24, color: Colors.graphite[400] }}>
                  What do you want to achieve?
                </Text>

                {/* Exercise Selection */}
                <Text style={{ fontSize: 12, fontWeight: '600', marginBottom: 8, color: Colors.graphite[300] }}>
                  Exercise
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {exerciseOptions.map((exercise) => (
                      <Pressable
                        key={exercise.id}
                        style={{
                          paddingHorizontal: 16,
                          paddingVertical: 12,
                          borderRadius: 12,
                          borderWidth: 1,
                          backgroundColor: selectedExercise?.id === exercise.id ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                          borderColor: selectedExercise?.id === exercise.id ? Colors.signal[500] : 'rgba(255, 255, 255, 0.1)',
                        }}
                        onPress={() => setSelectedExercise(exercise)}
                      >
                        <Text style={{ fontWeight: '500', color: selectedExercise?.id === exercise.id ? Colors.signal[400] : Colors.graphite[200] }}>
                          {exercise.name}
                        </Text>
                        {exercise.currentPR && (
                          <Text style={{ fontSize: 10, marginTop: 4, color: Colors.graphite[500] }}>
                            Current: {exercise.currentPR} lbs
                          </Text>
                        )}
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>

                {/* Target Value */}
                <Text style={{ fontSize: 12, fontWeight: '600', marginBottom: 8, color: Colors.graphite[300] }}>
                  Target (lbs)
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderRadius: 12,
                    marginBottom: 16,
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <TextInput
                    style={{ flex: 1, fontSize: 18, fontWeight: '600', color: Colors.graphite[50] }}
                    placeholder="405"
                    placeholderTextColor={Colors.graphite[500]}
                    value={targetValue}
                    onChangeText={setTargetValue}
                    keyboardType="numeric"
                  />
                  <Text style={{ fontSize: 18, color: Colors.graphite[400] }}>lbs</Text>
                </View>

                {/* Current vs Target */}
                {selectedExercise?.currentPR && targetValue && (
                  <View style={{ padding: 16, borderRadius: 12, marginBottom: 16, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View>
                        <Text style={{ fontSize: 10, color: Colors.graphite[500] }}>Current</Text>
                        <Text style={{ fontSize: 20, fontWeight: '700', color: Colors.graphite[300] }}>
                          {selectedExercise.currentPR}
                        </Text>
                      </View>
                      <Ionicons name="arrow-forward" size={24} color={Colors.signal[400]} />
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 10, color: Colors.graphite[500] }}>Target</Text>
                        <Text style={{ fontSize: 20, fontWeight: '700', color: Colors.signal[400] }}>
                          {targetValue}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 14, marginTop: 8, textAlign: 'center', color: Colors.graphite[400] }}>
                      +{(parseFloat(targetValue) - selectedExercise.currentPR).toFixed(0)} lbs to go
                    </Text>
                  </View>
                )}

                {/* Action Buttons */}
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                  <Pressable
                    style={{ flex: 1, paddingVertical: 16, borderRadius: 12, alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                    onPress={() => setShowCreateModal(false)}
                  >
                    <Text style={{ fontWeight: '600', color: Colors.graphite[300] }}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={{
                      flex: 1,
                      paddingVertical: 16,
                      borderRadius: 12,
                      alignItems: 'center',
                      backgroundColor: selectedExercise && targetValue ? Colors.signal[500] : Colors.graphite[600],
                    }}
                    onPress={handleCreateGoal}
                    disabled={!selectedExercise || !targetValue || createGoal.isPending}
                  >
                    <Text style={{ color: '#fff', fontWeight: '600' }}>
                      {createGoal.isPending ? 'Creating...' : 'Set Goal'}
                    </Text>
                  </Pressable>
                </View>
              </Pressable>
            </Pressable>
          </Modal>
        </SafeAreaView>
      </View>
    </>
  );
}
