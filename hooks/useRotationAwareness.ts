/**
 * Rotation Awareness Hooks
 *
 * Provides intelligence about where the user is in their training rotation
 * and surfaces the appropriate historical session to continue from.
 */

import { useQuery } from '@tanstack/react-query';
import { differenceInDays, parseISO } from 'date-fns';

import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/useAppStore';
import { useDetectedPatterns } from '@/hooks/usePatternDetection';
import { useTodaysReadiness, analyzeReadiness, getAdjustmentMultipliers } from '@/hooks/useReadiness';
import type { WorkoutWithSets, ReadinessAdjustment } from '@/types/database';

// ============================================================================
// Types
// ============================================================================

export interface RotationSuggestion {
  nextFocus: string;
  reason: string;
  daysSinceLast: number | null;
  lastSession: LastSessionSummary | null;
  confidence: 'high' | 'medium' | 'low';
  splitName: string | null;
  rotationPosition: number; // e.g., 2 of 3 for PPL
  rotationTotal: number;
  // Readiness context
  readiness: {
    score: number | null;
    adjustment: ReadinessAdjustment | null;
    message: string | null;
    hasCheckedIn: boolean;
  };
}

export interface LastSessionSummary {
  id: string;
  date: string;
  focus: string;
  exercises: ExerciseSummary[];
  totalVolume: number;
  totalSets: number;
  durationMinutes: number | null;
}

export interface ExerciseSummary {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string;
  sets: number;
  lastWeight: number | null;
  lastReps: number | null;
  lastRPE: number | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Normalize focus strings for matching
 */
function normalizeFocus(focus: string): string {
  return focus
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*/g, '') // Remove parentheticals like "(A)"
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if a workout focus matches a split type
 */
function focusMatchesSplit(focus: string, split: string): boolean {
  const normalizedFocus = normalizeFocus(focus);
  const normalizedSplit = split.toLowerCase();

  // Direct match
  if (normalizedFocus.includes(normalizedSplit)) return true;

  // Common aliases
  const aliases: Record<string, string[]> = {
    push: ['chest', 'shoulder', 'tricep', 'pressing'],
    pull: ['back', 'bicep', 'pulling', 'row'],
    legs: ['leg', 'lower', 'squat', 'quad', 'hamstring', 'glute'],
    upper: ['upper', 'chest', 'back', 'shoulder', 'arm'],
    lower: ['lower', 'leg', 'squat', 'glute'],
  };

  const splitAliases = aliases[normalizedSplit] || [];
  return splitAliases.some((alias) => normalizedFocus.includes(alias));
}

/**
 * Extract exercise summary from workout sets
 */
function extractExerciseSummaries(workoutSets: any[]): ExerciseSummary[] {
  const exerciseMap = new Map<string, ExerciseSummary>();

  workoutSets?.forEach((set: any) => {
    if (!set.exercise || set.is_warmup) return;

    const exerciseId = set.exercise_id;
    const existing = exerciseMap.get(exerciseId);

    if (!existing) {
      exerciseMap.set(exerciseId, {
        exerciseId,
        exerciseName: set.exercise.name,
        muscleGroup: set.exercise.muscle_group || 'Other',
        sets: 1,
        lastWeight: set.actual_weight,
        lastReps: set.actual_reps,
        lastRPE: set.actual_rpe,
      });
    } else {
      existing.sets += 1;
      // Keep the heaviest set's data
      if (set.actual_weight && (!existing.lastWeight || set.actual_weight > existing.lastWeight)) {
        existing.lastWeight = set.actual_weight;
        existing.lastReps = set.actual_reps;
        existing.lastRPE = set.actual_rpe;
      }
    }
  });

  return Array.from(exerciseMap.values()).sort((a, b) => b.sets - a.sets);
}

// ============================================================================
// Main Hooks
// ============================================================================

/**
 * Get the last workout session for a specific focus type
 */
export function useLastSessionByFocus(focus: string | null) {
  const userId = useAppStore((state) => state.userId);

  return useQuery({
    queryKey: ['lastSessionByFocus', userId, focus],
    queryFn: async (): Promise<LastSessionSummary | null> => {
      if (!userId || !focus) return null;

      // Fetch recent completed workouts
      const { data: workouts, error } = await supabase
        .from('workouts')
        .select(`
          id,
          focus,
          date_completed,
          duration_minutes,
          workout_sets(
            id,
            exercise_id,
            actual_weight,
            actual_reps,
            actual_rpe,
            is_warmup,
            exercise:exercises(id, name, muscle_group)
          )
        `)
        .eq('user_id', userId)
        .not('date_completed', 'is', null)
        .order('date_completed', { ascending: false })
        .limit(30);

      if (error) throw error;
      if (!workouts || workouts.length === 0) return null;

      // Find the most recent workout matching this focus
      const matchingWorkout = workouts.find((w: any) =>
        focusMatchesSplit(w.focus || '', focus)
      );

      if (!matchingWorkout) return null;

      const exercises = extractExerciseSummaries(matchingWorkout.workout_sets);
      const totalVolume = matchingWorkout.workout_sets?.reduce((sum: number, set: any) => {
        if (set.is_warmup || !set.actual_weight || !set.actual_reps) return sum;
        return sum + set.actual_weight * set.actual_reps;
      }, 0) || 0;

      const totalSets = matchingWorkout.workout_sets?.filter(
        (s: any) => !s.is_warmup && (s.actual_weight || s.actual_reps)
      ).length || 0;

      return {
        id: matchingWorkout.id,
        date: matchingWorkout.date_completed!,
        focus: matchingWorkout.focus || focus,
        exercises,
        totalVolume,
        totalSets,
        durationMinutes: matchingWorkout.duration_minutes,
      };
    },
    enabled: !!userId && !!focus,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Determine the next workout in the user's rotation
 */
export function useNextInRotation() {
  const userId = useAppStore((state) => state.userId);
  const { data: patterns } = useDetectedPatterns();

  return useQuery({
    queryKey: ['nextInRotation', userId, patterns?.length],
    queryFn: async (): Promise<RotationSuggestion | null> => {
      if (!userId) return null;

      // Find training split pattern
      const splitPattern = patterns?.find((p) => p.type === 'training_split');

      if (!splitPattern || splitPattern.confidence < 0.5) {
        // No detected pattern - return null
        return null;
      }

      const splits = (splitPattern.data.splits as string[]) || [];
      if (splits.length === 0) return null;

      // Fetch recent workouts to determine rotation position
      const { data: recentWorkouts, error } = await supabase
        .from('workouts')
        .select('id, focus, date_completed')
        .eq('user_id', userId)
        .not('date_completed', 'is', null)
        .order('date_completed', { ascending: false })
        .limit(10);

      if (error) throw error;

      // Determine last workout for each split type
      const lastByType = new Map<string, { date: string; daysSince: number }>();

      recentWorkouts?.forEach((w: any) => {
        for (const split of splits) {
          if (focusMatchesSplit(w.focus || '', split) && !lastByType.has(split)) {
            const daysSince = differenceInDays(new Date(), parseISO(w.date_completed));
            lastByType.set(split, { date: w.date_completed, daysSince });
            break;
          }
        }
      });

      // Determine next in rotation
      // Priority: longest time since last trained (that's recovered)
      let nextFocus: string | null = null;
      let maxDays = -1;
      let reason = '';

      for (const split of splits) {
        const lastData = lastByType.get(split);

        if (!lastData) {
          // Never done this split - suggest it
          nextFocus = split;
          maxDays = 999;
          reason = `You haven't logged a ${split} session yet`;
          break;
        }

        // Only suggest if at least 2 days since last (48hr recovery)
        if (lastData.daysSince >= 2 && lastData.daysSince > maxDays) {
          maxDays = lastData.daysSince;
          nextFocus = split;
          reason = `Last ${split} was ${lastData.daysSince} days ago`;
        }
      }

      // If nothing found (all trained recently), suggest the one trained longest ago
      if (!nextFocus) {
        let oldestDays = -1;
        for (const split of splits) {
          const lastData = lastByType.get(split);
          if (lastData && lastData.daysSince > oldestDays) {
            oldestDays = lastData.daysSince;
            nextFocus = split;
            reason = `${split} was your least recent session (${lastData.daysSince} day${lastData.daysSince !== 1 ? 's' : ''} ago)`;
          }
        }
      }

      if (!nextFocus) {
        nextFocus = splits[0];
        reason = 'Starting fresh with your rotation';
      }

      // Determine rotation position
      const rotationPosition = splits.indexOf(nextFocus) + 1;

      // Calculate confidence based on pattern confidence and data freshness
      let confidence: 'high' | 'medium' | 'low' = 'low';
      if (splitPattern.confidence >= 0.8 && lastByType.size >= splits.length - 1) {
        confidence = 'high';
      } else if (splitPattern.confidence >= 0.6) {
        confidence = 'medium';
      }

      return {
        nextFocus,
        reason,
        daysSinceLast: lastByType.get(nextFocus)?.daysSince ?? null,
        lastSession: null, // Will be populated by useLastSessionByFocus
        confidence,
        splitName: splitPattern.name,
        rotationPosition,
        rotationTotal: splits.length,
        // Readiness placeholder - will be populated by useRotationWithSession
        readiness: {
          score: null,
          adjustment: null,
          message: null,
          hasCheckedIn: false,
        },
      };
    },
    enabled: !!userId && !!patterns,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Combined hook that provides full rotation context with last session data and readiness
 */
export function useRotationWithSession() {
  const { data: rotation, isLoading: rotationLoading } = useNextInRotation();
  const { data: lastSession, isLoading: sessionLoading } = useLastSessionByFocus(
    rotation?.nextFocus ?? null
  );
  const { data: todaysReadiness, isLoading: readinessLoading } = useTodaysReadiness();

  const isLoading = rotationLoading || sessionLoading;

  if (!rotation) {
    return { data: null, isLoading };
  }

  // Calculate readiness context
  let readinessContext = rotation.readiness;
  if (todaysReadiness) {
    const analysis = analyzeReadiness(
      todaysReadiness.sleep_quality as 1 | 2 | 3 | 4 | 5,
      todaysReadiness.muscle_soreness as 1 | 2 | 3 | 4 | 5,
      todaysReadiness.stress_level as 1 | 2 | 3 | 4 | 5
    );
    readinessContext = {
      score: analysis.score,
      adjustment: analysis.suggestion,
      message: analysis.message,
      hasCheckedIn: true,
    };
  }

  // Modify reason based on readiness if checked in
  let adjustedReason = rotation.reason;
  if (readinessContext.hasCheckedIn && readinessContext.adjustment) {
    if (readinessContext.adjustment === 'rest') {
      adjustedReason = `${rotation.reason}. Consider rest or light activity based on your readiness.`;
    } else if (readinessContext.adjustment === 'light') {
      adjustedReason = `${rotation.reason}. Go lighter today based on your readiness check-in.`;
    }
  }

  return {
    data: {
      ...rotation,
      lastSession,
      reason: adjustedReason,
      readiness: readinessContext,
    },
    isLoading,
  };
}
