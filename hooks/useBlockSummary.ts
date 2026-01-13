/**
 * Block Summary Hook
 *
 * Returns summary stats for a training block, including:
 * - Total workouts, sets, volume
 * - PRs hit during the block
 * - Goal progress made
 * - Muscle group breakdown
 * - Check if block is complete
 */

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/useAppStore';
import { calculateSetVolume } from '@/lib/utils';

export interface BlockSummary {
  blockId: string;
  blockName: string;
  durationWeeks: number;

  // Completion status
  isComplete: boolean;
  completedWorkouts: number;
  totalWorkouts: number;

  // Stats
  totalSets: number;
  totalReps: number;
  totalVolume: number;
  totalDuration: number; // minutes

  // PRs during block
  prsHit: {
    exerciseId: string;
    exerciseName: string;
    value: number;
    unit: string;
    prType: string;
  }[];

  // Muscle group breakdown
  muscleGroups: {
    name: string;
    sets: number;
    volume: number;
  }[];

  // Timeline
  startDate: string | null;
  endDate: string | null;
}

/**
 * Get summary for a specific block
 */
export function useBlockSummary(blockId: string): {
  data: BlockSummary | null;
  isLoading: boolean;
} {
  const userId = useAppStore((state) => state.userId);

  const { data, isLoading } = useQuery({
    queryKey: ['blockSummary', blockId],
    queryFn: async (): Promise<BlockSummary | null> => {
      if (!userId || !blockId) return null;

      // Fetch the block
      const { data: block, error: blockError } = await supabase
        .from('training_blocks')
        .select('id, name, duration_weeks, start_date, is_active')
        .eq('id', blockId)
        .eq('user_id', userId)
        .single();

      if (blockError || !block) return null;

      // Fetch all workouts for this block
      const { data: workouts, error: workoutsError } = await supabase
        .from('workouts')
        .select(`
          id,
          date_completed,
          duration_minutes,
          workout_sets(
            id,
            actual_weight,
            actual_reps,
            is_warmup,
            is_pr,
            exercise:exercises(id, name, muscle_group)
          )
        `)
        .eq('block_id', blockId)
        .eq('user_id', userId);

      if (workoutsError) throw workoutsError;

      // Calculate stats
      let totalSets = 0;
      let totalReps = 0;
      let totalVolume = 0;
      let totalDuration = 0;
      const completedWorkouts = workouts?.filter((w) => w.date_completed).length || 0;
      const muscleGroupMap = new Map<string, { sets: number; volume: number }>();

      workouts?.forEach((workout: any) => {
        totalDuration += workout.duration_minutes || 0;

        workout.workout_sets?.forEach((set: any) => {
          if (!set.is_warmup && set.actual_weight && set.actual_reps) {
            const volume = calculateSetVolume(set.actual_weight, set.actual_reps);
            totalSets++;
            totalReps += set.actual_reps;
            totalVolume += volume;

            // Track muscle group
            const muscleGroup = set.exercise?.muscle_group || 'Other';
            const current = muscleGroupMap.get(muscleGroup) || { sets: 0, volume: 0 };
            muscleGroupMap.set(muscleGroup, {
              sets: current.sets + 1,
              volume: current.volume + volume,
            });
          }
        });
      });

      // Get end date from last completed workout
      const completedDates = workouts
        ?.filter((w: any) => w.date_completed)
        .map((w: any) => w.date_completed)
        .sort() || [];
      const endDate = completedDates.length > 0 ? completedDates[completedDates.length - 1] : null;

      // Fetch PRs hit during this block
      const startDate = block.start_date || new Date(0).toISOString();
      const endDateForPRs = endDate || new Date().toISOString();
      
      const { data: prs, error: prsError } = await supabase
        .from('personal_records')
        .select(`
          id,
          exercise_id,
          value,
          unit,
          exercise:exercises(name)
        `)
        .eq('user_id', userId)
        .gte('achieved_at', startDate)
        .lte('achieved_at', endDateForPRs);
      
      if (prsError) {
        console.warn('Error fetching PRs for block summary:', prsError);
      }

      const prsHit = (prs || []).map((pr: any) => ({
        exerciseId: pr.exercise_id,
        exerciseName: pr.exercise?.name || 'Unknown',
        value: pr.value,
        unit: pr.unit,
        prType: 'weight', // Default to weight type since pr_type column doesn't exist
      }));

      // Format muscle groups
      const muscleGroups = Array.from(muscleGroupMap.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.volume - a.volume);

      return {
        blockId: block.id,
        blockName: block.name,
        durationWeeks: block.duration_weeks,
        isComplete: completedWorkouts === (workouts?.length || 0) && completedWorkouts > 0,
        completedWorkouts,
        totalWorkouts: workouts?.length || 0,
        totalSets,
        totalReps,
        totalVolume,
        totalDuration,
        prsHit,
        muscleGroups,
        startDate: block.start_date,
        endDate,
      };
    },
    enabled: !!userId && !!blockId,
  });

  return { data: data || null, isLoading };
}

/**
 * Check if a workout completes its block
 */
export function useIsBlockComplete(workoutId: string): {
  isBlockComplete: boolean;
  blockId: string | null;
  isLoading: boolean;
} {
  const userId = useAppStore((state) => state.userId);

  const { data, isLoading } = useQuery({
    queryKey: ['isBlockComplete', workoutId],
    queryFn: async (): Promise<{ isComplete: boolean; blockId: string | null }> => {
      if (!userId || !workoutId) return { isComplete: false, blockId: null };

      // Get the workout and its block
      const { data: workout, error } = await supabase
        .from('workouts')
        .select('id, block_id, date_completed')
        .eq('id', workoutId)
        .eq('user_id', userId)
        .single();

      if (error || !workout || !workout.block_id || !workout.date_completed) {
        return { isComplete: false, blockId: null };
      }

      // Check if all workouts in this block are complete
      const { data: blockWorkouts } = await supabase
        .from('workouts')
        .select('id, date_completed')
        .eq('block_id', workout.block_id)
        .eq('user_id', userId);

      const allComplete = blockWorkouts?.every((w) => w.date_completed !== null) || false;

      return {
        isComplete: allComplete && (blockWorkouts?.length || 0) > 0,
        blockId: workout.block_id,
      };
    },
    enabled: !!userId && !!workoutId,
  });

  return {
    isBlockComplete: data?.isComplete || false,
    blockId: data?.blockId || null,
    isLoading,
  };
}
