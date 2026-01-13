// Strength-specific entry component
// Focused set-by-set input with weight, reps, RPE

import { Ionicons } from '@expo/vector-icons';
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TextInput, Pressable, Alert, Platform } from 'react-native';
import Slider from '@react-native-community/slider';

import { useColorScheme } from '@/components/useColorScheme';
import { MovementMemoryCard, EmptyMemoryCard } from '@/components/MovementMemoryCard';
import { useMovementMemory, useNextTimeSuggestion } from '@/hooks/useMovementMemory';
import { type SetWithExercise } from '@/lib/workoutSummary';
import type { Exercise, WorkoutSetInsert } from '@/types/database';

const RPE_DESCRIPTIONS: Record<number, string> = {
  6: '4+ reps left',
  7: '2-3 reps left',
  8: '1-2 reps left',
  9: '1 rep left',
  10: 'Max effort',
};

interface StrengthEntryProps {
  exercise: Exercise;
  sets: SetWithExercise[];
  workoutId: string;
  targetReps?: number;
  targetRPE?: number;
  targetLoad?: number;
  onSaveSet: (
    exerciseId: string,
    setOrder: number,
    data: Omit<WorkoutSetInsert, 'workout_id' | 'exercise_id' | 'set_order'>
  ) => Promise<void>;
  onDeleteSet: (setId: string) => Promise<void>;
  onAddSet: () => void;
}

export function StrengthEntry({
  exercise,
  sets,
  workoutId,
  targetReps,
  targetRPE,
  targetLoad,
  onSaveSet,
  onDeleteSet,
  onAddSet,
}: StrengthEntryProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Fetch movement memory and suggestion (Training Intelligence)
  const { data: movementMemory } = useMovementMemory(exercise.id, workoutId);
  const { data: suggestion } = useNextTimeSuggestion(exercise.id, exercise.name, workoutId);

  // Form state - declare editingSetId first since it's used below
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [rpe, setRpe] = useState(targetRPE || 8);
  const [isBodyweight, setIsBodyweight] = useState(false);
  const [showRPESlider, setShowRPESlider] = useState(false);
  const [isLogging, setIsLogging] = useState(false);

  // Find logged and pending sets
  const loggedSets = sets.filter(
    (s) => s.actual_weight !== null || s.actual_reps !== null
  );
  const pendingSets = sets.filter(
    (s) => s.actual_weight === null && s.actual_reps === null
  );
  
  // If editing a set, use that set's index, otherwise use next pending set
  const editingSet = editingSetId ? sets.find(s => s.id === editingSetId) : null;
  const currentSetIndex = editingSet 
    ? sets.findIndex(s => s.id === editingSetId)
    : loggedSets.length;
  const currentSet = editingSet || sets[currentSetIndex];
  const totalSets = sets.length;

  // Initialize weight from target or memory (only once, don't reset if user has cleared it)
  useEffect(() => {
    if (weight === '' && !isBodyweight) {
      if (targetLoad) {
        setWeight(targetLoad.toString());
      } else if (movementMemory?.lastWeight) {
        setWeight(movementMemory.lastWeight.toString());
      }
    }
  }, [targetLoad, movementMemory?.lastWeight, isBodyweight]); // Remove 'weight' from deps to prevent reset loop

  // Initialize reps from target (only once, don't reset if user has cleared it)
  useEffect(() => {
    if (reps === '' && targetReps) {
      setReps(targetReps.toString());
    }
  }, [targetReps]); // Remove 'reps' from deps to prevent reset loop

  // Load set data when editing
  useEffect(() => {
    if (editingSet) {
      if (editingSet.actual_weight !== null) {
        if (editingSet.actual_weight === 0) {
          setIsBodyweight(true);
          setWeight('0');
        } else {
          setIsBodyweight(false);
          setWeight(editingSet.actual_weight.toString());
        }
      }
      if (editingSet.actual_reps !== null) {
        setReps(editingSet.actual_reps.toString());
      }
      if (editingSet.actual_rpe !== null) {
        setRpe(editingSet.actual_rpe);
      }
    } else {
      // Reset form when not editing
      if (!weight && !isBodyweight) {
        if (targetLoad) {
          setWeight(targetLoad.toString());
        } else if (movementMemory?.lastWeight) {
          setWeight(movementMemory.lastWeight.toString());
        }
      }
      if (!reps && targetReps) {
        setReps(targetReps.toString());
      }
    }
  }, [editingSet, targetLoad, targetReps, movementMemory?.lastWeight]);

  // Handle logging a set
  const handleLogSet = useCallback(async () => {
    const weightNum = isBodyweight ? 0 : parseFloat(weight) || 0;
    const repsNum = parseInt(reps) || 0;

    if ((!isBodyweight && weightNum <= 0) || repsNum <= 0) {
      Alert.alert('Missing Info', 'Please enter weight and reps.');
      return;
    }

    const setOrder = currentSet?.set_order || currentSetIndex + 1;

    setIsLogging(true);
    try {
      await onSaveSet(exercise.id, setOrder, {
        actual_weight: isBodyweight ? 0 : weightNum,
        actual_reps: repsNum,
        actual_rpe: rpe,
        is_warmup: false,
        is_pr: false,
        segment_type: 'work',
      });

      // If editing, stop editing. Otherwise, keep weight for next set, clear reps
      if (editingSetId) {
        setEditingSetId(null);
      } else {
        // Keep weight for next set, clear reps for fresh entry
        // (Most people do same weight across sets)
        setReps('');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to log set. Please try again.');
    } finally {
      setIsLogging(false);
    }
  }, [exercise.id, currentSet, currentSetIndex, weight, reps, rpe, isBodyweight, onSaveSet]);

  // Handle skip set
  const handleSkipSet = useCallback(() => {
    // Just move to next set without logging
    // This is handled by not doing anything - the UI will show next pending
    Alert.alert('Skip Set', 'Set skipped. Tap on it below to enter later.');
  }, []);

  // Handle delete set
  const handleDeleteSet = useCallback(
    async (setId: string) => {
      const confirmDelete = () => {
        if (Platform.OS === 'web') {
          return window.confirm('Delete this set?');
        }
        return new Promise<boolean>((resolve) => {
          Alert.alert('Delete Set', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
          ]);
        });
      };

      const confirmed = await confirmDelete();
      if (confirmed) {
        await onDeleteSet(setId);
      }
    },
    [onDeleteSet]
  );

  // Handle duplicate last set
  const handleDuplicate = useCallback(async () => {
    const loggedSets = sets.filter(
      (s) => s.actual_weight !== null && s.actual_reps !== null
    );
    
    if (loggedSets.length === 0) {
      Alert.alert('No Sets', 'Log at least one set before duplicating.');
      return;
    }

    const lastSet = loggedSets[loggedSets.length - 1];
    
    // Find the next empty set (one without actual_weight or actual_reps)
    const emptySet = sets.find(
      (s) => s.actual_weight === null && s.actual_reps === null
    );
    
    // If there's an empty set, fill it. Otherwise, create a new one.
    const setOrder = emptySet 
      ? emptySet.set_order 
      : Math.max(0, ...sets.map((s) => s.set_order)) + 1;

    setIsLogging(true);
    try {
      await onSaveSet(exercise.id, setOrder, {
        actual_weight: lastSet.actual_weight,
        actual_reps: lastSet.actual_reps,
        actual_rpe: lastSet.actual_rpe || rpe,
        is_warmup: false,
        is_pr: false,
        segment_type: 'work',
      });
      
      // Pre-fill form with duplicated values for quick editing
      if (lastSet.actual_weight !== null) {
        setWeight(lastSet.actual_weight.toString());
      }
      if (lastSet.actual_reps !== null) {
        setReps(lastSet.actual_reps.toString());
      }
      if (lastSet.actual_rpe !== null) {
        setRpe(lastSet.actual_rpe);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to duplicate set.');
    } finally {
      setIsLogging(false);
    }
  }, [exercise.id, sets, rpe, onSaveSet]);

  // All sets logged?
  const allComplete = currentSetIndex >= totalSets;

  // Handle applying suggestion to form
  const handleApplySuggestion = useCallback((suggestedWeight: number, suggestedReps: number) => {
    if (suggestedWeight > 0) {
      setWeight(suggestedWeight.toString());
      setIsBodyweight(false);
    }
    if (suggestedReps > 0) {
      setReps(suggestedReps.toString());
    }
  }, []);

  return (
    <View className="px-4 pt-4">
      {/* Movement Memory Card - shows last performance + suggestion */}
      {!allComplete && (
        <View className="mb-4">
          {movementMemory ? (
            <MovementMemoryCard
              memory={movementMemory}
              suggestion={suggestion}
              compact
              onApplySuggestion={handleApplySuggestion}
            />
          ) : (
            <EmptyMemoryCard />
          )}
        </View>
      )}

      {/* Current Set Entry */}
      {!allComplete ? (
        <View
          className={`p-4 rounded-xl mb-4 ${
            isDark ? 'bg-graphite-800' : 'bg-white'
          } border ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}
        >
          {/* Set indicator */}
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center">
              <View className="w-8 h-8 rounded-full bg-signal-500/30 items-center justify-center mr-2">
                <Text className="font-bold text-signal-500">
                  {currentSetIndex + 1}
                </Text>
              </View>
              <Text
                className={`font-semibold ${
                  isDark ? 'text-graphite-100' : 'text-graphite-900'
                }`}
              >
                Set {currentSetIndex + 1} of {totalSets}
              </Text>
            </View>
            {targetLoad && (
              <Text
                className={`text-sm ${
                  isDark ? 'text-graphite-400' : 'text-graphite-500'
                }`}
              >
                Target: {targetLoad} lbs
              </Text>
            )}
          </View>

          {/* Input Row */}
          <View className="flex-row items-end gap-3 mb-4">
            {/* Weight */}
            <View className="flex-1">
              <View className="flex-row items-center justify-between mb-1">
                <Text
                  className={`text-xs ${
                    isDark ? 'text-graphite-400' : 'text-graphite-500'
                  }`}
                >
                  Weight
                </Text>
                <Pressable
                  onPress={() => {
                    setIsBodyweight(!isBodyweight);
                    if (!isBodyweight) setWeight('0');
                  }}
                >
                  <View
                    className={`flex-row items-center px-2 py-0.5 rounded ${
                      isBodyweight
                        ? 'bg-signal-500/20'
                        : isDark
                        ? 'bg-graphite-700'
                        : 'bg-graphite-100'
                    }`}
                  >
                    <Ionicons
                      name={isBodyweight ? 'checkmark-circle' : 'ellipse-outline'}
                      size={14}
                      color={isBodyweight ? '#2F80ED' : isDark ? '#808fb0' : '#607296'}
                    />
                    <Text
                      className={`text-xs ml-1 ${
                        isBodyweight
                          ? 'text-signal-500 font-semibold'
                          : isDark
                          ? 'text-graphite-400'
                          : 'text-graphite-500'
                      }`}
                    >
                      BW
                    </Text>
                  </View>
                </Pressable>
              </View>
              <TextInput
                className={`px-3 py-3 rounded-lg text-center text-xl font-bold ${
                  isDark ? 'bg-graphite-900 text-graphite-100' : 'bg-graphite-50 text-graphite-900'
                } border ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}
                value={isBodyweight ? 'BW' : weight}
                onChangeText={isBodyweight ? undefined : setWeight}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={isDark ? '#607296' : '#808fb0'}
                editable={!isBodyweight}
              />
            </View>

            <Text
              className={`text-2xl pb-3 ${
                isDark ? 'text-graphite-500' : 'text-graphite-400'
              }`}
            >
              x
            </Text>

            {/* Reps */}
            <View className="flex-1">
              <Text
                className={`text-xs mb-1 ${
                  isDark ? 'text-graphite-400' : 'text-graphite-500'
                }`}
              >
                Reps
              </Text>
              <TextInput
                className={`px-3 py-3 rounded-lg text-center text-xl font-bold ${
                  isDark ? 'bg-graphite-900 text-graphite-100' : 'bg-graphite-50 text-graphite-900'
                } border ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}
                value={reps}
                onChangeText={setReps}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={isDark ? '#607296' : '#808fb0'}
              />
            </View>

            <Text
              className={`text-2xl pb-3 ${
                isDark ? 'text-graphite-500' : 'text-graphite-400'
              }`}
            >
              @
            </Text>

            {/* RPE */}
            <View className="flex-1">
              <Text
                className={`text-xs mb-1 ${
                  isDark ? 'text-graphite-400' : 'text-graphite-500'
                }`}
              >
                RPE
              </Text>
              <Pressable
                onPress={() => setShowRPESlider(!showRPESlider)}
                className={`px-3 py-3 rounded-lg items-center ${
                  isDark ? 'bg-graphite-900' : 'bg-graphite-50'
                } border ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}
              >
                <Text
                  className={`text-xl font-bold ${
                    rpe >= 9 ? 'text-oxide-500' : isDark ? 'text-graphite-100' : 'text-graphite-900'
                  }`}
                >
                  {rpe}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* RPE Slider */}
          {showRPESlider && (
            <View
              className={`p-3 rounded-lg mb-4 ${
                isDark ? 'bg-graphite-900' : 'bg-graphite-50'
              }`}
            >
              <View className="flex-row justify-between mb-2">
                <Text
                  className={`text-sm ${
                    isDark ? 'text-graphite-400' : 'text-graphite-500'
                  }`}
                >
                  RPE {rpe}
                </Text>
                <Text
                  className={`text-sm ${
                    isDark ? 'text-graphite-400' : 'text-graphite-500'
                  }`}
                >
                  {RPE_DESCRIPTIONS[Math.round(rpe)] || ''}
                </Text>
              </View>
              <Slider
                minimumValue={6}
                maximumValue={10}
                step={0.5}
                value={rpe}
                onValueChange={setRpe}
                minimumTrackTintColor="#2F80ED"
                maximumTrackTintColor={isDark ? '#353D4B' : '#A5ABB6'}
                thumbTintColor="#2F80ED"
              />
            </View>
          )}

          {/* Action Buttons */}
          <View className="flex-row gap-3">
            {editingSetId && (
              <Pressable
                onPress={() => setEditingSetId(null)}
                className="px-4 py-3 rounded-xl border border-graphite-300 items-center"
              >
                <Text className={`font-semibold ${isDark ? 'text-graphite-300' : 'text-graphite-700'}`}>
                  Cancel
                </Text>
              </Pressable>
            )}
            <Pressable
              onPress={handleLogSet}
              disabled={isLogging}
              className={`flex-1 py-3 rounded-xl bg-signal-500 items-center ${
                isLogging ? 'opacity-50' : ''
              }`}
            >
              <Text className="text-white font-semibold text-lg">
                {isLogging ? 'Logging...' : editingSetId ? 'Update Set' : 'Log Set'}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        /* All Complete Message */
        <View
          className={`p-4 rounded-xl mb-4 ${
            isDark ? 'bg-progress-500/10' : 'bg-progress-500/5'
          } border ${isDark ? 'border-progress-500/30' : 'border-progress-500/20'}`}
        >
          <View className="flex-row items-center justify-center">
            <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
            <Text className="ml-2 text-progress-500 font-semibold text-lg">
              All sets complete!
            </Text>
          </View>
        </View>
      )}

      {/* Set List */}
      <View>
        <Text
          className={`text-sm font-semibold mb-3 ${
            isDark ? 'text-graphite-300' : 'text-graphite-600'
          }`}
        >
          Sets
        </Text>

        {sets.map((set, index) => {
          const isLogged = set.actual_weight !== null || set.actual_reps !== null;
          const isCurrent = index === currentSetIndex;

          return (
            <View
              key={set.id || index}
              className={`flex-row items-center p-3 rounded-xl mb-2 ${
                isLogged
                  ? isDark
                    ? 'bg-progress-500/10'
                    : 'bg-progress-500/5'
                  : isCurrent
                  ? isDark
                    ? 'bg-signal-500/10'
                    : 'bg-signal-500/5'
                  : isDark
                  ? 'bg-graphite-800'
                  : 'bg-graphite-100'
              } border ${
                isLogged
                  ? isDark
                    ? 'border-progress-500/30'
                    : 'border-progress-500/20'
                  : isCurrent
                  ? isDark
                    ? 'border-signal-500/30'
                    : 'border-signal-500/20'
                  : isDark
                  ? 'border-graphite-700'
                  : 'border-graphite-200'
              }`}
            >
              {/* Status icon */}
              <View className="mr-3">
                {isLogged ? (
                  <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                ) : isCurrent ? (
                  <View className="w-5 h-5 rounded-full border-2 border-signal-500 items-center justify-center">
                    <View className="w-2 h-2 rounded-full bg-signal-500" />
                  </View>
                ) : (
                  <View
                    className={`w-5 h-5 rounded-full border-2 ${
                      isDark ? 'border-graphite-600' : 'border-graphite-300'
                    }`}
                  />
                )}
              </View>

              {/* Set info - make logged sets clickable to edit */}
              <Pressable
                className="flex-1"
                onPress={() => {
                  if (isLogged && set.id) {
                    setEditingSetId(set.id);
                  }
                }}
                disabled={!isLogged || !set.id}
              >
                <Text
                  className={`font-medium ${
                    isLogged
                      ? editingSetId === set.id
                        ? 'text-signal-500'
                        : 'text-progress-600'
                      : isCurrent
                      ? 'text-signal-500'
                      : isDark
                      ? 'text-graphite-400'
                      : 'text-graphite-500'
                  }`}
                >
                  Set {index + 1}
                  {isLogged && set.actual_weight !== null && set.actual_reps !== null
                    ? `: ${set.actual_weight} x ${set.actual_reps}${
                        set.actual_rpe ? ` @ ${set.actual_rpe}` : ''
                      }${editingSetId === set.id ? ' (editing)' : ''}`
                    : isCurrent
                    ? ' (current)'
                    : ''}
                </Text>
              </Pressable>

              {/* Action buttons for logged sets */}
              {isLogged && set.id && (
                <View className="flex-row items-center gap-2">
                  {editingSetId === set.id && (
                    <Pressable
                      onPress={() => setEditingSetId(null)}
                      className="p-1"
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="close-circle-outline" size={18} color={isDark ? '#808fb0' : '#607296'} />
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => handleDeleteSet(set.id)}
                    className="p-1"
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="trash-outline" size={16} color="#ef4444" />
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}

        {/* Duplicate and Add Set Buttons */}
        <View className="flex-row gap-2 mt-2">
          {loggedSets.length > 0 && (
            <Pressable
              onPress={handleDuplicate}
              disabled={isLogging}
              className={`flex-1 flex-row items-center justify-center py-3 rounded-xl border ${
                isDark ? 'border-signal-500/50 bg-signal-500/10' : 'border-signal-500/50 bg-signal-500/10'
              } ${isLogging ? 'opacity-50' : ''}`}
            >
              <Ionicons
                name="copy-outline"
                size={18}
                color="#2F80ED"
              />
              <Text className="ml-2 text-signal-500 font-semibold text-sm">
                + Duplicate
              </Text>
            </Pressable>
          )}
          <Pressable
            onPress={onAddSet}
            className={`flex-1 flex-row items-center justify-center py-3 rounded-xl border border-dashed ${
              isDark ? 'border-graphite-600' : 'border-graphite-300'
            }`}
          >
            <Ionicons
              name="add-circle-outline"
              size={18}
              color={isDark ? '#808fb0' : '#607296'}
            />
            <Text
              className={`ml-2 font-medium ${
                isDark ? 'text-graphite-400' : 'text-graphite-500'
              }`}
            >
              + Add Set
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
