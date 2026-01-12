import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { parseWorkoutWithSets } from '@/lib/validation/schemas';
import { useAppStore } from '@/stores/useAppStore';
import type {
  Workout,
  WorkoutInsert,
  WorkoutUpdate,
  WorkoutWithSets,
  WorkoutSet,
  WorkoutSetInsert,
} from '@/types/database';

// Query keys
export const workoutKeys = {
  all: ['workouts'] as const,
  lists: () => [...workoutKeys.all, 'list'] as const,
  list: (filters: { blockId?: string; completed?: boolean }) =>
    [...workoutKeys.lists(), filters] as const,
  details: () => [...workoutKeys.all, 'detail'] as const,
  detail: (id: string) => [...workoutKeys.details(), id] as const,
  history: (limit?: number) => [...workoutKeys.all, 'history', limit] as const,
  incomplete: () => [...workoutKeys.all, 'incomplete'] as const,
  today: () => [...workoutKeys.all, 'today'] as const,
  next: () => [...workoutKeys.all, 'next'] as const,
  upcoming: (limit?: number) => [...workoutKeys.all, 'upcoming', limit] as const,
};

// Fetch workout with all sets and exercise details
export function useWorkout(id: string) {
  return useQuery({
    queryKey: workoutKeys.detail(id),
    queryFn: async (): Promise<WorkoutWithSets> => {
      const { data: workout, error: workoutError } = await supabase
        .from('workouts')
        .select('*')
        .eq('id', id)
        .single();

      if (workoutError) throw workoutError;

      const { data: sets, error: setsError } = await supabase
        .from('workout_sets')
        .select(`
          *,
          exercise:exercises(*)
        `)
        .eq('workout_id', id)
        .order('set_order');

      if (setsError) throw setsError;

      // Validate with Zod instead of type assertion
      // Note: Requires zod package to be installed (npm install zod)
      // For now, fallback to type assertion if zod is not available
      try {
        return parseWorkoutWithSets({
          ...workout,
          workout_sets: sets,
        });
      } catch (parseError) {
        // Validation failed - fallback to type assertion for backward compatibility
        // TODO: Once zod is installed and schemas are fully validated, consider throwing here
        return {
          ...(workout as Workout),
          workout_sets: sets,
        } as WorkoutWithSets;
      }
    },
    enabled: !!id,
    staleTime: 30 * 1000, // 30 seconds - workout data changes during active sessions
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Fetch today's scheduled workout (legacy - date-based)
export function useTodaysWorkout() {
  const userId = useAppStore((state) => state.userId);
  const today = new Date().toISOString().split('T')[0];

  return useQuery({
    queryKey: workoutKeys.today(),
    queryFn: async (): Promise<WorkoutWithSets | null> => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from('workouts')
        .select(`
          *,
          workout_sets(
            *,
            exercise:exercises(*)
          )
        `)
        .eq('user_id', userId)
        .eq('scheduled_date', today)
        .is('date_completed', null)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as WorkoutWithSets | null;
    },
    enabled: !!userId,
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Fetch next incomplete workout from active block (queue-based - flexible scheduling)
export function useNextWorkout() {
  const userId = useAppStore((state) => state.userId);

  return useQuery({
    queryKey: workoutKeys.next(),
    queryFn: async (): Promise<WorkoutWithSets | null> => {
      if (!userId) return null;

      // Get the next incomplete workout ordered by week/day (program order, not date)
      const { data, error } = await supabase
        .from('workouts')
        .select(`
          *,
          workout_sets(
            *,
            exercise:exercises(*)
          ),
          block:training_blocks!inner(
            id,
            name,
            is_active
          )
        `)
        .eq('user_id', userId)
        .eq('block.is_active', true)
        .is('date_completed', null)
        .order('week_number', { ascending: true })
        .order('day_number', { ascending: true })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as WorkoutWithSets | null;
    },
    enabled: !!userId,
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Fetch upcoming incomplete workouts for swap functionality
export function useUpcomingWorkouts(limit: number = 5) {
  const userId = useAppStore((state) => state.userId);

  return useQuery({
    queryKey: workoutKeys.upcoming(limit),
    queryFn: async (): Promise<WorkoutWithSets[]> => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('workouts')
        .select(`
          *,
          workout_sets(
            *,
            exercise:exercises(*)
          ),
          block:training_blocks!inner(
            id,
            name,
            is_active
          )
        `)
        .eq('user_id', userId)
        .eq('block.is_active', true)
        .is('date_completed', null)
        .order('week_number', { ascending: true })
        .order('day_number', { ascending: true })
        .limit(limit);

      if (error) throw error;
      return data as WorkoutWithSets[];
    },
    enabled: !!userId,
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Push all remaining workouts forward by N days
export function usePushWorkouts() {
  const queryClient = useQueryClient();
  const userId = useAppStore((state) => state.userId);

  return useMutation({
    mutationFn: async ({ days }: { days: number }) => {
      if (!userId) throw new Error('User not authenticated');

      // First get the active block
      const { data: activeBlockData } = await supabase
        .from('training_blocks')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      const activeBlock = activeBlockData as { id: string } | null;
      if (!activeBlock) return { updated: 0 };

      // Get all incomplete workouts from active block
      const { data: workouts, error: fetchError } = await supabase
        .from('workouts')
        .select('id, scheduled_date')
        .eq('block_id', activeBlock.id)
        .is('date_completed', null);

      if (fetchError) throw fetchError;
      if (!workouts || workouts.length === 0) return { updated: 0 };

      // Update each workout's scheduled_date
      const updates = (workouts as Array<{ id: string; scheduled_date: string }>).map((w) => {
        const currentDate = new Date(w.scheduled_date);
        currentDate.setDate(currentDate.getDate() + days);
        return {
          id: w.id,
          scheduled_date: currentDate.toISOString().split('T')[0],
        };
      });

      // Batch update
      for (const update of updates) {
        await supabase
          .from('workouts')
          .update({ scheduled_date: update.scheduled_date } as never)
          .eq('id', update.id);
      }

      return { updated: updates.length, blockId: activeBlock.id };
    },
    onSuccess: (result) => {
      // Only invalidate queries that show scheduled workouts
      queryClient.invalidateQueries({ queryKey: workoutKeys.next() });
      queryClient.invalidateQueries({ queryKey: workoutKeys.upcoming() });
      queryClient.invalidateQueries({ queryKey: workoutKeys.today() });
      if (result.blockId) {
        queryClient.invalidateQueries({ queryKey: workoutKeys.list({ blockId: result.blockId }) });
      }
    },
  });
}

// Fetch workout history with sets for stats calculation
export function useWorkoutHistory(limit: number = 20) {
  const userId = useAppStore((state) => state.userId);

  return useQuery({
    queryKey: workoutKeys.history(limit),
    queryFn: async (): Promise<WorkoutWithSets[]> => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('workouts')
        .select(`
          *,
          workout_sets(
            *,
            exercise:exercises(*)
          )
        `)
        .eq('user_id', userId)
        .not('date_completed', 'is', null)
        .order('date_completed', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as WorkoutWithSets[];
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes - history doesn't change often
    gcTime: 15 * 60 * 1000, // 15 minutes
  });
}

// Fetch workouts by block
export function useBlockWorkouts(blockId: string) {
  return useQuery({
    queryKey: workoutKeys.list({ blockId }),
    queryFn: async (): Promise<Workout[]> => {
      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .eq('block_id', blockId)
        .order('week_number')
        .order('day_number');

      if (error) throw error;
      return data as Workout[];
    },
    enabled: !!blockId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Create a new workout
export function useCreateWorkout() {
  const queryClient = useQueryClient();
  const userId = useAppStore((state) => state.userId);

  return useMutation({
    mutationFn: async (workout: Omit<WorkoutInsert, 'user_id'>): Promise<Workout> => {
      if (!userId) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('workouts')
        .insert({ ...workout, user_id: userId } as WorkoutInsert)
        .select()
        .single();

      if (error) throw error;
      return data as Workout;
    },
    onSuccess: (data) => {
      // Only invalidate relevant queries, not all workout queries
      queryClient.invalidateQueries({ queryKey: workoutKeys.incomplete() });
      queryClient.invalidateQueries({ queryKey: workoutKeys.next() });
      queryClient.invalidateQueries({ queryKey: workoutKeys.upcoming() });
      if (data.block_id) {
        queryClient.invalidateQueries({ queryKey: workoutKeys.list({ blockId: data.block_id }) });
      }
    },
  });
}

// Update workout (including marking as completed)
export function useUpdateWorkout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: WorkoutUpdate & { id: string }): Promise<Workout> => {
      const { data, error } = await supabase
        .from('workouts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Workout;
    },
    onSuccess: (data) => {
      // Invalidate specific workout detail and related list queries
      queryClient.invalidateQueries({ queryKey: workoutKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: workoutKeys.next() });
      queryClient.invalidateQueries({ queryKey: workoutKeys.upcoming() });
      if (data.block_id) {
        queryClient.invalidateQueries({ queryKey: workoutKeys.list({ blockId: data.block_id }) });
      }
    },
  });
}

// Complete a workout
export function useCompleteWorkout() {
  const queryClient = useQueryClient();
  const { endWorkout } = useAppStore();
  const userId = useAppStore((state) => state.userId);

  return useMutation({
    mutationFn: async ({ id, durationMinutes }: { id: string; durationMinutes: number }): Promise<Workout> => {
      const { data, error } = await supabase
        .from('workouts')
        .update({
          date_completed: new Date().toISOString(),
          duration_minutes: durationMinutes,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Automatically share workout to feed
      if (userId && data) {
        // Check if post already exists to avoid duplicates
        const { data: existingPost } = await supabase
          .from('workout_posts')
          .select('id')
          .eq('workout_id', id)
          .single();

        // Only insert if post doesn't exist yet
        if (!existingPost) {
          const { error: shareError } = await supabase
            .from('workout_posts')
            .insert({
              workout_id: id,
              user_id: userId,
              caption: null,
              is_public: true,
            });

          // Log error but don't fail the workout completion if sharing fails
          if (shareError) {
            console.warn('Failed to automatically share workout to feed:', shareError);
          }
        }
      }

      return data as Workout;
    },
    onSuccess: (data) => {
      endWorkout();
      // Invalidate queries that would be affected by workout completion
      queryClient.invalidateQueries({ queryKey: workoutKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: workoutKeys.incomplete() });
      queryClient.invalidateQueries({ queryKey: workoutKeys.next() });
      queryClient.invalidateQueries({ queryKey: workoutKeys.upcoming() });
      queryClient.invalidateQueries({ queryKey: workoutKeys.history() });
      // Invalidate feed since workout was automatically shared
      queryClient.invalidateQueries({ queryKey: ['social', 'feed'] });
      if (data.block_id) {
        queryClient.invalidateQueries({ queryKey: workoutKeys.list({ blockId: data.block_id }) });
      }
    },
  });
}

// Add a set to a workout
export function useAddWorkoutSet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (set: WorkoutSetInsert) => {
      const { data, error } = await supabase
        .from('workout_sets')
        .insert(set as WorkoutSetInsert)
        .select(`
          *,
          exercise:exercises(*)
        `)
        .single();

      if (error) throw error;
      return data as WorkoutSet & { exercise: unknown };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: workoutKeys.detail(data.workout_id) });
    },
  });
}

// Update a workout set
export function useUpdateWorkoutSet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, workoutId, ...updates }: Partial<WorkoutSet> & { id: string; workoutId: string }) => {
      const { data, error } = await supabase
        .from('workout_sets')
        .update(updates)
        .eq('id', id)
        .select(`
          *,
          exercise:exercises(*)
        `)
        .single();

      if (error) throw error;
      return { ...(data as WorkoutSet), workoutId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: workoutKeys.detail(data.workoutId) });
    },
  });
}

// Fetch incomplete ad-hoc workouts (for workout visibility fix)
export function useIncompleteWorkouts() {
  const userId = useAppStore((state) => state.userId);

  return useQuery({
    queryKey: workoutKeys.incomplete(),
    queryFn: async (): Promise<WorkoutWithSets[]> => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('workouts')
        .select(`
          *,
          workout_sets(
            *,
            exercise:exercises(*)
          )
        `)
        .eq('user_id', userId)
        .is('block_id', null)
        .is('date_completed', null)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data as WorkoutWithSets[];
    },
    enabled: !!userId,
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Delete a workout set
export function useDeleteWorkoutSet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, workoutId }: { id: string; workoutId: string }): Promise<void> => {
      const { error } = await supabase.from('workout_sets').delete().eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: workoutKeys.detail(variables.workoutId) });
    },
  });
}

// Get previous performance for an exercise
export function usePreviousPerformance(exerciseId: string, currentWorkoutId?: string) {
  const userId = useAppStore((state) => state.userId);

  return useQuery({
    queryKey: ['previousPerformance', exerciseId],
    queryFn: async () => {
      if (!userId) return [];

      let query = supabase
        .from('workout_sets')
        .select(`
          *,
          workout:workouts!inner(
            id,
            date_completed,
            user_id
          )
        `)
        .eq('exercise_id', exerciseId)
        .eq('workout.user_id', userId)
        .not('workout.date_completed', 'is', null)
        .eq('is_warmup', false)
        .order('workout(date_completed)', { ascending: false })
        .limit(10);

      if (currentWorkoutId) {
        query = query.neq('workout_id', currentWorkoutId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
    enabled: !!exerciseId && !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes - historical data
    gcTime: 15 * 60 * 1000, // 15 minutes
  });
}
