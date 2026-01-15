import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/useAppStore';
import type {
  TrainingBlock,
  TrainingBlockInsert,
  TrainingBlockUpdate,
  TrainingBlockWithWorkouts,
  Workout,
  WorkoutInsert,
  WorkoutSetInsert,
  AIGeneratedWorkout,
} from '@/types/database';

// Query keys
export const trainingBlockKeys = {
  all: ['trainingBlocks'] as const,
  lists: () => [...trainingBlockKeys.all, 'list'] as const,
  list: (filters: { active?: boolean }) =>
    [...trainingBlockKeys.lists(), filters] as const,
  details: () => [...trainingBlockKeys.all, 'detail'] as const,
  detail: (id: string) => [...trainingBlockKeys.details(), id] as const,
  active: () => [...trainingBlockKeys.all, 'active'] as const,
};

// Fetch all training blocks for current user
export function useTrainingBlocks(filters?: { active?: boolean }) {
  const userId = useAppStore((state) => state.userId);

  return useQuery({
    queryKey: trainingBlockKeys.list(filters || {}),
    queryFn: async (): Promise<TrainingBlock[]> => {
      if (!userId) return [];

      let query = supabase
        .from('training_blocks')
        .select('*')
        .eq('user_id', userId)
        .order('start_date', { ascending: false });

      if (filters?.active !== undefined) {
        query = query.eq('is_active', filters.active);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as TrainingBlock[];
    },
    enabled: !!userId,
  });
}

// Fetch active training block
export function useActiveTrainingBlock() {
  const userId = useAppStore((state) => state.userId);

  return useQuery({
    queryKey: trainingBlockKeys.active(),
    queryFn: async (): Promise<TrainingBlock | null> => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from('training_blocks')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      return data as TrainingBlock | null;
    },
    enabled: !!userId,
  });
}

// Fetch single training block with all workouts
export function useTrainingBlock(id: string) {
  return useQuery({
    queryKey: trainingBlockKeys.detail(id),
    queryFn: async (): Promise<TrainingBlockWithWorkouts> => {
      const { data: block, error: blockError } = await supabase
        .from('training_blocks')
        .select('*')
        .eq('id', id)
        .single();

      if (blockError) throw blockError;

      const { data: workouts, error: workoutsError } = await supabase
        .from('workouts')
        .select('*')
        .eq('block_id', id)
        .order('week_number')
        .order('day_number');

      if (workoutsError) throw workoutsError;

      return {
        ...(block as TrainingBlock),
        workouts: workouts as Workout[],
      };
    },
    enabled: !!id,
    staleTime: 1 * 60 * 1000, // 1 minute - same as useNextWorkout for consistency
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Create a new training block
export function useCreateTrainingBlock() {
  const queryClient = useQueryClient();
  const userId = useAppStore((state) => state.userId);

  return useMutation({
    mutationFn: async (block: Omit<TrainingBlockInsert, 'user_id'>): Promise<TrainingBlock> => {
      if (!userId) throw new Error('User not authenticated');

      // First, deactivate any existing active blocks
      await supabase
        .from('training_blocks')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('is_active', true);

      // Create the new block
      const { data, error } = await supabase
        .from('training_blocks')
        .insert({ ...block, user_id: userId, is_active: true } as TrainingBlockInsert)
        .select()
        .single();

      if (error) throw error;
      return data as TrainingBlock;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trainingBlockKeys.all });
    },
  });
}

// Update a training block
export function useUpdateTrainingBlock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: TrainingBlockUpdate & { id: string }): Promise<TrainingBlock> => {
      const { data, error } = await supabase
        .from('training_blocks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as TrainingBlock;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: trainingBlockKeys.all });
      queryClient.invalidateQueries({ queryKey: trainingBlockKeys.detail(data.id) });
    },
  });
}

// Set a block as active (deactivates others)
export function useSetActiveBlock() {
  const queryClient = useQueryClient();
  const userId = useAppStore((state) => state.userId);

  return useMutation({
    mutationFn: async (blockId: string): Promise<TrainingBlock> => {
      if (!userId) throw new Error('User not authenticated');

      // Deactivate all other blocks
      await supabase
        .from('training_blocks')
        .update({ is_active: false })
        .eq('user_id', userId)
        .neq('id', blockId);

      // Activate the selected block
      const { data, error } = await supabase
        .from('training_blocks')
        .update({ is_active: true })
        .eq('id', blockId)
        .select()
        .single();

      if (error) throw error;
      return data as TrainingBlock;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trainingBlockKeys.all });
    },
  });
}

// Delete a training block
export function useDeleteTrainingBlock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from('training_blocks').delete().eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trainingBlockKeys.all });
    },
  });
}

// Get block progress (workouts completed / total)
export function useBlockProgress(blockId: string) {
  return useQuery({
    queryKey: ['blockProgress', blockId],
    queryFn: async () => {
      const { data: workouts, error } = await supabase
        .from('workouts')
        .select('id, date_completed')
        .eq('block_id', blockId);

      if (error) throw error;

      const typedWorkouts = workouts as { id: string; date_completed: string | null }[];
      const total = typedWorkouts.length;
      const completed = typedWorkouts.filter((w) => w.date_completed !== null).length;

      return {
        total,
        completed,
        percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    },
    enabled: !!blockId,
  });
}

// Create all workouts for an AI-generated block
export function useCreateBlockWorkouts() {
  const queryClient = useQueryClient();
  const userId = useAppStore((state) => state.userId);

  return useMutation({
    mutationFn: async ({
      blockId,
      workouts,
    }: {
      blockId: string;
      workouts: AIGeneratedWorkout[];
    }): Promise<void> => {
      if (!userId) throw new Error('User not authenticated');

      // Calculate scheduled dates starting from today
      const startDate = new Date();
      let currentDate = new Date(startDate);

      for (const workout of workouts) {
        // Calculate the scheduled date based on week and day number
        const daysOffset = (workout.week_number - 1) * 7 + (workout.day_number - 1);
        currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + daysOffset);

        // Create the workout
        const { data: createdWorkout, error: workoutError } = await supabase
          .from('workouts')
          .insert({
            block_id: blockId,
            user_id: userId,
            week_number: workout.week_number,
            day_number: workout.day_number,
            focus: workout.focus,
            scheduled_date: currentDate.toISOString().split('T')[0],
          } as WorkoutInsert)
          .select()
          .single();

        if (workoutError) throw workoutError;

        const createdWorkoutData = createdWorkout as Workout;

        // Create all sets for this workout
        const setsToInsert: WorkoutSetInsert[] = [];

        workout.exercises.forEach((exercise) => {
          if (!exercise.exercise_id) {
            console.warn(`Exercise not found in database: ${exercise.exercise_name}`);
            return;
          }

          exercise.sets.forEach((set) => {
            setsToInsert.push({
              workout_id: createdWorkoutData.id,
              exercise_id: exercise.exercise_id!,
              set_order: set.set_order,
              target_reps: set.target_reps,
              target_rpe: set.target_rpe,
              target_load: set.target_load,
              tempo: set.tempo,
              notes: set.notes,
              is_warmup: false,
              is_pr: false,
            });
          });
        });

        if (setsToInsert.length > 0) {
          const { error: setsError } = await supabase
            .from('workout_sets')
            .insert(setsToInsert as WorkoutSetInsert[]);

          if (setsError) throw setsError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trainingBlockKeys.all });
    },
  });
}
