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
import { LabButton, LabCard } from '@/components/ui/LabPrimitives';

const RPE_DESCRIPTIONS: Record<number, string> = {
  6: '4+ reps left',
  7: '3 reps left',
  8: '2 reps left',
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
  
  // If editing a set, use that set's index, otherwise use next pending set
  const editingSet = editingSetId ? sets.find(s => s.id === editingSetId) : null;
  const currentSetIndex = editingSet 
    ? sets.findIndex(s => s.id === editingSetId)
    : loggedSets.length;
  const currentSet = editingSet || sets[currentSetIndex];
  const totalSets = sets.length;

  // Initialize weight from target, suggestion (high confidence), or memory
  useEffect(() => {
    if (weight === '' && !isBodyweight) {
      if (targetLoad) {
        // Explicit target from training block takes priority
        setWeight(targetLoad.toString());
      } else if (suggestion?.confidence === 'high' && suggestion.recommendation.weight > 0) {
        // High-confidence suggestion auto-fills
        setWeight(suggestion.recommendation.weight.toString());
      } else if (movementMemory?.lastWeight) {
        // Fall back to last weight
        setWeight(movementMemory.lastWeight.toString());
      }
    }
  }, [targetLoad, suggestion?.confidence, suggestion?.recommendation.weight, movementMemory?.lastWeight, isBodyweight]);

  // Initialize reps from target or high-confidence suggestion
  useEffect(() => {
    if (reps === '') {
      if (targetReps) {
        setReps(targetReps.toString());
      } else if (suggestion?.confidence === 'high' && suggestion.recommendation.reps > 0) {
        // High-confidence suggestion auto-fills reps too
        setReps(suggestion.recommendation.reps.toString());
      }
    }
  }, [targetReps, suggestion?.confidence, suggestion?.recommendation.reps]);

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
      // Reset form when not editing - use same priority as initial load
      if (!weight && !isBodyweight) {
        if (targetLoad) {
          setWeight(targetLoad.toString());
        } else if (suggestion?.confidence === 'high' && suggestion.recommendation.weight > 0) {
          setWeight(suggestion.recommendation.weight.toString());
        } else if (movementMemory?.lastWeight) {
          setWeight(movementMemory.lastWeight.toString());
        }
      }
      if (!reps) {
        if (targetReps) {
          setReps(targetReps.toString());
        } else if (suggestion?.confidence === 'high' && suggestion.recommendation.reps > 0) {
          setReps(suggestion.recommendation.reps.toString());
        }
      }
    }
  }, [editingSet, targetLoad, targetReps, movementMemory?.lastWeight, suggestion]);

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
        <LabCard 
          className="mb-4"
          noPadding
        >
          <View className="p-4">
            {/* Set indicator */}
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center">
                <View className="w-6 h-6 rounded bg-signal-500 items-center justify-center mr-2">
                  <Text className="font-lab-mono text-xs font-bold text-white">
                    {currentSetIndex + 1}
                  </Text>
                </View>
                <Text
                  className="font-semibold text-graphite-100"
                  style={{ color: '#E6E8EB' }}
                >
                  Set {currentSetIndex + 1}
                </Text>
              </View>
              {targetLoad && (
                <View className="bg-graphite-700 px-2 py-0.5 rounded" style={{ backgroundColor: '#353D4B' }}>
                  <Text className="text-xs font-lab-mono text-graphite-200" style={{ color: '#D4D7DC' }}>
                    Target: {targetLoad} lbs
                  </Text>
                </View>
              )}
            </View>

            {/* Input Row */}
            <View className="flex-row items-end gap-3 mb-4">
              {/* Weight */}
              <View className="flex-1">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-xs text-graphite-300" style={{ color: '#C4C8D0' }}>
                    Lbs {movementMemory?.lastWeight ? `(Last: ${movementMemory.lastWeight})` : ''}
                  </Text>
                  <Pressable
                    onPress={() => {
                      setIsBodyweight(!isBodyweight);
                      if (!isBodyweight) setWeight('0');
                    }}
                  >
                    <Text className={`text-xs ${isBodyweight ? 'text-signal-500 font-bold' : 'text-graphite-300'}`} style={!isBodyweight ? { color: '#C4C8D0' } : undefined}>
                      BW
                    </Text>
                  </Pressable>
                </View>
                <TextInput
                  className={`px-3 py-3 rounded-lg text-center text-xl font-lab-mono font-bold ${
                    isDark ? 'bg-graphite-800 text-graphite-100' : 'bg-graphite-100 text-graphite-900'
                  } border ${isDark ? 'border-graphite-700' : 'border-graphite-300'}`}
                  style={isDark ? { backgroundColor: '#1A1F2E', color: '#E6E8EB', borderColor: '#353D4B' } : undefined}
                  value={isBodyweight ? 'BW' : weight}
                  onChangeText={isBodyweight ? undefined : setWeight}
                  keyboardType="decimal-pad"
                  placeholder={suggestion?.recommendation.weight?.toString() || "0"}
                  placeholderTextColor={isDark ? '#808FB0' : '#A5ABB6'} // Much lighter placeholder for visibility on dark background
                  editable={!isBodyweight}
                />
              </View>

              <Text className="text-xl pb-3 font-lab-mono text-graphite-400" style={{ color: '#808FB0' }}>
                ×
              </Text>

              {/* Reps */}
              <View className="flex-1">
                <View className="flex-row justify-between mb-1">
                  <Text className="text-xs text-graphite-300" style={{ color: '#C4C8D0' }}>
                    Reps {movementMemory?.lastReps ? `(Last: ${movementMemory.lastReps})` : ''}
                  </Text>
                </View>
                <TextInput
                  className={`px-3 py-3 rounded-lg text-center text-xl font-lab-mono font-bold ${
                    isDark ? 'bg-graphite-800 text-graphite-100' : 'bg-graphite-100 text-graphite-900'
                  } border ${isDark ? 'border-graphite-700' : 'border-graphite-300'}`}
                  style={isDark ? { backgroundColor: '#1A1F2E', color: '#E6E8EB', borderColor: '#353D4B' } : undefined}
                  value={reps}
                  onChangeText={setReps}
                  keyboardType="number-pad"
                  placeholder={suggestion?.recommendation.reps?.toString() || "0"}
                  placeholderTextColor={isDark ? '#808FB0' : '#A5ABB6'} // Much lighter placeholder for visibility on dark background
                />
              </View>

              <Text className="text-xl pb-3 font-lab-mono text-graphite-400" style={{ color: '#808FB0' }}>
                @
              </Text>

              {/* RPE */}
              <View className="flex-1">
                <Text className="text-xs mb-1 text-graphite-300" style={{ color: '#C4C8D0' }}>
                  RPE
                </Text>
                <Pressable
                  onPress={() => setShowRPESlider(!showRPESlider)}
                  className={`px-3 py-3 rounded-lg items-center ${
                    isDark ? 'bg-graphite-800' : 'bg-graphite-100'
                  } border ${isDark ? 'border-graphite-700' : 'border-graphite-300'}`}
                  style={isDark ? { backgroundColor: '#1A1F2E', borderColor: '#353D4B' } : undefined}
                >
                  <Text
                    className={`text-xl font-lab-mono font-bold ${
                      rpe >= 9 ? 'text-oxide-500' : isDark ? 'text-graphite-100' : 'text-graphite-900'
                    }`}
                    style={rpe < 9 && isDark ? { color: '#E6E8EB' } : undefined}
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
                  isDark ? 'bg-graphite-950' : 'bg-graphite-100'
                }`}
              >
                <View className="flex-row justify-between mb-2">
                  <Text className="text-sm font-lab-mono text-graphite-300" style={{ color: '#C4C8D0' }}>
                    RPE {rpe}
                  </Text>
                  <Text className="text-xs text-graphite-300" style={{ color: '#C4C8D0' }}>
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
                <LabButton 
                  label="Cancel" 
                  variant="outline"
                  onPress={() => setEditingSetId(null)}
                />
              )}
              <LabButton 
                label={isLogging ? 'Logging...' : editingSetId ? 'Update Set' : 'Log Set'}
                variant="primary"
                className="flex-1"
                onPress={handleLogSet}
                disabled={isLogging}
              />
            </View>
          </View>
        </LabCard>
      ) : (
        /* All Complete Message */
        <LabCard className="mb-4 bg-progress-500/10 border-progress-500/30">
          <View className="flex-row items-center justify-center">
            <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
            <Text className="ml-2 text-progress-500 font-semibold text-lg">
              All sets complete!
            </Text>
          </View>
        </LabCard>
      )}

      {/* Set List */}
      <View>
        <Text className="text-xs font-bold uppercase tracking-wide mb-3 text-graphite-300" style={{ color: '#C4C8D0' }}>
          Completed Sets
        </Text>

        {sets.map((set, index) => {
          const isLogged = set.actual_weight !== null || set.actual_reps !== null;
          const isCurrent = index === currentSetIndex;

          return (
            <Pressable
              key={set.id || index}
              onPress={() => {
                if (isLogged && set.id) {
                  setEditingSetId(set.id);
                }
              }}
              disabled={!isLogged || !set.id}
              className={`flex-row items-center p-3 rounded-lg mb-2 border ${
                isLogged
                  ? isDark ? 'bg-graphite-800 border-graphite-700' : 'bg-white border-graphite-200'
                  : isCurrent
                  ? isDark ? 'bg-signal-500/10 border-signal-500/30' : 'bg-signal-500/5 border-signal-500/20'
                  : isDark ? 'bg-transparent border-dashed border-graphite-700' : 'bg-transparent border-dashed border-graphite-300'
              }`}
            >
              {/* Status icon */}
              <View className="mr-3 w-6 items-center">
                {isLogged ? (
                  <Text className="font-lab-mono text-sm text-graphite-300" style={{ color: '#C4C8D0' }}>{index + 1}</Text>
                ) : isCurrent ? (
                  <View className="w-2 h-2 rounded-full bg-signal-500" />
                ) : (
                  <Text className="font-lab-mono text-sm text-graphite-400" style={{ color: '#6B7485' }}>{index + 1}</Text>
                )}
              </View>

              {/* Set info */}
              <View className="flex-1">
                {isLogged && set.actual_weight !== null && set.actual_reps !== null ? (
                  <View className="flex-row items-baseline gap-2">
                    <Text className={`text-lg font-lab-mono font-bold ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`} style={isDark ? { color: '#E6E8EB' } : undefined}>
                      {set.actual_weight} <Text className="text-sm font-normal text-graphite-400" style={{ color: '#808FB0' }}>lbs</Text>
                    </Text>
                    <Text className={`text-lg font-lab-mono font-bold ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`} style={isDark ? { color: '#E6E8EB' } : undefined}>
                      {set.actual_reps} <Text className="text-sm font-normal text-graphite-400" style={{ color: '#808FB0' }}>reps</Text>
                    </Text>
                    {set.actual_rpe && (
                      <Text className="text-sm font-lab-mono text-graphite-300" style={{ color: '#C4C8D0' }}>
                        @ {set.actual_rpe}
                      </Text>
                    )}
                    {editingSetId === set.id && (
                      <Text className="text-xs text-signal-500 font-bold ml-2">EDITING</Text>
                    )}
                  </View>
                ) : (
                  <Text className={`text-sm ${isCurrent ? 'text-signal-500 font-medium' : 'text-graphite-300'}`} style={!isCurrent ? { color: '#C4C8D0' } : undefined}>
                    {isCurrent ? 'Current Set' : 'Pending'}
                  </Text>
                )}
              </View>

              {/* Actions */}
              {isLogged && set.id && (
                <View className="flex-row gap-3">
                  <Pressable
                    onPress={() => handleDeleteSet(set.id)}
                    hitSlop={10}
                  >
                    <Ionicons name="trash-outline" size={16} color={isDark ? '#424B5C' : '#A5ABB6'} />
                  </Pressable>
                </View>
              )}
            </Pressable>
          );
        })}

        {/* Duplicate and Add Set Buttons */}
        <View className="flex-row gap-3 mt-4">
          {loggedSets.length > 0 && (
            <LabButton 
              label="Duplicate Last" 
              variant="secondary" 
              size="sm"
              className="flex-1"
              icon={<Ionicons name="copy-outline" size={14} color="#C4C8D0" />}
              onPress={handleDuplicate}
              disabled={isLogging}
            />
          )}
          <LabButton 
            label="Add Set" 
            variant="outline" 
            size="sm"
            className="flex-1 border-dashed"
            icon={<Ionicons name="add" size={14} color="#C4C8D0" />}
            onPress={onAddSet}
          />
        </View>
      </View>
    </View>
  );
}
