/**
 * Fluid Session Hooks
 *
 * Data fetching and persistence for the Fluid Session feature.
 * Handles workout creation, set saving, and movement memory retrieval.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/useAppStore';
import { workoutKeys } from './useWorkouts';
import type {
  Exercise,
  Workout,
  WorkoutInsert,
  WorkoutSet,
  WorkoutSetInsert,
  MovementMemory,
  DailyReadiness,
  WorkoutContext,
} from '@/types/database';

// ============================================================================
// TYPES
// ============================================================================

export interface FluidSessionExerciseData {
  exercise: Exercise;
  movementMemory: MovementMemory | null;
}

export interface CreateFluidWorkoutParams {
  focus: string;
  context?: WorkoutContext;
  blockId?: string;
  weekNumber?: number;
  dayNumber?: number;
}

export interface SaveFluidSetParams {
  workoutId: string;
  exerciseId: string;
  setOrder: number;
  targetReps?: number | null;
  targetRpe?: number | null;
  targetLoad?: number | null;
  actualWeight: number;
  actualReps: number;
  actualRpe: number;
  isWarmup?: boolean;
  notes?: string | null;
}

// ============================================================================
// FETCH MOVEMENT MEMORY FOR MULTIPLE EXERCISES
// ============================================================================

export function useFluidSessionData(exerciseIds: string[]) {
  const userId = useAppStore((state) => state.userId);

  return useQuery({
    queryKey: ['fluidSessionData', exerciseIds],
    queryFn: async (): Promise<Map<string, MovementMemory>> => {
      if (!userId || exerciseIds.length === 0) {
        return new Map();
      }

      // Fetch movement memory for all exercises in one query
      const { data, error } = await supabase
        .from('movement_memory')
        .select('*')
        .eq('user_id', userId)
        .in('exercise_id', exerciseIds);

      if (error) {
        // Table might not exist yet - return empty map
        if (error.code === '42P01') {
          console.log('movement_memory table not found, returning empty data');
          return new Map();
        }
        throw error;
      }

      // Build map of exercise_id -> MovementMemory
      const memoryMap = new Map<string, MovementMemory>();
      (data || []).forEach((mem: any) => {
        memoryMap.set(mem.exercise_id, mem as MovementMemory);
      });

      return memoryMap;
    },
    enabled: !!userId && exerciseIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ============================================================================
// FETCH TODAY'S READINESS
// ============================================================================

export function useTodayReadiness() {
  const userId = useAppStore((state) => state.userId);
  const today = new Date().toISOString().split('T')[0];

  return useQuery({
    queryKey: ['dailyReadiness', today],
    queryFn: async (): Promise<DailyReadiness | null> => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from('daily_readiness')
        .select('*')
        .eq('user_id', userId)
        .eq('check_in_date', today)
        .maybeSingle();

      if (error) {
        // Table might not exist
        if (error.code === '42P01') {
          return null;
        }
        throw error;
      }

      return data as DailyReadiness | null;
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// ============================================================================
// CREATE WORKOUT FOR FLUID SESSION
// ============================================================================

export function useCreateFluidWorkout() {
  const queryClient = useQueryClient();
  const userId = useAppStore((state) => state.userId);

  return useMutation({
    mutationFn: async (params: CreateFluidWorkoutParams): Promise<Workout> => {
      if (!userId) throw new Error('User not authenticated');

      const workoutInsert: WorkoutInsert = {
        user_id: userId,
        focus: params.focus,
        context: params.context || 'building',
        block_id: params.blockId || null,
        week_number: params.weekNumber || null,
        day_number: params.dayNumber || null,
        // Don't set date_completed yet - that happens when session ends
      };

      const { data, error } = await supabase
        .from('workouts')
        .insert(workoutInsert as any)
        .select()
        .single();

      if (error) throw error;
      return data as Workout;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workoutKeys.incomplete() });
    },
  });
}

// ============================================================================
// SAVE SET TO DATABASE
// ============================================================================

export function useSaveFluidSet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SaveFluidSetParams): Promise<WorkoutSet> => {
      const setInsert: WorkoutSetInsert = {
        workout_id: params.workoutId,
        exercise_id: params.exerciseId,
        set_order: params.setOrder,
        target_reps: params.targetReps ?? null,
        target_rpe: params.targetRpe ?? null,
        target_load: params.targetLoad ?? null,
        actual_weight: params.actualWeight,
        actual_reps: params.actualReps,
        actual_rpe: params.actualRpe,
        is_warmup: params.isWarmup || false,
        notes: params.notes ?? null,
        segment_type: 'work',
      };

      const { data, error } = await supabase
        .from('workout_sets')
        .insert(setInsert as any)
        .select()
        .single();

      if (error) throw error;
      return data as WorkoutSet;
    },
    onSuccess: (data) => {
      // Invalidate workout detail and movement memory
      queryClient.invalidateQueries({ queryKey: workoutKeys.detail(data.workout_id) });
      queryClient.invalidateQueries({ queryKey: ['movementMemory', data.exercise_id] });
      queryClient.invalidateQueries({ queryKey: ['fluidSessionData'] });
    },
  });
}

// ============================================================================
// COMPLETE FLUID SESSION (Mark workout as done)
// ============================================================================

export function useCompleteFluidSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workoutId, durationMinutes }: { workoutId: string; durationMinutes?: number }): Promise<Workout> => {
      const { data, error } = await (supabase
        .from('workouts') as any)
        .update({
          date_completed: new Date().toISOString(),
          duration_minutes: durationMinutes || null,
        })
        .eq('id', workoutId)
        .select()
        .single();

      if (error) throw error;
      return data as Workout;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workoutKeys.all });
      queryClient.invalidateQueries({ queryKey: ['movementMemory'] });
      queryClient.invalidateQueries({ queryKey: ['fluidSessionData'] });
    },
  });
}

// ============================================================================
// FETCH EXISTING WORKOUT FOR FLUID SESSION
// ============================================================================

export function useWorkoutForFluidSession(workoutId: string | null) {
  return useQuery({
    queryKey: ['fluidWorkout', workoutId],
    queryFn: async () => {
      if (!workoutId) return null;

      const { data, error } = await supabase
        .from('workouts')
        .select(`
          *,
          workout_sets(
            *,
            exercise:exercises(*)
          )
        `)
        .eq('id', workoutId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!workoutId,
  });
}
