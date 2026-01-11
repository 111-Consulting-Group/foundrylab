/**
 * Exercise Memory Hook
 * 
 * Returns the last performance for an exercise to display prominently
 * "Last time: 225 x 5 @ RPE 8 (3 days ago)"
 */

import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';

import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/useAppStore';
import { calculateE1RM } from '@/lib/utils';
import type { WorkoutSet } from '@/types/database';

export interface ExerciseMemory {
  lastWeight: number | null;
  lastReps: number | null;
  lastRPE: number | null;
  lastPerformed: string | null; // ISO date string
  lastPerformedRelative: string | null; // "3 days ago"
  trend: 'improving' | 'stable' | 'declining' | 'unknown';
  displayText: string; // "225 x 5 @ RPE 8 (3 days ago)"
}

/**
 * Get exercise memory - last performance data for display
 */
export function useExerciseMemory(exerciseId: string, currentWorkoutId?: string): {
  data: ExerciseMemory | null;
  isLoading: boolean;
} {
  const userId = useAppStore((state) => state.userId);

  const { data, isLoading } = useQuery({
    queryKey: ['exerciseMemory', exerciseId, currentWorkoutId],
    queryFn: async (): Promise<ExerciseMemory | null> => {
      if (!userId || !exerciseId) return null;

      // Get recent completed sets for this exercise (for trend calculation)
      let query = supabase
        .from('workout_sets')
        .select(
          `
          *,
          workout:workouts!inner(
            id,
            date_completed,
            user_id
          )
        `
        )
        .eq('exercise_id', exerciseId)
        .eq('workout.user_id', userId)
        .not('workout.date_completed', 'is', null)
        .eq('is_warmup', false)
        .not('actual_weight', 'is', null)
        .not('actual_reps', 'is', null)
        .order('workout(date_completed)', { ascending: false })
        .limit(4); // Get last 4 sets for trend comparison

      if (currentWorkoutId) {
        query = query.neq('workout_id', currentWorkoutId);
      }

      const { data: sets, error } = await query;

      if (error) throw error;
      if (!sets || sets.length === 0) return null;

      const allSets = sets as Array<WorkoutSet & {
        workout: { date_completed: string };
      }>;
      
      const lastSet = allSets[0];
      const lastWeight = lastSet.actual_weight;
      const lastReps = lastSet.actual_reps;
      const lastRPE = lastSet.actual_rpe;
      const lastPerformed = lastSet.workout.date_completed;

      // Format relative date
      let lastPerformedRelative: string | null = null;
      if (lastPerformed) {
        try {
          lastPerformedRelative = formatDistanceToNow(new Date(lastPerformed), {
            addSuffix: true,
          });
        } catch (e) {
          // Date parsing error, ignore
        }
      }

      // Build display text
      const parts: string[] = [];
      if (lastWeight && lastWeight > 0) {
        parts.push(`${lastWeight} lb`);
      } else if (lastWeight === 0) {
        parts.push('BW');
      }
      if (lastReps) {
        parts.push(`x ${lastReps}`);
      }
      if (lastRPE) {
        parts.push(`@ RPE ${lastRPE}`);
      }
      if (lastPerformedRelative) {
        parts.push(`(${lastPerformedRelative})`);
      }

      const displayText = parts.length > 0 ? parts.join(' ') : null;

      // Determine trend by comparing last set with previous sets
      let trend: ExerciseMemory['trend'] = 'unknown';
      
      if (allSets.length >= 2 && lastWeight && lastReps) {
        const lastE1RM = calculateE1RM(lastWeight, lastReps);
        const previousSets = allSets.slice(1, 4); // Get 2-3 previous sets
        
        // Calculate average E1RM from previous sets
        const previousE1RMs = previousSets
          .filter(s => s.actual_weight && s.actual_reps)
          .map(s => calculateE1RM(s.actual_weight!, s.actual_reps!));
        
        if (previousE1RMs.length > 0) {
          const avgPreviousE1RM = previousE1RMs.reduce((a, b) => a + b, 0) / previousE1RMs.length;
          const percentChange = ((lastE1RM - avgPreviousE1RM) / avgPreviousE1RM) * 100;
          
          // Consider >2% improvement as improving, <-2% as declining, otherwise stable
          if (percentChange > 2) {
            trend = 'improving';
          } else if (percentChange < -2) {
            trend = 'declining';
          } else {
            trend = 'stable';
          }
        }
      }

      return {
        lastWeight,
        lastReps,
        lastRPE,
        lastPerformed,
        lastPerformedRelative,
        trend,
        displayText: displayText || 'No previous data',
      };
    },
    enabled: !!exerciseId && !!userId,
  });

  return { data: data || null, isLoading };
}
