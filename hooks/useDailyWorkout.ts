/**
 * Daily Workout Generator Hook
 *
 * Generates intelligent workout suggestions based on:
 * - Recent training history (what was trained recently)
 * - User's training profile/goals
 * - Recovery patterns
 * - Available time
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { differenceInDays } from 'date-fns';

import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/useAppStore';
import { useWorkoutHistory } from './useWorkouts';
import { useActiveTrainingBlock } from './useTrainingBlocks';
import { useExercises } from './useExercises';
import { useDetectedPatterns } from './usePatternDetection';
import type { Exercise, WorkoutWithSets } from '@/types/database';

// ============================================================================
// Types
// ============================================================================

export interface DailyWorkoutSuggestion {
  focus: string;
  description: string;
  reason: string;
  estimatedDuration: number;
  exercises: SuggestedExercise[];
  muscleGroups: string[];
  type: 'strength' | 'cardio' | 'hybrid';
}

export interface SuggestedExercise {
  exercise: Exercise;
  sets: number;
  targetReps: number;
  targetRPE: number;
  notes?: string;
}

interface MuscleGroupRecovery {
  muscleGroup: string;
  lastTrainedDate: string | null;
  daysSince: number | null;
  isRecovered: boolean; // Typically 48-72 hours
}

// ============================================================================
// Helper Functions
// ============================================================================

function analyzeMuscleGroupRecovery(workouts: WorkoutWithSets[]): MuscleGroupRecovery[] {
  const muscleGroupMap = new Map<string, string>();

  // Analyze last 7 days of workouts
  const recentWorkouts = workouts.filter((w) => {
    if (!w.date_completed) return false;
    const daysSince = differenceInDays(new Date(), new Date(w.date_completed));
    return daysSince <= 7;
  });

  // Find when each muscle group was last trained
  for (const workout of recentWorkouts) {
    if (!workout.workout_sets) continue;
    for (const set of workout.workout_sets) {
      if (!set.exercise?.muscle_group) continue;
      const muscleGroup = set.exercise.muscle_group;
      const existingDate = muscleGroupMap.get(muscleGroup);
      const setDate = workout.date_completed!;

      if (!existingDate || new Date(setDate) > new Date(existingDate)) {
        muscleGroupMap.set(muscleGroup, setDate);
      }
    }
  }

  // Common muscle groups to check
  const allMuscleGroups = [
    'Chest',
    'Back',
    'Shoulders',
    'Biceps',
    'Triceps',
    'Quadriceps',
    'Hamstrings',
    'Glutes',
    'Core',
    'Calves',
  ];

  return allMuscleGroups.map((muscleGroup) => {
    const lastTrainedDate = muscleGroupMap.get(muscleGroup) || null;
    const daysSince = lastTrainedDate
      ? differenceInDays(new Date(), new Date(lastTrainedDate))
      : null;

    return {
      muscleGroup,
      lastTrainedDate,
      daysSince,
      isRecovered: daysSince === null || daysSince >= 2, // 48 hours minimum
    };
  });
}

function generateWorkoutFocus(recoveryData: MuscleGroupRecovery[]): {
  focus: string;
  description: string;
  reason: string;
  muscleGroups: string[];
} {
  // Find muscle groups that are recovered
  const recoveredGroups = recoveryData.filter((r) => r.isRecovered);

  // Group by category
  const pushMuscles = recoveredGroups.filter((r) =>
    ['Chest', 'Shoulders', 'Triceps'].includes(r.muscleGroup)
  );
  const pullMuscles = recoveredGroups.filter((r) =>
    ['Back', 'Biceps'].includes(r.muscleGroup)
  );
  const legMuscles = recoveredGroups.filter((r) =>
    ['Quadriceps', 'Hamstrings', 'Glutes', 'Calves'].includes(r.muscleGroup)
  );

  // Find groups that haven't been trained longest
  const sortedByRest = [...recoveredGroups].sort((a, b) => {
    if (a.daysSince === null && b.daysSince === null) return 0;
    if (a.daysSince === null) return -1;
    if (b.daysSince === null) return 1;
    return b.daysSince - a.daysSince;
  });

  // Determine best focus based on recovery
  if (legMuscles.length >= 3 && sortedByRest[0]?.muscleGroup?.match(/Quad|Ham|Glute/)) {
    return {
      focus: 'Lower Body',
      description: 'Legs, glutes, and core focus',
      reason: 'Your lower body is fully recovered and ready to train',
      muscleGroups: ['Quadriceps', 'Hamstrings', 'Glutes', 'Core'],
    };
  }

  if (pushMuscles.length >= 2 && sortedByRest[0]?.muscleGroup?.match(/Chest|Shoulder/)) {
    return {
      focus: 'Push Day',
      description: 'Chest, shoulders, and triceps',
      reason: 'Your pushing muscles have had adequate rest',
      muscleGroups: ['Chest', 'Shoulders', 'Triceps'],
    };
  }

  if (pullMuscles.length >= 2 && sortedByRest[0]?.muscleGroup?.match(/Back|Bicep/)) {
    return {
      focus: 'Pull Day',
      description: 'Back and biceps focus',
      reason: 'Your pulling muscles are recovered and ready',
      muscleGroups: ['Back', 'Biceps'],
    };
  }

  // Default to full body if everything is recovered
  if (recoveredGroups.length >= 6) {
    return {
      focus: 'Full Body',
      description: 'Balanced full body workout',
      reason: "You're well recovered - time for a full body session",
      muscleGroups: ['Chest', 'Back', 'Quadriceps', 'Core'],
    };
  }

  // Fallback to upper body
  return {
    focus: 'Upper Body',
    description: 'Upper body strength focus',
    reason: 'Based on your recent training pattern',
    muscleGroups: ['Chest', 'Back', 'Shoulders'],
  };
}

function selectExercisesForFocus(
  exercises: Exercise[],
  targetMuscleGroups: string[],
  count: number = 5
): SuggestedExercise[] {
  const selected: SuggestedExercise[] = [];
  const usedExercises = new Set<string>();

  // Prioritize compound movements first
  const compoundKeywords = [
    'squat',
    'deadlift',
    'bench',
    'press',
    'row',
    'pull',
    'lunge',
  ];

  for (const muscleGroup of targetMuscleGroups) {
    const muscleExercises = exercises.filter(
      (e) =>
        e.muscle_group === muscleGroup &&
        e.modality === 'Strength' &&
        !usedExercises.has(e.id)
    );

    if (muscleExercises.length === 0) continue;

    // Sort by compound first, then by usage_count
    const sorted = [...muscleExercises].sort((a, b) => {
      const aIsCompound = compoundKeywords.some((k) =>
        a.name.toLowerCase().includes(k)
      );
      const bIsCompound = compoundKeywords.some((k) =>
        b.name.toLowerCase().includes(k)
      );
      if (aIsCompound && !bIsCompound) return -1;
      if (!aIsCompound && bIsCompound) return 1;
      return (b.usage_count || 0) - (a.usage_count || 0);
    });

    const exercise = sorted[0];
    if (exercise && selected.length < count) {
      usedExercises.add(exercise.id);
      selected.push({
        exercise,
        sets: 3,
        targetReps: 8,
        targetRPE: 7,
      });
    }
  }

  return selected;
}

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Map training split names to muscle groups
 */
function splitToMuscleGroups(splitName: string): string[] {
  const lower = splitName.toLowerCase();

  if (lower.includes('push')) {
    return ['Chest', 'Shoulders', 'Triceps'];
  }
  if (lower.includes('pull')) {
    return ['Back', 'Biceps'];
  }
  if (lower.includes('leg') || lower.includes('lower')) {
    return ['Quadriceps', 'Hamstrings', 'Glutes', 'Calves'];
  }
  if (lower.includes('upper')) {
    return ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps'];
  }
  if (lower.includes('full')) {
    return ['Chest', 'Back', 'Quadriceps', 'Core'];
  }
  if (lower.includes('chest')) {
    return ['Chest', 'Triceps'];
  }
  if (lower.includes('back')) {
    return ['Back', 'Biceps'];
  }
  if (lower.includes('shoulder') || lower.includes('arm')) {
    return ['Shoulders', 'Biceps', 'Triceps'];
  }

  // Default to full body if we can't determine
  return ['Chest', 'Back', 'Quadriceps', 'Core'];
}

/**
 * Get the next focus in a detected training rotation
 */
function getNextInRotation(
  splits: string[],
  workoutHistory: WorkoutWithSets[]
): { nextFocus: string; reason: string; daysSince: number | null } | null {
  if (splits.length === 0) return null;

  // Build map of when each split was last trained
  const lastByType = new Map<string, { date: string; daysSince: number }>();

  for (const workout of workoutHistory) {
    if (!workout.date_completed || !workout.focus) continue;
    const workoutFocus = workout.focus.toLowerCase();

    for (const split of splits) {
      const splitLower = split.toLowerCase();
      if (workoutFocus.includes(splitLower) && !lastByType.has(split)) {
        const daysSince = differenceInDays(new Date(), new Date(workout.date_completed));
        lastByType.set(split, { date: workout.date_completed, daysSince });
        break;
      }
    }
  }

  // Find the split that was trained longest ago (and is recovered)
  let nextFocus: string | null = null;
  let maxDays = -1;
  let reason = '';

  for (const split of splits) {
    const lastData = lastByType.get(split);

    if (!lastData) {
      nextFocus = split;
      reason = `You haven't logged a ${split} session yet`;
      return { nextFocus, reason, daysSince: null };
    }

    if (lastData.daysSince >= 2 && lastData.daysSince > maxDays) {
      maxDays = lastData.daysSince;
      nextFocus = split;
      reason = `Last ${split} was ${lastData.daysSince} days ago`;
    }
  }

  if (!nextFocus) {
    // All trained recently, pick the one trained longest ago
    let oldestDays = -1;
    for (const split of splits) {
      const lastData = lastByType.get(split);
      if (lastData && lastData.daysSince > oldestDays) {
        oldestDays = lastData.daysSince;
        nextFocus = split;
        reason = `${split} was your least recent session`;
      }
    }
  }

  if (!nextFocus) {
    nextFocus = splits[0];
    reason = 'Starting fresh with your rotation';
  }

  return {
    nextFocus,
    reason,
    daysSince: lastByType.get(nextFocus)?.daysSince ?? null,
  };
}

export function useDailyWorkoutSuggestion() {
  const userId = useAppStore((state) => state.userId);
  const { data: workoutHistory = [] } = useWorkoutHistory(10);
  const { data: exercises = [] } = useExercises();
  const { data: activeBlock } = useActiveTrainingBlock();
  const { data: patterns = [] } = useDetectedPatterns();

  return useQuery({
    queryKey: ['dailyWorkoutSuggestion', userId, workoutHistory.length, patterns?.length],
    queryFn: async (): Promise<DailyWorkoutSuggestion | null> => {
      if (!userId) return null;

      // Check for detected training split pattern
      const splitPattern = patterns?.find((p) => p.type === 'training_split');
      const hasRotation = splitPattern && splitPattern.confidence >= 0.5;

      let focus: string;
      let description: string;
      let reason: string;
      let muscleGroups: string[];

      if (hasRotation) {
        // Use rotation awareness - follows the user's established pattern
        const splits = (splitPattern.data.splits as string[]) || [];
        const rotationInfo = getNextInRotation(splits, workoutHistory);

        if (rotationInfo) {
          focus = rotationInfo.nextFocus;
          description = `${rotationInfo.nextFocus} day based on your ${splitPattern.name || 'training split'}`;
          reason = rotationInfo.reason;
          muscleGroups = splitToMuscleGroups(rotationInfo.nextFocus);
        } else {
          // Fallback to recovery-based
          const recoveryData = analyzeMuscleGroupRecovery(workoutHistory);
          const recoveryFocus = generateWorkoutFocus(recoveryData);
          focus = recoveryFocus.focus;
          description = recoveryFocus.description;
          reason = recoveryFocus.reason;
          muscleGroups = recoveryFocus.muscleGroups;
        }
      } else {
        // No rotation detected - use recovery-based suggestion
        const recoveryData = analyzeMuscleGroupRecovery(workoutHistory);
        const recoveryFocus = generateWorkoutFocus(recoveryData);
        focus = recoveryFocus.focus;
        description = recoveryFocus.description;
        reason = recoveryFocus.reason;
        muscleGroups = recoveryFocus.muscleGroups;
      }

      // Select exercises for the focus
      const suggestedExercises = selectExercisesForFocus(
        exercises,
        muscleGroups,
        5
      );

      // Calculate estimated duration (3-4 min per set including rest)
      const totalSets = suggestedExercises.reduce((sum, e) => sum + e.sets, 0);
      const estimatedDuration = Math.round(totalSets * 3.5);

      return {
        focus,
        description,
        reason,
        estimatedDuration,
        exercises: suggestedExercises,
        muscleGroups,
        type: 'strength',
      };
    },
    enabled: !!userId && exercises.length > 0,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Quick workout options for different goals
export interface QuickWorkoutOption {
  id: string;
  label: string;
  description: string;
  icon: string;
  duration: number;
  muscleGroups: string[];
}

export function useQuickWorkoutOptions(): QuickWorkoutOption[] {
  return [
    {
      id: 'upper',
      label: 'Upper Body',
      description: 'Chest, back, shoulders',
      icon: 'body-outline',
      duration: 45,
      muscleGroups: ['Chest', 'Back', 'Shoulders'],
    },
    {
      id: 'lower',
      label: 'Lower Body',
      description: 'Legs and glutes',
      icon: 'fitness-outline',
      duration: 45,
      muscleGroups: ['Quadriceps', 'Hamstrings', 'Glutes'],
    },
    {
      id: 'push',
      label: 'Push Day',
      description: 'Chest, shoulders, triceps',
      icon: 'trending-up-outline',
      duration: 40,
      muscleGroups: ['Chest', 'Shoulders', 'Triceps'],
    },
    {
      id: 'pull',
      label: 'Pull Day',
      description: 'Back and biceps',
      icon: 'arrow-down-outline',
      duration: 40,
      muscleGroups: ['Back', 'Biceps'],
    },
    {
      id: 'full',
      label: 'Full Body',
      description: 'Balanced workout',
      icon: 'barbell-outline',
      duration: 60,
      muscleGroups: ['Chest', 'Back', 'Quadriceps', 'Core'],
    },
  ];
}
