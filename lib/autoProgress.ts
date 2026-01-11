/**
 * Auto-Progression Suggestions
 * 
 * Suggests the next load/rep target based on previous performance,
 * block phase, and recovery status.
 */

import type { Exercise } from '@/types/database';

export interface SetData {
  actual_weight: number | null;
  actual_reps: number | null;
  actual_rpe: number | null;
}

export interface ProgressionSuggestion {
  targetWeight?: number;
  targetReps?: number;
  targetRPE?: number;
  message: string;
  progressionType: 'weight' | 'reps' | 'volume' | 'maintain' | 'deload';
}

/**
 * Suggest progression for an exercise based on history and context
 */
export function suggestProgression(
  exercise: Exercise,
  history: SetData[],
  blockPhase?: string | null,
  recoveryStatus?: 'good' | 'moderate' | 'poor'
): ProgressionSuggestion | null {
  if (history.length === 0) {
    // No history - can't suggest progression
    return null;
  }

  // Get the most recent set (non-warmup)
  const lastSet = history.find((s) => s.actual_weight && s.actual_reps && !s.is_warmup);
  if (!lastSet || !lastSet.actual_weight || !lastSet.actual_reps) {
    return null;
  }

  const lastWeight = lastSet.actual_weight;
  const lastReps = lastSet.actual_reps;
  const lastRPE = lastSet.actual_rpe || 8;

  // Handle poor recovery - suggest maintain or deload
  if (recoveryStatus === 'poor') {
    return {
      targetWeight: lastWeight * 0.9, // 10% reduction
      targetReps: lastReps,
      targetRPE: lastRPE,
      message: 'Hold or reduce (poor recovery)',
      progressionType: 'deload',
    };
  }

  // Handle deloading phase
  if (blockPhase === 'deload') {
    return {
      targetWeight: lastWeight * 0.8, // 20% reduction
      targetReps: lastReps,
      targetRPE: lastRPE - 1,
      message: 'Deload: -20% volume',
      progressionType: 'deload',
    };
  }

  // Handle maintaining phase
  if (blockPhase === 'maintaining') {
    return {
      targetWeight: lastWeight,
      targetReps: lastReps,
      targetRPE: lastRPE,
      message: 'Maintain previous load',
      progressionType: 'maintain',
    };
  }

  // Default: Building phase - suggest progression
  // Strategy: prefer rep progression for hypertrophy, weight progression for strength
  
  // If last RPE was low (< 7), suggest rep increase at same weight
  if (lastRPE < 7 && lastReps < 15) {
    return {
      targetWeight: lastWeight,
      targetReps: lastReps + 1,
      targetRPE: lastRPE + 0.5,
      message: `+1 rep (${lastWeight} lb)`,
      progressionType: 'reps',
    };
  }

  // If last RPE was moderate (7-8.5), suggest weight increase
  if (lastRPE >= 7 && lastRPE <= 8.5) {
    // Increase weight by 5 lb (or 2.5% if > 200 lb)
    const increment = lastWeight > 200 ? Math.round(lastWeight * 0.025) : 5;
    return {
      targetWeight: lastWeight + increment,
      targetReps: lastReps,
      targetRPE: lastRPE + 0.5,
      message: `+${increment} lb`,
      progressionType: 'weight',
    };
  }

  // If last RPE was high (>= 9), maintain for now
  if (lastRPE >= 9) {
    return {
      targetWeight: lastWeight,
      targetReps: lastReps,
      targetRPE: lastRPE,
      message: 'Maintain (high RPE last session)',
      progressionType: 'maintain',
    };
  }

  // Default: small weight increase
  const increment = lastWeight > 200 ? Math.round(lastWeight * 0.025) : 5;
  return {
    targetWeight: lastWeight + increment,
    targetReps: lastReps,
    targetRPE: lastRPE,
    message: `+${increment} lb`,
    progressionType: 'weight',
  };
}

/**
 * Format progression suggestion for display
 */
export function formatProgressionSuggestion(suggestion: ProgressionSuggestion | null): string {
  if (!suggestion) return 'No previous data';
  return suggestion.message;
}
