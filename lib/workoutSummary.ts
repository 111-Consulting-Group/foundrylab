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
  // If already has suffix or is a descriptive pace (like "5K pace"), return as-is
  if (pace.includes('/') || pace.toLowerCase().includes('pace') || pace.toLowerCase().includes('k')) {
    return pace;
  }
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
  // If segment_type is not set, assume it's a work set (for backwards compatibility)
  const warmupSets = loggedSets.filter(s => s.segment_type === 'warmup' || s.is_warmup);
  const workSets = loggedSets.filter(s => {
    // Include sets that are explicitly work sets, or sets without segment_type (assume work)
    return (s.segment_type === 'work' || !s.segment_type) && !s.is_warmup;
  });
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
      // Check if all sets have the same pace string (like "5K pace")
      const paces = workSets.map(s => s.avg_pace).filter(Boolean);
      const allSamePace = paces.length > 0 && paces.every(p => p === paces[0]);
      
      let paceStr = '';
      if (allSamePace && paces[0]) {
        // Use the pace string directly (e.g., "5K pace")
        paceStr = ` @ ${formatPace(paces[0])}`;
      } else {
        // Calculate average pace from time-based pace
        const avgPace = calculateAveragePace(workSets);
        paceStr = avgPace ? ` @ ${avgPace}` : '';
      }
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
  // Also ensure sets have actual data (not just null values)
  const uniqueSets = workingSets.filter((set, index, self) => {
    // First check if this set has actual data
    const hasData = set.actual_weight !== null && set.actual_reps !== null;
    if (!hasData) return false;
    
    // Then deduplicate
    if (set.id) {
      // Deduplicate by ID
      return index === self.findIndex((s) => s.id === set.id && s.actual_weight !== null && s.actual_reps !== null);
    } else {
      // For temp sets without ID, deduplicate by set_order
      return index === self.findIndex((s) => 
        s.set_order === set.set_order && 
        s.exercise_id === set.exercise_id &&
        s.actual_weight !== null && 
        s.actual_reps !== null
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
    // CRITICAL: Filter out warmup sets completely - they have different distances and shouldn't affect target
    // Warmup sets typically have longer distances (like 1mi) vs work intervals (like 400m)
    const workSets = sets.filter(s => {
      // Explicitly exclude warmup by both flags
      if (s.is_warmup === true) return false;
      if (s.segment_type === 'warmup') return false;
      // Also exclude sets with very long distances that are likely warmup (1mi = 1609m)
      // Work intervals are typically shorter (200m, 400m, 800m)
      if (s.distance_meters && s.distance_meters > 1000) {
        // If it's a long distance and marked as warmup or has warmup in notes, exclude
        const notes = (s.notes || '').toLowerCase();
        if (notes.includes('warm') || notes.includes('warmup')) {
          return false;
        }
        // Otherwise, if it's clearly a warmup distance pattern, exclude
        // But be conservative - only exclude if we're sure
      }
      // Include work sets or sets without segment_type (assume work if not explicitly warmup)
      return s.segment_type === 'work' || !s.segment_type;
    });
    
    if (workSets.length === 0) {
      // If no work sets, we can't determine target
      return '';
    }
    
    // Check for distance-based prescription
    // Use distance from work sets only (warmup has different distance like 1mi vs 400m)
    const workDistances = workSets.map(s => s.distance_meters).filter(Boolean);
    
    if (workDistances.length > 0) {
      // Find the most common distance among work sets (this is the target interval distance)
      // Work intervals should all have the same distance (e.g., all 400m)
      const uniqueDistances = [...new Set(workDistances)];
      let targetDistance = workDistances[0];
      
      if (uniqueDistances.length === 1) {
        // All work sets have same distance - that's the target
        targetDistance = uniqueDistances[0];
      } else {
        // Multiple distances - find most common (likely the target interval distance)
        // Also prefer shorter distances (work intervals) over longer ones (warmup)
        const counts = new Map<number, number>();
        workDistances.forEach(d => counts.set(d, (counts.get(d) || 0) + 1));
        let maxCount = 0;
        let candidateDistance = workDistances[0];
        for (const [dist, count] of counts) {
          if (count > maxCount) {
            maxCount = count;
            candidateDistance = dist;
          } else if (count === maxCount && dist < candidateDistance) {
            // If tie, prefer shorter distance (work intervals are shorter than warmup)
            candidateDistance = dist;
          }
        }
        targetDistance = candidateDistance;
      }
      
      const dist = formatDistance(targetDistance);
      
      // Get target pace from notes - look for "5K pace" or similar in work sets
      const paceNotes = workSets.map(s => s.notes).filter(Boolean);
      const paceFromNotes = paceNotes.find(n => {
        const note = (n || '').toLowerCase();
        return note.includes('5k pace') || note.includes('~5k pace') || note.includes('@ 5k pace');
      });
      
      // Extract pace string from notes
      let targetPace: string | null = null;
      if (paceFromNotes) {
        const paceMatch = paceFromNotes.match(/(~?5k\s*pace)/i);
        if (paceMatch) {
          targetPace = paceMatch[1];
        }
      }
      
      const paceStr = targetPace ? ` @ ${formatPace(targetPace)}` : '';
      
      // Target set count is the number of planned work sets (not warmup)
      // This represents what was planned in the workout (e.g., 6x400m)
      const targetSetCount = workSets.length;
      
      return `${targetSetCount} x ${dist}${paceStr}`;
    }
    
    // Duration-based
    const durations = workSets.map(s => s.duration_seconds).filter(Boolean);
    if (durations.length > 0 && durations[0]) {
      const mins = Math.round(durations[0] / 60);
      return `${workSets.length} x ${mins}min`;
    }
    
    return `${workSets.length} interval${workSets.length > 1 ? 's' : ''}`;
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
