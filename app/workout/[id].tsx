import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExercisePicker } from '@/components/ExercisePicker';
import { PRCelebration } from '@/components/PRCelebration';
import { SetInput } from '@/components/SetInput';
import { useColorScheme } from '@/components/useColorScheme';
import { detectProgression, getProgressionTypeString, type SetData } from '@/lib/progression';
import { detectWorkoutContext, getContextInfo } from '@/lib/workoutContext';
import {
  useWorkout,
  useAddWorkoutSet,
  useCompleteWorkout,
  useCreateWorkout,
  useDeleteWorkoutSet,
} from '@/hooks/useWorkouts';
import { useAppStore, useActiveWorkout } from '@/stores/useAppStore';
import { supabase } from '@/lib/supabase';
import { useSmartExerciseSuggestions } from '@/hooks/useProgressionTargets';
import type { Exercise, WorkoutSetInsert } from '@/types/database';

// Tracked exercise with local state
interface TrackedExercise {
  exercise: Exercise;
  sets: number[];
  targetSets?: number;
  targetReps?: number;
  targetRPE?: number;
  targetLoad?: number;
}

export default function ActiveWorkoutScreen() {
  const { id, focus: focusParam } = useLocalSearchParams<{ id: string; focus?: string }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Check if this is a new ad-hoc workout or an existing scheduled one
  const isNewWorkout = id === 'new';

  // Store state
  const activeWorkout = useActiveWorkout();
  const { startWorkout, endWorkout, addCompletedSet } = useAppStore();

  // Queries & mutations
  const { data: workout, isLoading: workoutLoading } = useWorkout(isNewWorkout ? '' : id);
  const createWorkoutMutation = useCreateWorkout();
  const addSetMutation = useAddWorkoutSet();
  const completeWorkoutMutation = useCompleteWorkout();
  const deleteSetMutation = useDeleteWorkoutSet();

  // Smart suggestions for ad-hoc workouts
  const { data: smartSuggestions = [] } = useSmartExerciseSuggestions(5);

  // Track saved set data for multiply feature
  const [savedSetData, setSavedSetData] = useState<Map<string, Omit<WorkoutSetInsert, 'workout_id' | 'exercise_id' | 'set_order'>>>(new Map());

  // Local state
  const [trackedExercises, setTrackedExercises] = useState<TrackedExercise[]>([]);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [currentWorkoutId, setCurrentWorkoutId] = useState<string | null>(
    isNewWorkout ? null : id
  );
  const [recentExerciseIds, setRecentExerciseIds] = useState<string[]>([]);
  const [workoutStartTime] = useState(new Date());
  
  // Mutex to prevent race condition in workout creation
  const isCreatingWorkout = useRef(false);

  // PR celebration state
  const [showPRCelebration, setShowPRCelebration] = useState(false);
  const [prExercise, setPRExercise] = useState<Exercise | null>(null);
  const [prType, setPRType] = useState<'weight' | 'reps' | 'volume' | 'e1rm' | null>(null);
  const [prValue, setPRValue] = useState('');

  // Calculate elapsed time
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const diff = Math.floor((now.getTime() - workoutStartTime.getTime()) / 60000);
      setElapsedMinutes(diff);
    }, 60000);

    return () => clearInterval(interval);
  }, [workoutStartTime]);

  // Initialize workout from scheduled workout data
  useEffect(() => {
    if (workout && workout.workout_sets && trackedExercises.length === 0) {
      // Group sets by exercise (filter out sets with null exercises)
      const exerciseMap = new Map<string, TrackedExercise>();

      workout.workout_sets.forEach((set) => {
        // Skip sets that don't have an exercise (e.g., exercise was deleted)
        if (!set.exercise) {
          return;
        }

        if (!exerciseMap.has(set.exercise_id)) {
          exerciseMap.set(set.exercise_id, {
            exercise: set.exercise,
            sets: [],
            targetReps: set.target_reps || undefined,
            targetRPE: set.target_rpe || undefined,
            targetLoad: set.target_load || undefined,
          });
        }
        exerciseMap.get(set.exercise_id)!.sets.push(set.set_order);
      });

      setTrackedExercises(Array.from(exerciseMap.values()));
      setCurrentWorkoutId(workout.id);

      // Start workout tracking in store
      if (!activeWorkout) {
        startWorkout(workout.id);
      }
    }
  }, [workout, trackedExercises.length, activeWorkout, startWorkout]);

  // Create new ad-hoc workout
  const createNewWorkout = useCallback(async () => {
    if (currentWorkoutId) return currentWorkoutId;
    
    // Prevent concurrent creation attempts
    if (isCreatingWorkout.current) {
      // Wait a bit and check again
      await new Promise(resolve => setTimeout(resolve, 100));
      if (currentWorkoutId) return currentWorkoutId;
      // If still creating, return null to prevent infinite loop
      if (isCreatingWorkout.current) return null;
    }

    isCreatingWorkout.current = true;
    try {
      const newWorkout = await createWorkoutMutation.mutateAsync({
        focus: focusParam || 'Quick Workout',
        scheduled_date: new Date().toISOString().split('T')[0],
      });
      setCurrentWorkoutId(newWorkout.id);
      startWorkout(newWorkout.id);
      return newWorkout.id;
    } catch (error) {
      Alert.alert('Error', 'Failed to create workout. Please try again.');
      return null;
    } finally {
      isCreatingWorkout.current = false;
    }
  }, [currentWorkoutId, createWorkoutMutation, startWorkout, focusParam]);

  // Add exercise to workout
  const handleAddExercise = useCallback(
    async (exercise: Exercise) => {
      // Ensure workout exists
      const workoutId = await createNewWorkout();
      if (!workoutId) return;

      // Add to tracked exercises
      setTrackedExercises((prev) => [
        ...prev,
        {
          exercise,
          sets: [1], // Start with one set
        },
      ]);

      // Track as recent
      setRecentExerciseIds((prev) => {
        const filtered = prev.filter((id) => id !== exercise.id);
        return [exercise.id, ...filtered].slice(0, 10);
      });
    },
    [createNewWorkout]
  );

  // Add another set to an exercise
  const handleAddSet = useCallback((exerciseIndex: number) => {
    setTrackedExercises((prev) => {
      const updated = [...prev];
      const nextSetNumber = Math.max(...updated[exerciseIndex].sets) + 1;
      updated[exerciseIndex].sets.push(nextSetNumber);
      return updated;
    });
  }, []);

  // Save a set
  const handleSaveSet = useCallback(
    async (
      exerciseId: string,
      setOrder: number,
      setData: Omit<WorkoutSetInsert, 'workout_id' | 'exercise_id' | 'set_order'>
    ) => {
      if (!currentWorkoutId) return;

      try {
        // Detect progression by comparing with previous sets
        let progressionType: string | null = null;
        let previousSetId: string | null = null;

        if (!setData.is_warmup && setData.actual_weight && setData.actual_reps && setData.actual_weight > 0) {
          // Get the most recent set for this exercise (from current workout or previous workouts)
          const { data: previousSets } = await supabase
            .from('workout_sets')
            .select('id, actual_weight, actual_reps, actual_rpe, is_warmup, set_order')
            .eq('exercise_id', exerciseId)
            .neq('workout_id', currentWorkoutId)
            .not('actual_weight', 'is', null)
            .not('actual_reps', 'is', null)
            .eq('is_warmup', false)
            .order('created_at', { ascending: false })
            .limit(1);

          // Also check current workout for previous sets
          const { data: currentWorkoutSets } = await supabase
            .from('workout_sets')
            .select('id, actual_weight, actual_reps, actual_rpe, is_warmup, set_order')
            .eq('workout_id', currentWorkoutId)
            .eq('exercise_id', exerciseId)
            .lt('set_order', setOrder)
            .not('actual_weight', 'is', null)
            .not('actual_reps', 'is', null)
            .eq('is_warmup', false)
            .order('set_order', { ascending: false })
            .limit(1);

          // Use current workout set if available, otherwise use previous workout set
          const previousSet = currentWorkoutSets && currentWorkoutSets.length > 0
            ? currentWorkoutSets[0]
            : previousSets && previousSets.length > 0
            ? previousSets[0]
            : null;

          if (previousSet) {
            previousSetId = previousSet.id;
            const currentSetData: SetData = {
              actual_weight: setData.actual_weight,
              actual_reps: setData.actual_reps,
              actual_rpe: setData.actual_rpe || null,
              is_warmup: false,
            };
            const previousSetData: SetData = {
              actual_weight: previousSet.actual_weight,
              actual_reps: previousSet.actual_reps,
              actual_rpe: previousSet.actual_rpe || null,
              is_warmup: false,
            };
            const progression = detectProgression(currentSetData, previousSetData);
            progressionType = getProgressionTypeString(progression);
          }
        }

        await addSetMutation.mutateAsync({
          workout_id: currentWorkoutId,
          exercise_id: exerciseId,
          set_order: setOrder,
          progression_type: progressionType,
          previous_set_id: previousSetId,
          ...setData,
        });
        
        // Store set data for multiply feature (if this is the first set)
        if (setOrder === 1) {
          setSavedSetData((prev) => {
            const updated = new Map(prev);
            updated.set(exerciseId, setData);
            return updated;
          });
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to save set. Please try again.');
      }
    },
    [currentWorkoutId, addSetMutation]
  );

  // Multiply sets - duplicate first set data to 3 more sets
  const handleMultiplySets = useCallback(async (exerciseIndex: number) => {
    const exercise = trackedExercises[exerciseIndex];
    if (!exercise || !currentWorkoutId) return;

    const setData = savedSetData.get(exercise.exercise.id);
    if (!setData) {
      Alert.alert('Error', 'Please save the first set before multiplying.');
      return;
    }

    try {
      const currentMaxSet = Math.max(...exercise.sets);
      const newSets: number[] = [];
      const count = 3; // Add 3 more sets
      
      // Create multiple sets with same data
      for (let i = 0; i < count; i++) {
        const setOrder = currentMaxSet + i + 1;
        await addSetMutation.mutateAsync({
          workout_id: currentWorkoutId,
          exercise_id: exercise.exercise.id,
          set_order: setOrder,
          ...setData,
        });
        newSets.push(setOrder);
      }

      // Add new sets to tracked exercises
      setTrackedExercises((prev) => {
        const updated = [...prev];
        updated[exerciseIndex].sets.push(...newSets);
        return updated;
      });
      } catch (error) {
        Alert.alert('Error', 'Failed to multiply sets. Please try again.');
      }
  }, [trackedExercises, currentWorkoutId, savedSetData, addSetMutation]);

  // Delete exercise (remove all sets and exercise from workout)
  const handleDeleteExercise = useCallback(async (exerciseIndex: number) => {
    const exercise = trackedExercises[exerciseIndex];
    if (!exercise || !currentWorkoutId) return;

    const confirmDelete = () => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        return window.confirm(`Delete ${exercise.exercise.name}?\n\nThis will remove all sets for this exercise.`);
      } else {
        return new Promise<boolean>((resolve) => {
          Alert.alert(
            'Delete Exercise',
            `Delete ${exercise.exercise.name}? This will remove all sets for this exercise.`,
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => resolve(true),
              },
            ]
          );
        });
      }
    };

    const confirmed = await confirmDelete();
    if (!confirmed) return;

    try {
      // Get all set IDs for this exercise from the workout
      const exerciseSets = workout?.workout_sets?.filter(
        (set) => set.exercise_id === exercise.exercise.id
      ) || [];

      // Delete all sets
      for (const set of exerciseSets) {
        await deleteSetMutation.mutateAsync({
          id: set.id,
          workoutId: currentWorkoutId,
        });
      }

      // Remove exercise from tracked exercises
      setTrackedExercises((prev) => prev.filter((_, idx) => idx !== exerciseIndex));
      setSavedSetData((prev) => {
        const updated = new Map(prev);
        updated.delete(exercise.exercise.id);
        return updated;
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to delete exercise. Please try again.');
    }
  }, [trackedExercises, currentWorkoutId, workout, deleteSetMutation]);

  // Handle PR detection
  const handlePRDetected = useCallback(
    (
      exercise: Exercise,
      type: 'weight' | 'reps' | 'volume' | 'e1rm',
      value: string
    ) => {
      setPRExercise(exercise);
      setPRType(type);
      setPRValue(value);
      setShowPRCelebration(true);
    },
    []
  );

  // Complete workout
  const handleFinishWorkout = useCallback(async () => {
    if (!currentWorkoutId) {
      router.back();
      return;
    }

    const totalSets = trackedExercises.reduce(
      (acc, ex) => acc + ex.sets.length,
      0
    );

    if (totalSets === 0) {
      Alert.alert(
        'No Sets Logged',
        'You haven\'t logged any sets yet. Are you sure you want to finish?',
        [
          { text: 'Keep Training', style: 'cancel' },
          {
            text: 'Finish Anyway',
            style: 'destructive',
            onPress: async () => {
              await completeWorkoutMutation.mutateAsync({
                id: currentWorkoutId,
                durationMinutes: elapsedMinutes,
              });
              endWorkout();
              router.back();
            },
          },
        ]
      );
      return;
    }

    try {
      await completeWorkoutMutation.mutateAsync({
        id: currentWorkoutId,
        durationMinutes: elapsedMinutes,
      });
      endWorkout();
      
      // Navigate to workout summary instead of going back
      router.replace(`/workout-summary/${currentWorkoutId}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to complete workout. Please try again.');
    }
  }, [
    currentWorkoutId,
    trackedExercises,
    elapsedMinutes,
    completeWorkoutMutation,
    endWorkout,
  ]);

  // Save & Exit - save progress and return to program
  const handleSaveAndExit = useCallback(() => {
    // Simply end the workout tracking in the store and go back
    // The sets are already saved to the database via handleSaveSet
    endWorkout();
    
    const totalSets = trackedExercises.reduce(
      (acc, ex) => acc + (ex.sets?.length || 0),
      0
    );
    
    if (Platform.OS === 'web') {
      // Simple notification on web
      alert(`Progress saved! ${totalSets} sets logged. Come back anytime to continue.`);
    } else {
      Alert.alert(
        'Progress Saved',
        `${totalSets} sets logged. Come back anytime to continue this workout.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
      return;
    }
    router.back();
  }, [endWorkout, trackedExercises]);

  // Discard workout - go back with or without confirmation
  const handleDiscard = useCallback(() => {
    try {
      // Count total sets logged
      const totalSets = trackedExercises.reduce(
        (acc, ex) => acc + (ex.sets?.length || 0),
        0
      );

      // If no sets have been logged, just go back immediately without confirmation
      if (totalSets === 0) {
        endWorkout();
        router.back();
        return;
      }

      // Has logged sets, show confirmation before discarding
      // On web, use window.confirm for better compatibility
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const confirmed = window.confirm('Discard Workout?\n\nAll logged sets will be lost. This cannot be undone.');
        if (confirmed) {
          endWorkout();
          router.back();
        }
        return;
      }

      // On native, use Alert
      Alert.alert(
        'Discard Workout?',
        'All logged sets will be lost. This cannot be undone.',
        [
          { 
            text: 'Keep Training', 
            style: 'cancel',
            onPress: () => {
              // User chose to keep training, do nothing
            }
          },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              endWorkout();
              router.back();
            },
          },
        ],
        { cancelable: true }
      );
    } catch (error) {
      // Fallback: just go back if something fails
      endWorkout();
      router.back();
    }
  }, [endWorkout, trackedExercises, router]);

  // Format elapsed time
  const formattedTime = useMemo(() => {
    const hours = Math.floor(elapsedMinutes / 60);
    const mins = elapsedMinutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  }, [elapsedMinutes]);

  if (!isNewWorkout && workoutLoading) {
    return (
      <SafeAreaView
        className={`flex-1 items-center justify-center ${
          isDark ? 'bg-carbon-950' : 'bg-graphite-50'
        }`}
      >
        <ActivityIndicator size="large" color="#2F80ED" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      className={`flex-1 ${isDark ? 'bg-carbon-950' : 'bg-graphite-50'}`}
      edges={['left', 'right', 'bottom']}
    >
      {/* Header */}
      <View
        className={`px-4 py-3 border-b ${
          isDark ? 'border-graphite-700 bg-graphite-900' : 'border-graphite-200 bg-white'
        }`}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <Pressable 
              onPress={() => {
                handleDiscard();
              }}
              className="p-2 -ml-2"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name="close"
                size={24}
                color={isDark ? '#E6E8EB' : '#0E1116'}
              />
            </Pressable>
            <View className="ml-2 flex-1">
              <View className="flex-row items-center gap-2">
                <Text
                  className={`font-semibold ${
                    isDark ? 'text-graphite-100' : 'text-graphite-900'
                  }`}
                >
                  {workout?.focus || 'Quick Workout'}
                </Text>
                {workout && (() => {
                  const context = detectWorkoutContext(workout);
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
              <View className="flex-row items-center mt-1">
                <Ionicons
                  name="time-outline"
                  size={14}
                  color={isDark ? '#808fb0' : '#607296'}
                />
                <Text
                  className={`ml-1 text-sm ${
                    isDark ? 'text-graphite-400' : 'text-graphite-500'
                  }`}
                >
                  {formattedTime}
                </Text>
              </View>
              {workout && detectWorkoutContext(workout) === 'unstructured' && (
                <Text
                  className={`text-xs mt-1 ${isDark ? 'text-regression-400' : 'text-regression-600'}`}
                >
                  Unstructured session - does not contribute to progression
                </Text>
              )}
            </View>
          </View>

          <View className="flex-row items-center gap-2">
            <Pressable
              className={`px-3 py-2 rounded-full border ${
                isDark ? 'border-graphite-600' : 'border-graphite-300'
              }`}
              onPress={handleSaveAndExit}
            >
              <Text
                className={`font-semibold ${
                  isDark ? 'text-graphite-200' : 'text-graphite-700'
                }`}
              >
                Save & Exit
              </Text>
            </Pressable>
            <Pressable
              className="px-4 py-2 rounded-full bg-signal-500"
              onPress={handleFinishWorkout}
            >
              <Text className="text-white font-semibold">Finish</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Exercises */}
        {trackedExercises
          .filter((tracked) => tracked.exercise) // Additional safety filter
          .map((tracked, exerciseIndex) => (
          <View key={tracked.exercise.id} className="mb-6">
            {/* Exercise Header */}
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-1">
                <View className="flex-row items-center justify-between">
                  <Text
                    className={`text-lg font-bold ${
                      isDark ? 'text-graphite-100' : 'text-graphite-900'
                    }`}
                  >
                    {tracked.exercise?.name || 'Unknown Exercise'}
                  </Text>
                  <Pressable
                    onPress={() => handleDeleteExercise(exerciseIndex)}
                    className="p-2 -mr-2"
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={20}
                      color={isDark ? '#ef4444' : '#dc2626'}
                    />
                  </Pressable>
                </View>
                {tracked.exercise && (
                  <View className="flex-row items-center mt-1">
                    <View
                      className={`px-2 py-0.5 rounded ${
                        tracked.exercise.modality === 'Strength'
                          ? 'bg-signal-500/20'
                          : tracked.exercise.modality === 'Cardio'
                          ? 'bg-progress-500/20'
                          : 'bg-purple-500/20'
                      }`}
                    >
                      <Text
                        className={`text-xs ${
                          tracked.exercise.modality === 'Strength'
                            ? 'text-signal-500'
                            : tracked.exercise.modality === 'Cardio'
                            ? 'text-progress-500'
                            : 'text-purple-500'
                        }`}
                      >
                        {tracked.exercise.modality}
                      </Text>
                    </View>
                    <Text
                      className={`ml-2 text-xs ${
                        isDark ? 'text-graphite-400' : 'text-graphite-500'
                      }`}
                    >
                      {tracked.exercise.muscle_group}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Sets */}
            {tracked.sets.map((setNumber) => (
              <SetInput
                key={`${tracked.exercise.id}-${setNumber}`}
                exercise={tracked.exercise}
                setNumber={setNumber}
                workoutId={currentWorkoutId || ''}
                targetReps={tracked.targetReps}
                targetRPE={tracked.targetRPE}
                targetLoad={tracked.targetLoad}
                onSave={(setData) =>
                  handleSaveSet(tracked.exercise.id, setNumber, setData)
                }
                onPRDetected={(set, type) => {
                  const value =
                    type === 'weight'
                      ? `${set.actual_weight} lbs`
                      : type === 'reps'
                      ? `${set.actual_reps} reps @ ${set.actual_weight} lbs`
                      : type === 'e1rm'
                      ? `${Math.round(
                          (set.actual_weight || 0) *
                            (1 + (set.actual_reps || 0) / 30)
                        )} lbs E1RM`
                      : '';
                  handlePRDetected(tracked.exercise, type, value);
                }}
              />
            ))}

            {/* Add Set / Multiply Sets Buttons */}
            <View className="flex-row gap-2">
              {savedSetData.has(tracked.exercise.id) && tracked.sets.length > 0 && (
                <Pressable
                  className={`flex-1 flex-row items-center justify-center py-3 rounded-xl border ${
                    isDark ? 'border-signal-500/50 bg-signal-500/10' : 'border-signal-500/50 bg-signal-500/10'
                  }`}
                  onPress={() => handleMultiplySets(exerciseIndex)}
                >
                  <Ionicons
                    name="copy-outline"
                    size={18}
                    color="#2F80ED"
                  />
                  <Text className="ml-2 text-signal-500 font-semibold text-sm">
                    +3 Sets
                  </Text>
                </Pressable>
              )}
              <Pressable
                className={`flex-1 flex-row items-center justify-center py-3 rounded-xl border border-dashed ${
                  isDark ? 'border-graphite-600' : 'border-graphite-300'
                }`}
                onPress={() => handleAddSet(exerciseIndex)}
              >
                <Ionicons
                  name="add-circle-outline"
                  size={20}
                  color={isDark ? '#808fb0' : '#607296'}
                />
                <Text
                  className={`ml-2 ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}
                >
                  Add Set
                </Text>
              </Pressable>
            </View>
          </View>
        ))}

        {/* Empty State / Add Exercise Button */}
        {trackedExercises.length === 0 ? (
          <View className="items-center justify-center py-8">
            <View
              className={`w-20 h-20 rounded-full items-center justify-center mb-4 ${
                isDark ? 'bg-graphite-800' : 'bg-graphite-100'
              }`}
            >
              <Ionicons
                name="barbell-outline"
                size={40}
                color={isDark ? '#2F80ED' : '#2F80ED'}
              />
            </View>
            <Text
              className={`text-lg font-semibold mb-2 ${
                isDark ? 'text-graphite-100' : 'text-graphite-900'
              }`}
            >
              Ready to train?
            </Text>
            <Text
              className={`text-center mb-6 ${
                isDark ? 'text-graphite-400' : 'text-graphite-500'
              }`}
            >
              {isNewWorkout && smartSuggestions.length > 0
                ? 'Pick from your go-to exercises or browse the full library'
                : 'Add your first exercise to get started'}
            </Text>

            {/* Smart Suggestions for ad-hoc workouts */}
            {isNewWorkout && smartSuggestions.length > 0 && (
              <View className="w-full mb-6">
                <Text
                  className={`text-sm font-semibold mb-3 ${
                    isDark ? 'text-graphite-300' : 'text-graphite-600'
                  }`}
                >
                  Suggested for you
                </Text>
                <View className="gap-2">
                  {smartSuggestions.map((suggestion) => (
                    <Pressable
                      key={suggestion.exercise.id}
                      className={`flex-row items-center p-3 rounded-xl ${
                        isDark ? 'bg-graphite-800' : 'bg-white'
                      } border ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}
                      onPress={() => handleAddExercise(suggestion.exercise)}
                    >
                      <View
                        className={`w-10 h-10 rounded-full items-center justify-center ${
                          suggestion.exercise.modality === 'Strength'
                            ? 'bg-signal-500/20'
                            : suggestion.exercise.modality === 'Cardio'
                            ? 'bg-progress-500/20'
                            : 'bg-purple-500/20'
                        }`}
                      >
                        <Ionicons
                          name={
                            suggestion.exercise.modality === 'Strength'
                              ? 'barbell-outline'
                              : suggestion.exercise.modality === 'Cardio'
                              ? 'bicycle-outline'
                              : 'fitness-outline'
                          }
                          size={20}
                          color={
                            suggestion.exercise.modality === 'Strength'
                              ? '#2F80ED'
                              : suggestion.exercise.modality === 'Cardio'
                              ? '#27AE60'
                              : '#9B59B6'
                          }
                        />
                      </View>
                      <View className="flex-1 ml-3">
                        <Text
                          className={`font-semibold ${
                            isDark ? 'text-graphite-100' : 'text-graphite-900'
                          }`}
                        >
                          {suggestion.exercise.name}
                        </Text>
                        <Text
                          className={`text-xs ${
                            isDark ? 'text-graphite-400' : 'text-graphite-500'
                          }`}
                        >
                          {suggestion.message}
                        </Text>
                      </View>
                      <Ionicons
                        name="add-circle"
                        size={24}
                        color="#2F80ED"
                      />
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            <Pressable
              className="px-6 py-3 rounded-xl bg-signal-500"
              onPress={() => setShowExercisePicker(true)}
            >
              <Text className="text-white font-semibold">
                {isNewWorkout && smartSuggestions.length > 0 ? 'Browse All Exercises' : 'Add Exercise'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            className={`flex-row items-center justify-center py-4 rounded-xl ${
              isDark ? 'bg-signal-600' : 'bg-signal-500'
            }`}
            onPress={() => setShowExercisePicker(true)}
          >
            <Ionicons name="add" size={24} color="#ffffff" />
            <Text className="text-white font-semibold ml-2">Add Exercise</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* Exercise Picker Modal */}
      <ExercisePicker
        visible={showExercisePicker}
        onClose={() => setShowExercisePicker(false)}
        onSelectExercise={handleAddExercise}
        recentExerciseIds={recentExerciseIds}
      />

      {/* PR Celebration Modal */}
      <PRCelebration
        visible={showPRCelebration}
        onClose={() => setShowPRCelebration(false)}
        exercise={prExercise}
        prType={prType}
        value={prValue}
      />
    </SafeAreaView>
  );
}
