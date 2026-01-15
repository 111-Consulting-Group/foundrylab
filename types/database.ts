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
export type SegmentType = 'warmup' | 'work' | 'recovery' | 'cooldown';

// Training Intelligence types
export type ConfidenceLevel = 'low' | 'medium' | 'high';
export type PerformanceTrend = 'progressing' | 'stagnant' | 'regressing';
export type PatternType = 'training_split' | 'exercise_pairing' | 'rep_range_preference' | 'training_day';
export type AchievementType = 'pr' | 'streak' | 'block_complete' | 'consistency' | 'volume_milestone';

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
          status: 'approved' | 'pending' | 'rejected';
          aliases: string[];
          merged_into: string | null;
          usage_count: number;
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
          status?: 'approved' | 'pending' | 'rejected';
          aliases?: string[];
          merged_into?: string | null;
          usage_count?: number;
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
          status?: 'approved' | 'pending' | 'rejected';
          aliases?: string[];
          merged_into?: string | null;
          usage_count?: number;
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
          segment_type: SegmentType;
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
          segment_type?: SegmentType;
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
          segment_type?: SegmentType;
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
      movement_memory: {
        Row: {
          id: string;
          user_id: string;
          exercise_id: string;
          last_workout_id: string | null;
          last_date: string | null;
          last_weight: number | null;
          last_reps: number | null;
          last_rpe: number | null;
          last_sets: number | null;
          last_context: WorkoutContext | null;
          last_total_volume: number | null;
          exposure_count: number;
          first_logged: string | null;
          avg_rpe: number | null;
          typical_rep_min: number | null;
          typical_rep_max: number | null;
          total_lifetime_volume: number;
          pr_weight: number | null;
          pr_weight_date: string | null;
          pr_weight_reps: number | null;
          pr_reps: number | null;
          pr_reps_weight: number | null;
          pr_reps_date: string | null;
          pr_e1rm: number | null;
          pr_e1rm_date: string | null;
          pr_volume: number | null;
          pr_volume_date: string | null;
          confidence_level: ConfidenceLevel;
          trend: PerformanceTrend;
          days_since_last: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          exercise_id: string;
          last_workout_id?: string | null;
          last_date?: string | null;
          last_weight?: number | null;
          last_reps?: number | null;
          last_rpe?: number | null;
          last_sets?: number | null;
          last_context?: WorkoutContext | null;
          last_total_volume?: number | null;
          exposure_count?: number;
          first_logged?: string | null;
          avg_rpe?: number | null;
          typical_rep_min?: number | null;
          typical_rep_max?: number | null;
          total_lifetime_volume?: number;
          pr_weight?: number | null;
          pr_weight_date?: string | null;
          pr_weight_reps?: number | null;
          pr_reps?: number | null;
          pr_reps_weight?: number | null;
          pr_reps_date?: string | null;
          pr_e1rm?: number | null;
          pr_e1rm_date?: string | null;
          pr_volume?: number | null;
          pr_volume_date?: string | null;
          confidence_level?: ConfidenceLevel;
          trend?: PerformanceTrend;
          days_since_last?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          exercise_id?: string;
          last_workout_id?: string | null;
          last_date?: string | null;
          last_weight?: number | null;
          last_reps?: number | null;
          last_rpe?: number | null;
          last_sets?: number | null;
          last_context?: WorkoutContext | null;
          last_total_volume?: number | null;
          exposure_count?: number;
          first_logged?: string | null;
          avg_rpe?: number | null;
          typical_rep_min?: number | null;
          typical_rep_max?: number | null;
          total_lifetime_volume?: number;
          pr_weight?: number | null;
          pr_weight_date?: string | null;
          pr_weight_reps?: number | null;
          pr_reps?: number | null;
          pr_reps_weight?: number | null;
          pr_reps_date?: string | null;
          pr_e1rm?: number | null;
          pr_e1rm_date?: string | null;
          pr_volume?: number | null;
          pr_volume_date?: string | null;
          confidence_level?: ConfidenceLevel;
          trend?: PerformanceTrend;
          days_since_last?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      detected_patterns: {
        Row: {
          id: string;
          user_id: string;
          pattern_type: PatternType;
          pattern_name: string | null;
          pattern_data: Json;
          confidence: number;
          confirmation_count: number;
          first_detected: string;
          last_confirmed: string;
          offered_structure: boolean;
          offered_at: string | null;
          structure_accepted: boolean | null;
          accepted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          pattern_type: PatternType;
          pattern_name?: string | null;
          pattern_data?: Json;
          confidence?: number;
          confirmation_count?: number;
          first_detected?: string;
          last_confirmed?: string;
          offered_structure?: boolean;
          offered_at?: string | null;
          structure_accepted?: boolean | null;
          accepted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          pattern_type?: PatternType;
          pattern_name?: string | null;
          pattern_data?: Json;
          confidence?: number;
          confirmation_count?: number;
          first_detected?: string;
          last_confirmed?: string;
          offered_structure?: boolean;
          offered_at?: string | null;
          structure_accepted?: boolean | null;
          accepted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_achievements: {
        Row: {
          id: string;
          user_id: string;
          achievement_type: AchievementType;
          label: string;
          description: string | null;
          icon: string | null;
          achievement_data: Json;
          workout_id: string | null;
          exercise_id: string | null;
          block_id: string | null;
          is_active: boolean;
          earned_at: string;
          is_featured: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          achievement_type: AchievementType;
          label: string;
          description?: string | null;
          icon?: string | null;
          achievement_data?: Json;
          workout_id?: string | null;
          exercise_id?: string | null;
          block_id?: string | null;
          is_active?: boolean;
          earned_at?: string;
          is_featured?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          achievement_type?: AchievementType;
          label?: string;
          description?: string | null;
          icon?: string | null;
          achievement_data?: Json;
          workout_id?: string | null;
          exercise_id?: string | null;
          block_id?: string | null;
          is_active?: boolean;
          earned_at?: string;
          is_featured?: boolean;
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
      segment_type: SegmentType;
      confidence_level: ConfidenceLevel;
      performance_trend: PerformanceTrend;
      pattern_type: PatternType;
      achievement_type: AchievementType;
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

// Training Intelligence type aliases
export type MovementMemory = Database['public']['Tables']['movement_memory']['Row'];
export type MovementMemoryInsert = Database['public']['Tables']['movement_memory']['Insert'];
export type MovementMemoryUpdate = Database['public']['Tables']['movement_memory']['Update'];

export type DetectedPattern = Database['public']['Tables']['detected_patterns']['Row'];
export type DetectedPatternInsert = Database['public']['Tables']['detected_patterns']['Insert'];
export type DetectedPatternUpdate = Database['public']['Tables']['detected_patterns']['Update'];

export type UserAchievement = Database['public']['Tables']['user_achievements']['Row'];
export type UserAchievementInsert = Database['public']['Tables']['user_achievements']['Insert'];
export type UserAchievementUpdate = Database['public']['Tables']['user_achievements']['Update'];

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
export type GoalType = 'e1rm' | 'weight' | 'reps' | 'volume' | 'watts' | 'pace' | 'distance' | 'custom';
export type GoalStatus = 'active' | 'achieved' | 'abandoned' | 'paused';

export interface Goal {
  id: string;
  user_id: string;
  exercise_id: string | null;
  exercise_name?: string; // Joined from exercises table
  goal_type: GoalType;
  target_value: number;
  target_unit: string;
  description: string | null;
  starting_value: number | null;
  current_value: number | null;
  target_date: string | null;
  status: GoalStatus;
  achieved_at: string | null;
  created_at: string;
  updated_at: string;
}

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

// ============================================================================
// TRAINING INTELLIGENCE TYPES
// ============================================================================

/**
 * Next Time Suggestion - Generated recommendation for the next session
 * Core to the "Every movement has memory" principle
 */
export interface NextTimeSuggestion {
  exercise_id: string;
  exercise_name: string;

  // Last Performance
  last_performance: {
    weight: number | null;
    reps: number | null;
    sets: number | null;
    rpe: number | null;
    date: string | null;
    context: WorkoutContext | null;
  };

  // Recommendation
  recommendation: {
    weight: number;
    reps: number;
    target_rpe: number;
  };

  // Meta
  confidence: ConfidenceLevel;
  trend: PerformanceTrend;
  reasoning: string;
  exposure_count: number;
  pr_e1rm: number | null;

  // Optional alerts
  alerts?: NextTimeAlert[];
}

export interface NextTimeAlert {
  type: 'missed_session' | 'rpe_creep' | 'regression' | 'plateau';
  message: string;
  suggested_action: string;
}

/**
 * Movement Memory with Exercise info - for display purposes
 */
export interface MovementMemoryWithExercise extends MovementMemory {
  exercise: Exercise;
}

/**
 * Pattern Data structures for detected_patterns.pattern_data JSONB field
 */
export interface TrainingSplitPatternData {
  splits: string[];  // e.g., ["Push", "Pull", "Legs"]
  days_per_week: number;
  typical_sequence?: string[];  // e.g., ["Push", "Pull", "Legs", "Push", "Pull", "Legs"]
}

export interface ExercisePairingPatternData {
  exercises: string[];  // Exercise names that appear together
  exercise_ids: string[];
  co_occurrence: number;  // 0-1, how often they appear together
}

export interface RepRangePreferenceData {
  exercise_id: string;
  exercise_name: string;
  preferred_min: number;
  preferred_max: number;
  sample_size: number;
}

export interface TrainingDayPatternData {
  focus: string;  // e.g., "Legs"
  preferred_days: number[];  // 0-6, Sunday-Saturday
  preferred_day_names: string[];  // ["Monday", "Thursday"]
  consistency: number;  // 0-1
}

/**
 * Achievement Data structures for user_achievements.achievement_data JSONB field
 */
export interface StreakAchievementData {
  days: number;
  start_date: string;
  current: boolean;
}

export interface ConsistencyAchievementData {
  rate: number;  // 0-1
  period: 'week' | 'month' | 'block';
  workouts_completed: number;
  workouts_planned: number;
}

export interface VolumeMilestoneData {
  total_lbs: number;
  total_kg: number;
}

export interface BlockCompleteData {
  block_id: string;
  block_name: string;
  duration_weeks: number;
  completion_rate: number;
}

export interface PRAchievementData {
  exercise_id: string;
  exercise_name: string;
  record_type: RecordType;
  value: number;
  previous_value: number | null;
  improvement: number | null;
}

/**
 * Key Lift for social feed - enhanced workout post display
 */
export interface KeyLift {
  exercise_id: string;
  exercise_name: string;
  weight: number;
  reps: number;
  is_pr: boolean;
  progression?: {
    type: 'weight_increase' | 'rep_increase' | 'e1rm_increase' | 'matched' | 'regressed';
    delta?: number;
    delta_label: string;  // "+10 lbs", "+2 reps"
  };
}

/**
 * Goal Context for social feed display
 */
export interface GoalContext {
  type: TrainingGoal;
  block_name?: string;
  phase?: TrainingPhase;
}

/**
 * Enhanced Workout Post with computed fields
 */
export interface EnhancedWorkoutPost {
  id: string;
  workout_id: string;
  user_id: string;
  caption: string | null;
  is_public: boolean;
  created_at: string;

  // Enhanced computed fields
  workout_summary: {
    focus: string;
    duration_minutes: number | null;
    context: WorkoutContext;
    exercise_count: number;
  };

  key_lifts: KeyLift[];
  goal_context?: GoalContext;
  achievements?: {
    type: AchievementType;
    label: string;
    icon: string;
  }[];

  // User info (joined)
  user?: {
    id: string;
    display_name: string | null;
  };
}

/**
 * Confidence calculation factors
 */
export interface ConfidenceFactors {
  exposureCount: number;
  recency: number;  // days since last
  consistency: number;  // variance in performance
  rpeReporting: number;  // 0-1, ratio of sets with RPE logged
}

/**
 * Calculate confidence level from factors
 */
export function calculateConfidenceLevel(factors: ConfidenceFactors): ConfidenceLevel {
  let score = 0;

  // Exposure weight (max 40 points)
  if (factors.exposureCount >= 5) score += 40;
  else if (factors.exposureCount >= 3) score += 25;
  else score += factors.exposureCount * 5;

  // Recency weight (max 25 points)
  if (factors.recency <= 7) score += 25;
  else if (factors.recency <= 14) score += 15;
  else if (factors.recency <= 28) score += 5;

  // Consistency weight (max 20 points)
  score += Math.max(0, 20 - (factors.consistency * 2));

  // RPE reporting weight (max 15 points)
  score += Math.round(factors.rpeReporting * 15);

  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

/**
 * Confidence badge display config
 */
export interface ConfidenceBadgeConfig {
  bg: string;
  text: string;
  label: string;
  tooltip: string;
}

export const CONFIDENCE_BADGE_CONFIG: Record<ConfidenceLevel, Omit<ConfidenceBadgeConfig, 'tooltip'>> = {
  low: {
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    label: 'Low Confidence',
  },
  medium: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-700',
    label: 'Suggested',
  },
  high: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    label: 'Recommended',
  },
};
