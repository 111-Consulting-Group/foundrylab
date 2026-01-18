/**
 * Readiness-Aware Workout Hook
 *
 * Combines daily workout suggestions with readiness data to produce
 * adjusted workouts. This is the core of the Guided Journey experience.
 *
 * When readiness is low, the workout is modified:
 * - Intensity reduced (lower target weights)
 * - Volume reduced (fewer sets)
 * - RPE targets lowered
 * - Rest recommendation shown when very low
 */

import { useQuery } from '@tanstack/react-query';

import { useTodaysReadiness, analyzeReadiness, getAdjustmentMultipliers } from './useReadiness';
import { useDailyWorkoutSuggestion, type DailyWorkoutSuggestion, type SuggestedExercise } from './useDailyWorkout';
import { useAppStore } from '@/stores/useAppStore';
import type { ReadinessAdjustment, ReadinessAnalysis } from '@/types/database';

// ============================================================================
// Types
// ============================================================================

export interface ReadinessAwareWorkout extends DailyWorkoutSuggestion {
  // Readiness context
  readinessScore: number | null;
  readinessAdjustment: ReadinessAdjustment | null;
  readinessMessage: string | null;

  // Adjusted exercises
  adjustedExercises: AdjustedExercise[];

  // Should user rest instead?
  suggestRest: boolean;
  restReason?: string;

  // Overall adjustment summary
  adjustmentSummary: string | null;
}

export interface AdjustedExercise extends SuggestedExercise {
  // Original values (before adjustment)
  originalSets: number;
  originalTargetReps: number;
  originalTargetRPE: number;

  // Was this exercise adjusted?
  wasAdjusted: boolean;

  // Adjustment note to show user
  adjustmentNote?: string;
}

// ============================================================================
// Adjustment Logic
// ============================================================================

function adjustWorkoutForReadiness(
  workout: DailyWorkoutSuggestion,
  analysis: ReadinessAnalysis
): {
  adjustedExercises: AdjustedExercise[];
  adjustmentSummary: string;
  suggestRest: boolean;
  restReason?: string;
} {
  const { suggestion, score, recommendations } = analysis;
  const multipliers = getAdjustmentMultipliers(suggestion);

  // Check if we should suggest rest
  if (suggestion === 'rest') {
    return {
      adjustedExercises: workout.exercises.map((ex) => ({
        ...ex,
        originalSets: ex.sets,
        originalTargetReps: ex.targetReps,
        originalTargetRPE: ex.targetRPE,
        wasAdjusted: false,
      })),
      adjustmentSummary: 'Rest recommended',
      suggestRest: true,
      restReason: 'Based on your readiness, today would be better for recovery. Consider light mobility or a walk instead.',
    };
  }

  // Apply adjustments to exercises
  const adjustedExercises: AdjustedExercise[] = workout.exercises.map((ex) => {
    const originalSets = ex.sets;
    const originalRPE = ex.targetRPE;

    // Adjust sets based on volume multiplier
    const adjustedSets = Math.max(1, Math.round(originalSets * multipliers.volumeMultiplier));

    // Adjust RPE based on adjustment
    const adjustedRPE = Math.max(5, Math.round((originalRPE + multipliers.rpeAdjustment) * 10) / 10);

    const wasAdjusted = adjustedSets !== originalSets || adjustedRPE !== originalRPE;

    // Generate adjustment note
    let adjustmentNote: string | undefined;
    if (wasAdjusted) {
      const changes: string[] = [];
      if (adjustedSets < originalSets) {
        changes.push(`${originalSets - adjustedSets} fewer sets`);
      }
      if (adjustedRPE < originalRPE) {
        changes.push(`RPE lowered to ${adjustedRPE}`);
      }
      if (changes.length > 0) {
        adjustmentNote = changes.join(', ');
      }
    }

    return {
      ...ex,
      sets: adjustedSets,
      targetRPE: adjustedRPE,
      originalSets,
      originalTargetReps: ex.targetReps,
      originalTargetRPE: originalRPE,
      wasAdjusted,
      adjustmentNote,
    };
  });

  // Generate adjustment summary
  let adjustmentSummary: string;
  if (suggestion === 'full') {
    adjustmentSummary = 'Full intensity - you\'re ready to push it!';
  } else if (suggestion === 'moderate') {
    adjustmentSummary = 'Slightly reduced intensity based on your readiness';
  } else {
    adjustmentSummary = 'Lighter session recommended - focus on movement quality';
  }

  return {
    adjustedExercises,
    adjustmentSummary,
    suggestRest: false,
  };
}

// ============================================================================
// Main Hook
// ============================================================================

export function useReadinessAwareWorkout() {
  const userId = useAppStore((state) => state.userId);
  const { data: readiness, isLoading: readinessLoading } = useTodaysReadiness();
  const { data: suggestion, isLoading: suggestionLoading } = useDailyWorkoutSuggestion();

  return useQuery({
    queryKey: ['readiness-aware-workout', userId, readiness?.id, suggestion?.focus],
    queryFn: async (): Promise<ReadinessAwareWorkout | null> => {
      if (!userId || !suggestion) return null;

      // If no readiness check-in, return workout without adjustments
      if (!readiness) {
        return {
          ...suggestion,
          readinessScore: null,
          readinessAdjustment: null,
          readinessMessage: null,
          adjustedExercises: suggestion.exercises.map((ex) => ({
            ...ex,
            originalSets: ex.sets,
            originalTargetReps: ex.targetReps,
            originalTargetRPE: ex.targetRPE,
            wasAdjusted: false,
          })),
          suggestRest: false,
          adjustmentSummary: null,
        };
      }

      // Analyze readiness
      const analysis = analyzeReadiness(
        readiness.sleep_quality as 1 | 2 | 3 | 4 | 5,
        readiness.muscle_soreness as 1 | 2 | 3 | 4 | 5,
        readiness.stress_level as 1 | 2 | 3 | 4 | 5
      );

      // Apply adjustments
      const { adjustedExercises, adjustmentSummary, suggestRest, restReason } =
        adjustWorkoutForReadiness(suggestion, analysis);

      // Calculate adjusted duration
      const totalSets = adjustedExercises.reduce((sum, e) => sum + e.sets, 0);
      const adjustedDuration = Math.round(totalSets * 3.5);

      return {
        ...suggestion,
        estimatedDuration: adjustedDuration,
        readinessScore: analysis.score,
        readinessAdjustment: analysis.suggestion,
        readinessMessage: analysis.message,
        adjustedExercises,
        suggestRest,
        restReason,
        adjustmentSummary,
      };
    },
    enabled: !!userId && !suggestionLoading,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ============================================================================
// Alternative Workout Options Based on Readiness
// ============================================================================

export interface ReadinessAlternative {
  id: string;
  label: string;
  description: string;
  icon: string;
  suitable: boolean;
  duration: number;
}

export function useReadinessAlternatives(): ReadinessAlternative[] {
  const { data: readiness } = useTodaysReadiness();

  if (!readiness) {
    // No readiness data - all options suitable
    return [
      { id: 'strength', label: 'Strength', description: 'Full intensity workout', icon: 'barbell-outline', suitable: true, duration: 60 },
      { id: 'cardio', label: 'Cardio', description: 'Conditioning focus', icon: 'pulse-outline', suitable: true, duration: 30 },
      { id: 'mobility', label: 'Mobility', description: 'Movement and flexibility', icon: 'body-outline', suitable: true, duration: 20 },
      { id: 'rest', label: 'Rest Day', description: 'Complete recovery', icon: 'bed-outline', suitable: true, duration: 0 },
    ];
  }

  const analysis = analyzeReadiness(
    readiness.sleep_quality as 1 | 2 | 3 | 4 | 5,
    readiness.muscle_soreness as 1 | 2 | 3 | 4 | 5,
    readiness.stress_level as 1 | 2 | 3 | 4 | 5
  );

  const score = analysis.score;

  return [
    {
      id: 'strength',
      label: 'Strength',
      description: score >= 60 ? 'Full intensity workout' : 'Reduced intensity',
      icon: 'barbell-outline',
      suitable: score >= 40,
      duration: 60,
    },
    {
      id: 'cardio',
      label: 'Cardio',
      description: score >= 50 ? 'Conditioning focus' : 'Light cardio',
      icon: 'pulse-outline',
      suitable: score >= 30,
      duration: score >= 50 ? 30 : 20,
    },
    {
      id: 'mobility',
      label: 'Mobility',
      description: 'Movement and flexibility',
      icon: 'body-outline',
      suitable: true, // Always suitable
      duration: 20,
    },
    {
      id: 'rest',
      label: 'Rest Day',
      description: score < 40 ? 'Recommended today' : 'Complete recovery',
      icon: 'bed-outline',
      suitable: true,
      duration: 0,
    },
  ];
}

// ============================================================================
// Quick Check: Should User Do Readiness First?
// ============================================================================

/**
 * Returns true if user should be prompted to check in before workout
 */
export function useShouldPromptReadiness(): { shouldPrompt: boolean; reason: string } {
  const { data: readiness, isLoading } = useTodaysReadiness();

  if (isLoading) {
    return { shouldPrompt: false, reason: 'Loading...' };
  }

  if (!readiness) {
    return {
      shouldPrompt: true,
      reason: 'Quick check-in helps us tailor your workout',
    };
  }

  // Already checked in today
  return { shouldPrompt: false, reason: 'Already checked in' };
}
