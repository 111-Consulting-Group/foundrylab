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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExerciseCard, SectionHeader } from '@/components/ExerciseCard';
import { ExerciseEntryModal } from '@/components/ExerciseEntryModal';
import { ExercisePicker } from '@/components/ExercisePicker';
import { PRCelebration } from '@/components/PRCelebration';
import { ReadinessCheckIn, ReadinessIndicator } from '@/components/ReadinessCheckIn';
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
} from '@/hooks/useWorkouts';
import { useAppStore, useActiveWorkout } from '@/stores/useAppStore';
import { supabase } from '@/lib/supabase';
import { useSmartExerciseSuggestions } from '@/hooks/useProgressionTargets';
import { useWorkoutTemplate } from '@/hooks/useWorkoutTemplates';
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
  const { id, focus: focusParam, templateId, scheduledDate } = useLocalSearchParams<{ 
    id: string; 
    focus?: string; 
    templateId?: string;
    scheduledDate?: string;
  }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Check if this is a new ad-hoc workout or an existing scheduled one
  const isNewWorkout = id === 'new';

  // Fetch template if starting from one
  const { data: template } = useWorkoutTemplate(templateId || '');

  // Store state
  const activeWorkout = useActiveWorkout();
  const { startWorkout, endWorkout } = useAppStore();

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
  const [currentWorkoutId, setCurrentWorkoutId] = useState<string | null>(
    isNewWorkout ? null : id
  );
  const [recentExerciseIds, setRecentExerciseIds] = useState<string[]>([]);
  const [workoutStartTime] = useState(new Date());
  
  // Mutex to prevent race condition in workout creation
  const isCreatingWorkout = useRef(false);

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
  }, [currentWorkoutId, createWorkoutMutation, startWorkout, focusParam, scheduledDate]);

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
      if (!currentWorkoutId) return;

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
              const setIndex = updated[exerciseIndex].sets.findIndex(s => s.set_order === setOrder);
              if (setIndex >= 0) {
                updated[exerciseIndex].sets[setIndex] = {
                  ...updated[exerciseIndex].sets[setIndex],
                  ...(result as any),
                };
              } else {
                // New set - add it
                updated[exerciseIndex].sets.push(result as any);
              }
            }
            return updated;
          });
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to save set. Please try again.');
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
      router.replace(`/workout-summary/${currentWorkoutId}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to complete workout. Please try again.');
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
              onPress={handleDiscard}
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
                  numberOfLines={1}
                >
                  {workout?.focus || focusParam || 'Quick Workout'}
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
                {todaysReadiness && (
                  <ReadinessIndicator
                    score={todaysReadiness.readiness_score}
                    onPress={() => setShowReadinessCheckIn(true)}
                  />
                )}
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
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
      >
        {/* Exercise Cards by Section */}
        {exercisesBySection.map(([section, exercises]) => (
          <View key={section}>
            <SectionHeader title={section} />
            {exercises.map((tracked) => {
              const exerciseIndex = trackedExercises.findIndex(
                (t) => t.exercise.id === tracked.exercise.id
              );
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
                />
              );
            })}
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
                color="#2F80ED"
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

            {/* Smart Suggestions */}
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
            className={`flex-row items-center justify-center py-4 rounded-xl mt-4 ${
              isDark ? 'bg-signal-600' : 'bg-signal-500'
            }`}
            onPress={() => setShowExercisePicker(true)}
          >
            <Ionicons name="add" size={24} color="#ffffff" />
            <Text className="text-white font-semibold ml-2">Add Exercise</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* Exercise Entry Modal */}
      <ExerciseEntryModal
        visible={selectedExerciseIndex !== null}
        exercise={selectedExercise?.exercise || null}
        sets={selectedExercise?.sets || []}
        workoutId={currentWorkoutId || ''}
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
        <View className={`flex-1 ${isDark ? 'bg-carbon-950' : 'bg-graphite-50'}`}>
          <SafeAreaView className="flex-1 justify-center px-4">
            <ReadinessCheckIn
              onComplete={handleReadinessComplete}
              onSkip={handleReadinessSkip}
            />
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
