/**
 * Week Summary Hook
 *
 * Returns comprehensive stats for the current week including
 * workouts, volume, PRs, goal progress, and muscle group breakdown
 */

import { useQuery } from '@tanstack/react-query';
import { startOfWeek, endOfWeek, differenceInDays } from 'date-fns';

import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/useAppStore';
import { calculateSetVolume } from '@/lib/utils';

export interface WeekSummary {
  // Basic stats
  workoutsCompleted: number;
  totalVolume: number;
  totalSets: number;
  totalDuration: number; // minutes
  workoutDays: number[]; // 0-6, Sunday=0

  // PRs this week
  prsThisWeek: {
    exerciseId: string;
    exerciseName: string;
    value: number;
    unit: string;
    prType: string;
  }[];

  // Goal progress
  goalsProgress: {
    goalId: string;
    exerciseName: string;
    startValue: number | null;
    currentValue: number | null;
    targetValue: number;
    weeklyGain: number;
  }[];

  // Muscle group breakdown
  muscleGroups: {
    name: string;
    sets: number;
    volume: number;
  }[];

  // Comparison to last week
  comparison: {
    volumeChange: number; // percentage
    workoutChange: number; // count difference
    isUp: boolean;
  };
}

export function useWeekSummary(): {
  data: WeekSummary | null;
  isLoading: boolean;
} {
  const userId = useAppStore((state) => state.userId);

  const { data, isLoading } = useQuery({
    queryKey: ['weekSummary', userId],
    queryFn: async (): Promise<WeekSummary> => {
      if (!userId) throw new Error('No user');

      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 0 }); // Sunday
      const weekEnd = endOfWeek(now, { weekStartsOn: 0 });

      // Previous week for comparison
      const lastWeekStart = new Date(weekStart);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);
      const lastWeekEnd = new Date(weekStart);
      lastWeekEnd.setMilliseconds(-1);

      // Fetch this week's completed workouts with sets
      const { data: workouts, error: workoutsError } = await supabase
        .from('workouts')
        .select(`
          id,
          focus,
          date_completed,
          duration_minutes,
          workout_sets(
            id,
            actual_weight,
            actual_reps,
            is_warmup,
            is_pr,
            progression_type,
            exercise:exercises(id, name, muscle_group, modality)
          )
        `)
        .eq('user_id', userId)
        .gte('date_completed', weekStart.toISOString())
        .lte('date_completed', weekEnd.toISOString())
        .not('date_completed', 'is', null);

      if (workoutsError) throw workoutsError;

      // Fetch last week's workouts for comparison
      const { data: lastWeekWorkouts } = await supabase
        .from('workouts')
        .select(`
          id,
          workout_sets(
            actual_weight,
            actual_reps,
            is_warmup
          )
        `)
        .eq('user_id', userId)
        .gte('date_completed', lastWeekStart.toISOString())
        .lte('date_completed', lastWeekEnd.toISOString())
        .not('date_completed', 'is', null);

      // Fetch PRs from this week
      const { data: prs } = await supabase
        .from('personal_records')
        .select(`
          id,
          exercise_id,
          value,
          unit,
          record_type,
          exercise:exercises(name)
        `)
        .eq('user_id', userId)
        .gte('achieved_at', weekStart.toISOString())
        .lte('achieved_at', weekEnd.toISOString());

      // Fetch active goals with progress
      const { data: goals } = await supabase
        .from('fitness_goals')
        .select(`
          id,
          target_value,
          current_value,
          exercise:exercises(name)
        `)
        .eq('user_id', userId)
        .eq('status', 'active');

      // Calculate stats
      let totalVolume = 0;
      let totalSets = 0;
      let totalDuration = 0;
      const workoutDays = new Set<number>();
      const muscleGroupMap = new Map<string, { sets: number; volume: number }>();

      workouts?.forEach((workout: any) => {
        if (workout.date_completed) {
          const date = new Date(workout.date_completed);
          workoutDays.add(date.getDay());
          totalDuration += workout.duration_minutes || 0;

          workout.workout_sets?.forEach((set: any) => {
            if (!set.is_warmup && set.actual_weight && set.actual_reps) {
              const volume = calculateSetVolume(set.actual_weight, set.actual_reps);
              totalVolume += volume;
              totalSets++;

              // Track muscle group
              const muscleGroup = set.exercise?.muscle_group || 'Other';
              const current = muscleGroupMap.get(muscleGroup) || { sets: 0, volume: 0 };
              muscleGroupMap.set(muscleGroup, {
                sets: current.sets + 1,
                volume: current.volume + volume,
              });
            }
          });
        }
      });

      // Calculate last week's volume
      let lastWeekVolume = 0;
      lastWeekWorkouts?.forEach((workout: any) => {
        workout.workout_sets?.forEach((set: any) => {
          if (!set.is_warmup && set.actual_weight && set.actual_reps) {
            lastWeekVolume += calculateSetVolume(set.actual_weight, set.actual_reps);
          }
        });
      });

      // Volume change percentage
      const volumeChange = lastWeekVolume > 0
        ? ((totalVolume - lastWeekVolume) / lastWeekVolume) * 100
        : 0;

      // Format PRs
      const prsThisWeek = (prs || []).map((pr: any) => ({
        exerciseId: pr.exercise_id,
        exerciseName: pr.exercise?.name || 'Unknown',
        value: pr.value,
        unit: pr.unit,
        prType: pr.record_type,
      }));

      // Format goals progress (simplified - would need workout history for true weekly gain)
      const goalsProgress = (goals || []).map((goal: any) => ({
        goalId: goal.id,
        exerciseName: goal.exercise?.name || 'Unknown',
        startValue: null, // Would need historical data
        currentValue: goal.current_value,
        targetValue: goal.target_value,
        weeklyGain: 0, // Would calculate from workout data
      }));

      // Format muscle groups
      const muscleGroups = Array.from(muscleGroupMap.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.volume - a.volume);

      return {
        workoutsCompleted: workouts?.length || 0,
        totalVolume,
        totalSets,
        totalDuration,
        workoutDays: Array.from(workoutDays),
        prsThisWeek,
        goalsProgress,
        muscleGroups,
        comparison: {
          volumeChange,
          workoutChange: (workouts?.length || 0) - (lastWeekWorkouts?.length || 0),
          isUp: volumeChange > 0,
        },
      };
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return { data: data || null, isLoading };
}
