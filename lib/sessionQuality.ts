/**
 * Session Quality Evaluation
 * 
 * Determines if a workout session was productive, maintaining, suboptimal, junk, or recovery
 */

import type { WorkoutWithSets } from '@/types/database';

export type SessionQuality =
  | 'productive'      // Multiple progressions
  | 'maintaining'     // All matches, in maintenance phase
  | 'suboptimal'      // Regressions without deload context
  | 'junk'            // Random exercises, no progression
  | 'recovery';       // Intentional deload

/**
 * Evaluate session quality based on workout data
 */
export function evaluateSession(workout: WorkoutWithSets): SessionQuality {
  // Check if workout is part of a structured block
  const isStructured = !!workout.block_id || !!workout.week_number || !!workout.day_number;

  // If deloading, it's recovery
  if (workout.context === 'deloading') {
    return 'recovery';
  }

  // Count PRs (progressions)
  const prCount = workout.workout_sets?.filter((set) => set.is_pr && !set.is_warmup).length || 0;
  const totalSets = workout.workout_sets?.filter((set) => !set.is_warmup && set.actual_weight && set.actual_reps).length || 0;

  // If no sets, can't evaluate
  if (totalSets === 0) {
    return isStructured ? 'maintaining' : 'junk'; // If structured but no sets, treat as baseline
  }

  // If structured but no context yet, we're establishing baseline
  // This happens early in a block before we have enough data
  if (isStructured && !workout.context) {
    return 'maintaining'; // Use 'maintaining' as a neutral state for baseline establishment
  }

  // If unstructured, it's junk
  if (workout.context === 'unstructured' && !isStructured) {
    return 'junk';
  }

  // Multiple progressions = productive
  if (prCount >= 2) {
    return 'productive';
  }

  // Some progressions but not many = maintaining
  if (prCount === 1) {
    return 'maintaining';
  }

  // No progressions
  // If maintaining phase, that's expected
  if (workout.context === 'maintaining') {
    return 'maintaining';
  }

  // Building phase with no progressions = suboptimal
  if (workout.context === 'building') {
    return 'suboptimal';
  }

  // Default to maintaining (for structured blocks establishing baseline)
  return 'maintaining';
}

/**
 * Get session quality display info
 */
export function getSessionQualityInfo(quality: SessionQuality): {
  label: string;
  color: string;
  description: string;
} {
  switch (quality) {
    case 'productive':
      return {
        label: 'PRODUCTIVE',
        color: '#22c55e', // progress-500
        description: 'Multiple progressions achieved',
      };
    case 'maintaining':
      return {
        label: 'MAINTAINING',
        color: '#F2994A', // oxide-500
        description: 'Stimulus matched',
      };
    case 'suboptimal':
      return {
        label: 'SUBOPTIMAL',
        color: '#ef4444', // regression-500
        description: 'No progressions in building phase',
      };
    case 'junk':
      return {
        label: 'UNSTRUCTURED',
        color: '#808fb0', // graphite-500
        description: 'Does not contribute to progression',
      };
    case 'recovery':
      return {
        label: 'RECOVERY',
        color: '#2F80ED', // signal-500
        description: 'Deload session',
      };
  }
}
