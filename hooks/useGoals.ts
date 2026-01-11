/**
 * Goals Hooks
 *
 * CRUD operations for fitness goals - track objectives like "Squat 405 by June"
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/useAppStore';
import type { Exercise } from '@/types/database';

// Types
export type GoalType = 'e1rm' | 'weight' | 'reps' | 'volume' | 'watts' | 'pace' | 'distance' | 'custom';
export type GoalStatus = 'active' | 'achieved' | 'abandoned' | 'paused';

export interface FitnessGoal {
  id: string;
  user_id: string;
  exercise_id: string | null;
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
  exercise?: Exercise | null;
}

export interface GoalInsert {
  exercise_id?: string | null;
  goal_type: GoalType;
  target_value: number;
  target_unit?: string;
  description?: string | null;
  starting_value?: number | null;
  current_value?: number | null;
  target_date?: string | null;
}

// Query keys
export const goalKeys = {
  all: ['goals'] as const,
  active: () => [...goalKeys.all, 'active'] as const,
  byExercise: (exerciseId: string) => [...goalKeys.all, 'exercise', exerciseId] as const,
  byId: (id: string) => [...goalKeys.all, id] as const,
};

/**
 * Fetch all active goals for current user
 */
export function useActiveGoals() {
  const userId = useAppStore((state) => state.userId);

  return useQuery({
    queryKey: goalKeys.active(),
    queryFn: async (): Promise<FitnessGoal[]> => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('fitness_goals')
        .select(`
          *,
          exercise:exercises(id, name, modality, primary_metric)
        `)
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as FitnessGoal[];
    },
    enabled: !!userId,
  });
}

/**
 * Fetch all goals for current user (any status)
 */
export function useAllGoals() {
  const userId = useAppStore((state) => state.userId);

  return useQuery({
    queryKey: goalKeys.all,
    queryFn: async (): Promise<FitnessGoal[]> => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('fitness_goals')
        .select(`
          *,
          exercise:exercises(id, name, modality, primary_metric)
        `)
        .eq('user_id', userId)
        .order('status', { ascending: true }) // active first
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as FitnessGoal[];
    },
    enabled: !!userId,
  });
}

/**
 * Fetch goal for a specific exercise
 */
export function useGoalForExercise(exerciseId: string) {
  const userId = useAppStore((state) => state.userId);

  return useQuery({
    queryKey: goalKeys.byExercise(exerciseId),
    queryFn: async (): Promise<FitnessGoal | null> => {
      if (!userId || !exerciseId) return null;

      const { data, error } = await supabase
        .from('fitness_goals')
        .select(`
          *,
          exercise:exercises(id, name, modality, primary_metric)
        `)
        .eq('user_id', userId)
        .eq('exercise_id', exerciseId)
        .eq('status', 'active')
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
      return data as FitnessGoal | null;
    },
    enabled: !!userId && !!exerciseId,
  });
}

/**
 * Create a new goal
 */
export function useCreateGoal() {
  const queryClient = useQueryClient();
  const userId = useAppStore((state) => state.userId);

  return useMutation({
    mutationFn: async (goal: GoalInsert): Promise<FitnessGoal> => {
      if (!userId) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('fitness_goals')
        .insert({
          ...goal,
          user_id: userId,
          target_unit: goal.target_unit || 'lbs',
        })
        .select(`
          *,
          exercise:exercises(id, name, modality, primary_metric)
        `)
        .single();

      if (error) throw error;
      return data as FitnessGoal;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: goalKeys.all });
      if (data.exercise_id) {
        queryClient.invalidateQueries({ queryKey: goalKeys.byExercise(data.exercise_id) });
      }
    },
  });
}

/**
 * Update goal progress (current_value)
 */
export function useUpdateGoalProgress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      goalId,
      currentValue,
    }: {
      goalId: string;
      currentValue: number;
    }): Promise<FitnessGoal> => {
      const { data, error } = await supabase
        .from('fitness_goals')
        .update({ current_value: currentValue })
        .eq('id', goalId)
        .select(`
          *,
          exercise:exercises(id, name, modality, primary_metric)
        `)
        .single();

      if (error) throw error;
      return data as FitnessGoal;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: goalKeys.all });
      if (data.exercise_id) {
        queryClient.invalidateQueries({ queryKey: goalKeys.byExercise(data.exercise_id) });
      }
    },
  });
}

/**
 * Update goal status (abandon, pause, etc.)
 */
export function useUpdateGoalStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      goalId,
      status,
    }: {
      goalId: string;
      status: GoalStatus;
    }): Promise<FitnessGoal> => {
      const updates: Partial<FitnessGoal> = { status };
      if (status === 'achieved') {
        updates.achieved_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('fitness_goals')
        .update(updates)
        .eq('id', goalId)
        .select(`
          *,
          exercise:exercises(id, name, modality, primary_metric)
        `)
        .single();

      if (error) throw error;
      return data as FitnessGoal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goalKeys.all });
    },
  });
}

/**
 * Delete a goal
 */
export function useDeleteGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (goalId: string): Promise<void> => {
      const { error } = await supabase
        .from('fitness_goals')
        .delete()
        .eq('id', goalId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: goalKeys.all });
    },
  });
}

/**
 * Calculate progress percentage toward goal
 */
export function calculateGoalProgress(goal: FitnessGoal): number {
  if (!goal.current_value || !goal.target_value) return 0;

  const starting = goal.starting_value || 0;
  const current = goal.current_value;
  const target = goal.target_value;

  // Handle case where we need to decrease (like pace)
  if (target < starting) {
    // Lower is better (e.g., pace)
    const totalChange = starting - target;
    const currentChange = starting - current;
    return Math.min(100, Math.max(0, (currentChange / totalChange) * 100));
  }

  // Higher is better (e.g., weight, reps)
  const totalChange = target - starting;
  const currentChange = current - starting;

  if (totalChange <= 0) return current >= target ? 100 : 0;

  return Math.min(100, Math.max(0, (currentChange / totalChange) * 100));
}

/**
 * Format goal for display
 */
export function formatGoal(goal: FitnessGoal): string {
  const exerciseName = goal.exercise?.name || 'Custom Goal';
  const typeLabel = goal.goal_type === 'e1rm' ? 'E1RM' : goal.goal_type.toUpperCase();

  return `${exerciseName}: ${goal.target_value} ${goal.target_unit} ${typeLabel}`;
}
