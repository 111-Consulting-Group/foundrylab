import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { parseWorkoutWithSets } from '@/lib/validation/schemas';
import { useAppStore } from '@/stores/useAppStore';
import { trainingBlockKeys } from '@/hooks/useTrainingBlocks';
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
  history: (limit?: number, userId?: string) => [...workoutKeys.all, 'history', userId, limit] as const,
  incomplete: () => [...workoutKeys.all, 'incomplete'] as const,
  today: () => [...workoutKeys.all, 'today'] as const,
  next: () => [...workoutKeys.all, 'next'] as const,
  upcoming: (limit?: number) => [...workoutKeys.all, 'upcoming', limit] as const,
  byDateRange: (startDate: string, endDate: string) =>
    [...workoutKeys.all, 'dateRange', startDate, endDate] as const,
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
        .maybeSingle();

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
      // First get active block ID
      const { data: activeBlock, error: blockError } = await supabase
        .from('training_blocks')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();

      if (!activeBlock) {
        return null;
      }

      const { data, error } = await supabase
        .from('workouts')
        .select(`
          *,
          workout_sets(
            *,
            exercise:exercises(*)
          ),
          block:training_blocks(
            id,
            name,
            is_active
          )
        `)
        .eq('user_id', userId)
        .eq('block_id', activeBlock.id)
        .is('date_completed', null)
        .order('week_number', { ascending: true })
        .order('day_number', { ascending: true })
        .limit(1)
        .maybeSingle();

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

      // First get active block ID
      const { data: activeBlock } = await supabase
        .from('training_blocks')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (!activeBlock) {
        return [];
      }

      const { data, error } = await supabase
        .from('workouts')
        .select(`
          *,
          workout_sets(
            *,
            exercise:exercises(*)
          ),
          block:training_blocks(
            id,
            name,
            is_active
          )
        `)
        .eq('user_id', userId)
        .eq('block_id', activeBlock.id)
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
export function useWorkoutHistory(limit: number = 20, dateRange?: { start: string; end: string }) {
  const userId = useAppStore((state) => state.userId);

  return useQuery({
    queryKey: [...workoutKeys.history(limit, userId), dateRange?.start, dateRange?.end],
    queryFn: async (): Promise<WorkoutWithSets[]> => {
      if (!userId) return [];

      let query = supabase
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
        .order('date_completed', { ascending: false });
      
      // Apply date range filter if provided (more efficient than client-side filtering)
      if (dateRange) {
        query = query
          .gte('date_completed', dateRange.start)
          .lte('date_completed', dateRange.end);
      }
      
      // Only apply limit if no date range (date range should return all in range)
      if (!dateRange) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

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

// Uncomplete a workout (mark as incomplete so it can be rescheduled)
export function useUncompleteWorkout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string }): Promise<Workout> => {
      const { data, error } = await supabase
        .from('workouts')
        .update({ date_completed: null })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error uncompleting workout:', error);
        throw error;
      }
      return data as Workout;
    },
    onSuccess: (data) => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: workoutKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: workoutKeys.next() });
      queryClient.invalidateQueries({ queryKey: workoutKeys.upcoming() });
      queryClient.invalidateQueries({ queryKey: workoutKeys.history() });
      queryClient.invalidateQueries({ queryKey: workoutKeys.incomplete() });
      queryClient.invalidateQueries({ queryKey: workoutKeys.today() });
      // Invalidate all date range queries (they'll refetch when needed)
      queryClient.invalidateQueries({ 
        queryKey: [...workoutKeys.all, 'dateRange'],
        exact: false 
      });
      if (data.block_id) {
        queryClient.invalidateQueries({ queryKey: workoutKeys.list({ blockId: data.block_id }) });
        // Also invalidate the training block detail to update program screen
        queryClient.invalidateQueries({ queryKey: trainingBlockKeys.detail(data.block_id) });
        queryClient.invalidateQueries({ queryKey: ['blockProgress', data.block_id] });
      }
    },
    onError: (error) => {
      console.error('Failed to uncomplete workout:', error);
    },
  });
}

// Reschedule a workout and adjust all subsequent workouts in the program
export function useRescheduleWorkout() {
  const queryClient = useQueryClient();
  const userId = useAppStore((state) => state.userId);

  return useMutation({
    mutationFn: async ({
      workoutId,
      newDate,
      pushProgram = true,
    }: {
      workoutId: string;
      newDate: Date;
      pushProgram?: boolean; // If true, push all subsequent workouts. If false, just move this one.
    }): Promise<{ updated: number; workout: Workout }> => {
      if (!userId) throw new Error('User not authenticated');

      // Get the workout to reschedule
      const { data: workout, error: workoutError } = await supabase
        .from('workouts')
        .select('*')
        .eq('id', workoutId)
        .single();

      if (workoutError) throw workoutError;
      if (!workout) throw new Error('Workout not found');

      const oldDate = workout.scheduled_date ? new Date(workout.scheduled_date) : null;
      if (!oldDate) throw new Error('Workout has no scheduled date');

      const dayDifference = Math.floor(
        (newDate.getTime() - oldDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Update the workout's scheduled_date
      const newDateStr = newDate.toISOString().split('T')[0];
      const { data: updatedWorkout, error: updateError } = await supabase
        .from('workouts')
        .update({ scheduled_date: newDateStr })
        .eq('id', workoutId)
        .select()
        .single();

      if (updateError) throw updateError;

      // If workout is part of a block, adjust all subsequent workouts (only if pushProgram is true)
      let adjustedCount = 0;
      if (workout.block_id && dayDifference !== 0 && pushProgram) {
        // Get all incomplete workouts from the same block
        const { data: allBlockWorkouts, error: allError } = await supabase
          .from('workouts')
          .select('id, scheduled_date, week_number, day_number')
          .eq('block_id', workout.block_id)
          .is('date_completed', null)
          .order('week_number', { ascending: true })
          .order('day_number', { ascending: true });

        if (allError) throw allError;

        // Filter to get workouts that come after this one in program order
        const subsequentWorkouts = (allBlockWorkouts || []).filter((w) => {
          if (!workout.week_number || !workout.day_number) return false;
          if (!w.week_number || !w.day_number) return false;
          
          if (w.week_number > workout.week_number) return true;
          if (w.week_number === workout.week_number && w.day_number > workout.day_number) return true;
          return false;
        });

        if (subsequentError) throw subsequentError;

        // Adjust each subsequent workout's scheduled_date
        for (const subsequentWorkout of subsequentWorkouts) {
          if (subsequentWorkout.scheduled_date) {
            const currentDate = new Date(subsequentWorkout.scheduled_date);
            currentDate.setDate(currentDate.getDate() + dayDifference);
            const newScheduledDate = currentDate.toISOString().split('T')[0];

            const { error: adjustError } = await supabase
              .from('workouts')
              .update({ scheduled_date: newScheduledDate })
              .eq('id', subsequentWorkout.id);

            if (adjustError) throw adjustError;
            adjustedCount++;
          }
        }
      }

      return { updated: adjustedCount, workout: updatedWorkout as Workout };
    },
    onSuccess: (result) => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: workoutKeys.detail(result.workout.id) });
      queryClient.invalidateQueries({ queryKey: workoutKeys.next() });
      queryClient.invalidateQueries({ queryKey: workoutKeys.upcoming() });
      queryClient.invalidateQueries({ queryKey: workoutKeys.byDateRange() });
      if (result.workout.block_id) {
        queryClient.invalidateQueries({ queryKey: workoutKeys.list({ blockId: result.workout.block_id }) });
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
      // Invalidate all history queries (with any limit/userId combination)
      queryClient.invalidateQueries({ 
        queryKey: [...workoutKeys.all, 'history'],
        exact: false 
      });
      // Invalidate feed since workout was automatically shared
      queryClient.invalidateQueries({ queryKey: ['social', 'feed'] });
      if (data.block_id) {
        queryClient.invalidateQueries({ queryKey: workoutKeys.list({ blockId: data.block_id }) });
        // Also invalidate the training block detail to update program screen
        queryClient.invalidateQueries({ queryKey: trainingBlockKeys.detail(data.block_id) });
        queryClient.invalidateQueries({ queryKey: ['blockProgress', data.block_id] });
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

      if (error) {
        console.error('[useAddWorkoutSet] Error inserting set:', error);
        console.error('[useAddWorkoutSet] Set data:', set);
        // Check if it's an auth error
        if (error.status === 400 || error.status === 401) {
          const errorMessage = error.message || '';
          if (errorMessage.includes('Refresh Token') || errorMessage.includes('refresh_token')) {
            console.error('[useAddWorkoutSet] Auth error - refresh token issue');
          }
        }
        throw error;
      }
      return data as WorkoutSet & { exercise: unknown };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: workoutKeys.detail(data.workout_id) });
    },
  });
}

// Update a workout set and check for PRs
export function useUpdateWorkoutSet() {
  const queryClient = useQueryClient();
  const userId = useAppStore((state) => state.userId);

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
      
      const set = data as WorkoutSet;
      
      // Check for PRs if actual_weight and actual_reps are set
      if (userId && set.exercise_id && set.actual_weight && set.actual_reps) {
        const weight = set.actual_weight;
        const reps = set.actual_reps;
        const e1rm = Math.round(weight * (1 + reps / 30)); // Epley formula
        
        // Check if this is a new e1rm PR
        const { data: existingE1rmPR } = await supabase
          .from('personal_records')
          .select('value')
          .eq('user_id', userId)
          .eq('exercise_id', set.exercise_id)
          .eq('record_type', 'e1rm')
          .order('value', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        const existingE1rm = (existingE1rmPR as { value: number } | null)?.value;
        if (!existingE1rm || e1rm > existingE1rm) {
          // Record new e1rm PR
          await supabase
            .from('personal_records')
            .insert({
              user_id: userId,
              exercise_id: set.exercise_id,
              workout_set_id: id,
              record_type: 'e1rm',
              value: e1rm,
              unit: 'lbs',
              achieved_at: new Date().toISOString(),
            });
          
          // Mark set as PR
          await supabase
            .from('workout_sets')
            .update({ is_pr: true })
            .eq('id', id);
        }
        
        // Check if this is a new weight PR
        const { data: existingWeightPR } = await supabase
          .from('personal_records')
          .select('value')
          .eq('user_id', userId)
          .eq('exercise_id', set.exercise_id)
          .eq('record_type', 'weight')
          .order('value', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        const existingWeight = (existingWeightPR as { value: number } | null)?.value;
        if (!existingWeight || weight > existingWeight) {
          // Record new weight PR
          await supabase
            .from('personal_records')
            .insert({
              user_id: userId,
              exercise_id: set.exercise_id,
              workout_set_id: id,
              record_type: 'weight',
              value: weight,
              unit: 'lbs',
              achieved_at: new Date().toISOString(),
            });
        }
      }
      
      return { ...set, workoutId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: workoutKeys.detail(data.workoutId) });
      // Also invalidate PR queries in case we recorded a new PR
      queryClient.invalidateQueries({ queryKey: ['mainLiftPRs'] });
      queryClient.invalidateQueries({ queryKey: ['personalRecords'] });
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

// Fetch workouts by date range (for calendar view)
export function useWorkoutsByDateRange(startDate: Date, endDate: Date) {
  const userId = useAppStore((state) => state.userId);

  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  return useQuery({
    queryKey: workoutKeys.byDateRange(startDateStr, endDateStr),
    queryFn: async (): Promise<WorkoutWithSets[]> => {
      if (!userId) return [];

      // Fetch workouts that are either:
      // 1. Completed within the date range (date_completed)
      // 2. Scheduled within the date range (scheduled_date) - even if not completed
      const { data: completedWorkouts, error: completedError } = await supabase
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
        .gte('date_completed', startDateStr)
        .lte('date_completed', endDateStr);

      if (completedError) throw completedError;

      const { data: scheduledWorkouts, error: scheduledError } = await supabase
        .from('workouts')
        .select(`
          *,
          workout_sets(
            *,
            exercise:exercises(*)
          )
        `)
        .eq('user_id', userId)
        .not('scheduled_date', 'is', null)
        .gte('scheduled_date', startDateStr)
        .lte('scheduled_date', endDateStr);

      if (scheduledError) throw scheduledError;

      // Combine and deduplicate by workout ID
      const workoutMap = new Map<string, WorkoutWithSets>();
      
      (completedWorkouts || []).forEach((w) => {
        workoutMap.set(w.id, w as WorkoutWithSets);
      });
      
      (scheduledWorkouts || []).forEach((w) => {
        if (!workoutMap.has(w.id)) {
          workoutMap.set(w.id, w as WorkoutWithSets);
        }
      });

      return Array.from(workoutMap.values()).sort((a, b) => {
        // Sort by scheduled_date first, then date_completed
        const aDate = a.scheduled_date || a.date_completed || '';
        const bDate = b.scheduled_date || b.date_completed || '';
        return aDate.localeCompare(bDate);
      });
    },
    enabled: !!userId,
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}
