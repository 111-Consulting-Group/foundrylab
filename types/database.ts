// Database types for Forged fitness app
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
