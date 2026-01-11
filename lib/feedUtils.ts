/**
 * Feed Utilities
 *
 * Helpers for processing workout data for social feed display.
 * Shows ALL exercises with progression - making strength training "sexy" like Strava runs.
 */

import { detectProgression, type ProgressionType } from './progression';
import type { WorkoutSet, Exercise } from '@/types/database';

export interface ExerciseSummary {
  exerciseId: string;
  exerciseName: string;
  modality: 'Strength' | 'Cardio' | 'Hybrid';
  primaryMetric: 'Weight' | 'Watts' | 'Pace' | 'Distance';
  bestSet: {
    weight: number | null;
    reps: number | null;
    watts: number | null;
    distance: number | null;
    duration: number | null;
  };
  totalSets: number;
  totalVolume: number;
  isPR: boolean;
  progression: ProgressionType | null;
  previousBest: {
    weight: number | null;
    reps: number | null;
  } | null;
}

interface SetWithExercise extends WorkoutSet {
  exercise?: Exercise | null;
  previous_set?: WorkoutSet | null;
}

/**
 * Group workout sets by exercise and calculate summary for each
 */
export function summarizeWorkoutExercises(
  sets: SetWithExercise[]
): ExerciseSummary[] {
  if (!sets || sets.length === 0) return [];

  // Filter out warmup sets for display
  const workingSets = sets.filter(s => !s.is_warmup);

  // Group by exercise
  const exerciseMap = new Map<string, SetWithExercise[]>();

  for (const set of workingSets) {
    if (!set.exercise_id) continue;

    const existing = exerciseMap.get(set.exercise_id) || [];
    existing.push(set);
    exerciseMap.set(set.exercise_id, existing);
  }

  // Convert to summaries
  const summaries: ExerciseSummary[] = [];

  for (const [exerciseId, exerciseSets] of exerciseMap) {
    const firstSet = exerciseSets[0];
    const exercise = firstSet.exercise;

    if (!exercise) continue;

    // Find best set (highest weight for strength, or first set for cardio)
    let bestSet = exerciseSets[0];
    let isPR = false;
    let progression: ProgressionType | null = null;

    // For strength: find set with highest weight * reps
    if (exercise.modality === 'Strength' || exercise.primary_metric === 'Weight') {
      bestSet = exerciseSets.reduce((best, current) => {
        const bestScore = (best.actual_weight || 0) * (best.actual_reps || 0);
        const currentScore = (current.actual_weight || 0) * (current.actual_reps || 0);
        return currentScore > bestScore ? current : best;
      }, exerciseSets[0]);
    }

    // Check if any set was a PR
    isPR = exerciseSets.some(s => s.is_pr);

    // Calculate progression from previous workout
    // Use the first set's previous_set data if available
    const setWithPrevious = exerciseSets.find(s => s.previous_set);
    if (setWithPrevious && setWithPrevious.previous_set) {
      progression = detectProgression(
        {
          actual_weight: bestSet.actual_weight,
          actual_reps: bestSet.actual_reps,
          actual_rpe: bestSet.actual_rpe,
          is_warmup: false,
        },
        {
          actual_weight: setWithPrevious.previous_set.actual_weight,
          actual_reps: setWithPrevious.previous_set.actual_reps,
          actual_rpe: setWithPrevious.previous_set.actual_rpe,
          is_warmup: false,
        }
      );
    }

    // Calculate total volume
    const totalVolume = exerciseSets.reduce((sum, s) => {
      return sum + ((s.actual_weight || 0) * (s.actual_reps || 0));
    }, 0);

    summaries.push({
      exerciseId,
      exerciseName: exercise.name,
      modality: exercise.modality,
      primaryMetric: exercise.primary_metric,
      bestSet: {
        weight: bestSet.actual_weight,
        reps: bestSet.actual_reps,
        watts: bestSet.avg_watts || null,
        distance: bestSet.distance_meters ? bestSet.distance_meters / 1609.34 : null, // meters to miles
        duration: bestSet.duration_seconds ? bestSet.duration_seconds / 60 : null, // seconds to minutes
      },
      totalSets: exerciseSets.length,
      totalVolume,
      isPR,
      progression,
      previousBest: setWithPrevious?.previous_set ? {
        weight: setWithPrevious.previous_set.actual_weight,
        reps: setWithPrevious.previous_set.actual_reps,
      } : null,
    });
  }

  // Sort: PRs first, then by volume
  return summaries.sort((a, b) => {
    if (a.isPR && !b.isPR) return -1;
    if (!a.isPR && b.isPR) return 1;
    return b.totalVolume - a.totalVolume;
  });
}

/**
 * Format exercise for feed display
 */
export function formatExerciseForFeed(summary: ExerciseSummary): string {
  const { modality, primaryMetric, bestSet, totalSets } = summary;

  if (modality === 'Cardio' || primaryMetric === 'Watts') {
    if (bestSet.watts) {
      return `${bestSet.watts}W`;
    }
    if (bestSet.distance && bestSet.duration) {
      // Calculate pace (min/mile or min/km)
      const pace = bestSet.duration / bestSet.distance;
      return `${bestSet.distance} mi @ ${formatPace(pace)}`;
    }
    if (bestSet.duration) {
      return `${Math.round(bestSet.duration)} min`;
    }
  }

  // Strength format: weight × reps (× sets if multiple)
  const weight = bestSet.weight || 0;
  const reps = bestSet.reps || 0;

  if (totalSets > 1) {
    return `${weight} × ${reps} × ${totalSets}`;
  }
  return `${weight} × ${reps}`;
}

/**
 * Format pace as mm:ss
 */
function formatPace(minutesPerMile: number): string {
  const mins = Math.floor(minutesPerMile);
  const secs = Math.round((minutesPerMile - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, '0')}/mi`;
}

/**
 * Get progression badge info
 */
export function getProgressionBadge(summary: ExerciseSummary): {
  text: string;
  color: string;
  bgColor: string;
} | null {
  if (summary.isPR) {
    return {
      text: 'PR',
      color: '#2F80ED',
      bgColor: 'rgba(47, 128, 237, 0.2)',
    };
  }

  if (!summary.progression) return null;

  switch (summary.progression.type) {
    case 'weight_increase':
    case 'rep_increase':
    case 'volume_increase':
    case 'e1rm_increase':
      return {
        text: summary.progression.message,
        color: '#27AE60',
        bgColor: 'rgba(39, 174, 96, 0.2)',
      };
    case 'rpe_decrease':
      return {
        text: summary.progression.message,
        color: '#9B59B6',
        bgColor: 'rgba(155, 89, 182, 0.2)',
      };
    case 'matched':
      return {
        text: 'Matched',
        color: '#808fb0',
        bgColor: 'rgba(128, 143, 176, 0.2)',
      };
    case 'regressed':
      return {
        text: summary.progression.message,
        color: '#EB5757',
        bgColor: 'rgba(235, 87, 87, 0.2)',
      };
    default:
      return null;
  }
}

/**
 * Get modality icon name
 */
export function getModalityIcon(modality: 'Strength' | 'Cardio' | 'Hybrid'): string {
  switch (modality) {
    case 'Strength':
      return 'barbell-outline';
    case 'Cardio':
      return 'bicycle-outline';
    case 'Hybrid':
      return 'fitness-outline';
    default:
      return 'barbell-outline';
  }
}
