/**
 * Zod Schemas for Database Types
 * 
 * Runtime validation schemas for Supabase responses.
 * Use these instead of type assertions (as Type) for better type safety.
 * 
 * Note: This is a foundation - gradually migrate type assertions to use these schemas.
 */

import { z } from 'zod';

// Exercise schema
export const ExerciseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  modality: z.enum(['Strength', 'Cardio', 'Hybrid']),
  primary_metric: z.enum(['Weight', 'Watts', 'Pace', 'Distance']),
  muscle_group: z.string(),
  equipment: z.string().nullable(),
  instructions: z.string().nullable(),
  is_custom: z.boolean(),
  created_by: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

// Workout schema (base)
export const WorkoutSchema = z.object({
  id: z.string().uuid(),
  block_id: z.string().uuid().nullable(),
  user_id: z.string().uuid(),
  week_number: z.number().int().nullable(),
  day_number: z.number().int().nullable(),
  focus: z.string(),
  notes: z.string().nullable(),
  scheduled_date: z.string().nullable(),
  date_completed: z.string().nullable(),
  duration_minutes: z.number().int().nullable(),
  context: z.enum(['building', 'maintaining', 'deloading', 'testing', 'unstructured']),
  created_at: z.string(),
  updated_at: z.string(),
});

// WorkoutSet schema (base)
export const WorkoutSetSchema = z.object({
  id: z.string().uuid(),
  workout_id: z.string().uuid(),
  exercise_id: z.string().uuid(),
  set_order: z.number().int(),
  target_reps: z.number().int().nullable(),
  target_rpe: z.number().nullable(),
  target_load: z.number().nullable(),
  tempo: z.string().nullable(),
  actual_weight: z.number().nullable(),
  actual_reps: z.number().int().nullable(),
  actual_rpe: z.number().nullable(),
  avg_watts: z.number().nullable(),
  avg_hr: z.number().int().nullable(),
  duration_seconds: z.number().int().nullable(),
  distance_meters: z.number().nullable(),
  avg_pace: z.string().nullable(),
  notes: z.string().nullable(),
  is_warmup: z.boolean(),
  is_pr: z.boolean(),
  progression_type: z.string().nullable(),
  previous_set_id: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

// WorkoutSet with Exercise (nested)
export const WorkoutSetWithExerciseSchema = WorkoutSetSchema.extend({
  exercise: ExerciseSchema,
});

// WorkoutWithSets schema (nested)
export const WorkoutWithSetsSchema = WorkoutSchema.extend({
  workout_sets: z.array(WorkoutSetWithExerciseSchema),
});

// TrainingBlock schema
export const TrainingBlockSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string(),
  goal_prompt: z.string().nullable(),
  description: z.string().nullable(),
  start_date: z.string(),
  duration_weeks: z.number().int(),
  is_active: z.boolean(),
  phase: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

// UserProfile schema
export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().nullable(),
  display_name: z.string().nullable(),
  weight_kg: z.number().nullable(),
  height_cm: z.number().int().nullable(),
  date_of_birth: z.string().nullable(),
  max_hr: z.number().int().nullable(),
  ftp: z.number().int().nullable(),
  units_preference: z.enum(['imperial', 'metric']),
  created_at: z.string(),
  updated_at: z.string(),
});

// Helper functions for safe parsing
export function safeParseWorkout(data: unknown) {
  return WorkoutSchema.safeParse(data);
}

export function safeParseWorkoutWithSets(data: unknown) {
  return WorkoutWithSetsSchema.safeParse(data);
}

export function safeParseExercise(data: unknown) {
  return ExerciseSchema.safeParse(data);
}

export function safeParseTrainingBlock(data: unknown) {
  return TrainingBlockSchema.safeParse(data);
}

export function safeParseUserProfile(data: unknown) {
  return UserProfileSchema.safeParse(data);
}

// Parse with error throwing (for use in query functions)
export function parseWorkoutWithSets(data: unknown) {
  return WorkoutWithSetsSchema.parse(data);
}

export function parseExercise(data: unknown) {
  return ExerciseSchema.parse(data);
}

export function parseTrainingBlock(data: unknown) {
  return TrainingBlockSchema.parse(data);
}