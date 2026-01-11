/**
 * Workout Adjustment Engine
 *
 * Takes readiness data, user context, and workout plans to suggest
 * intelligent modifications that keep training productive but safe.
 */

import type {
  ReadinessAdjustment,
  ReadinessAnalysis,
  WorkoutWithSets,
  WorkoutSet,
  TrainingProfile,
  AdjustmentDetails,
  AdjustmentChange,
} from '@/types/database';

// ============================================================================
// Core Adjustment Logic
// ============================================================================

export interface WorkoutAdjustments {
  intensityModifier: number; // Multiply target weights by this (0.6 - 1.0)
  volumeModifier: number; // Multiply sets by this (0.5 - 1.0)
  rpeAdjustment: number; // Add to target RPE (-2 to 0)
  restModifier: number; // Multiply rest periods by this (1.0 - 1.5)
  exerciseSwaps: ExerciseSwap[];
  skipExercises: string[]; // Exercise IDs to skip entirely
  message: string;
  details: AdjustmentDetails;
}

export interface ExerciseSwap {
  originalExerciseId: string;
  originalExerciseName: string;
  suggestedExerciseId: string;
  suggestedExerciseName: string;
  reason: string;
}

/**
 * Generate workout adjustments based on readiness
 */
export function generateReadinessAdjustments(
  readinessAnalysis: ReadinessAnalysis,
  chosenAdjustment: ReadinessAdjustment,
  workout?: WorkoutWithSets,
  profile?: TrainingProfile | null
): WorkoutAdjustments {
  const changes: AdjustmentChange[] = [];

  // Base modifiers from chosen adjustment level
  let intensityModifier = 1.0;
  let volumeModifier = 1.0;
  let rpeAdjustment = 0;
  let restModifier = 1.0;

  switch (chosenAdjustment) {
    case 'full':
      // No modifications
      break;

    case 'moderate':
      intensityModifier = 0.95;
      volumeModifier = 0.9;
      rpeAdjustment = -0.5;
      restModifier = 1.1;
      changes.push({
        type: 'intensity',
        original: '100%',
        suggested: '95%',
        reason: 'Slight intensity reduction to account for recovery status',
      });
      changes.push({
        type: 'volume',
        original: '100%',
        suggested: '90%',
        reason: 'Drop 1 set per exercise to manage fatigue',
      });
      break;

    case 'light':
      intensityModifier = 0.85;
      volumeModifier = 0.7;
      rpeAdjustment = -1;
      restModifier = 1.25;
      changes.push({
        type: 'intensity',
        original: '100%',
        suggested: '85%',
        reason: 'Reduced intensity to prioritize movement quality',
      });
      changes.push({
        type: 'volume',
        original: '100%',
        suggested: '70%',
        reason: 'Significantly reduced volume - focus on key movements',
      });
      changes.push({
        type: 'rest',
        original: '100%',
        suggested: '125%',
        reason: 'Extended rest periods for better recovery between sets',
      });
      break;

    case 'rest':
      intensityModifier = 0.6;
      volumeModifier = 0.5;
      rpeAdjustment = -2;
      restModifier = 1.5;
      changes.push({
        type: 'intensity',
        original: '100%',
        suggested: '60%',
        reason: 'Active recovery intensity - movement without stress',
      });
      changes.push({
        type: 'volume',
        original: '100%',
        suggested: '50%',
        reason: 'Minimal volume - just enough to stay active',
      });
      break;
  }

  // Additional adjustments based on specific readiness factors
  const exerciseSwaps: ExerciseSwap[] = [];
  const skipExercises: string[] = [];

  // If soreness is high, suggest swaps for affected muscle groups
  if (readinessAnalysis.details.sorenessImpact === 'negative' && workout) {
    // In a real implementation, we'd analyze which muscle groups are sore
    // and suggest appropriate swaps. For now, just note it.
    changes.push({
      type: 'exercise',
      reason: 'Consider lighter variations for sore muscle groups',
    });
  }

  // If sleep was poor, reduce high-skill movements
  if (readinessAnalysis.details.sleepImpact === 'negative') {
    changes.push({
      type: 'intensity',
      reason: 'Avoid max attempts - coordination may be impaired',
    });
    // Further reduce intensity for safety
    intensityModifier = Math.min(intensityModifier, 0.9);
  }

  // Generate message
  const message = generateAdjustmentMessage(chosenAdjustment, readinessAnalysis);

  return {
    intensityModifier,
    volumeModifier,
    rpeAdjustment,
    restModifier,
    exerciseSwaps,
    skipExercises,
    message,
    details: {
      message,
      changes,
    },
  };
}

/**
 * Apply adjustments to workout sets
 */
export function applyAdjustmentsToSets(
  sets: WorkoutSet[],
  adjustments: WorkoutAdjustments
): WorkoutSet[] {
  return sets.map((set) => {
    // Skip warmup sets - they don't need adjustment
    if (set.is_warmup) return set;

    // Skip if this exercise should be removed entirely
    if (adjustments.skipExercises.includes(set.exercise_id)) {
      return { ...set, _skipped: true } as WorkoutSet & { _skipped: boolean };
    }

    // Apply intensity modifier to target load
    const adjustedLoad = set.target_load
      ? Math.round(set.target_load * adjustments.intensityModifier)
      : undefined;

    // Apply RPE adjustment
    const adjustedRpe = set.target_rpe
      ? Math.max(5, Math.min(10, set.target_rpe + adjustments.rpeAdjustment))
      : undefined;

    return {
      ...set,
      target_load: adjustedLoad,
      target_rpe: adjustedRpe,
      // Store original values for reference
      _original_load: set.target_load,
      _original_rpe: set.target_rpe,
      _adjusted: true,
    };
  });
}

/**
 * Calculate adjusted volume (reduce sets per exercise)
 */
export function calculateAdjustedVolume(
  sets: WorkoutSet[],
  volumeModifier: number
): WorkoutSet[] {
  if (volumeModifier >= 1) return sets;

  // Group sets by exercise
  const setsByExercise = new Map<string, WorkoutSet[]>();
  sets.forEach((set) => {
    const existing = setsByExercise.get(set.exercise_id) || [];
    setsByExercise.set(set.exercise_id, [...existing, set]);
  });

  // Reduce sets for each exercise
  const adjustedSets: WorkoutSet[] = [];

  setsByExercise.forEach((exerciseSets) => {
    // Keep warmup sets
    const warmupSets = exerciseSets.filter((s) => s.is_warmup);
    const workingSets = exerciseSets.filter((s) => !s.is_warmup);

    // Calculate how many working sets to keep
    const targetWorkingSets = Math.max(1, Math.round(workingSets.length * volumeModifier));
    const keptWorkingSets = workingSets.slice(0, targetWorkingSets);

    adjustedSets.push(...warmupSets, ...keptWorkingSets);
  });

  // Sort by original order
  return adjustedSets.sort((a, b) => a.set_order - b.set_order);
}

// ============================================================================
// Context-Specific Adjustments
// ============================================================================

export interface TimeConstraintAdjustment {
  availableMinutes: number;
  originalMinutes: number;
  priorityExercises: string[]; // Exercise IDs to keep
  skipExercises: string[]; // Exercise IDs to cut
  message: string;
}

/**
 * Generate adjustments for time constraints
 */
export function generateTimeConstraintAdjustments(
  workout: WorkoutWithSets,
  availableMinutes: number,
  estimatedMinutes: number
): TimeConstraintAdjustment {
  if (availableMinutes >= estimatedMinutes) {
    return {
      availableMinutes,
      originalMinutes: estimatedMinutes,
      priorityExercises: [],
      skipExercises: [],
      message: 'You have enough time for the full workout.',
    };
  }

  // Calculate how much to cut
  const cutRatio = availableMinutes / estimatedMinutes;

  // Group exercises by type (compound vs isolation)
  const compoundExercises: string[] = [];
  const isolationExercises: string[] = [];

  const seenExercises = new Set<string>();
  workout.workout_sets?.forEach((set) => {
    if (seenExercises.has(set.exercise_id)) return;
    seenExercises.add(set.exercise_id);

    // Assume compound if muscle group is one of the major groups
    const majorGroups = ['Chest', 'Back', 'Legs', 'Shoulders', 'Full Body'];
    const isCompound = set.exercise?.muscle_group
      ? majorGroups.includes(set.exercise.muscle_group)
      : true;

    if (isCompound) {
      compoundExercises.push(set.exercise_id);
    } else {
      isolationExercises.push(set.exercise_id);
    }
  });

  // Priority: keep compounds, cut isolations first
  const priorityExercises = compoundExercises;
  const skipExercises: string[] = [];

  // If still need to cut, remove some isolations
  if (cutRatio < 0.7) {
    skipExercises.push(...isolationExercises);
  } else if (cutRatio < 0.85) {
    // Cut half the isolation work
    skipExercises.push(...isolationExercises.slice(0, Math.ceil(isolationExercises.length / 2)));
  }

  return {
    availableMinutes,
    originalMinutes: estimatedMinutes,
    priorityExercises,
    skipExercises,
    message: `Short on time. Focus on ${compoundExercises.length} key movements, skip accessories.`,
  };
}

export interface PainReportAdjustment {
  bodyPart: string;
  severity: 'mild' | 'moderate' | 'severe';
  affectedExercises: string[];
  substitutions: ExerciseSwap[];
  message: string;
}

/**
 * Generate adjustments for reported pain/discomfort
 */
export function generatePainAdjustments(
  bodyPart: string,
  severity: 'mild' | 'moderate' | 'severe',
  workout: WorkoutWithSets
): PainReportAdjustment {
  // Map body parts to muscle groups that would be affected
  const affectedGroups: Record<string, string[]> = {
    shoulder: ['Shoulders', 'Chest', 'Back'],
    back: ['Back', 'Legs'],
    knee: ['Legs'],
    elbow: ['Arms', 'Chest', 'Back'],
    wrist: ['Arms', 'Chest'],
    hip: ['Legs', 'Core'],
    neck: ['Shoulders', 'Back'],
  };

  const groups = affectedGroups[bodyPart.toLowerCase()] || [];

  // Find exercises that involve affected muscle groups
  const affectedExercises: string[] = [];
  const seenExercises = new Set<string>();

  workout.workout_sets?.forEach((set) => {
    if (seenExercises.has(set.exercise_id)) return;
    seenExercises.add(set.exercise_id);

    if (set.exercise?.muscle_group && groups.includes(set.exercise.muscle_group)) {
      affectedExercises.push(set.exercise_id);
    }
  });

  let message: string;
  const substitutions: ExerciseSwap[] = [];

  switch (severity) {
    case 'mild':
      message = `Noted ${bodyPart} discomfort. We'll use lighter loads and stop if it worsens.`;
      break;
    case 'moderate':
      message = `${bodyPart} needs attention. Switching to pain-free alternatives for affected exercises.`;
      break;
    case 'severe':
      message = `Skip exercises involving ${bodyPart} today. Consider seeing a professional if pain persists.`;
      break;
  }

  return {
    bodyPart,
    severity,
    affectedExercises,
    substitutions,
    message,
  };
}

// ============================================================================
// Message Generation
// ============================================================================

function generateAdjustmentMessage(
  adjustment: ReadinessAdjustment,
  analysis: ReadinessAnalysis
): string {
  const messages: Record<ReadinessAdjustment, string[]> = {
    full: [
      "You're primed for a great session. Let's make it count!",
      'All systems go. Time to push your limits.',
      "Green light on all fronts. Let's build some strength.",
    ],
    moderate: [
      "Solid day ahead. We'll keep the intensity smart.",
      'Good foundation to work with. Training smart today.',
      "Not peak but not bad. Let's be strategic.",
    ],
    light: [
      "Recovery mode activated. Quality over quantity today.",
      'Dialing it back to protect your gains.',
      "Light day, but we're still making progress.",
    ],
    rest: [
      'Your body needs a break. Active recovery or rest today.',
      "Sometimes rest is the best training. Honor that today.",
      'Taking it easy is part of the program. Recover well.',
    ],
  };

  const options = messages[adjustment];
  return options[Math.floor(Math.random() * options.length)];
}

// ============================================================================
// Adjustment Summary
// ============================================================================

export interface AdjustmentSummary {
  hasAdjustments: boolean;
  adjustmentLevel: ReadinessAdjustment;
  intensityChange: string;
  volumeChange: string;
  keyChanges: string[];
}

/**
 * Generate a human-readable summary of adjustments
 */
export function summarizeAdjustments(adjustments: WorkoutAdjustments): AdjustmentSummary {
  const hasAdjustments =
    adjustments.intensityModifier < 1 ||
    adjustments.volumeModifier < 1 ||
    adjustments.exerciseSwaps.length > 0 ||
    adjustments.skipExercises.length > 0;

  const intensityChange =
    adjustments.intensityModifier >= 1
      ? 'Normal'
      : `${Math.round(adjustments.intensityModifier * 100)}%`;

  const volumeChange =
    adjustments.volumeModifier >= 1
      ? 'Normal'
      : `${Math.round(adjustments.volumeModifier * 100)}%`;

  const keyChanges: string[] = [];

  if (adjustments.intensityModifier < 1) {
    keyChanges.push(`Intensity at ${Math.round(adjustments.intensityModifier * 100)}%`);
  }
  if (adjustments.volumeModifier < 1) {
    keyChanges.push(`Volume reduced to ${Math.round(adjustments.volumeModifier * 100)}%`);
  }
  if (adjustments.rpeAdjustment !== 0) {
    keyChanges.push(`Target RPE adjusted by ${adjustments.rpeAdjustment}`);
  }
  if (adjustments.exerciseSwaps.length > 0) {
    keyChanges.push(`${adjustments.exerciseSwaps.length} exercise substitutions`);
  }
  if (adjustments.skipExercises.length > 0) {
    keyChanges.push(`Skipping ${adjustments.skipExercises.length} exercises`);
  }

  // Determine overall adjustment level from modifiers
  let adjustmentLevel: ReadinessAdjustment = 'full';
  if (adjustments.intensityModifier <= 0.65) {
    adjustmentLevel = 'rest';
  } else if (adjustments.intensityModifier <= 0.85) {
    adjustmentLevel = 'light';
  } else if (adjustments.intensityModifier < 1) {
    adjustmentLevel = 'moderate';
  }

  return {
    hasAdjustments,
    adjustmentLevel,
    intensityChange,
    volumeChange,
    keyChanges,
  };
}
