// Database types for Foundry Lab app
// These types are designed to match the Supabase PostgreSQL schema

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ExerciseModality = 'Strength' | 'Cardio' | 'Hybrid';
export type PrimaryMetric = 'Weight' | 'Watts' | 'Pace' | 'Distance';
export type RecordType = 'weight' | 'reps' | 'volume' | 'e1rm' | 'watts' | 'pace';
export type UnitsPreference = 'imperial' | 'metric';
export type WorkoutContext = 'building' | 'maintaining' | 'deloading' | 'testing' | 'unstructured';

// Core database types matching Supabase schema
export interface Database {
  public: {
    Tables: {
      exercises: {
        Row: {
          id: string;
          name: string;
          modality: ExerciseModality;
          primary_metric: PrimaryMetric;
          muscle_group: string;
          equipment: string | null;
          instructions: string | null;
          is_custom: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          modality?: ExerciseModality;
          primary_metric?: PrimaryMetric;
          muscle_group: string;
          equipment?: string | null;
          instructions?: string | null;
          is_custom?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          modality?: ExerciseModality;
          primary_metric?: PrimaryMetric;
          muscle_group?: string;
          equipment?: string | null;
          instructions?: string | null;
          is_custom?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      training_blocks: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          goal_prompt: string | null;
          description: string | null;
          start_date: string;
          duration_weeks: number;
          is_active: boolean;
          phase: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          goal_prompt?: string | null;
          description?: string | null;
          start_date: string;
          duration_weeks?: number;
          is_active?: boolean;
          phase?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          goal_prompt?: string | null;
          description?: string | null;
          start_date?: string;
          duration_weeks?: number;
          is_active?: boolean;
          phase?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      workouts: {
        Row: {
          id: string;
          block_id: string | null;
          user_id: string;
          week_number: number | null;
          day_number: number | null;
          focus: string;
          notes: string | null;
          scheduled_date: string | null;
          date_completed: string | null;
          duration_minutes: number | null;
          context: WorkoutContext;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          block_id?: string | null;
          user_id: string;
          week_number?: number | null;
          day_number?: number | null;
          focus: string;
          notes?: string | null;
          scheduled_date?: string | null;
          date_completed?: string | null;
          duration_minutes?: number | null;
          context?: WorkoutContext;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          block_id?: string | null;
          user_id?: string;
          week_number?: number | null;
          day_number?: number | null;
          focus?: string;
          notes?: string | null;
          scheduled_date?: string | null;
          date_completed?: string | null;
          duration_minutes?: number | null;
          context?: WorkoutContext;
          created_at?: string;
          updated_at?: string;
        };
      };
      workout_sets: {
        Row: {
          id: string;
          workout_id: string;
          exercise_id: string;
          set_order: number;
          target_reps: number | null;
          target_rpe: number | null;
          target_load: number | null;
          tempo: string | null;
          actual_weight: number | null;
          actual_reps: number | null;
          actual_rpe: number | null;
          avg_watts: number | null;
          avg_hr: number | null;
          duration_seconds: number | null;
          distance_meters: number | null;
          avg_pace: string | null;
          notes: string | null;
          is_warmup: boolean;
          is_pr: boolean;
          progression_type: string | null;
          previous_set_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workout_id: string;
          exercise_id: string;
          set_order: number;
          target_reps?: number | null;
          target_rpe?: number | null;
          target_load?: number | null;
          tempo?: string | null;
          actual_weight?: number | null;
          actual_reps?: number | null;
          actual_rpe?: number | null;
          avg_watts?: number | null;
          avg_hr?: number | null;
          duration_seconds?: number | null;
          distance_meters?: number | null;
          avg_pace?: string | null;
          notes?: string | null;
          is_warmup?: boolean;
          is_pr?: boolean;
          progression_type?: string | null;
          previous_set_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workout_id?: string;
          exercise_id?: string;
          set_order?: number;
          target_reps?: number | null;
          target_rpe?: number | null;
          target_load?: number | null;
          tempo?: string | null;
          actual_weight?: number | null;
          actual_reps?: number | null;
          actual_rpe?: number | null;
          avg_watts?: number | null;
          avg_hr?: number | null;
          duration_seconds?: number | null;
          distance_meters?: number | null;
          avg_pace?: string | null;
          notes?: string | null;
          is_warmup?: boolean;
          is_pr?: boolean;
          progression_type?: string | null;
          previous_set_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_profiles: {
        Row: {
          id: string;
          email: string | null;
          display_name: string | null;
          weight_kg: number | null;
          height_cm: number | null;
          date_of_birth: string | null;
          max_hr: number | null;
          ftp: number | null;
          units_preference: UnitsPreference;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          display_name?: string | null;
          weight_kg?: number | null;
          height_cm?: number | null;
          date_of_birth?: string | null;
          max_hr?: number | null;
          ftp?: number | null;
          units_preference?: UnitsPreference;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          display_name?: string | null;
          weight_kg?: number | null;
          height_cm?: number | null;
          date_of_birth?: string | null;
          max_hr?: number | null;
          ftp?: number | null;
          units_preference?: UnitsPreference;
          created_at?: string;
          updated_at?: string;
        };
      };
      personal_records: {
        Row: {
          id: string;
          user_id: string;
          exercise_id: string;
          workout_set_id: string | null;
          record_type: RecordType;
          value: number;
          unit: string;
          achieved_at: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          exercise_id: string;
          workout_set_id?: string | null;
          record_type: RecordType;
          value: number;
          unit: string;
          achieved_at: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          exercise_id?: string;
          workout_set_id?: string | null;
          record_type?: RecordType;
          value?: number;
          unit?: string;
          achieved_at?: string;
          notes?: string | null;
          created_at?: string;
        };
      };
      follows: {
        Row: {
          id: string;
          follower_id: string;
          following_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          follower_id: string;
          following_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          follower_id?: string;
          following_id?: string;
          created_at?: string;
        };
      };
      workout_posts: {
        Row: {
          id: string;
          workout_id: string;
          user_id: string;
          caption: string | null;
          is_public: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          workout_id: string;
          user_id: string;
          caption?: string | null;
          is_public?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          workout_id?: string;
          user_id?: string;
          caption?: string | null;
          is_public?: boolean;
          created_at?: string;
        };
      };
      post_likes: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          user_id?: string;
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      exercise_modality: ExerciseModality;
      primary_metric: PrimaryMetric;
      record_type: RecordType;
      units_preference: UnitsPreference;
    };
  };
}

// Convenience type aliases
export type Exercise = Database['public']['Tables']['exercises']['Row'];
export type ExerciseInsert = Database['public']['Tables']['exercises']['Insert'];
export type ExerciseUpdate = Database['public']['Tables']['exercises']['Update'];

export type TrainingBlock = Database['public']['Tables']['training_blocks']['Row'];
export type TrainingBlockInsert = Database['public']['Tables']['training_blocks']['Insert'];
export type TrainingBlockUpdate = Database['public']['Tables']['training_blocks']['Update'];

export type Workout = Database['public']['Tables']['workouts']['Row'];
export type WorkoutInsert = Database['public']['Tables']['workouts']['Insert'];
export type WorkoutUpdate = Database['public']['Tables']['workouts']['Update'];

export type WorkoutSet = Database['public']['Tables']['workout_sets']['Row'];
export type WorkoutSetInsert = Database['public']['Tables']['workout_sets']['Insert'];
export type WorkoutSetUpdate = Database['public']['Tables']['workout_sets']['Update'];

export type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
export type UserProfileInsert = Database['public']['Tables']['user_profiles']['Insert'];
export type UserProfileUpdate = Database['public']['Tables']['user_profiles']['Update'];

export type PersonalRecord = Database['public']['Tables']['personal_records']['Row'];
export type PersonalRecordInsert = Database['public']['Tables']['personal_records']['Insert'];
export type PersonalRecordUpdate = Database['public']['Tables']['personal_records']['Update'];

// Workout Template types (not in main Database interface yet)
export interface WorkoutTemplate {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  focus: string | null;
  exercises: WorkoutTemplateExercise[];
  estimated_duration: number | null;
  is_public: boolean;
  use_count: number;
  created_at: string;
  updated_at: string;
}

export interface WorkoutTemplateExercise {
  exercise_id: string;
  exercise_name?: string; // For display
  sets: number;
  target_reps?: number;
  target_rpe?: number;
  target_weight?: number;
  rest_seconds?: number;
}

export type WorkoutTemplateInsert = Omit<WorkoutTemplate, 'id' | 'created_at' | 'updated_at' | 'use_count'>;

// ============================================================================
// AI Coach System Types
// ============================================================================

export type ReadinessAdjustment = 'full' | 'moderate' | 'light' | 'rest';
export type TrainingExperience = 'beginner' | 'intermediate' | 'advanced';
export type TrainingGoal = 'strength' | 'hypertrophy' | 'athletic' | 'general' | 'powerlifting' | 'bodybuilding';
export type TrainingPhase = 'accumulation' | 'intensification' | 'realization' | 'deload' | 'maintenance';
export type RecoverySpeed = 'fast' | 'normal' | 'slow';
export type AdjustmentTrigger = 'readiness' | 'time_constraint' | 'pain_report' | 'missed_workout' | 'user_request';
export type AdjustmentType = 'intensity_reduction' | 'volume_reduction' | 'exercise_swap' | 'workout_merge' | 'rest_day' | 'deload';
export type AdjustmentFeedback = 'too_easy' | 'just_right' | 'too_hard' | 'skipped';

export interface DailyReadiness {
  id: string;
  user_id: string;
  check_in_date: string;
  sleep_quality: 1 | 2 | 3 | 4 | 5;
  muscle_soreness: 1 | 2 | 3 | 4 | 5;
  stress_level: 1 | 2 | 3 | 4 | 5;
  notes: string | null;
  readiness_score: number;
  suggested_adjustment: ReadinessAdjustment | null;
  adjustment_applied: ReadinessAdjustment | 'skipped' | null;
  created_at: string;
  updated_at: string;
}

export interface DailyReadinessInsert {
  user_id?: string; // Will be set by RLS
  check_in_date?: string;
  sleep_quality: 1 | 2 | 3 | 4 | 5;
  muscle_soreness: 1 | 2 | 3 | 4 | 5;
  stress_level: 1 | 2 | 3 | 4 | 5;
  notes?: string | null;
  adjustment_applied?: ReadinessAdjustment | 'skipped' | null;
}

export interface TrainingProfile {
  id: string;
  user_id: string;
  training_experience: TrainingExperience | null;
  primary_goal: TrainingGoal | null;
  typical_weekly_days: number | null;
  average_session_minutes: number | null;
  avg_sleep_quality: number | null;
  avg_soreness_level: number | null;
  avg_stress_level: number | null;
  recovery_speed: RecoverySpeed | null;
  preferred_exercises: string[];
  avoided_exercises: string[];
  preferred_rep_ranges: Record<string, string>;
  available_equipment: string[];
  current_training_phase: TrainingPhase | null;
  weeks_in_current_phase: number;
  annual_goals: AnnualGoal[];
  competition_dates: string[];
  total_workouts_logged: number;
  total_volume_logged: number;
  check_ins_completed: number;
  created_at: string;
  updated_at: string;
}

export interface AnnualGoal {
  goal: string;
  targetDate?: string;
  priority: 'high' | 'medium' | 'low';
}

export interface TrainingProfileUpdate {
  training_experience?: TrainingExperience | null;
  primary_goal?: TrainingGoal | null;
  typical_weekly_days?: number | null;
  available_equipment?: string[];
  current_training_phase?: TrainingPhase | null;
  annual_goals?: AnnualGoal[];
  competition_dates?: string[];
}

export interface WorkoutAdjustment {
  id: string;
  user_id: string;
  workout_id: string | null;
  readiness_id: string | null;
  trigger_type: AdjustmentTrigger;
  trigger_context: Record<string, unknown> | null;
  adjustment_type: AdjustmentType;
  adjustment_details: AdjustmentDetails;
  accepted: boolean | null;
  modified: boolean;
  user_override: Record<string, unknown> | null;
  workout_completed: boolean | null;
  user_feedback: AdjustmentFeedback | null;
  created_at: string;
}

export interface AdjustmentDetails {
  message: string;
  changes: AdjustmentChange[];
}

export interface AdjustmentChange {
  type: 'intensity' | 'volume' | 'exercise' | 'rest';
  original?: string | number;
  suggested?: string | number;
  reason: string;
}

// Computed readiness analysis
export interface ReadinessAnalysis {
  score: number; // 0-100
  suggestion: ReadinessAdjustment;
  message: string;
  details: {
    sleepImpact: 'positive' | 'neutral' | 'negative';
    sorenessImpact: 'positive' | 'neutral' | 'negative';
    stressImpact: 'positive' | 'neutral' | 'negative';
  };
  recommendations: string[];
}

// Extended types with relations
export interface WorkoutWithSets extends Workout {
  workout_sets: (WorkoutSet & { exercise: Exercise })[];
}

export interface WorkoutSetWithExercise extends WorkoutSet {
  exercise: Exercise;
}

export interface WorkoutSetWithWorkout extends WorkoutSet {
  workout: Workout;
}

export interface TrainingBlockWithWorkouts extends TrainingBlock {
  workouts: Workout[];
}

// Types for AI Block Builder response
export interface AIGeneratedBlock {
  name: string;
  description: string;
  duration_weeks: number;
  workouts: AIGeneratedWorkout[];
}

export interface AIGeneratedWorkout {
  week_number: number;
  day_number: number;
  focus: string;
  exercises: AIGeneratedExercise[];
}

export interface AIGeneratedExercise {
  exercise_name: string;
  exercise_id?: string;
  sets: AIGeneratedSet[];
}

export interface AIGeneratedSet {
  set_order: number;
  target_reps?: number;
  target_rpe?: number;
  target_load?: number;
  tempo?: string;
  duration_seconds?: number;
  notes?: string;
}

// Type guards
export function isStrengthExercise(exercise: Exercise): boolean {
  return exercise.modality === 'Strength' || exercise.modality === 'Hybrid';
}

export function isCardioExercise(exercise: Exercise): boolean {
  return exercise.modality === 'Cardio' || exercise.modality === 'Hybrid';
}

// Utility functions
export function calculateE1RM(weight: number, reps: number): number {
  if (reps === 1) return weight;
  if (reps <= 0 || weight <= 0) return 0;
  return Math.round(weight * (1 + reps / 30));
}

export function calculateVolume(weight: number, reps: number, sets: number = 1): number {
  return weight * reps * sets;
}

// ============================================================================
// AI COACH CONVERSATION TYPES
// ============================================================================

export type ConversationContextType = 'general' | 'workout' | 'block_planning' | 'recovery' | 'technique';
export type MessageRole = 'user' | 'assistant' | 'system';
export type QuickActionType = 'adjust_intensity' | 'swap_exercise' | 'add_deload' | 'modify_volume' | 'change_split' | 'custom';
export type SuggestedActionType = 'adjust_workout' | 'swap_exercise' | 'modify_block' | 'add_note' | 'set_goal' | 'schedule_deload';

export interface CoachConversation {
  id: string;
  user_id: string;
  title: string | null;
  context_type: ConversationContextType | null;
  workout_id: string | null;
  block_id: string | null;
  is_active: boolean;
  message_count: number;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
}

export interface CoachMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: MessageRole;
  content: string;
  context_snapshot: ContextSnapshot | null;
  suggested_action: SuggestedAction | null;
  action_taken: boolean;
  created_at: string;
}

export interface ContextSnapshot {
  readiness?: {
    score: number;
    sleep: number;
    soreness: number;
    stress: number;
  };
  currentBlock?: {
    name: string;
    week: number;
    phase: string;
  };
  recentWorkouts?: {
    date: string;
    focus: string;
    completed: boolean;
  }[];
  upcomingWorkout?: {
    focus: string;
    exercises: string[];
  };
  prs?: {
    exercise: string;
    weight: number;
    reps: number;
  }[];
}

export interface SuggestedAction {
  type: SuggestedActionType;
  label: string;
  details: Record<string, unknown>;
  applied?: boolean;
}

export interface CoachQuickAction {
  id: string;
  user_id: string;
  action_type: QuickActionType;
  label: string;
  prompt_template: string;
  times_used: number;
  last_used_at: string | null;
  is_system_default: boolean;
  created_at: string;
}

// Chat UI types
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  suggestedAction?: SuggestedAction;
}

export interface CoachContext {
  profile: TrainingProfile | null;
  currentBlock: TrainingBlock | null;
  todayReadiness: DailyReadiness | null;
  recentWorkouts: Workout[];
  upcomingWorkout: WorkoutWithSets | null;
  recentPRs: PersonalRecord[];
  goals: Goal[];
}

// ============================================================================
// ANNUAL PERIODIZATION TYPES
// ============================================================================

export type EventType = 'powerlifting_meet' | 'weightlifting_meet' | 'strongman' | 'crossfit_comp' | 'sport_season' | 'photo_shoot' | 'vacation' | 'other';
export type EventPriority = 'primary' | 'secondary' | 'tune_up';
export type EventStatus = 'upcoming' | 'completed' | 'cancelled';
export type BlockType = 'accumulation' | 'intensification' | 'realization' | 'peaking' | 'deload' | 'transition' | 'base_building' | 'hypertrophy' | 'strength' | 'power';
export type VolumeLevel = 'low' | 'moderate' | 'high' | 'very_high';
export type PlannedBlockStatus = 'planned' | 'active' | 'completed' | 'skipped';
export type TransitionTrigger = 'scheduled' | 'user_initiated' | 'ai_recommended' | 'competition_prep' | 'recovery_needed';

export interface AnnualPlan {
  id: string;
  user_id: string;
  name: string;
  year: number;
  description: string | null;
  primary_goal: TrainingGoal | null;
  secondary_goals: string[];
  target_metrics: TargetMetrics;
  preferred_block_length: number;
  deload_frequency: number;
  competition_focus: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TargetMetrics {
  squat?: number;
  bench?: number;
  deadlift?: number;
  bodyweight?: number;
  [key: string]: number | undefined;
}

export interface Competition {
  id: string;
  user_id: string;
  annual_plan_id: string | null;
  name: string;
  event_type: EventType;
  event_date: string;
  priority: EventPriority;
  target_lifts: TargetMetrics | null;
  weight_class: string | null;
  status: EventStatus;
  result_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlannedBlock {
  id: string;
  user_id: string;
  annual_plan_id: string | null;
  name: string;
  description: string | null;
  block_type: BlockType;
  planned_start_date: string;
  duration_weeks: number;
  primary_focus: 'strength' | 'hypertrophy' | 'power' | 'conditioning' | 'technique' | 'recovery' | null;
  target_metrics: TargetMetrics | null;
  volume_level: VolumeLevel;
  intensity_level: VolumeLevel;
  training_block_id: string | null;
  sequence_order: number;
  depends_on_competition: string | null;
  status: PlannedBlockStatus;
  created_at: string;
  updated_at: string;
}

export interface PhaseTransition {
  id: string;
  user_id: string;
  from_phase: TrainingPhase | null;
  to_phase: TrainingPhase;
  from_block_id: string | null;
  to_block_id: string | null;
  trigger_type: TransitionTrigger;
  trigger_reason: string | null;
  recommendation_context: Record<string, unknown> | null;
  alternatives_considered: BlockRecommendation[] | null;
  accepted: boolean | null;
  user_modification: string | null;
  transition_date: string;
  created_at: string;
}

export interface BlockRecommendation {
  block_type: BlockType;
  duration_weeks: number;
  reasoning: string;
  confidence: number;
  volume_level: VolumeLevel;
  intensity_level: VolumeLevel;
  primary_focus: string;
}

export interface AnnualOverview {
  plan_id: string;
  user_id: string;
  year: number;
  plan_name: string;
  primary_goal: TrainingGoal | null;
  is_active: boolean;
  competition_count: number;
  next_competition: {
    id: string;
    name: string;
    date: string;
    days_until: number;
  } | null;
  planned_blocks_count: number;
  current_block: {
    id: string;
    name: string;
    type: BlockType;
    weeks_remaining: number;
  } | null;
  next_block: {
    id: string;
    name: string;
    type: BlockType;
    starts_in_days: number;
  } | null;
}

// Calendar visualization types
export interface CalendarMonth {
  year: number;
  month: number;
  weeks: CalendarWeek[];
}

export interface CalendarWeek {
  weekNumber: number;
  startDate: string;
  endDate: string;
  block?: PlannedBlock;
  competition?: Competition;
  phase?: TrainingPhase;
}

export interface PeriodizationTimeline {
  startDate: string;
  endDate: string;
  blocks: PlannedBlock[];
  competitions: Competition[];
  currentWeek: number;
  totalWeeks: number;
}
