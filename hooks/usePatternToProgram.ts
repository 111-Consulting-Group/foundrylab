/**
 * Pattern to Program Hook
 *
 * Watches user workout history, detects their routine, and offers to
 * formalize it into a structured training block. This is the "learn and build"
 * approach - we don't ask them to upload their program, we LEARN it.
 *
 * Philosophy: "We've been watching. Here's what you do. Want us to structure it?"
 */

import { useQuery } from '@tanstack/react-query';
import { differenceInDays, parseISO } from 'date-fns';

import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/useAppStore';
import { useDetectedPatterns } from './usePatternDetection';
import type { Exercise } from '@/types/database';

// ============================================================================
// Types
// ============================================================================

export interface InferredWorkoutDay {
  dayNumber: number;
  focus: string;
  muscleGroups: string[];
  exercises: InferredExercise[];
  typicalDuration: number;
}

export interface InferredExercise {
  exercise: Exercise;
  frequency: number; // How often this exercise appears in this focus
  typicalSets: number;
  typicalReps: string; // e.g., "8-12"
  typicalWeight: number | null;
  lastPerformed: string | null;
}

export interface InferredProgram {
  // Split information
  splitName: string;
  splitType: 'ppl' | 'upper_lower' | 'full_body' | 'bro_split' | 'custom';
  daysPerWeek: number;
  rotationLength: number; // e.g., 3 for PPL, 2 for Upper/Lower

  // Workout structure
  workoutDays: InferredWorkoutDay[];

  // Confidence
  confidence: number;
  workoutsAnalyzed: number;
  weeksOfData: number;

  // User-friendly description
  summary: string;
  highlights: string[];
}

export interface PatternToProgramResult {
  // Is there enough data to suggest a program?
  isReady: boolean;
  readyReason: string;

  // The inferred program (if ready)
  inferredProgram: InferredProgram | null;

  // Progress toward readiness
  workoutsLogged: number;
  workoutsNeeded: number;
  daysTracking: number;

  // Has user dismissed or accepted?
  hasBeenOffered: boolean;
  wasAccepted: boolean | null;
}

// ============================================================================
// Configuration
// ============================================================================

const MIN_WORKOUTS_FOR_INFERENCE = 6; // At least 2 weeks of 3x/week
const MIN_DAYS_TRACKING = 10; // At least 10 days of history
const MIN_CONFIDENCE_TO_OFFER = 0.6;

// ============================================================================
// Exercise Analysis
// ============================================================================

interface WorkoutWithExercises {
  id: string;
  focus: string;
  normalized_focus: string | null;
  date_completed: string;
  duration_minutes: number | null;
  workout_sets: Array<{
    exercise_id: string;
    actual_reps: number | null;
    actual_weight: number | null;
    target_reps: number | null;
    exercise: Exercise;
  }>;
}

function analyzeExercisesForFocus(
  workouts: WorkoutWithExercises[],
  targetFocus: string
): InferredExercise[] {
  // Filter workouts matching this focus using normalized values
  const normalizedTarget = normalizeFocus(targetFocus);
  const matchingWorkouts = workouts.filter((w) =>
    getEffectiveFocus(w) === normalizedTarget
  );

  if (matchingWorkouts.length === 0) return [];

  // Count exercise occurrences and gather stats
  const exerciseStats = new Map<
    string,
    {
      exercise: Exercise;
      occurrences: number;
      sets: number[];
      reps: number[];
      weights: number[];
      lastDate: string;
    }
  >();

  for (const workout of matchingWorkouts) {
    const exercisesInWorkout = new Set<string>();

    for (const set of workout.workout_sets) {
      if (!set.exercise) continue;
      const exId = set.exercise_id;

      if (!exerciseStats.has(exId)) {
        exerciseStats.set(exId, {
          exercise: set.exercise,
          occurrences: 0,
          sets: [],
          reps: [],
          weights: [],
          lastDate: workout.date_completed,
        });
      }

      const stats = exerciseStats.get(exId)!;

      // Count occurrences (once per workout)
      if (!exercisesInWorkout.has(exId)) {
        stats.occurrences++;
        exercisesInWorkout.add(exId);
      }

      // Track reps and weights
      if (set.actual_reps) stats.reps.push(set.actual_reps);
      if (set.actual_weight) stats.weights.push(set.actual_weight);

      // Update last date
      if (workout.date_completed > stats.lastDate) {
        stats.lastDate = workout.date_completed;
      }
    }

    // Count sets per exercise in this workout
    const setsPerExercise = new Map<string, number>();
    for (const set of workout.workout_sets) {
      if (!set.exercise) continue;
      setsPerExercise.set(
        set.exercise_id,
        (setsPerExercise.get(set.exercise_id) || 0) + 1
      );
    }
    for (const [exId, setCount] of setsPerExercise) {
      exerciseStats.get(exId)?.sets.push(setCount);
    }
  }

  // Convert to InferredExercise array, sorted by frequency
  const totalWorkouts = matchingWorkouts.length;

  return Array.from(exerciseStats.values())
    .map((stats) => {
      const avgSets = stats.sets.length > 0
        ? Math.round(stats.sets.reduce((a, b) => a + b, 0) / stats.sets.length)
        : 3;

      const minReps = stats.reps.length > 0 ? Math.min(...stats.reps) : 8;
      const maxReps = stats.reps.length > 0 ? Math.max(...stats.reps) : 12;
      const repRange = minReps === maxReps ? `${minReps}` : `${minReps}-${maxReps}`;

      const avgWeight = stats.weights.length > 0
        ? Math.round(stats.weights.reduce((a, b) => a + b, 0) / stats.weights.length)
        : null;

      return {
        exercise: stats.exercise,
        frequency: stats.occurrences / totalWorkouts,
        typicalSets: avgSets,
        typicalReps: repRange,
        typicalWeight: avgWeight,
        lastPerformed: stats.lastDate,
      };
    })
    .filter((e) => e.frequency >= 0.3) // Must appear in at least 30% of workouts
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 8); // Top 8 exercises per focus
}

/**
 * Client-side focus normalization matching the database function.
 * Used as fallback when normalized_focus isn't populated.
 */
function normalizeFocus(focus: string): string {
  const lower = focus.toLowerCase().trim();

  // Push day variants
  if (/push|chest|bench|press day|pressing/.test(lower)) return 'push';

  // Pull day variants
  if (/pull|back|row|deadlift day|pulling/.test(lower)) return 'pull';

  // Legs day variants
  if (/legs?|squat|lower|quad|ham|glute/.test(lower)) return 'legs';

  // Upper body
  if (/upper|upper body/.test(lower)) return 'upper';

  // Lower body
  if (/lower body/.test(lower)) return 'lower';

  // Full body
  if (/full|total|whole/.test(lower)) return 'full_body';

  // Arms
  if (/arms?|bicep|tricep|curl/.test(lower)) return 'arms';

  // Shoulders
  if (/shoulder|delt|ohp/.test(lower)) return 'shoulders';

  // Core/Abs
  if (/core|abs?|abdominal/.test(lower)) return 'core';

  // Conditioning/Cardio
  if (/cardio|conditioning|metcon|wod|hiit|circuit|echo|bike|run|row/.test(lower)) return 'conditioning';

  return lower;
}

/**
 * Get the effective normalized focus for a workout.
 * Uses database field if available, falls back to client-side normalization.
 */
function getEffectiveFocus(workout: WorkoutWithExercises): string {
  return workout.normalized_focus || normalizeFocus(workout.focus);
}

// ============================================================================
// Program Inference
// ============================================================================

async function inferProgram(
  userId: string,
  patterns: Array<{ type: string; name: string; confidence: number; data: Record<string, unknown> }>
): Promise<InferredProgram | null> {
  // Get training split pattern
  const splitPattern = patterns.find((p) => p.type === 'training_split');
  if (!splitPattern || splitPattern.confidence < MIN_CONFIDENCE_TO_OFFER) {
    return null;
  }

  // Fetch workout history with exercises
  const { data: workouts, error } = await supabase
    .from('workouts')
    .select(`
      id,
      focus,
      normalized_focus,
      date_completed,
      duration_minutes,
      workout_sets(
        exercise_id,
        actual_reps,
        actual_weight,
        target_reps,
        exercise:exercises(*)
      )
    `)
    .eq('user_id', userId)
    .not('date_completed', 'is', null)
    .order('date_completed', { ascending: false })
    .limit(40);

  if (error || !workouts || workouts.length < MIN_WORKOUTS_FOR_INFERENCE) {
    return null;
  }

  // Get the splits from pattern data
  const splits = (splitPattern.data.splits as string[]) || [];
  const daysPerWeek = (splitPattern.data.days_per_week as number) || splits.length;

  // Determine split type
  let splitType: InferredProgram['splitType'] = 'custom';
  const splitName = splitPattern.name.toLowerCase();
  if (splitName.includes('push') && splitName.includes('pull')) splitType = 'ppl';
  else if (splitName.includes('upper') && splitName.includes('lower')) splitType = 'upper_lower';
  else if (splitName.includes('full')) splitType = 'full_body';
  else if (splitName.includes('body part') || splitName.includes('bro')) splitType = 'bro_split';

  // Build workout days
  const workoutDays: InferredWorkoutDay[] = [];

  for (let i = 0; i < splits.length; i++) {
    const focus = splits[i];
    const exercises = analyzeExercisesForFocus(workouts as WorkoutWithExercises[], focus);

    // Get typical duration for this focus using normalized values
    const normalizedFocus = normalizeFocus(focus);
    const matchingWorkouts = (workouts as WorkoutWithExercises[]).filter((w) =>
      getEffectiveFocus(w) === normalizedFocus
    );
    const workoutsWithDuration = matchingWorkouts.filter((w) => w.duration_minutes != null);
    const avgDuration = workoutsWithDuration.length > 0
      ? Math.round(
          workoutsWithDuration.reduce((sum, w) => sum + (w.duration_minutes || 0), 0) /
          workoutsWithDuration.length
        )
      : 60;

    // Extract muscle groups from exercises
    const muscleGroups = [...new Set(exercises.map((e) => e.exercise.muscle_group))];

    workoutDays.push({
      dayNumber: i + 1,
      focus,
      muscleGroups,
      exercises,
      typicalDuration: avgDuration,
    });
  }

  // Calculate weeks of data
  const oldestWorkout = workouts[workouts.length - 1];
  const newestWorkout = workouts[0];
  const weeksOfData = oldestWorkout && newestWorkout
    ? Math.ceil(
        differenceInDays(
          parseISO(newestWorkout.date_completed!),
          parseISO(oldestWorkout.date_completed!)
        ) / 7
      )
    : 0;

  // Generate summary and highlights
  const totalExercises = workoutDays.reduce((sum, d) => sum + d.exercises.length, 0);
  const avgExercisesPerDay = Math.round(totalExercises / workoutDays.length);

  const highlights: string[] = [];

  // Find most frequent exercises
  const allExercises = workoutDays.flatMap((d) => d.exercises);
  const topExercises = allExercises
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 3);

  if (topExercises.length > 0) {
    highlights.push(
      `Your staples: ${topExercises.map((e) => e.exercise.name).join(', ')}`
    );
  }

  // Note any consistent patterns
  const avgSets = allExercises.length > 0
    ? Math.round(allExercises.reduce((sum, e) => sum + e.typicalSets, 0) / allExercises.length)
    : 3;
  highlights.push(`Typically ${avgSets} sets per exercise`);

  if (daysPerWeek) {
    highlights.push(`Training ${daysPerWeek}x per week`);
  }

  return {
    splitName: splitPattern.name,
    splitType,
    daysPerWeek,
    rotationLength: splits.length,
    workoutDays,
    confidence: splitPattern.confidence,
    workoutsAnalyzed: workouts.length,
    weeksOfData,
    summary: `You're running a ${splitPattern.name} split with ${avgExercisesPerDay} exercises per session.`,
    highlights,
  };
}

// ============================================================================
// Main Hook
// ============================================================================

export function usePatternToProgram() {
  const userId = useAppStore((state) => state.userId);
  const { data: patterns, isLoading: patternsLoading } = useDetectedPatterns();

  return useQuery({
    queryKey: ['pattern-to-program', userId],
    queryFn: async (): Promise<PatternToProgramResult> => {
      if (!userId) {
        return {
          isReady: false,
          readyReason: 'Not logged in',
          inferredProgram: null,
          workoutsLogged: 0,
          workoutsNeeded: MIN_WORKOUTS_FOR_INFERENCE,
          daysTracking: 0,
          hasBeenOffered: false,
          wasAccepted: null,
        };
      }

      // Get workout count and date range
      const { data: workoutStats, error: statsError } = await supabase
        .from('workouts')
        .select('id, date_completed')
        .eq('user_id', userId)
        .not('date_completed', 'is', null)
        .order('date_completed', { ascending: true });

      if (statsError) throw statsError;

      const workoutsLogged = workoutStats?.length || 0;
      const daysTracking = workoutStats && workoutStats.length >= 2
        ? differenceInDays(
            parseISO(workoutStats[workoutStats.length - 1].date_completed!),
            parseISO(workoutStats[0].date_completed!)
          )
        : 0;

      // Check if we have enough data
      if (workoutsLogged < MIN_WORKOUTS_FOR_INFERENCE) {
        return {
          isReady: false,
          readyReason: `Need ${MIN_WORKOUTS_FOR_INFERENCE - workoutsLogged} more workouts to learn your routine`,
          inferredProgram: null,
          workoutsLogged,
          workoutsNeeded: MIN_WORKOUTS_FOR_INFERENCE,
          daysTracking,
          hasBeenOffered: false,
          wasAccepted: null,
        };
      }

      if (daysTracking < MIN_DAYS_TRACKING) {
        return {
          isReady: false,
          readyReason: `Need ${MIN_DAYS_TRACKING - daysTracking} more days to see your pattern`,
          inferredProgram: null,
          workoutsLogged,
          workoutsNeeded: MIN_WORKOUTS_FOR_INFERENCE,
          daysTracking,
          hasBeenOffered: false,
          wasAccepted: null,
        };
      }

      // Check if already offered/accepted
      const { data: offerStatus } = await supabase
        .from('detected_patterns')
        .select('offered_structure, structure_accepted')
        .eq('user_id', userId)
        .eq('pattern_type', 'training_split')
        .maybeSingle();

      const hasBeenOffered = offerStatus?.offered_structure || false;
      const wasAccepted = offerStatus?.structure_accepted || null;

      // If already accepted, don't show again
      if (wasAccepted === true) {
        return {
          isReady: false,
          readyReason: 'Program already created',
          inferredProgram: null,
          workoutsLogged,
          workoutsNeeded: MIN_WORKOUTS_FOR_INFERENCE,
          daysTracking,
          hasBeenOffered: true,
          wasAccepted: true,
        };
      }

      // Try to infer program
      if (!patterns || patterns.length === 0) {
        return {
          isReady: false,
          readyReason: 'Still learning your patterns',
          inferredProgram: null,
          workoutsLogged,
          workoutsNeeded: MIN_WORKOUTS_FOR_INFERENCE,
          daysTracking,
          hasBeenOffered,
          wasAccepted,
        };
      }

      const inferredProgram = await inferProgram(userId, patterns);

      if (!inferredProgram) {
        return {
          isReady: false,
          readyReason: 'Your routine is still emerging',
          inferredProgram: null,
          workoutsLogged,
          workoutsNeeded: MIN_WORKOUTS_FOR_INFERENCE,
          daysTracking,
          hasBeenOffered,
          wasAccepted,
        };
      }

      return {
        isReady: true,
        readyReason: 'Ready to structure your routine',
        inferredProgram,
        workoutsLogged,
        workoutsNeeded: MIN_WORKOUTS_FOR_INFERENCE,
        daysTracking,
        hasBeenOffered,
        wasAccepted,
      };
    },
    enabled: !!userId && !patternsLoading,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// ============================================================================
// Action Hooks
// ============================================================================

export function useMarkProgramOffered() {
  const userId = useAppStore((state) => state.userId);

  return async () => {
    if (!userId) return;

    await supabase
      .from('detected_patterns')
      .update({
        offered_structure: true,
        offered_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('pattern_type', 'training_split');
  };
}

export function useAcceptInferredProgram() {
  const userId = useAppStore((state) => state.userId);

  return async (accepted: boolean) => {
    if (!userId) return;

    await supabase
      .from('detected_patterns')
      .update({
        structure_accepted: accepted,
        accepted_at: accepted ? new Date().toISOString() : null,
      })
      .eq('user_id', userId)
      .eq('pattern_type', 'training_split');
  };
}
