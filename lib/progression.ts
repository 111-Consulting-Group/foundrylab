/**
 * Progression Detection Engine
 * 
 * Determines if a set represents progression, maintenance, or regression
 * based on comparison with previous performance.
 */

import { calculateSetVolume } from '@/lib/utils';
import type { WorkoutSet } from '@/types/database';

export interface SetData {
  actual_weight: number | null;
  actual_reps: number | null;
  actual_rpe: number | null;
  is_warmup: boolean;
}

export type ProgressionType =
  | { type: 'weight_increase'; delta: number; message: string }
  | { type: 'rep_increase'; delta: number; message: string }
  | { type: 'set_increase'; delta: number; message: string }
  | { type: 'rpe_decrease'; delta: number; message: string }
  | { type: 'volume_increase'; delta: number; message: string }
  | { type: 'e1rm_increase'; delta: number; message: string }
  | { type: 'matched'; message: string }
  | { type: 'regressed'; reason: string; message: string };

/**
 * Calculate estimated 1RM using Epley formula: weight * (1 + reps / 30)
 * This matches the calculation used in the rest of the codebase (types/database.ts)
 */
export function calculateE1RM(weight: number, reps: number): number {
  if (reps === 1) return weight;
  if (reps <= 0 || weight <= 0) return 0;
  return Math.round(weight * (1 + reps / 30));
}

/**
 * Calculate total volume for a set (weight * reps)
 * @deprecated Use calculateSetVolume from @/lib/utils instead
 */
function calculateVolume(weight: number | null, reps: number | null): number {
  return calculateSetVolume(weight, reps);
}

/**
 * Detect progression type by comparing current set with previous set
 */
export function detectProgression(
  current: SetData,
  previous: SetData | null
): ProgressionType | null {
  // Can't determine progression without previous data
  if (!previous) return null;
  
  // Skip warmup sets
  if (current.is_warmup || previous.is_warmup) return null;
  
  // Need actual data for comparison
  if (!current.actual_weight || !current.actual_reps) return null;
  if (!previous.actual_weight || !previous.actual_reps) return null;

  const currentWeight = current.actual_weight;
  const currentReps = current.actual_reps;
  const currentRPE = current.actual_rpe || 10;
  
  const prevWeight = previous.actual_weight;
  const prevReps = previous.actual_reps;
  const prevRPE = previous.actual_rpe || 10;

  // Weight increase (same reps or more)
  if (currentWeight > prevWeight && currentReps >= prevReps) {
    const delta = currentWeight - prevWeight;
    return {
      type: 'weight_increase',
      delta,
      message: `+${delta} lb`,
    };
  }

  // Rep increase (same weight or more)
  if (currentReps > prevReps && currentWeight >= prevWeight) {
    const delta = currentReps - prevReps;
    return {
      type: 'rep_increase',
      delta,
      message: `+${delta} rep${delta > 1 ? 's' : ''}`,
    };
  }

  // Volume increase (total weight * reps increased)
  const currentVolume = calculateVolume(currentWeight, currentReps);
  const prevVolume = calculateVolume(prevWeight, prevReps);
  if (currentVolume > prevVolume) {
    const delta = currentVolume - prevVolume;
    const percentIncrease = ((delta / prevVolume) * 100).toFixed(0);
    return {
      type: 'volume_increase',
      delta,
      message: `+${percentIncrease}% volume`,
    };
  }

  // E1RM increase (estimated 1RM improved)
  const currentE1RM = calculateE1RM(currentWeight, currentReps);
  const prevE1RM = calculateE1RM(prevWeight, prevReps);
  if (currentE1RM > prevE1RM * 1.01) { // 1% threshold to avoid noise
    const delta = currentE1RM - prevE1RM;
    return {
      type: 'e1rm_increase',
      delta,
      message: `+${Math.round(delta)} lb E1RM`,
    };
  }

  // RPE decrease (same load, lower effort)
  if (
    currentWeight === prevWeight &&
    currentReps === prevReps &&
    currentRPE < prevRPE
  ) {
    const delta = prevRPE - currentRPE;
    return {
      type: 'rpe_decrease',
      delta,
      message: `RPE ${prevRPE} → ${currentRPE}`,
    };
  }

  // Matched (same weight, reps, similar RPE)
  if (
    currentWeight === prevWeight &&
    currentReps === prevReps &&
    Math.abs((currentRPE || 10) - (prevRPE || 10)) <= 0.5
  ) {
    return {
      type: 'matched',
      message: 'Stimulus matched, not progressed',
    };
  }

  // Regressed (any decrease in measurable metrics)
  if (currentWeight < prevWeight || currentReps < prevReps) {
    const weightDelta = prevWeight - currentWeight;
    const repDelta = prevReps - currentReps;
    const reasons: string[] = [];
    
    if (weightDelta > 0) reasons.push(`${weightDelta.toFixed(0)} lb`);
    if (repDelta > 0) reasons.push(`${repDelta} rep${repDelta > 1 ? 's' : ''}`);
    
    return {
      type: 'regressed',
      reason: reasons.join(', '),
      message: `Regressed: -${reasons.join(', ')}`,
    };
  }

  // Default to matched if no clear progression/regression
  return {
    type: 'matched',
    message: 'Stimulus matched, not progressed',
  };
}

/**
 * Get user-friendly progression message
 */
export function getProgressionMessage(progression: ProgressionType | null): string {
  if (!progression) return '';
  return progression.message;
}

/**
 * Get progression type string for database storage
 */
export function getProgressionTypeString(progression: ProgressionType | null): string | null {
  if (!progression) return null;
  
  switch (progression.type) {
    case 'weight_increase':
      return `+${progression.delta}lb`;
    case 'rep_increase':
      return `+${progression.delta}rep`;
    case 'volume_increase':
      return `+${progression.delta.toFixed(0)}vol`;
    case 'e1rm_increase':
      return `+${progression.delta.toFixed(0)}e1rm`;
    case 'rpe_decrease':
      return `-${progression.delta}rpe`;
    case 'matched':
      return 'matched';
    case 'regressed':
      return 'regressed';
  }
}

/**
 * Compare multiple previous sets to find best match for comparison
 * Returns the most recent comparable set (same set order preferred)
 */
export function findBestPreviousSet(
  current: SetData & { set_order: number },
  previousSets: (SetData & { set_order: number })[]
): SetData | null {
  if (previousSets.length === 0) return null;

  // Filter out warmup sets
  const nonWarmupSets = previousSets.filter(s => !s.is_warmup);
  if (nonWarmupSets.length === 0) return null;

  // Prefer same set order
  const sameOrderSet = nonWarmupSets.find(s => s.set_order === current.set_order);
  if (sameOrderSet) return sameOrderSet;

  // Fall back to most recent non-warmup set
  return nonWarmupSets[0];
}
