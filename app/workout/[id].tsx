import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExerciseCard, SectionHeader } from '@/components/ExerciseCard';
import { ExerciseEntryModal } from '@/components/ExerciseEntryModal';
import { ExercisePicker } from '@/components/ExercisePicker';
import { PRCelebration } from '@/components/PRCelebration';
import { ReadinessCheckIn, ReadinessIndicator } from '@/components/ReadinessCheckIn';
import { GlassCard, LabButton, SectionLabel, LiveIndicator } from '@/components/ui/LabPrimitives';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { detectWorkoutContext, getContextInfo } from '@/lib/workoutContext';
import { generateReadinessAdjustments, type WorkoutAdjustments } from '@/lib/adjustmentEngine';
import { useTodaysReadiness, analyzeReadiness } from '@/hooks/useReadiness';
import type { ReadinessAdjustment } from '@/types/database';
import {
  useWorkout,
  useAddWorkoutSet,
  useCompleteWorkout,
  useCreateWorkout,
  useDeleteWorkoutSet,
  workoutKeys,
} from '@/hooks/useWorkouts';
import { useAppStore, useActiveWorkout } from '@/stores/useAppStore';
import { supabase } from '@/lib/supabase';
import { useSmartExerciseSuggestions } from '@/hooks/useProgressionTargets';
import { useWorkoutTemplate } from '@/hooks/useWorkoutTemplates';
import { useActiveTrainingBlock } from '@/hooks/useTrainingBlocks';
import { useExerciseMemoryBatch } from '@/hooks/useMovementMemory';
import type { Exercise, WorkoutSetInsert, SegmentType } from '@/types/database';
import type { SetWithExercise } from '@/lib/workoutSummary';

// Tracked exercise with local state
interface TrackedExercise {
  exercise: Exercise;
  sets: SetWithExercise[];
  targetSets?: number;
  targetReps?: number;
  targetRPE?: number;
  targetLoad?: number;
  section?: string; // For grouping (e.g., "Speed Work", "Chest/Back")
}

// Parse workout focus to extract sections
function parseFocusToSections(focus: string): string[] {
  // Handle common patterns like "Speed + Chest/Back (Heavy Bias)"
  // Remove parenthetical notes
  const cleanFocus = focus.replace(/\s*\([^)]*\)\s*/g, '');
  
  // Split on + or &
  const parts = cleanFocus.split(/\s*[+&]\s*/);
  
  return parts.map((p) => p.trim()).filter(Boolean);
}

// Assign exercises to sections based on modality and muscle group
function assignSection(exercise: Exercise, sections: string[]): string {
  if (exercise.modality === 'Cardio') {
    // Cardio exercises go to first section or "Conditioning"
    return sections.find((s) => 
      s.toLowerCase().includes('speed') || 
      s.toLowerCase().includes('cardio') ||
      s.toLowerCase().includes('conditioning') ||
      s.toLowerCase().includes('run')
    ) || sections[0] || 'Conditioning';
  }
  
  // Strength exercises - try to match by muscle group
  const muscleGroup = exercise.muscle_group.toLowerCase();
  for (const section of sections) {
    const sectionLower = section.toLowerCase();
    if (
      (sectionLower.includes('chest') && muscleGroup.includes('chest')) ||
      (sectionLower.includes('back') && muscleGroup.includes('back')) ||
      (sectionLower.includes('push') && (muscleGroup.includes('chest') || muscleGroup.includes('shoulder') || muscleGroup.includes('tricep'))) ||
      (sectionLower.includes('pull') && (muscleGroup.includes('back') || muscleGroup.includes('bicep'))) ||
      (sectionLower.includes('leg') && muscleGroup.includes('leg')) ||
      (sectionLower.includes('upper') && !muscleGroup.includes('leg')) ||
      (sectionLower.includes('lower') && muscleGroup.includes('leg'))
    ) {
      return section;
    }
  }
  
  // Default to first non-cardio section or last section
  return sections.find((s) => !s.toLowerCase().includes('speed') && !s.toLowerCase().includes('cardio')) || sections[sections.length - 1] || 'Strength';
}

export default function ActiveWorkoutScreen() {
  const { id, focus: focusParam, templateId, scheduledDate, autoOpenPicker } = useLocalSearchParams<{ 
    id: string; 
    focus?: string; 
    templateId?: string;
    scheduledDate?: string;
    autoOpenPicker?: string;
  }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Check if this is a new ad-hoc workout or an existing scheduled one
  const isNewWorkout = id === 'new';

  // Fetch template if starting from one
  const { data: template } = useWorkoutTemplate(templateId || '');

  // Get active training block to set block_id for new workouts
  const { data: activeBlock } = useActiveTrainingBlock();

  // Query client for cache invalidation
  const queryClient = useQueryClient();

  // Store state
  const activeWorkout = useActiveWorkout();
  const { startWorkout, endWorkout, userId } = useAppStore();

  // Queries & mutations
  const { data: workout, isLoading: workoutLoading } = useWorkout(isNewWorkout ? '' : id);
  const createWorkoutMutation = useCreateWorkout();
  const addSetMutation = useAddWorkoutSet();
  const completeWorkoutMutation = useCompleteWorkout();
  const deleteSetMutation = useDeleteWorkoutSet();

  // Smart suggestions for ad-hoc workouts
  const { data: smartSuggestions = [] } = useSmartExerciseSuggestions(5);

  // Local state
  const [trackedExercises, setTrackedExercises] = useState<TrackedExercise[]>([]);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const hasAutoOpenedPicker = useRef(false);
  const [currentWorkoutId, setCurrentWorkoutId] = useState<string | null>(
    isNewWorkout ? null : id
  );
  const [recentExerciseIds, setRecentExerciseIds] = useState<string[]>([]);
  const [workoutStartTime] = useState(new Date());
  
  // Mutex to prevent race condition in workout creation
  const isCreatingWorkout = useRef(false);
  // Track if bulk backfill has been run
  const bulkBackfillRun = useRef(false);

  // Modal state for exercise entry
  const [selectedExerciseIndex, setSelectedExerciseIndex] = useState<number | null>(null);

  // PR celebration state
  const [showPRCelebration, setShowPRCelebration] = useState(false);
  const [prExercise, setPRExercise] = useState<Exercise | null>(null);
  const [prType, setPRType] = useState<'weight' | 'reps' | 'volume' | 'e1rm' | null>(null);
  const [prValue, setPRValue] = useState('');

  // Readiness check-in state
  const { data: todaysReadiness, isLoading: readinessLoading } = useTodaysReadiness();
  const [showReadinessCheckIn, setShowReadinessCheckIn] = useState(false);
  const [currentAdjustment, setCurrentAdjustment] = useState<ReadinessAdjustment | null>(null);
  const [workoutAdjustments, setWorkoutAdjustments] = useState<WorkoutAdjustments | null>(null);
  const hasShownReadinessPrompt = useRef(false);

  // Parse focus into sections
  const sections = useMemo(() => {
    const focus = workout?.focus || focusParam || 'Workout';
    return parseFocusToSections(focus);
  }, [workout?.focus, focusParam]);

  // Movement memory for exercise cards
  const trackedExerciseIds = useMemo(
    () => trackedExercises.map((t) => t.exercise.id),
    [trackedExercises]
  );
  const { data: exerciseMemoryMap } = useExerciseMemoryBatch(trackedExerciseIds);

  // Show readiness check-in if no check-in today (only once)
  useEffect(() => {
    if (!readinessLoading && !todaysReadiness && !hasShownReadinessPrompt.current) {
      hasShownReadinessPrompt.current = true;
      const timer = setTimeout(() => setShowReadinessCheckIn(true), 500);
      return () => clearTimeout(timer);
    }
    if (todaysReadiness && !currentAdjustment) {
      setCurrentAdjustment(todaysReadiness.suggested_adjustment as ReadinessAdjustment);
      const analysis = analyzeReadiness(
        todaysReadiness.sleep_quality as 1 | 2 | 3 | 4 | 5,
        todaysReadiness.muscle_soreness as 1 | 2 | 3 | 4 | 5,
        todaysReadiness.stress_level as 1 | 2 | 3 | 4 | 5
      );
      const adjustments = generateReadinessAdjustments(
        analysis,
        (todaysReadiness.adjustment_applied || todaysReadiness.suggested_adjustment) as ReadinessAdjustment
      );
      setWorkoutAdjustments(adjustments);
    }
  }, [readinessLoading, todaysReadiness, currentAdjustment]);

  const handleReadinessComplete = useCallback((adjustment: ReadinessAdjustment) => {
    setCurrentAdjustment(adjustment);
    setShowReadinessCheckIn(false);
    const analysis = analyzeReadiness(3, 3, 3);
    const adjustments = generateReadinessAdjustments(analysis, adjustment);
    setWorkoutAdjustments(adjustments);
  }, []);

  const handleReadinessSkip = useCallback(() => {
    setShowReadinessCheckIn(false);
    setCurrentAdjustment('full');
  }, []);

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

  // Backfill block_id if workout is missing it and there's an active block
  useEffect(() => {
    if (workout && !workout.block_id && activeBlock) {
      // If there's an active block and this workout doesn't have a block_id, assign it
      // This ensures workouts are properly associated with the active block
      supabase
        .from('workouts')
        .update({ block_id: activeBlock.id })
        .eq('id', workout.id)
        .then(({ error, data }) => {
          if (error) {
            console.error('Failed to backfill block_id:', error);
          } else {
            // Invalidate all workout queries to force a refresh
            queryClient.invalidateQueries({ queryKey: workoutKeys.all });
            // Also specifically invalidate this workout
            queryClient.invalidateQueries({ queryKey: workoutKeys.detail(workout.id) });
          }
        });
    }
  }, [workout?.id, workout?.block_id, activeBlock?.id, queryClient]);

  // Bulk backfill: Update all workouts without block_id to the active block (runs once)
  useEffect(() => {
    if (activeBlock && userId && !bulkBackfillRun.current) {
      bulkBackfillRun.current = true;
      
      // First, update workouts without block_id
      supabase
        .from('workouts')
        .update({ block_id: activeBlock.id })
        .eq('user_id', userId)
        .is('block_id', null)
        .then(({ error, count }) => {
          if (error) {
            console.error('Failed to bulk backfill block_id:', error);
            bulkBackfillRun.current = false; // Allow retry on error
          } else if (count && count > 0) {
            queryClient.invalidateQueries({ queryKey: workoutKeys.all });
          }
        });

      // Second, clear explicit 'unstructured' context for workouts that have a block_id
      // This fixes workouts that were imported with context='unstructured' but are part of a block
      supabase
        .from('workouts')
        .update({ context: null })
        .eq('user_id', userId)
        .not('block_id', 'is', null)
        .eq('context', 'unstructured')
        .then(({ error, count }) => {
          if (error) {
            console.error('Failed to clear unstructured context:', error);
          } else if (count && count > 0) {
            // Invalidate all workout queries to force refresh
            queryClient.invalidateQueries({ queryKey: workoutKeys.all });
          }
        });
    }
  }, [activeBlock?.id, userId, queryClient]);

  // Initialize workout from scheduled workout data
  useEffect(() => {
    if (workout && workout.workout_sets && trackedExercises.length === 0) {
      const exerciseMap = new Map<string, TrackedExercise>();

      workout.workout_sets.forEach((set) => {
        if (!set.exercise) return;

        if (!exerciseMap.has(set.exercise_id)) {
          const section = assignSection(set.exercise, sections);
          // Count sets with target data to determine targetSets
          const setsWithTarget = workout.workout_sets.filter(
            (s) => s.exercise_id === set.exercise_id && (s.target_reps || s.target_load || s.target_rpe)
          );
          const targetSetsCount = setsWithTarget.length > 0 ? setsWithTarget.length : undefined;
          
          exerciseMap.set(set.exercise_id, {
            exercise: set.exercise,
            sets: [],
            targetSets: targetSetsCount,
            targetReps: set.target_reps || undefined,
            targetRPE: set.target_rpe || undefined,
            targetLoad: set.target_load || undefined,
            section,
          });
        }
        exerciseMap.get(set.exercise_id)!.sets.push({
          ...set,
          segment_type: (set as any).segment_type || 'work',
        });
      });

      setTrackedExercises(Array.from(exerciseMap.values()));
      setCurrentWorkoutId(workout.id);

      if (!activeWorkout) {
        startWorkout(workout.id);
      }
    }
  }, [workout, trackedExercises.length, activeWorkout, startWorkout, sections]);

  // Initialize workout from template
  useEffect(() => {
    if (template && isNewWorkout && trackedExercises.length === 0) {
      let cancelled = false;

      const loadTemplateExercises = async () => {
        const exerciseIds = template.exercises.map((e) => e.exercise_id);
        const { data: exercises, error } = await supabase
          .from('exercises')
          .select('*')
          .in('id', exerciseIds);

        if (cancelled || error || !exercises) return;

        const exerciseMap = new Map(exercises.map((e) => [e.id, e]));
        const tracked: TrackedExercise[] = [];

        template.exercises.forEach((te) => {
          const exercise = exerciseMap.get(te.exercise_id);
          if (exercise) {
            const section = assignSection(exercise, sections);
            const sets: SetWithExercise[] = Array.from({ length: te.sets }, (_, i) => ({
              id: `temp-${te.exercise_id}-${i}`,
              workout_id: '',
              exercise_id: te.exercise_id,
              set_order: i + 1,
              target_reps: te.target_reps || null,
              target_rpe: te.target_rpe || null,
              target_load: te.target_weight || null,
              actual_weight: null,
              actual_reps: null,
              actual_rpe: null,
              tempo: null,
              avg_watts: null,
              avg_hr: null,
              duration_seconds: null,
              distance_meters: null,
              avg_pace: null,
              notes: null,
              is_warmup: false,
              is_pr: false,
              progression_type: null,
              previous_set_id: null,
              segment_type: 'work' as SegmentType,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }));
            tracked.push({
              exercise,
              sets,
              targetSets: te.sets,
              targetReps: te.target_reps,
              targetRPE: te.target_rpe,
              targetLoad: te.target_weight,
              section,
            });
          }
        });

        if (!cancelled) {
          setTrackedExercises(tracked);
        }
      };

      loadTemplateExercises();
      return () => { cancelled = true; };
    }
  }, [template, isNewWorkout, trackedExercises.length, sections]);

  // Create new ad-hoc workout
  const createNewWorkout = useCallback(async () => {
    if (currentWorkoutId) return currentWorkoutId;
    
    if (isCreatingWorkout.current) {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (currentWorkoutId) return currentWorkoutId;
      if (isCreatingWorkout.current) return null;
    }

    isCreatingWorkout.current = true;
    try {
      const workoutDate = scheduledDate || new Date().toISOString().split('T')[0];
      const newWorkout = await createWorkoutMutation.mutateAsync({
        focus: focusParam || 'Quick Workout',
        scheduled_date: workoutDate,
        block_id: activeBlock?.id || null,
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
  }, [currentWorkoutId, createWorkoutMutation, startWorkout, focusParam, scheduledDate, activeBlock]);

  // Add exercise to workout
  const handleAddExercise = useCallback(
    async (exercise: Exercise) => {
      const workoutId = await createNewWorkout();
      if (!workoutId) return;

      const section = assignSection(exercise, sections);
      const newSet: SetWithExercise = {
        id: `temp-${exercise.id}-0`,
        workout_id: workoutId,
        exercise_id: exercise.id,
        set_order: 1,
        target_reps: null,
        target_rpe: null,
        target_load: null,
        actual_weight: null,
        actual_reps: null,
        actual_rpe: null,
        tempo: null,
        avg_watts: null,
        avg_hr: null,
        duration_seconds: null,
        distance_meters: null,
        avg_pace: null,
        notes: null,
        is_warmup: false,
        is_pr: false,
        progression_type: null,
        previous_set_id: null,
        segment_type: 'work' as SegmentType,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setTrackedExercises((prev) => [
        ...prev,
        { exercise, sets: [newSet], section },
      ]);

      setRecentExerciseIds((prev) => {
        const filtered = prev.filter((id) => id !== exercise.id);
        return [exercise.id, ...filtered].slice(0, 10);
      });
    },
    [createNewWorkout, sections]
  );

  // Auto-open exercise picker for quick log (must be after createNewWorkout is defined)
  useEffect(() => {
    if (autoOpenPicker === 'true' && isNewWorkout && !hasAutoOpenedPicker.current) {
      // Create workout first if needed, then open picker
      const openPicker = async () => {
        if (!currentWorkoutId) {
          const workoutId = await createNewWorkout();
          if (workoutId) {
            // Wait a moment for UI to settle
            setTimeout(() => {
              setShowExercisePicker(true);
              hasAutoOpenedPicker.current = true;
            }, 300);
          }
        } else {
          // Workout already exists, just open picker
          setTimeout(() => {
            setShowExercisePicker(true);
            hasAutoOpenedPicker.current = true;
          }, 300);
        }
      };
      openPicker();
    }
  }, [autoOpenPicker, isNewWorkout, currentWorkoutId, createNewWorkout]);

  // Add set to an exercise
  const handleAddSet = useCallback((exerciseIndex: number) => {
    setTrackedExercises((prev) => {
      const updated = [...prev];
      const exercise = updated[exerciseIndex];
      const maxSetOrder = Math.max(0, ...exercise.sets.map(s => s.set_order));
      const newSet: SetWithExercise = {
        id: `temp-${exercise.exercise.id}-${maxSetOrder + 1}`,
        workout_id: currentWorkoutId || '',
        exercise_id: exercise.exercise.id,
        set_order: maxSetOrder + 1,
        target_reps: exercise.targetReps || null,
        target_rpe: exercise.targetRPE || null,
        target_load: exercise.targetLoad || null,
        actual_weight: null,
        actual_reps: null,
        actual_rpe: null,
        tempo: null,
        avg_watts: null,
        avg_hr: null,
        duration_seconds: null,
        distance_meters: null,
        avg_pace: null,
        notes: null,
        is_warmup: false,
        is_pr: false,
        progression_type: null,
        previous_set_id: null,
        segment_type: 'work' as SegmentType,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      updated[exerciseIndex].sets.push(newSet);
      return updated;
    });
  }, [currentWorkoutId]);

  // Save a set
  const handleSaveSet = useCallback(
    async (
      exerciseId: string,
      setOrder: number,
      setData: Omit<WorkoutSetInsert, 'workout_id' | 'exercise_id' | 'set_order'>
    ) => {
      if (!currentWorkoutId) {
        Alert.alert('Error', 'No active workout. Please try again.');
        return;
      }

      try {
        const result = await addSetMutation.mutateAsync({
          workout_id: currentWorkoutId,
          exercise_id: exerciseId,
          set_order: setOrder,
          ...setData,
        });
        
        // Update local state with the saved set
        if (result && (result as any).id) {
          setTrackedExercises((prev) => {
            const updated = [...prev];
            const exerciseIndex = updated.findIndex(ex => ex.exercise.id === exerciseId);
            if (exerciseIndex >= 0) {
              const exercise = updated[exerciseIndex].exercise;
              const setWithExercise = {
                ...(result as any),
                exercise: (result as any).exercise || exercise, // Preserve exercise relationship
              };
              
              const setIndex = updated[exerciseIndex].sets.findIndex(s => s.set_order === setOrder);
              if (setIndex >= 0) {
                updated[exerciseIndex].sets[setIndex] = setWithExercise;
              } else {
                // New set - add it
                updated[exerciseIndex].sets.push(setWithExercise);
              }
            }
            return updated;
          });
        }
      } catch (error: any) {
        Alert.alert('Error', `Failed to save set: ${error?.message || 'Unknown error'}. Please try again.`);
      }
    },
    [currentWorkoutId, addSetMutation]
  );

  // Delete a set
  const handleDeleteSet = useCallback(
    async (setId: string) => {
      if (!currentWorkoutId) return;

      try {
        await deleteSetMutation.mutateAsync({
          id: setId,
          workoutId: currentWorkoutId,
        });

        // Remove from local state
        setTrackedExercises((prev) => {
          const updated = prev.map(ex => ({
            ...ex,
            sets: ex.sets.filter(s => s.id !== setId),
          }));
          // Remove exercises with no sets
          return updated.filter(ex => ex.sets.length > 0);
        });
      } catch (error) {
        Alert.alert('Error', 'Failed to delete set.');
      }
    },
    [currentWorkoutId, deleteSetMutation]
  );

  // Delete an entire exercise (all its sets)
  const handleDeleteExercise = useCallback(
    async (exerciseId: string) => {
      if (!currentWorkoutId) return;

      // Find the exercise and its sets
      const exercise = trackedExercises.find(ex => ex.exercise.id === exerciseId);
      if (!exercise) return;

      // Confirm deletion - handle web vs native
      const doDelete = async () => {
        try {
          // Delete all sets for this exercise
          const setsToDelete = exercise.sets.filter(s => s.id && !s.id.startsWith('temp-'));
          if (setsToDelete.length > 0) {
            await Promise.all(
              setsToDelete.map(set =>
                deleteSetMutation.mutateAsync({
                  id: set.id!,
                  workoutId: currentWorkoutId,
                })
              )
            );
          }

          // Remove from local state
          setTrackedExercises((prev) =>
            prev.filter(ex => ex.exercise.id !== exerciseId)
          );
        } catch (error) {
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            window.alert('Failed to remove exercise. Please try again.');
          } else {
            Alert.alert('Error', 'Failed to remove exercise. Please try again.');
          }
        }
      };

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const confirmed = window.confirm(`Remove "${exercise.exercise.name}" from this workout?`);
        if (confirmed) {
          await doDelete();
        }
      } else {
        Alert.alert(
          'Remove Exercise',
          `Remove "${exercise.exercise.name}" from this workout?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Remove',
              style: 'destructive',
              onPress: doDelete,
            },
          ]
        );
      }
    },
    [currentWorkoutId, trackedExercises, deleteSetMutation]
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
      const confirmed = Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.confirm('You haven\'t logged any sets yet. Are you sure you want to finish?')
        : await new Promise<boolean>((resolve) => {
            Alert.alert(
              'No Sets Logged',
              'You haven\'t logged any sets yet. Are you sure you want to finish?',
              [
                { text: 'Keep Training', style: 'cancel', onPress: () => resolve(false) },
                {
                  text: 'Finish Anyway',
                  style: 'destructive',
                  onPress: () => resolve(true),
                },
              ]
            );
          });
      
      if (!confirmed) return;

      try {
        await completeWorkoutMutation.mutateAsync({
          id: currentWorkoutId,
          durationMinutes: elapsedMinutes,
        });
        endWorkout();
        router.replace(`/workout-summary/${currentWorkoutId}`);
      } catch (error: any) {
        console.error('Error completing workout:', error);
        Alert.alert('Error', error?.message || 'Failed to complete workout. Please try again.');
      }
      return;
    }

    try {
      await completeWorkoutMutation.mutateAsync({
        id: currentWorkoutId,
        durationMinutes: elapsedMinutes,
      });
      
      // Don't call endWorkout here - the mutation's onSuccess will handle it
      // Show success message before navigating
      const confirmed = Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.confirm(`Workout Completed! ✅\n\nYour workout has been saved successfully. ${totalSets} set${totalSets !== 1 ? 's' : ''} logged.\n\nView Summary?`)
        : await new Promise<boolean>((resolve) => {
            Alert.alert(
              'Workout Completed! ✅',
              `Your workout has been saved successfully. ${totalSets} set${totalSets !== 1 ? 's' : ''} logged.`,
              [
                { text: 'OK', onPress: () => resolve(false) },
                { text: 'View Summary', onPress: () => resolve(true) },
              ]
            );
          });
      
      if (confirmed) {
        router.replace(`/workout-summary/${currentWorkoutId}`);
      } else {
        router.back();
      }
    } catch (error: any) {
      console.error('Error completing workout:', error);
      const errorMessage = error?.message || 'Failed to complete workout. Please try again.';
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        alert(`Error: ${errorMessage}`);
      } else {
        Alert.alert('Error', errorMessage);
      }
    }
  }, [currentWorkoutId, trackedExercises, elapsedMinutes, completeWorkoutMutation, endWorkout]);

  // Save & Exit
  const handleSaveAndExit = useCallback(() => {
    endWorkout();
    const totalSets = trackedExercises.reduce(
      (acc, ex) => acc + (ex.sets?.length || 0),
      0
    );
    
    if (Platform.OS === 'web') {
      alert(`Progress saved! ${totalSets} set${totalSets !== 1 ? 's' : ''} logged. Come back anytime to continue.`);
    } else {
      Alert.alert(
        'Progress Saved 💾',
        `${totalSets} set${totalSets !== 1 ? 's' : ''} logged. Your workout is saved but not completed yet. Come back anytime to finish it.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
      return;
    }
    router.back();
  }, [endWorkout, trackedExercises]);

  // Discard workout
  const handleDiscard = useCallback(() => {
    try {
      const totalSets = trackedExercises.reduce(
        (acc, ex) => acc + (ex.sets?.length || 0),
        0
      );

      if (totalSets === 0) {
        endWorkout();
        router.back();
        return;
      }

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const confirmed = window.confirm('Discard Workout?\n\nAll logged sets will be lost. This cannot be undone.');
        if (confirmed) {
          endWorkout();
          router.back();
        }
        return;
      }

      Alert.alert(
        'Discard Workout?',
        'All logged sets will be lost. This cannot be undone.',
        [
          { text: 'Keep Training', style: 'cancel' },
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
      endWorkout();
      router.back();
    }
  }, [endWorkout, trackedExercises]);

  // Format elapsed time
  const formattedTime = useMemo(() => {
    const hours = Math.floor(elapsedMinutes / 60);
    const mins = elapsedMinutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  }, [elapsedMinutes]);

  // Group exercises by section for display
  const exercisesBySection = useMemo(() => {
    const grouped = new Map<string, TrackedExercise[]>();
    
    for (const tracked of trackedExercises) {
      const section = tracked.section || 'Exercises';
      if (!grouped.has(section)) {
        grouped.set(section, []);
      }
      grouped.get(section)!.push(tracked);
    }
    
    // Sort sections to match original order
    const orderedSections: [string, TrackedExercise[]][] = [];
    for (const section of sections) {
      if (grouped.has(section)) {
        orderedSections.push([section, grouped.get(section)!]);
        grouped.delete(section);
      }
    }
    // Add any remaining sections
    for (const [section, exercises] of grouped) {
      orderedSections.push([section, exercises]);
    }
    
    return orderedSections;
  }, [trackedExercises, sections]);

  // Get selected exercise for modal
  const selectedExercise = selectedExerciseIndex !== null ? trackedExercises[selectedExerciseIndex] : null;

  if (!isNewWorkout && workoutLoading) {
    return (
      <SafeAreaView
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.void[900] }}
      >
        <ActivityIndicator size="large" color={Colors.signal[500]} />
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.void[900] }}>
      {/* Ambient Background Glows */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -100,
          right: -100,
          width: 300,
          height: 300,
          backgroundColor: 'rgba(37, 99, 235, 0.08)',
          borderRadius: 150,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: 50,
          left: -80,
          width: 280,
          height: 280,
          backgroundColor: 'rgba(37, 99, 235, 0.05)',
          borderRadius: 140,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: '40%',
          left: '50%',
          width: 200,
          height: 200,
          backgroundColor: 'rgba(37, 99, 235, 0.03)',
          borderRadius: 100,
          transform: [{ translateX: -100 }],
        }}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right', 'bottom']}>
        {/* Header */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 16,
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(255, 255, 255, 0.08)',
            backgroundColor: 'rgba(12, 12, 12, 0.95)',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Pressable
                onPress={() => {
                  // Simply exit - all sets are already saved to the database
                  endWorkout();
                  router.back();
                }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color={Colors.graphite[300]} />
              </Pressable>
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text
                  style={{ fontSize: 18, fontWeight: '700', color: Colors.graphite[50] }}
                  numberOfLines={1}
                >
                  {workout?.focus || focusParam || 'Quick Workout'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 10 }}>
                  <LiveIndicator />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="time-outline" size={12} color={Colors.graphite[500]} />
                    <Text style={{ fontSize: 12, fontFamily: 'monospace', color: Colors.graphite[400] }}>
                      {formattedTime}
                    </Text>
                  </View>
                  {workout && (() => {
                    const context = detectWorkoutContext(workout);
                    const contextInfo = getContextInfo(context);
                    return (
                      <View
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 10,
                          backgroundColor: contextInfo.bgColor,
                        }}
                      >
                        <Text style={{ fontSize: 9, fontWeight: '700', color: contextInfo.color, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          {contextInfo.label}
                        </Text>
                      </View>
                    );
                  })()}
                  {todaysReadiness && (
                    <ReadinessIndicator
                      score={todaysReadiness.readiness_score}
                      onPress={() => setShowReadinessCheckIn(true)}
                    />
                  )}
                </View>
              </View>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
            <Pressable
              style={{
                paddingHorizontal: 18,
                paddingVertical: 11,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.1)',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
              }}
              onPress={handleSaveAndExit}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.graphite[200] }}>
                Save & Exit
              </Text>
            </Pressable>
            <Pressable
              style={{
                paddingHorizontal: 20,
                paddingVertical: 11,
                borderRadius: 12,
                backgroundColor: completeWorkoutMutation.isPending ? 'rgba(16, 185, 129, 0.5)' : Colors.emerald[500],
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                shadowColor: Colors.emerald[400],
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                opacity: completeWorkoutMutation.isPending ? 0.7 : 1,
              }}
              onPress={handleFinishWorkout}
              disabled={completeWorkoutMutation.isPending}
            >
              {completeWorkoutMutation.isPending ? (
                <>
                  <ActivityIndicator size="small" color="#000" />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#000' }}>Finishing...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#000" />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#000' }}>Finish</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1, paddingHorizontal: 16 }}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 100 }}
        >
        {/* Exercise Cards by Section */}
        {exercisesBySection.map(([section, exercises]) => (
          <View key={section}>
            <SectionHeader title={section} />
            {exercises.map((tracked) => {
              const exerciseIndex = trackedExercises.findIndex(
                (t) => t.exercise.id === tracked.exercise.id
              );
              const memory = exerciseMemoryMap?.get(tracked.exercise.id);
              return (
                <ExerciseCard
                  key={tracked.exercise.id}
                  exercise={tracked.exercise}
                  sets={tracked.sets}
                  targetSets={tracked.targetSets || tracked.sets.length}
                  targetReps={tracked.targetReps}
                  targetRPE={tracked.targetRPE}
                  targetLoad={tracked.targetLoad}
                  onPress={() => setSelectedExerciseIndex(exerciseIndex)}
                  onDelete={() => handleDeleteExercise(tracked.exercise.id)}
                  showDelete={true}
                  lastPerformance={memory ? {
                    weight: memory.lastWeight,
                    reps: memory.lastReps,
                    rpe: memory.lastRPE,
                    date: memory.lastDate,
                  } : undefined}
                />
              );
            })}
          </View>
        ))}

          {/* Empty State / Add Exercise Button */}
          {trackedExercises.length === 0 ? (
            <GlassCard style={{ marginTop: 8 }}>
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 24 }}>
                <View
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 16,
                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                    borderWidth: 1,
                    borderColor: 'rgba(59, 130, 246, 0.3)',
                  }}
                >
                  <Ionicons name="barbell-outline" size={40} color={Colors.signal[400]} />
                </View>
                <Text style={{ fontSize: 20, fontWeight: '700', color: Colors.graphite[50], marginBottom: 8 }}>
                  Ready to train?
                </Text>
                <Text style={{ fontSize: 14, textAlign: 'center', color: Colors.graphite[400], marginBottom: 24, paddingHorizontal: 16 }}>
                  {isNewWorkout && smartSuggestions.length > 0
                    ? 'Pick from your go-to exercises or browse the full library'
                    : 'Add your first exercise to get started'}
                </Text>

                {/* Smart Suggestions */}
                {isNewWorkout && smartSuggestions.length > 0 && (
                  <View style={{ width: '100%', marginBottom: 24 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2, color: Colors.signal[400] }}>
                        Suggested for you
                      </Text>
                    </View>
                    <View style={{ gap: 10 }}>
                      {smartSuggestions.map((suggestion) => (
                        <Pressable
                          key={suggestion.exercise.id}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            padding: 14,
                            borderRadius: 16,
                            backgroundColor: 'rgba(0, 0, 0, 0.3)',
                            borderWidth: 1,
                            borderColor: 'rgba(255, 255, 255, 0.08)',
                          }}
                          onPress={() => handleAddExercise(suggestion.exercise)}
                        >
                          <View
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 22,
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor:
                                suggestion.exercise.modality === 'Strength'
                                  ? 'rgba(59, 130, 246, 0.2)'
                                  : suggestion.exercise.modality === 'Cardio'
                                  ? 'rgba(16, 185, 129, 0.2)'
                                  : 'rgba(155, 89, 182, 0.2)',
                              borderWidth: 1,
                              borderColor:
                                suggestion.exercise.modality === 'Strength'
                                  ? 'rgba(59, 130, 246, 0.3)'
                                  : suggestion.exercise.modality === 'Cardio'
                                  ? 'rgba(16, 185, 129, 0.3)'
                                  : 'rgba(155, 89, 182, 0.3)',
                            }}
                          >
                            <Ionicons
                              name={
                                suggestion.exercise.modality === 'Strength'
                                  ? 'barbell-outline'
                                  : suggestion.exercise.modality === 'Cardio'
                                  ? 'bicycle-outline'
                                  : 'fitness-outline'
                              }
                              size={22}
                              color={
                                suggestion.exercise.modality === 'Strength'
                                  ? Colors.signal[400]
                                  : suggestion.exercise.modality === 'Cardio'
                                  ? Colors.emerald[400]
                                  : '#9B59B6'
                              }
                            />
                          </View>
                          <View style={{ flex: 1, marginLeft: 14 }}>
                            <Text style={{ fontWeight: '600', fontSize: 15, color: Colors.graphite[50] }}>
                              {suggestion.exercise.name}
                            </Text>
                            <Text style={{ fontSize: 12, color: Colors.graphite[500], marginTop: 2 }}>
                              {suggestion.message}
                            </Text>
                          </View>
                          <View
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 16,
                              backgroundColor: 'rgba(59, 130, 246, 0.15)',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Ionicons name="add" size={20} color={Colors.signal[400]} />
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}

                <LabButton
                  label={isNewWorkout && smartSuggestions.length > 0 ? 'Browse All Exercises' : 'Add Exercise'}
                  icon={<Ionicons name="search" size={16} color="white" />}
                  onPress={() => setShowExercisePicker(true)}
                />
              </View>
            </GlassCard>
          ) : (
            <Pressable
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 16,
                borderRadius: 16,
                marginTop: 16,
                backgroundColor: Colors.signal[600],
                shadowColor: Colors.signal[500],
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.3,
                shadowRadius: 16,
              }}
              onPress={() => setShowExercisePicker(true)}
            >
              <Ionicons name="add-circle" size={22} color="#ffffff" />
              <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 14, marginLeft: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Add Exercise</Text>
            </Pressable>
          )}
        </ScrollView>

      {/* Exercise Entry Modal */}
      <ExerciseEntryModal
        visible={selectedExerciseIndex !== null}
        exercise={selectedExercise?.exercise || null}
        sets={selectedExercise?.sets || []}
        workoutId={currentWorkoutId || ''}
        targetSets={selectedExercise?.targetSets}
        targetReps={selectedExercise?.targetReps}
        targetRPE={selectedExercise?.targetRPE}
        targetLoad={selectedExercise?.targetLoad}
        onClose={() => setSelectedExerciseIndex(null)}
        onSaveSet={handleSaveSet}
        onDeleteSet={handleDeleteSet}
        onAddSet={() => selectedExerciseIndex !== null && handleAddSet(selectedExerciseIndex)}
      />

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

        {/* Readiness Check-In Modal */}
        <Modal
          visible={showReadinessCheckIn}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={handleReadinessSkip}
        >
          <View style={{ flex: 1, backgroundColor: Colors.void[900] }}>
            <SafeAreaView style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 16 }}>
              <ReadinessCheckIn
                onComplete={handleReadinessComplete}
                onSkip={handleReadinessSkip}
              />
            </SafeAreaView>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}
