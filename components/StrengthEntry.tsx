// Strength-specific entry component
// Focused set-by-set input with weight, reps, RPE

import { Ionicons } from '@expo/vector-icons';
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TextInput, Pressable, Alert, Platform } from 'react-native';
import Slider from '@react-native-community/slider';

import { Colors } from '@/constants/Colors';
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

  // Deduplicate sets by set_order (keep most recent/logged version)
  // Then sort by set_order to ensure correct display order
  const deduplicatedSets = sets.reduce((acc, set) => {
    const existingIndex = acc.findIndex(s => s.set_order === set.set_order && s.exercise_id === set.exercise_id);
    if (existingIndex >= 0) {
      // If current set is logged and existing isn't, replace it
      const existing = acc[existingIndex];
      const isCurrentLogged = set.actual_weight !== null || set.actual_reps !== null;
      const isExistingLogged = existing.actual_weight !== null || existing.actual_reps !== null;
      
      if (isCurrentLogged && !isExistingLogged) {
        acc[existingIndex] = set;
      } else if (isCurrentLogged && isExistingLogged) {
        // Both logged - keep the one with an actual database id
        if (set.id && !set.id.startsWith('temp-')) {
          acc[existingIndex] = set;
        }
      }
    } else {
      acc.push(set);
    }
    return acc;
  }, [] as SetWithExercise[]);

  const sortedSets = [...deduplicatedSets].sort((a, b) => (a.set_order || 0) - (b.set_order || 0));
  
  // Find logged and pending sets
  const loggedSets = sortedSets.filter(
    (s) => s.actual_weight !== null || s.actual_reps !== null
  );
  
  // If editing a set, use that set, otherwise find the first unlogged set by set_order
  const editingSet = editingSetId ? sortedSets.find(s => s.id === editingSetId) : null;
  const firstUnloggedSet = sortedSets.find(s => 
    (s.actual_weight === null && s.actual_reps === null) || 
    (!s.actual_weight && !s.actual_reps)
  );
  const currentSet = editingSet || firstUnloggedSet || sortedSets[sortedSets.length - 1];
  const currentSetIndex = currentSet ? sortedSets.findIndex(s => 
    (s.id && currentSet.id && s.id === currentSet.id) ||
    (s.set_order === currentSet.set_order && s.exercise_id === currentSet.exercise_id)
  ) : sortedSets.length;
  const totalSets = sortedSets.length;

  // Initialize weight from target, last logged set, suggestion, or memory
  useEffect(() => {
    if (weight === '' && !isBodyweight) {
      // Priority 1: Explicit target from training block
      if (targetLoad) {
        setWeight(targetLoad.toString());
      } 
      // Priority 2: Last logged set in this workout (most relevant)
      else if (loggedSets.length > 0) {
        const lastLoggedSet = loggedSets[loggedSets.length - 1];
        if (lastLoggedSet && lastLoggedSet.actual_weight !== null && lastLoggedSet.actual_weight > 0) {
          setWeight(lastLoggedSet.actual_weight.toString());
        }
      }
      // Priority 3: High-confidence suggestion
      else if (suggestion?.confidence === 'high' && suggestion.recommendation.weight > 0) {
        setWeight(suggestion.recommendation.weight.toString());
      } 
      // Priority 4: Fall back to last weight from history
      else if (movementMemory?.lastWeight) {
        setWeight(movementMemory.lastWeight.toString());
      }
    }
  }, [targetLoad, loggedSets, suggestion?.confidence, suggestion?.recommendation.weight, movementMemory?.lastWeight, isBodyweight, weight]);

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
      // Reset form when not editing
      // For weight: keep the last logged weight if available, otherwise use targets/suggestions
      const lastLoggedSet = loggedSets.length > 0 ? loggedSets[loggedSets.length - 1] : null;
      
      if (!weight && !isBodyweight) {
        if (lastLoggedSet && lastLoggedSet.actual_weight !== null && lastLoggedSet.actual_weight > 0) {
          setWeight(lastLoggedSet.actual_weight.toString());
        } else if (targetLoad) {
          setWeight(targetLoad.toString());
        } else if (suggestion?.confidence === 'high' && suggestion.recommendation.weight > 0) {
          setWeight(suggestion.recommendation.weight.toString());
        } else if (movementMemory?.lastWeight) {
          setWeight(movementMemory.lastWeight.toString());
        }
      }
      
      // Always default reps to target if available, otherwise use suggestion or memory
      if (targetReps) {
        setReps(targetReps.toString());
      } else if (suggestion?.confidence === 'high' && suggestion.recommendation.reps > 0) {
        setReps(suggestion.recommendation.reps.toString());
      } else if (movementMemory?.lastReps && !reps) {
        setReps(movementMemory.lastReps.toString());
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

    const setOrder = currentSet?.set_order || (currentSetIndex < sortedSets.length ? sortedSets[currentSetIndex]?.set_order : sortedSets.length + 1);

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

      // If editing, stop editing. Otherwise, keep weight for next set, reset reps to target
      if (editingSetId) {
        setEditingSetId(null);
      } else {
        // Keep weight for next set, reset reps to target (or keep current if no target)
        // This makes it easier to log multiple sets with same target
        if (targetReps) {
          setReps(targetReps.toString());
        } else {
          // If no target, keep the reps that were just logged
          setReps(repsNum.toString());
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to log set. Please try again.');
    } finally {
      setIsLogging(false);
    }
  }, [exercise.id, currentSet, currentSetIndex, weight, reps, rpe, isBodyweight, onSaveSet, sortedSets]);

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
    const loggedSets = sortedSets.filter(
      (s) => s.actual_weight !== null && s.actual_reps !== null
    );
    
    if (loggedSets.length === 0) {
      Alert.alert('No Sets', 'Log at least one set before duplicating.');
      return;
    }

    // Get the last logged set by set_order, not array position
    const sortedLoggedSets = [...loggedSets].sort((a, b) => (b.set_order || 0) - (a.set_order || 0));
    const lastSet = sortedLoggedSets[0];
    
    // Find the next empty set (one without actual_weight or actual_reps) by set_order
    const emptySet = sortedSets.find(
      (s) => (s.actual_weight === null && s.actual_reps === null) ||
             (!s.actual_weight && !s.actual_reps)
    );
    
    // If there's an empty set, fill it. Otherwise, create a new one.
    const setOrder = emptySet 
      ? emptySet.set_order 
      : Math.max(0, ...sortedSets.map((s) => s.set_order || 0)) + 1;

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
  }, [exercise.id, sortedSets, rpe, onSaveSet]);

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
                    {currentSet?.set_order || currentSetIndex + 1}
                  </Text>
                </View>
                <Text style={{ fontWeight: '600', color: Colors.graphite[50] }}>
                  Set {currentSet?.set_order || currentSetIndex + 1}
                </Text>
              </View>
              {targetLoad && (
                <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ fontSize: 12, fontFamily: 'monospace', color: Colors.graphite[200] }}>
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
                  <Text style={{ fontSize: 12, color: Colors.graphite[300] }}>
                    Lbs {movementMemory?.lastWeight ? `(Last: ${movementMemory.lastWeight})` : ''}
                  </Text>
                  <Pressable
                    onPress={() => {
                      setIsBodyweight(!isBodyweight);
                      if (!isBodyweight) setWeight('0');
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: isBodyweight ? '700' : '400', color: isBodyweight ? Colors.signal[500] : Colors.graphite[300] }}>
                      BW
                    </Text>
                  </Pressable>
                </View>
                <TextInput
                  className="px-3 py-3 rounded-lg text-center text-xl font-lab-mono font-bold"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    color: Colors.graphite[50],
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                  }}
                  value={isBodyweight ? 'BW' : weight}
                  onChangeText={isBodyweight ? undefined : setWeight}
                  keyboardType="decimal-pad"
                  placeholder={suggestion?.recommendation.weight?.toString() || "0"}
                  placeholderTextColor={Colors.graphite[500]}
                  editable={!isBodyweight}
                />
              </View>

              <Text style={{ fontSize: 20, paddingBottom: 12, fontFamily: 'monospace', color: Colors.graphite[400] }}>
                ×
              </Text>

              {/* Reps */}
              <View className="flex-1">
                <View className="flex-row justify-between mb-1">
                  <Text style={{ fontSize: 12, color: Colors.graphite[300] }}>
                    Reps {movementMemory?.lastReps ? `(Last: ${movementMemory.lastReps})` : ''}
                  </Text>
                </View>
                <TextInput
                  className="px-3 py-3 rounded-lg text-center text-xl font-lab-mono font-bold"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    color: Colors.graphite[50],
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                  }}
                  value={reps}
                  onChangeText={setReps}
                  keyboardType="number-pad"
                  placeholder={targetReps?.toString() || suggestion?.recommendation.reps?.toString() || "0"}
                  placeholderTextColor={Colors.graphite[500]}
                />
              </View>

              <Text style={{ fontSize: 20, paddingBottom: 12, fontFamily: 'monospace', color: Colors.graphite[400] }}>
                @
              </Text>

              {/* RPE */}
              <View className="flex-1">
                <Text style={{ fontSize: 12, marginBottom: 4, color: Colors.graphite[300] }}>
                  RPE
                </Text>
                <Pressable
                  onPress={() => setShowRPESlider(!showRPESlider)}
                  className="px-3 py-3 rounded-lg items-center"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                  }}
                >
                  <Text
                    className={`text-xl font-lab-mono font-bold ${
                      rpe >= 9 ? 'text-oxide-500' : ''
                    }`}
                    style={rpe < 9 ? { color: Colors.graphite[50] } : undefined}
                  >
                    {rpe}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* RPE Slider */}
            {showRPESlider && (
              <View
                style={{
                  padding: 12,
                  borderRadius: 8,
                  marginBottom: 16,
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                }}
              >
                <View className="flex-row justify-between mb-2">
                  <Text style={{ fontSize: 14, fontFamily: 'monospace', color: Colors.graphite[300] }}>
                    RPE {rpe}
                  </Text>
                  <Text style={{ fontSize: 12, color: Colors.graphite[300] }}>
                    {RPE_DESCRIPTIONS[Math.round(rpe)] || ''}
                  </Text>
                </View>
                <Slider
                  minimumValue={6}
                  maximumValue={10}
                  step={0.5}
                  value={rpe}
                  onValueChange={setRpe}
                  minimumTrackTintColor={Colors.signal[500]}
                  maximumTrackTintColor="rgba(255, 255, 255, 0.1)"
                  thumbTintColor={Colors.signal[500]}
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
        <Text style={{ fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12, color: Colors.graphite[300] }}>
          Completed Sets
        </Text>

        {sortedSets.map((set, index) => {
          const isLogged = set.actual_weight !== null || set.actual_reps !== null;
          const isCurrent = currentSet && (
            (set.id && currentSet.id && set.id === currentSet.id) ||
            (set.set_order === currentSet.set_order && set.exercise_id === currentSet.exercise_id)
          );

          return (
            <Pressable
              key={set.id || index}
              onPress={() => {
                if (isLogged && set.id) {
                  setEditingSetId(set.id);
                }
              }}
              disabled={!isLogged || !set.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 12,
                borderRadius: 8,
                marginBottom: 8,
                borderWidth: 1,
                backgroundColor: isLogged ? 'rgba(255, 255, 255, 0.05)' : isCurrent ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                borderColor: isLogged ? 'rgba(255, 255, 255, 0.1)' : isCurrent ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                borderStyle: !isLogged && !isCurrent ? 'dashed' : 'solid',
              }}
            >
              {/* Status icon */}
              <View style={{ marginRight: 12, width: 24, alignItems: 'center' }}>
                {isLogged ? (
                  <Text style={{ fontFamily: 'monospace', fontSize: 14, color: Colors.graphite[300] }}>{set.set_order || index + 1}</Text>
                ) : isCurrent ? (
                  <View className="w-2 h-2 rounded-full bg-signal-500" />
                ) : (
                  <Text style={{ fontFamily: 'monospace', fontSize: 14, color: Colors.graphite[500] }}>{set.set_order || index + 1}</Text>
                )}
              </View>

              {/* Set info */}
              <View className="flex-1">
                {isLogged && set.actual_weight !== null && set.actual_reps !== null ? (
                  <View className="flex-row items-baseline gap-2">
                    <Text style={{ fontSize: 18, fontFamily: 'monospace', fontWeight: '700', color: Colors.graphite[50] }}>
                      {set.actual_weight} <Text style={{ fontSize: 14, fontWeight: '400', color: Colors.graphite[400] }}>lbs</Text>
                    </Text>
                    <Text style={{ fontSize: 18, fontFamily: 'monospace', fontWeight: '700', color: Colors.graphite[50] }}>
                      {set.actual_reps} <Text style={{ fontSize: 14, fontWeight: '400', color: Colors.graphite[400] }}>reps</Text>
                    </Text>
                    {set.actual_rpe && (
                      <Text style={{ fontSize: 14, fontFamily: 'monospace', color: Colors.graphite[300] }}>
                        @ {set.actual_rpe}
                      </Text>
                    )}
                    {editingSetId === set.id && (
                      <Text style={{ fontSize: 12, fontWeight: '700', marginLeft: 8, color: Colors.signal[500] }}>EDITING</Text>
                    )}
                  </View>
                ) : (
                  <Text style={{ fontSize: 14, fontWeight: isCurrent ? '500' : '400', color: isCurrent ? Colors.signal[500] : Colors.graphite[300] }}>
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
                    <Ionicons name="trash-outline" size={16} color={Colors.graphite[500]} />
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
              icon={<Ionicons name="copy-outline" size={14} color={Colors.graphite[300]} />}
              onPress={handleDuplicate}
              disabled={isLogging}
            />
          )}
          <LabButton
            label="Add Set"
            variant="outline"
            size="sm"
            className="flex-1 border-dashed"
            icon={<Ionicons name="add" size={14} color={Colors.graphite[300]} />}
            onPress={onAddSet}
          />
        </View>
      </View>
    </View>
  );
}
