/**
 * Block Builder - AI-Powered Program Generation
 *
 * Generates periodized training blocks based on:
 * - User's training experience and goals
 * - Available training days
 * - Exercise preferences and history
 * - Current training phase
 */

import type {
  TrainingProfile,
  TrainingGoal,
  TrainingPhase,
  TrainingExperience,
  Exercise,
} from '@/types/database';

// ============================================================================
// Types
// ============================================================================

export interface BlockConfig {
  goal: TrainingGoal;
  durationWeeks: number;
  daysPerWeek: number;
  experience: TrainingExperience;
  phase?: TrainingPhase;
  focusLifts?: string[]; // Exercise IDs to prioritize
  availableEquipment?: string[];
  sessionDurationMinutes?: number;
}

export interface GeneratedBlock {
  name: string;
  description: string;
  goal: TrainingGoal;
  durationWeeks: number;
  phase: TrainingPhase;
  weeks: GeneratedWeek[];
  projectedProgress: ProgressProjection;
}

export interface GeneratedWeek {
  weekNumber: number;
  theme: string; // e.g., "Volume Accumulation", "Intensity Ramp"
  workouts: GeneratedWorkout[];
  totalVolume: number; // Estimated total sets
  intensityRange: { min: number; max: number }; // RPE range
}

export interface GeneratedWorkout {
  dayNumber: number;
  name: string;
  focus: string; // e.g., "Upper Push", "Lower", "Full Body"
  exercises: GeneratedExercise[];
  estimatedDuration: number; // minutes
}

export interface GeneratedExercise {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string;
  sets: GeneratedSet[];
  notes?: string;
  alternatives?: string[]; // Alternative exercise IDs
}

export interface GeneratedSet {
  setNumber: number;
  targetReps: number;
  targetRPE: number;
  isWarmup: boolean;
  restSeconds: number;
  percentOf1RM?: number; // For strength-focused programs
}

export interface ProgressProjection {
  mainLifts: {
    exerciseName: string;
    currentE1RM: number | null;
    projectedE1RM: number;
    percentIncrease: number;
  }[];
  volumeProgression: number[]; // Weekly total sets
  intensityProgression: number[]; // Weekly avg RPE
}

// ============================================================================
// Periodization Templates
// ============================================================================

export interface PeriodizationTemplate {
  id: string;
  name: string;
  description: string;
  goal: TrainingGoal;
  durationWeeks: number;
  phases: PhaseConfig[];
  suitableFor: TrainingExperience[];
}

export interface PhaseConfig {
  phase: TrainingPhase;
  weeks: number;
  volumeMultiplier: number; // 0.7 - 1.3
  intensityMultiplier: number; // 0.7 - 1.0
  repRangeMin: number;
  repRangeMax: number;
  rpeRange: { min: number; max: number };
}

// Pre-defined periodization templates
export const PERIODIZATION_TEMPLATES: PeriodizationTemplate[] = [
  {
    id: 'strength-6week',
    name: '6-Week Strength Block',
    description: 'Classic strength periodization with volume accumulation, intensity peak, and deload.',
    goal: 'strength',
    durationWeeks: 6,
    suitableFor: ['intermediate', 'advanced'],
    phases: [
      {
        phase: 'accumulation',
        weeks: 3,
        volumeMultiplier: 1.0,
        intensityMultiplier: 0.75,
        repRangeMin: 5,
        repRangeMax: 8,
        rpeRange: { min: 7, max: 8 },
      },
      {
        phase: 'intensification',
        weeks: 2,
        volumeMultiplier: 0.85,
        intensityMultiplier: 0.9,
        repRangeMin: 3,
        repRangeMax: 5,
        rpeRange: { min: 8, max: 9 },
      },
      {
        phase: 'deload',
        weeks: 1,
        volumeMultiplier: 0.5,
        intensityMultiplier: 0.7,
        repRangeMin: 5,
        repRangeMax: 8,
        rpeRange: { min: 6, max: 7 },
      },
    ],
  },
  {
    id: 'hypertrophy-8week',
    name: '8-Week Hypertrophy Block',
    description: 'High volume muscle building with progressive overload and strategic deloads.',
    goal: 'hypertrophy',
    durationWeeks: 8,
    suitableFor: ['beginner', 'intermediate', 'advanced'],
    phases: [
      {
        phase: 'accumulation',
        weeks: 4,
        volumeMultiplier: 1.1,
        intensityMultiplier: 0.7,
        repRangeMin: 8,
        repRangeMax: 12,
        rpeRange: { min: 7, max: 8 },
      },
      {
        phase: 'intensification',
        weeks: 3,
        volumeMultiplier: 1.0,
        intensityMultiplier: 0.8,
        repRangeMin: 6,
        repRangeMax: 10,
        rpeRange: { min: 8, max: 9 },
      },
      {
        phase: 'deload',
        weeks: 1,
        volumeMultiplier: 0.5,
        intensityMultiplier: 0.65,
        repRangeMin: 10,
        repRangeMax: 15,
        rpeRange: { min: 5, max: 6 },
      },
    ],
  },
  {
    id: 'powerlifting-12week',
    name: '12-Week Powerlifting Prep',
    description: 'Competition preparation with peaking protocol for squat, bench, and deadlift.',
    goal: 'powerlifting',
    durationWeeks: 12,
    suitableFor: ['intermediate', 'advanced'],
    phases: [
      {
        phase: 'accumulation',
        weeks: 5,
        volumeMultiplier: 1.0,
        intensityMultiplier: 0.7,
        repRangeMin: 5,
        repRangeMax: 8,
        rpeRange: { min: 7, max: 8 },
      },
      {
        phase: 'intensification',
        weeks: 4,
        volumeMultiplier: 0.8,
        intensityMultiplier: 0.85,
        repRangeMin: 3,
        repRangeMax: 5,
        rpeRange: { min: 8, max: 9 },
      },
      {
        phase: 'realization',
        weeks: 2,
        volumeMultiplier: 0.6,
        intensityMultiplier: 0.95,
        repRangeMin: 1,
        repRangeMax: 3,
        rpeRange: { min: 9, max: 10 },
      },
      {
        phase: 'deload',
        weeks: 1,
        volumeMultiplier: 0.3,
        intensityMultiplier: 0.6,
        repRangeMin: 3,
        repRangeMax: 5,
        rpeRange: { min: 5, max: 6 },
      },
    ],
  },
  {
    id: 'athletic-4week',
    name: '4-Week Athletic Block',
    description: 'Balanced strength and power development for athletic performance.',
    goal: 'athletic',
    durationWeeks: 4,
    suitableFor: ['beginner', 'intermediate', 'advanced'],
    phases: [
      {
        phase: 'accumulation',
        weeks: 2,
        volumeMultiplier: 0.9,
        intensityMultiplier: 0.75,
        repRangeMin: 5,
        repRangeMax: 8,
        rpeRange: { min: 7, max: 8 },
      },
      {
        phase: 'intensification',
        weeks: 1,
        volumeMultiplier: 0.8,
        intensityMultiplier: 0.85,
        repRangeMin: 3,
        repRangeMax: 6,
        rpeRange: { min: 8, max: 9 },
      },
      {
        phase: 'deload',
        weeks: 1,
        volumeMultiplier: 0.5,
        intensityMultiplier: 0.7,
        repRangeMin: 5,
        repRangeMax: 8,
        rpeRange: { min: 6, max: 7 },
      },
    ],
  },
  {
    id: 'beginner-4week',
    name: '4-Week Foundation Block',
    description: 'Perfect for beginners - learn movements and build base strength.',
    goal: 'general',
    durationWeeks: 4,
    suitableFor: ['beginner'],
    phases: [
      {
        phase: 'accumulation',
        weeks: 3,
        volumeMultiplier: 0.8,
        intensityMultiplier: 0.65,
        repRangeMin: 8,
        repRangeMax: 12,
        rpeRange: { min: 6, max: 7 },
      },
      {
        phase: 'deload',
        weeks: 1,
        volumeMultiplier: 0.5,
        intensityMultiplier: 0.6,
        repRangeMin: 10,
        repRangeMax: 15,
        rpeRange: { min: 5, max: 6 },
      },
    ],
  },
];

// ============================================================================
// Training Splits
// ============================================================================

export interface TrainingSplit {
  id: string;
  name: string;
  daysPerWeek: number;
  days: SplitDay[];
  suitableFor: TrainingGoal[];
}

export interface SplitDay {
  dayNumber: number;
  name: string;
  focus: string;
  muscleGroups: string[];
  primaryMovements: MovementPattern[];
  accessorySlots: number;
}

export type MovementPattern =
  | 'squat'
  | 'hinge'
  | 'horizontal_push'
  | 'horizontal_pull'
  | 'vertical_push'
  | 'vertical_pull'
  | 'carry'
  | 'core';

export const TRAINING_SPLITS: TrainingSplit[] = [
  {
    id: 'upper-lower-4',
    name: 'Upper/Lower (4 days)',
    daysPerWeek: 4,
    suitableFor: ['strength', 'hypertrophy', 'general', 'powerlifting'],
    days: [
      {
        dayNumber: 1,
        name: 'Upper A',
        focus: 'Upper Push Focus',
        muscleGroups: ['Chest', 'Shoulders', 'Triceps', 'Back'],
        primaryMovements: ['horizontal_push', 'horizontal_pull', 'vertical_push'],
        accessorySlots: 2,
      },
      {
        dayNumber: 2,
        name: 'Lower A',
        focus: 'Squat Focus',
        muscleGroups: ['Legs', 'Glutes', 'Core'],
        primaryMovements: ['squat', 'hinge', 'core'],
        accessorySlots: 2,
      },
      {
        dayNumber: 3,
        name: 'Upper B',
        focus: 'Upper Pull Focus',
        muscleGroups: ['Back', 'Biceps', 'Shoulders', 'Chest'],
        primaryMovements: ['horizontal_pull', 'vertical_pull', 'horizontal_push'],
        accessorySlots: 2,
      },
      {
        dayNumber: 4,
        name: 'Lower B',
        focus: 'Hinge Focus',
        muscleGroups: ['Legs', 'Glutes', 'Hamstrings', 'Core'],
        primaryMovements: ['hinge', 'squat', 'carry'],
        accessorySlots: 2,
      },
    ],
  },
  {
    id: 'push-pull-legs-6',
    name: 'Push/Pull/Legs (6 days)',
    daysPerWeek: 6,
    suitableFor: ['hypertrophy', 'bodybuilding'],
    days: [
      {
        dayNumber: 1,
        name: 'Push A',
        focus: 'Chest Focus',
        muscleGroups: ['Chest', 'Shoulders', 'Triceps'],
        primaryMovements: ['horizontal_push', 'vertical_push'],
        accessorySlots: 3,
      },
      {
        dayNumber: 2,
        name: 'Pull A',
        focus: 'Back Width',
        muscleGroups: ['Back', 'Biceps', 'Rear Delts'],
        primaryMovements: ['vertical_pull', 'horizontal_pull'],
        accessorySlots: 3,
      },
      {
        dayNumber: 3,
        name: 'Legs A',
        focus: 'Quad Focus',
        muscleGroups: ['Legs', 'Glutes', 'Calves'],
        primaryMovements: ['squat', 'hinge'],
        accessorySlots: 3,
      },
      {
        dayNumber: 4,
        name: 'Push B',
        focus: 'Shoulder Focus',
        muscleGroups: ['Shoulders', 'Chest', 'Triceps'],
        primaryMovements: ['vertical_push', 'horizontal_push'],
        accessorySlots: 3,
      },
      {
        dayNumber: 5,
        name: 'Pull B',
        focus: 'Back Thickness',
        muscleGroups: ['Back', 'Biceps', 'Rear Delts'],
        primaryMovements: ['horizontal_pull', 'vertical_pull'],
        accessorySlots: 3,
      },
      {
        dayNumber: 6,
        name: 'Legs B',
        focus: 'Hamstring Focus',
        muscleGroups: ['Legs', 'Glutes', 'Hamstrings', 'Calves'],
        primaryMovements: ['hinge', 'squat'],
        accessorySlots: 3,
      },
    ],
  },
  {
    id: 'full-body-3',
    name: 'Full Body (3 days)',
    daysPerWeek: 3,
    suitableFor: ['strength', 'general', 'athletic', 'beginner'],
    days: [
      {
        dayNumber: 1,
        name: 'Full Body A',
        focus: 'Squat Day',
        muscleGroups: ['Legs', 'Chest', 'Back', 'Core'],
        primaryMovements: ['squat', 'horizontal_push', 'horizontal_pull'],
        accessorySlots: 2,
      },
      {
        dayNumber: 2,
        name: 'Full Body B',
        focus: 'Press Day',
        muscleGroups: ['Shoulders', 'Back', 'Legs', 'Core'],
        primaryMovements: ['vertical_push', 'vertical_pull', 'hinge'],
        accessorySlots: 2,
      },
      {
        dayNumber: 3,
        name: 'Full Body C',
        focus: 'Deadlift Day',
        muscleGroups: ['Legs', 'Back', 'Chest', 'Core'],
        primaryMovements: ['hinge', 'horizontal_push', 'horizontal_pull'],
        accessorySlots: 2,
      },
    ],
  },
  {
    id: 'powerlifting-4',
    name: 'Powerlifting (4 days)',
    daysPerWeek: 4,
    suitableFor: ['powerlifting', 'strength'],
    days: [
      {
        dayNumber: 1,
        name: 'Squat',
        focus: 'Competition Squat',
        muscleGroups: ['Legs', 'Glutes', 'Core'],
        primaryMovements: ['squat'],
        accessorySlots: 3,
      },
      {
        dayNumber: 2,
        name: 'Bench',
        focus: 'Competition Bench',
        muscleGroups: ['Chest', 'Shoulders', 'Triceps'],
        primaryMovements: ['horizontal_push'],
        accessorySlots: 3,
      },
      {
        dayNumber: 3,
        name: 'Deadlift',
        focus: 'Competition Deadlift',
        muscleGroups: ['Back', 'Legs', 'Glutes'],
        primaryMovements: ['hinge'],
        accessorySlots: 3,
      },
      {
        dayNumber: 4,
        name: 'Accessories',
        focus: 'Weak Point Training',
        muscleGroups: ['Full Body'],
        primaryMovements: ['squat', 'horizontal_push', 'horizontal_pull'],
        accessorySlots: 4,
      },
    ],
  },
  {
    id: 'upper-lower-3',
    name: 'Upper/Lower (3 days)',
    daysPerWeek: 3,
    suitableFor: ['strength', 'hypertrophy', 'general'],
    days: [
      {
        dayNumber: 1,
        name: 'Upper',
        focus: 'Upper Body',
        muscleGroups: ['Chest', 'Back', 'Shoulders', 'Arms'],
        primaryMovements: ['horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull'],
        accessorySlots: 2,
      },
      {
        dayNumber: 2,
        name: 'Lower',
        focus: 'Lower Body',
        muscleGroups: ['Legs', 'Glutes', 'Core'],
        primaryMovements: ['squat', 'hinge', 'core'],
        accessorySlots: 2,
      },
      {
        dayNumber: 3,
        name: 'Full Body',
        focus: 'Full Body',
        muscleGroups: ['Full Body'],
        primaryMovements: ['squat', 'horizontal_push', 'horizontal_pull'],
        accessorySlots: 2,
      },
    ],
  },
];

// ============================================================================
// Exercise Selection
// ============================================================================

// Map movement patterns to exercise selection criteria
export const MOVEMENT_PATTERN_EXERCISES: Record<MovementPattern, {
  muscleGroups: string[];
  preferredExerciseNames: string[];
}> = {
  squat: {
    muscleGroups: ['Legs', 'Glutes'],
    preferredExerciseNames: [
      'Barbell Back Squat',
      'Barbell Front Squat',
      'Goblet Squat',
      'Leg Press',
      'Bulgarian Split Squat',
    ],
  },
  hinge: {
    muscleGroups: ['Back', 'Legs', 'Glutes'],
    preferredExerciseNames: [
      'Conventional Deadlift',
      'Romanian Deadlift',
      'Sumo Deadlift',
      'Trap Bar Deadlift',
      'Hip Thrust',
    ],
  },
  horizontal_push: {
    muscleGroups: ['Chest', 'Shoulders', 'Triceps'],
    preferredExerciseNames: [
      'Barbell Bench Press',
      'Dumbbell Bench Press',
      'Incline Bench Press',
      'Dumbbell Press',
      'Push-Up',
    ],
  },
  horizontal_pull: {
    muscleGroups: ['Back', 'Biceps'],
    preferredExerciseNames: [
      'Barbell Row',
      'Dumbbell Row',
      'Cable Row',
      'T-Bar Row',
      'Chest Supported Row',
    ],
  },
  vertical_push: {
    muscleGroups: ['Shoulders', 'Triceps'],
    preferredExerciseNames: [
      'Overhead Press',
      'Dumbbell Shoulder Press',
      'Arnold Press',
      'Push Press',
      'Landmine Press',
    ],
  },
  vertical_pull: {
    muscleGroups: ['Back', 'Biceps'],
    preferredExerciseNames: [
      'Pull-Up',
      'Lat Pulldown',
      'Chin-Up',
      'Cable Pulldown',
      'Assisted Pull-Up',
    ],
  },
  carry: {
    muscleGroups: ['Core', 'Full Body'],
    preferredExerciseNames: [
      'Farmer\'s Walk',
      'Suitcase Carry',
      'Overhead Carry',
      'Trap Bar Carry',
    ],
  },
  core: {
    muscleGroups: ['Core'],
    preferredExerciseNames: [
      'Plank',
      'Dead Bug',
      'Ab Wheel Rollout',
      'Hanging Leg Raise',
      'Cable Crunch',
      'Pallof Press',
    ],
  },
};

// ============================================================================
// Block Generation Functions
// ============================================================================

/**
 * Select the best training split based on config
 */
export function selectTrainingSplit(config: BlockConfig): TrainingSplit {
  // Filter splits by days per week
  const compatibleSplits = TRAINING_SPLITS.filter(
    (split) => split.daysPerWeek === config.daysPerWeek &&
               split.suitableFor.includes(config.goal)
  );

  // If no exact match, find closest
  if (compatibleSplits.length === 0) {
    // Find closest days per week
    const sorted = [...TRAINING_SPLITS]
      .filter((s) => s.suitableFor.includes(config.goal))
      .sort((a, b) =>
        Math.abs(a.daysPerWeek - config.daysPerWeek) -
        Math.abs(b.daysPerWeek - config.daysPerWeek)
      );
    return sorted[0] || TRAINING_SPLITS[0];
  }

  return compatibleSplits[0];
}

/**
 * Select the best periodization template based on config
 */
export function selectPeriodizationTemplate(config: BlockConfig): PeriodizationTemplate {
  // Filter by goal and experience
  const compatible = PERIODIZATION_TEMPLATES.filter(
    (t) => t.goal === config.goal && t.suitableFor.includes(config.experience)
  );

  if (compatible.length === 0) {
    // Fallback to any template for this goal
    const goalMatch = PERIODIZATION_TEMPLATES.filter((t) => t.goal === config.goal);
    if (goalMatch.length > 0) return goalMatch[0];

    // Ultimate fallback
    return PERIODIZATION_TEMPLATES.find((t) => t.id === 'beginner-4week')!;
  }

  // Prefer template with matching duration
  const durationMatch = compatible.find((t) => t.durationWeeks === config.durationWeeks);
  return durationMatch || compatible[0];
}

/**
 * Calculate progressive overload for the block
 */
export function calculateProgressiveOverload(
  weekNumber: number,
  totalWeeks: number,
  phase: PhaseConfig,
  experience: TrainingExperience
): {
  volumeAdjustment: number;
  intensityAdjustment: number;
} {
  // Progressive overload within the phase
  const weekInPhase = weekNumber % phase.weeks || phase.weeks;
  const progressRate = experience === 'beginner' ? 0.05 : experience === 'intermediate' ? 0.025 : 0.015;

  return {
    volumeAdjustment: 1 + (weekInPhase - 1) * progressRate,
    intensityAdjustment: 1 + (weekInPhase - 1) * (progressRate * 0.5),
  };
}

/**
 * Generate sets for an exercise based on phase config
 */
export function generateSetsForExercise(
  phase: PhaseConfig,
  isCompound: boolean,
  experience: TrainingExperience,
  weekInPhase: number
): GeneratedSet[] {
  // Base sets based on experience and exercise type
  let baseSets = isCompound
    ? (experience === 'beginner' ? 3 : experience === 'intermediate' ? 4 : 5)
    : (experience === 'beginner' ? 2 : 3);

  // Adjust for phase
  baseSets = Math.round(baseSets * phase.volumeMultiplier);
  baseSets = Math.max(2, Math.min(6, baseSets));

  // Generate target reps (vary slightly within range)
  const repRange = phase.repRangeMax - phase.repRangeMin;
  const reps = phase.repRangeMin + Math.floor(repRange / 2);

  // Generate RPE (increase slightly through week)
  const baseRPE = phase.rpeRange.min + (weekInPhase - 1) * 0.5;
  const targetRPE = Math.min(phase.rpeRange.max, baseRPE);

  // Rest periods based on goal
  const restSeconds = phase.repRangeMax <= 5 ? 180 : phase.repRangeMax <= 8 ? 120 : 90;

  const sets: GeneratedSet[] = [];

  // Add warmup sets for compound movements
  if (isCompound) {
    sets.push({
      setNumber: 1,
      targetReps: 10,
      targetRPE: 4,
      isWarmup: true,
      restSeconds: 60,
    });
    sets.push({
      setNumber: 2,
      targetReps: 5,
      targetRPE: 5,
      isWarmup: true,
      restSeconds: 60,
    });
  }

  // Add working sets
  for (let i = 0; i < baseSets; i++) {
    sets.push({
      setNumber: sets.length + 1,
      targetReps: reps,
      targetRPE: Math.round(targetRPE * 10) / 10,
      isWarmup: false,
      restSeconds,
    });
  }

  return sets;
}

/**
 * Generate a descriptive name for the block
 */
export function generateBlockName(config: BlockConfig): string {
  const goalNames: Record<TrainingGoal, string> = {
    strength: 'Strength',
    hypertrophy: 'Hypertrophy',
    powerlifting: 'Powerlifting',
    bodybuilding: 'Bodybuilding',
    athletic: 'Athletic Performance',
    general: 'General Fitness',
  };

  return `${config.durationWeeks}-Week ${goalNames[config.goal]} Block`;
}

/**
 * Generate week theme based on phase
 */
export function generateWeekTheme(phase: TrainingPhase, weekInPhase: number, totalWeeksInPhase: number): string {
  const themes: Record<TrainingPhase, (week: number, total: number) => string> = {
    accumulation: (w, t) => {
      if (w === 1) return 'Volume Foundation';
      if (w === t) return 'Volume Peak';
      return 'Volume Building';
    },
    intensification: (w, t) => {
      if (w === 1) return 'Intensity Introduction';
      if (w === t) return 'Intensity Peak';
      return 'Intensity Ramp';
    },
    realization: (w, t) => {
      if (w === 1) return 'Peak Preparation';
      if (w === t) return 'Test Week';
      return 'Peak Performance';
    },
    deload: () => 'Recovery & Adaptation',
    maintenance: () => 'Maintaining Gains',
  };

  return themes[phase](weekInPhase, totalWeeksInPhase);
}

/**
 * Estimate workout duration based on exercises and sets
 */
export function estimateWorkoutDuration(exercises: GeneratedExercise[]): number {
  let totalMinutes = 5; // Warmup time

  exercises.forEach((exercise) => {
    const workingSets = exercise.sets.filter((s) => !s.isWarmup);
    const warmupSets = exercise.sets.filter((s) => s.isWarmup);

    // Time per set (including rest)
    workingSets.forEach((set) => {
      totalMinutes += 1 + (set.restSeconds / 60); // 1 min per set + rest
    });

    warmupSets.forEach((set) => {
      totalMinutes += 0.5 + (set.restSeconds / 60);
    });
  });

  return Math.round(totalMinutes);
}
