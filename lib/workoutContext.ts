/**
 * Workout Context Detection
 * 
 * Determines the context of a workout (building, maintaining, deloading, testing, unstructured)
 */

import type { Workout, WorkoutWithSets } from '@/types/database';
import type { WorkoutContext } from '@/types/database';

/**
 * Detect workout context based on block association and workout characteristics
 */
export function detectWorkoutContext(workout: Workout | WorkoutWithSets): WorkoutContext {
  // If no block_id, it's unstructured
  if (!workout.block_id) {
    return 'unstructured';
  }

  // If workout has explicit context already set, use it
  if (workout.context && workout.context !== 'unstructured') {
    return workout.context;
  }

  // For workouts with blocks, default to 'building' unless we have more context
  // This is a simplified detection - more sophisticated logic can be added later
  // based on volume/intensity trends, block phase, etc.
  return 'building';
}

/**
 * Get context display information
 */
export function getContextInfo(context: WorkoutContext): {
  label: string;
  color: string;
  bgColor: string;
  description: string;
} {
  switch (context) {
    case 'building':
      return {
        label: 'Building',
        color: '#22c55e', // progress-500 (green)
        bgColor: '#22c55e20',
        description: 'Progressive overload phase',
      };
    case 'maintaining':
      return {
        label: 'Maintaining',
        color: '#F2994A', // oxide-500 (yellow/orange)
        bgColor: '#F2994A20',
        description: 'Maintenance phase',
      };
    case 'deloading':
      return {
        label: 'Deloading',
        color: '#2F80ED', // signal-500 (blue)
        bgColor: '#2F80ED20',
        description: 'Recovery phase',
      };
    case 'testing':
      return {
        label: 'Testing',
        color: '#A855F7', // purple-500
        bgColor: '#A855F720',
        description: 'Testing week - PR attempts',
      };
    case 'unstructured':
      return {
        label: 'Unstructured',
        color: '#808fb0', // graphite-500 (gray)
        bgColor: '#808fb020',
        description: 'Does not contribute to tracked progression',
      };
    default:
      return {
        label: 'Unknown',
        color: '#808fb0',
        bgColor: '#808fb020',
        description: '',
      };
  }
}
