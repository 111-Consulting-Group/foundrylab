// Utility functions for generating one-line workout summaries
// Used by ExerciseCard to show completion status

import type { WorkoutSet, Exercise, SegmentType } from '@/types/database';

export interface SetWithExercise extends WorkoutSet {
  exercise?: Exercise;
}

// Distance presets in meters for display conversion
const DISTANCE_PRESETS = {
  200: '200m',
  400: '400m',
  800: '800m',
  1609: '1mi',
  1600: '1mi', // Close enough
  5000: '5K',
  10000: '10K',
};

/**
 * Format distance in meters to a readable string
 */
export function formatDistance(meters: number): string {
  // Check for preset distances (with 5% tolerance)
  for (const [preset, label] of Object.entries(DISTANCE_PRESETS)) {
    const presetMeters = parseInt(preset);
    if (Math.abs(meters - presetMeters) / presetMeters < 0.05) {
      return label;
    }
  }
  
  // For other distances
  if (meters >= 1000) {
    const km = meters / 1000;
    return `${km.toFixed(1)}km`;
  }
  return `${meters}m`;
}

/**
 * Format pace string for display (ensure it has /mi or /km suffix)
 */
export function formatPace(pace: string | null | undefined): string {
  if (!pace) return '';
  // If already has suffix, return as-is
  if (pace.includes('/')) return pace;
  // Otherwise assume /mi
  return `${pace}/mi`;
}

/**
 * Calculate average pace from a list of sets
 */
export function calculateAveragePace(sets: SetWithExercise[]): string | null {
  const paceSets = sets.filter(s => s.avg_pace);
  if (paceSets.length === 0) return null;
  
  // Parse pace strings (format: "8:45" or "8:45/mi")
  const paceSeconds: number[] = [];
  for (const set of paceSets) {
    const paceStr = set.avg_pace?.replace(/\/.*$/, '') || '';
    const match = paceStr.match(/^(\d+):(\d+)$/);
    if (match) {
      const mins = parseInt(match[1]);
      const secs = parseInt(match[2]);
      paceSeconds.push(mins * 60 + secs);
    }
  }
  
  if (paceSeconds.length === 0) return null;
  
  const avgSeconds = Math.round(paceSeconds.reduce((a, b) => a + b, 0) / paceSeconds.length);
  const mins = Math.floor(avgSeconds / 60);
  const secs = avgSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Generate a one-line summary for cardio sets
 * Examples:
 * - "1mi @ 9:15 + 4x400m @ 8:45 avg"
 * - "30min Zone 2 @ 145 bpm"
 * - "5x800m @ 7:30 avg"
 */
export function generateCardioSummary(sets: SetWithExercise[]): string {
  if (sets.length === 0) return 'No sets logged';
  
  // Only count sets that have actual data logged
  const loggedSets = sets.filter(s => 
    s.distance_meters || s.duration_seconds || s.avg_pace
  );
  
  if (loggedSets.length === 0) return 'No sets logged';
  
  // Group logged sets by segment type
  const warmupSets = loggedSets.filter(s => s.segment_type === 'warmup' || s.is_warmup);
  const workSets = loggedSets.filter(s => s.segment_type === 'work' && !s.is_warmup);
  const recoverySets = loggedSets.filter(s => s.segment_type === 'recovery');
  const cooldownSets = loggedSets.filter(s => s.segment_type === 'cooldown');
  
  const parts: string[] = [];
  
  // Warm-up summary
  if (warmupSets.length > 0) {
    const warmup = warmupSets[0];
    if (warmup.distance_meters) {
      const dist = formatDistance(warmup.distance_meters);
      const pace = warmup.avg_pace ? ` @ ${formatPace(warmup.avg_pace)}` : '';
      parts.push(`${dist}${pace} warm-up`);
    } else if (warmup.duration_seconds) {
      const mins = Math.round(warmup.duration_seconds / 60);
      parts.push(`${mins}min warm-up`);
    }
  }
  
  // Work intervals summary
  if (workSets.length > 0) {
    // Check if all work sets are the same distance
    const distances = workSets.map(s => s.distance_meters).filter(Boolean);
    const allSameDistance = distances.length > 0 && 
      distances.every(d => d === distances[0]);
    
    if (allSameDistance && distances[0]) {
      const dist = formatDistance(distances[0]);
      const avgPace = calculateAveragePace(workSets);
      const paceStr = avgPace ? ` @ ${avgPace}` : '';
      parts.push(`${workSets.length}x${dist}${paceStr}`);
    } else if (workSets.length === 1 && workSets[0].distance_meters) {
      const set = workSets[0];
      const dist = formatDistance(set.distance_meters!);
      const pace = set.avg_pace ? ` @ ${formatPace(set.avg_pace)}` : '';
      parts.push(`${dist}${pace}`);
    } else {
      // Mixed distances - just show count and average pace
      const avgPace = calculateAveragePace(workSets);
      const paceStr = avgPace ? ` @ ${avgPace} avg` : '';
      parts.push(`${workSets.length} intervals${paceStr}`);
    }
  }
  
  // If no segments, try duration-based summary
  if (parts.length === 0) {
    const totalDuration = loggedSets.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);
    if (totalDuration > 0) {
      const mins = Math.round(totalDuration / 60);
      const avgHR = loggedSets.find(s => s.avg_hr)?.avg_hr;
      const hrStr = avgHR ? ` @ ${avgHR} bpm` : '';
      return `${mins}min${hrStr}`;
    }
    return `${loggedSets.length} set${loggedSets.length > 1 ? 's' : ''} logged`;
  }
  
  return parts.join(' + ');
}

/**
 * Generate a one-line summary for strength sets
 * Examples:
 * - "4x6 @ 185 lbs (top: 195)"
 * - "3x10 @ 135 lbs"
 * - "5x5 @ 225 lbs PR!"
 */
export function generateStrengthSummary(sets: SetWithExercise[]): string {
  if (sets.length === 0) return 'No sets logged';
  
  // Filter out warmup sets and only count sets with actual data
  const workingSets = sets.filter(s => 
    !s.is_warmup && 
    s.segment_type !== 'warmup' &&
    s.actual_weight !== null && 
    s.actual_reps !== null
  );
  
  if (workingSets.length === 0) {
    // Check if there are any warmup sets
    const warmupSets = sets.filter(s => s.is_warmup || s.segment_type === 'warmup');
    if (warmupSets.length > 0) {
      return `${warmupSets.length} warm-up set${warmupSets.length > 1 ? 's' : ''}`;
    }
    return 'No sets logged';
  }
  
  // Deduplicate sets by ID, or by set_order if no ID (for temp sets)
  const uniqueSets = workingSets.filter((set, index, self) => {
    if (set.id) {
      // Deduplicate by ID
      return index === self.findIndex((s) => s.id === set.id);
    } else {
      // For temp sets without ID, deduplicate by set_order
      return index === self.findIndex((s) => 
        s.set_order === set.set_order && 
        s.exercise_id === set.exercise_id
      );
    }
  });
  
  // Get weights and reps from unique sets
  const weights = uniqueSets.map(s => s.actual_weight).filter((w): w is number => w !== null && w > 0);
  const reps = uniqueSets.map(s => s.actual_reps).filter((r): r is number => r !== null && r > 0);
  
  if (weights.length === 0 || reps.length === 0) {
    return `${uniqueSets.length} set${uniqueSets.length > 1 ? 's' : ''} logged`;
  }
  
  const topWeight = Math.max(...weights);
  const mostCommonWeight = getMostCommon(weights);
  const mostCommonReps = getMostCommon(reps);
  const hasPR = uniqueSets.some(s => s.is_pr);
  
  // Check if all sets are similar
  const allSameWeight = weights.every(w => w === mostCommonWeight);
  const allSameReps = reps.every(r => r === mostCommonReps);
  
  let summary = '';
  
  if (allSameWeight && allSameReps) {
    // Uniform sets: "4x6 @ 185 lbs"
    summary = `${uniqueSets.length}x${mostCommonReps} @ ${mostCommonWeight} lbs`;
  } else if (allSameReps) {
    // Same reps, different weights: "4x6 @ 185 lbs (top: 195)"
    summary = `${uniqueSets.length}x${mostCommonReps} @ ${mostCommonWeight} lbs`;
    if (topWeight > mostCommonWeight) {
      summary += ` (top: ${topWeight})`;
    }
  } else {
    // Variable sets: show range
    const minWeight = Math.min(...weights);
    const minReps = Math.min(...reps);
    const maxReps = Math.max(...reps);
    
    if (minWeight === topWeight) {
      summary = `${uniqueSets.length}x${minReps}-${maxReps} @ ${topWeight} lbs`;
    } else {
      summary = `${uniqueSets.length} sets @ ${minWeight}-${topWeight} lbs`;
    }
  }
  
  // Add PR indicator
  if (hasPR) {
    summary += ' PR!';
  }
  
  return summary;
}

/**
 * Get the most common value in an array
 */
function getMostCommon<T>(arr: T[]): T {
  const counts = new Map<T, number>();
  for (const val of arr) {
    counts.set(val, (counts.get(val) || 0) + 1);
  }
  let maxCount = 0;
  let mostCommon = arr[0];
  for (const [val, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      mostCommon = val;
    }
  }
  return mostCommon;
}

/**
 * Generate a summary based on exercise modality
 */
export function generateExerciseSummary(exercise: Exercise, sets: SetWithExercise[]): string {
  if (exercise.modality === 'Cardio') {
    return generateCardioSummary(sets);
  }
  return generateStrengthSummary(sets);
}

/**
 * Format the prescription for an exercise (what's planned)
 * Examples:
 * - "4 x 6 @ RPE 8"
 * - "4 x 400m @ 5K pace"
 * - "30min Zone 2"
 */
export function formatPrescription(
  sets: SetWithExercise[], 
  exercise?: Exercise,
  targetReps?: number,
  targetRPE?: number,
  targetLoad?: number
): string {
  if (sets.length === 0) return '';
  
  const isCardio = exercise?.modality === 'Cardio';
  
  if (isCardio) {
    // Check for distance-based prescription
    const distances = sets.map(s => s.distance_meters).filter(Boolean);
    if (distances.length > 0 && distances[0]) {
      const dist = formatDistance(distances[0]);
      return `${sets.length} x ${dist}`;
    }
    
    // Duration-based
    const durations = sets.map(s => s.duration_seconds).filter(Boolean);
    if (durations.length > 0 && durations[0]) {
      const mins = Math.round(durations[0] / 60);
      return `${mins}min`;
    }
    
    return `${sets.length} interval${sets.length > 1 ? 's' : ''}`;
  }
  
  // Strength prescription - use passed values first, then fall back to sets
  const reps = targetReps ?? sets[0]?.target_reps;
  const rpe = targetRPE ?? sets[0]?.target_rpe;
  const load = targetLoad ?? sets[0]?.target_load;
  
  // Use targetSets if available, otherwise use sets.length
  const setCount = sets.length;
  
  // Build prescription parts
  const parts: string[] = [];
  
  // Set count and reps
  if (reps) {
    parts.push(`${setCount} x ${reps}`);
  } else {
    parts.push(`${setCount} x ?`);
  }
  
  // Add load or RPE
  if (load) {
    parts.push(`@ ${load} lbs`);
  } else if (rpe) {
    parts.push(`@ RPE ${rpe}`);
  }
  
  return parts.join(' ');
}

/**
 * Calculate completion percentage for an exercise
 */
export function calculateCompletionPercent(
  sets: SetWithExercise[], 
  isCardio: boolean, 
  targetSets?: number
): number {
  if (sets.length === 0) return 0;
  
  const completedSets = sets.filter(s => {
    if (isCardio) {
      return s.distance_meters || s.duration_seconds || s.avg_pace;
    }
    return s.actual_weight !== null && s.actual_reps !== null;
  });
  
  // Use targetSets if provided, otherwise use total sets length
  const denominator = targetSets || sets.length;
  if (denominator === 0) return 0;
  
  return Math.round((completedSets.length / denominator) * 100);
}

/**
 * Get completion status for display
 */
export type CompletionStatus = 'pending' | 'in_progress' | 'completed';

export function getCompletionStatus(
  sets: SetWithExercise[], 
  isCardio: boolean,
  targetSets?: number
): CompletionStatus {
  const percent = calculateCompletionPercent(sets, isCardio, targetSets);
  if (percent === 0) return 'pending';
  if (percent === 100) return 'completed';
  return 'in_progress';
}
