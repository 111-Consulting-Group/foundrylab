/**
 * Coach Types
 * Type definitions for the Adaptive Training Coach system
 */

// ============================================================================
// COACH MODES
// ============================================================================

/**
 * The 8 interaction modes the coach can operate in
 */
export type CoachMode =
  | 'intake'           // Onboarding questions (one section at a time)
  | 'reflect'          // Summarize understanding before programming
  | 'history'          // Analyze 4-6 weeks of training
  | 'phase'            // Determine current training phase
  | 'weekly_planning'  // Sunday planning use case
  | 'daily'            // What should I do today?
  | 'post_workout'     // Evaluate completed session
  | 'explain'          // Why did you recommend this?
  | 'general';         // Free conversation

/**
 * Training phases the coach can detect/assign
 */
export type TrainingPhase =
  | 'rebuilding'    // Coming back from disruption
  | 'accumulating'  // Building volume/base
  | 'intensifying'  // Pushing load/intensity
  | 'maintaining'   // Holding steady
  | 'deloading';    // Recovery week

/**
 * Confidence level for coach recommendations
 */
export type ConfidenceLevel = 'LOW' | 'MED' | 'HIGH';

// ============================================================================
// INTAKE SYSTEM
// ============================================================================

/**
 * Sections of the intake flow
 */
export type IntakeSection =
  | 'goals'
  | 'schedule'
  | 'concurrent_training'
  | 'constraints'
  | 'context'
  | 'coaching_style';

/**
 * State of the intake process
 */
export interface IntakeState {
  currentSection: IntakeSection;
  completedSections: IntakeSection[];
  responses: IntakeResponses;
  isComplete: boolean;
  startedAt?: string;
  completedAt?: string;
}

/**
 * Running schedule for hybrid training
 */
export type RunType = 'easy_run' | 'tempo' | 'intervals' | 'long_run' | 'recovery';
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export type TrainingPriority = 'equal' | 'running' | 'lifting';

export interface RunningSchedule {
  days: DayOfWeek[];               // Which days you run
  types: RunType[];                // What types of runs (matched to days if same length)
  weekly_mileage?: number;         // Approximate weekly mileage
  priority: TrainingPriority;      // Which takes precedence when scheduling
}

/**
 * User responses from intake
 */
export interface IntakeResponses {
  // Goals
  primary_goal?: 'strength' | 'hypertrophy' | 'fat_loss' | 'athletic' | 'health' | 'maintain';
  secondary_goal?: string;

  // Schedule
  days_per_week?: number;
  session_length_minutes?: number;
  preferred_days?: string[]; // ['monday', 'wednesday', 'friday']

  // Concurrent training
  concurrent_activities?: ('running' | 'cycling' | 'swimming' | 'sports' | 'hiking' | 'other')[];
  concurrent_hours_per_week?: number;

  // Running schedule (for hybrid athletes)
  running_schedule?: RunningSchedule;

  // Constraints
  injuries?: string;
  exercise_preferences?: string;
  exercise_aversions?: string;

  // Context
  upcoming_disruptions?: string;
  recent_disruptions?: ('illness' | 'travel' | 'layoff' | 'injury' | 'stress')[];
  sleep_quality?: number; // 1-10
  stress_level?: number;  // 1-10

  // Coaching style
  autonomy_preference?: number; // 1-10 (1 = flexible framework, 10 = precise prescriptions)
}

// ============================================================================
// CONTEXT & HISTORY
// ============================================================================

/**
 * Disruption record (illness, travel, etc.)
 */
export interface Disruption {
  id?: string;
  type: 'illness' | 'travel' | 'injury' | 'life_stress' | 'schedule';
  start_date: string;
  end_date?: string;
  severity: 'minor' | 'moderate' | 'major';
  notes?: string;
}

/**
 * Analyzed training history for coach context
 */
export interface HistoryAnalysis {
  // Volume metrics
  totalWorkouts: number;
  workoutsPerWeek: number;
  averageSessionMinutes: number;
  totalVolume: number; // Total tonnage

  // Patterns
  volumeByMuscleGroup: Record<string, number>;
  preferredDays: string[];
  typicalDuration: number;
  detectedSplit?: string; // 'push_pull_legs', 'upper_lower', etc.

  // Progression
  progressingExercises: ExerciseProgression[];
  stagnantExercises: ExerciseProgression[];
  regressingExercises: ExerciseProgression[];

  // Disruptions
  missedWorkouts: number;
  gaps: { startDate: string; endDate: string; days: number }[];
  recentDisruption?: Disruption;

  // Confidence
  dataQuality: ConfidenceLevel;
  weeksAnalyzed: number;
}

/**
 * Exercise-specific progression data
 */
export interface ExerciseProgression {
  exerciseId: string;
  exerciseName: string;
  trend: 'progressing' | 'stagnant' | 'regressing';
  recentE1RM?: number;
  previousE1RM?: number;
  changePercent?: number;
  lastPerformed?: string;
  exposureCount: number;
}

/**
 * Phase detection result
 */
export interface PhaseDetection {
  phase: TrainingPhase;
  confidence: ConfidenceLevel;
  reasoning: string;
  suggestedDuration?: number; // weeks
}

// ============================================================================
// COACH ACTIONS
// ============================================================================

/**
 * Actions the coach can suggest/execute
 */
export type CoachAction =
  | AdjustWorkoutAction
  | SwapExerciseAction
  | ScheduleDeloadAction
  | UpdateTargetsAction
  | AddDisruptionAction
  | SetGoalAction
  | UpdateProfileAction
  | UpdateProfileAction
  | UpdateProfileAction
  | ReplaceProgramAction
  | OpenWeekPlannerAction;

export interface AdjustWorkoutAction {
  type: 'adjust_workout';
  workoutId: string;
  adjustments: {
    exerciseId: string;
    newReps?: number;
    newLoad?: number;
    newRPE?: number;
    newSets?: number;
  }[];
  reason: string;
}

export interface SwapExerciseAction {
  type: 'swap_exercise';
  workoutId: string;
  oldExerciseId: string;
  newExerciseId: string;
  reason: string;
}

export interface ScheduleDeloadAction {
  type: 'schedule_deload';
  blockId?: string;
  weekNumber: number;
  reductionPercent: number; // typically 40-50%
  reason: string;
}

export interface UpdateTargetsAction {
  type: 'update_targets';
  exerciseId: string;
  newTargets: {
    reps?: number;
    load?: number;
    rpe?: number;
    sets?: number;
  };
  reason: string;
}

export interface AddDisruptionAction {
  type: 'add_disruption';
  disruption: Omit<Disruption, 'id'>;
}

export interface SetGoalAction {
  type: 'set_goal';
  goal: {
    exercise_id?: string;
    goal_type: 'e1rm' | 'weight' | 'reps' | 'volume' | 'custom';
    target_value: number;
    target_date?: string;
    description?: string;
  };
}

export interface UpdateProfileAction {
  type: 'update_profile';
  updates: Partial<IntakeResponses>;
}

export interface ReplaceProgramAction {
  type: 'replace_program';
  blockId?: string;
  weekCount: number;
  daysPerWeek: number;
  config: {
    goal: string;
    phase?: string;
    focusAreas?: string[];
  };
  reason: string;
}

export interface OpenWeekPlannerAction {
  type: 'open_week_planner';
  constraints?: {
    disruption?: string;
    focus?: string;
  };
  reason: string;
}

// ============================================================================
// WEEKLY PLANNING
// ============================================================================

/**
 * Session type for hybrid athletes
 */
export type SessionType =
  | 'hypertrophy'
  | 'strength'
  | 'zone2'
  | 'tempo'
  | 'intervals'
  | 'long_run'
  | 'easy_run'
  | 'rest';

/**
 * Muscle groups for volume targeting
 */
export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'legs'
  | 'glutes'
  | 'core';

/**
 * Weekly targets set by the user for week planning
 */
export interface WeeklyTargets {
  // Lifting sessions
  hypertrophySessions: { min: number; max: number };
  strengthSessions?: { min: number; max: number };

  // Cardio
  zone2Sessions: { min: number; max: number; durationMinutes: number };
  tempoSessions?: number;
  intervalSessions?: number;
  longRunSessions?: number;

  // Constraints
  restDays: number;
  availableDays: DayOfWeek[];

  // Volume targets (optional)
  weeklyVolumeTargets?: Partial<Record<MuscleGroup, number>>;
}

/**
 * Default targets for quick start
 */
export const DEFAULT_WEEKLY_TARGETS: WeeklyTargets = {
  hypertrophySessions: { min: 3, max: 4 },
  zone2Sessions: { min: 2, max: 3, durationMinutes: 45 },
  tempoSessions: 1,
  restDays: 1,
  availableDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
};

/**
 * A generated weekly plan
 */
export interface WeeklyPlan {
  weekOf: string; // ISO date of Monday
  phase: TrainingPhase;
  days: PlannedDay[];
  rationale: string;
  adjustmentsApplied?: string[];
  targets?: WeeklyTargets; // The targets used to generate this plan
}

/**
 * A single day in the weekly plan
 */
export interface PlannedDay {
  dayNumber: number; // 1-7 (Monday = 1)
  dayName: string;
  isRestDay: boolean;
  sessionType?: SessionType; // Type of session for this day
  focus?: string; // 'Upper Body', 'Legs', etc.
  exercises?: PlannedExercise[];
  notes?: string;
  alternativeIfNeeded?: string;
  isLocked?: boolean; // User manually adjusted this day
  estimatedDuration?: number; // minutes
}

/**
 * A planned exercise with targets
 */
export interface PlannedExercise {
  exerciseId: string;
  exerciseName: string;
  sets: number;
  reps: string; // '8-10' or '5'
  loadGuidance?: string; // '185 lbs' or 'RPE 8' or '+5 lbs from last week'
  progressionNote?: string; // 'Add 5 lbs if you hit all reps last week'
  substituteOptions?: string[];
}

// ============================================================================
// POST-WORKOUT EVALUATION
// ============================================================================

/**
 * Comparison of expected vs actual workout
 */
export interface WorkoutEvaluation {
  workoutId: string;
  date: string;

  // Overall assessment
  overallAssessment: 'exceeded' | 'met' | 'below' | 'mixed';

  // Per-exercise breakdown
  exerciseComparisons: ExerciseComparison[];

  // Coach insights
  progressNotes: string[];
  adjustmentSuggestions: string[];
  nextSessionGuidance: string;
}

export interface ExerciseComparison {
  exerciseId: string;
  exerciseName: string;

  expected: {
    sets: number;
    reps: string;
    load?: number;
    rpe?: number;
  };

  actual: {
    sets: number;
    avgReps: number;
    avgLoad?: number;
    avgRPE?: number;
    totalVolume: number;
  };

  assessment: 'progressed' | 'maintained' | 'regressed' | 'skipped';
  note?: string;
}

// ============================================================================
// COACH CONTEXT (Extended)
// ============================================================================

/**
 * Full context passed to coach for any interaction
 */
export interface ExtendedCoachContext {
  // User profile
  profile: {
    userId: string;
    trainingExperience?: string;
    primaryGoal?: string;
    recoverySpeed?: string;
    totalWorkoutsLogged?: number;
  } | null;

  // Intake state
  intakeState?: IntakeState;
  intakeComplete: boolean;

  // Current training block
  currentBlock?: {
    id: string;
    name: string;
    week: number;
    totalWeeks: number;
    phase?: string;
  } | null;

  // Today's state
  todayReadiness?: {
    score: number;
    sleep: number;
    soreness: number;
    stress: number;
  } | null;

  // History analysis
  historyAnalysis?: HistoryAnalysis;

  // Phase detection
  detectedPhase?: PhaseDetection;

  // Recent data
  recentWorkouts: {
    id: string;
    date: string;
    focus: string;
    completed: boolean;
    exerciseCount: number;
    totalVolume?: number;
  }[];

  // Upcoming workout (if scheduled)
  upcomingWorkout?: {
    id: string;
    focus: string;
    exercises: { name: string; sets: number; reps?: string }[];
  } | null;

  // Recent PRs
  recentPRs: {
    exerciseName: string;
    type: string;
    value: number;
    date: string;
  }[];

  // Active goals
  activeGoals: {
    description: string;
    targetValue: number;
    currentValue?: number;
    targetDate?: string;
  }[];

  // Movement memory for key exercises
  movementMemory: {
    exerciseName: string;
    lastWeight?: number;
    lastReps?: number;
    trend: 'progressing' | 'stagnant' | 'regressing';
    confidence: ConfidenceLevel;
  }[];

  // Active disruptions
  activeDisruptions: Disruption[];

  // Concurrent training
  concurrentTraining?: {
    activities: string[];
    hoursPerWeek: number;
  };

  // Running schedule (for hybrid athletes)
  runningSchedule?: RunningSchedule;
}

// ============================================================================
// COACH MESSAGE EXTENSIONS
// ============================================================================

/**
 * Extended coach message with mode awareness
 */
export interface CoachMessageExtended {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;

  // Mode tracking
  mode?: CoachMode;

  // For intake messages
  intakeSection?: IntakeSection;

  // For action suggestions
  suggestedAction?: CoachAction;
  actionTaken?: boolean;

  // Context snapshot at message time
  contextSnapshot?: Partial<ExtendedCoachContext>;
}
