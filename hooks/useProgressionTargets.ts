/**
 * Progression Targets Hook
 *
 * Returns suggested progression targets for a workout's exercises
 * based on the user's history and current training context.
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/useAppStore';
import { suggestProgression } from '@/lib/autoProgress';
import type { Exercise, WorkoutWithSets, WorkoutContext } from '@/types/database';

export interface ProgressionTarget {
  exerciseId: string;
  exerciseName: string;
  exercise: Exercise;
  lastWeight: number | null;
  lastReps: number | null;
  lastRPE: number | null;
  lastDate: string | null;
  daysSinceLastWorkout: number | null;
  targetWeight: number | null;
  targetReps: number | null;
  targetRPE: number | null;
  message: string;
  progressionType: 'weight' | 'reps' | 'volume' | 'maintain' | 'deload' | null;
}

interface ExerciseHistory {
  exercise_id: string;
  actual_weight: number | null;
  actual_reps: number | null;
  actual_rpe: number | null;
  is_warmup: boolean;
  workout: {
    date_completed: string | null;
    context: WorkoutContext;
  };
}

/**
 * Get progression targets for a specific workout
 */
export function useProgressionTargets(workout: WorkoutWithSets | null) {
  const userId = useAppStore((state) => state.userId);

  // Get unique exercises from workout sets
  const exercises = useMemo(() => {
    if (!workout?.workout_sets) return [];

    const exerciseMap = new Map<string, Exercise>();
    workout.workout_sets.forEach((set) => {
      if (set.exercise && !exerciseMap.has(set.exercise.id)) {
        exerciseMap.set(set.exercise.id, set.exercise);
      }
    });

    return Array.from(exerciseMap.values());
  }, [workout?.workout_sets]);

  const exerciseIds = exercises.map((e) => e.id);
  const blockContext = workout?.context || 'building';

  return useQuery({
    queryKey: ['progressionTargets', exerciseIds.join(','), blockContext],
    queryFn: async (): Promise<ProgressionTarget[]> => {
      if (!userId || exercises.length === 0) return [];

      // Fetch last 10 sets for each exercise
      const { data: historyData, error } = await supabase
        .from('workout_sets')
        .select(`
          exercise_id,
          actual_weight,
          actual_reps,
          actual_rpe,
          is_warmup,
          workout:workouts!inner(
            date_completed,
            context,
            user_id
          )
        `)
        .eq('workout.user_id', userId)
        .in('exercise_id', exerciseIds)
        .not('workout.date_completed', 'is', null)
        .order('workout(date_completed)', { ascending: false })
        .limit(100); // Get enough to cover all exercises

      if (error) throw error;

      // Group by exercise
      const historyByExercise = new Map<string, ExerciseHistory[]>();
      for (const row of (historyData || []) as ExerciseHistory[]) {
        const existing = historyByExercise.get(row.exercise_id) || [];
        existing.push(row);
        historyByExercise.set(row.exercise_id, existing);
      }

      // Generate targets for each exercise
      const targets: ProgressionTarget[] = [];

      for (const exercise of exercises) {
        const history = historyByExercise.get(exercise.id) || [];

        // Find the most recent non-warmup set
        const lastSet = history.find((h) => !h.is_warmup && h.actual_weight && h.actual_reps);
        const lastDate = lastSet?.workout?.date_completed || null;

        // Calculate days since last workout
        let daysSinceLastWorkout: number | null = null;
        if (lastDate) {
          const lastDateObj = new Date(lastDate);
          const today = new Date();
          daysSinceLastWorkout = Math.floor(
            (today.getTime() - lastDateObj.getTime()) / (1000 * 60 * 60 * 24)
          );
        }

        // Get suggestion from autoProgress
        const suggestion = suggestProgression(
          exercise,
          history.filter((h) => !h.is_warmup),
          blockContext
        );

        targets.push({
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          exercise,
          lastWeight: lastSet?.actual_weight || null,
          lastReps: lastSet?.actual_reps || null,
          lastRPE: lastSet?.actual_rpe || null,
          lastDate,
          daysSinceLastWorkout,
          targetWeight: suggestion?.targetWeight || lastSet?.actual_weight || null,
          targetReps: suggestion?.targetReps || lastSet?.actual_reps || null,
          targetRPE: suggestion?.targetRPE || null,
          message: suggestion?.message || 'No previous data',
          progressionType: suggestion?.progressionType || null,
        });
      }

      return targets;
    },
    enabled: !!userId && exercises.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get smart suggestions for exercises not in a block
 * Suggests exercises the user hasn't done recently
 */
export function useSmartExerciseSuggestions(limit: number = 5) {
  const userId = useAppStore((state) => state.userId);

  return useQuery({
    queryKey: ['smartExerciseSuggestions', limit],
    queryFn: async () => {
      if (!userId) return [];

      // Get user's most used exercises with their last workout date
      const { data, error } = await supabase
        .from('workout_sets')
        .select(`
          exercise_id,
          exercise:exercises!inner(
            id,
            name,
            modality,
            muscle_group
          ),
          workout:workouts!inner(
            date_completed,
            user_id
          )
        `)
        .eq('workout.user_id', userId)
        .not('workout.date_completed', 'is', null)
        .order('workout(date_completed)', { ascending: false })
        .limit(500);

      if (error) throw error;

      // Group by exercise and find last date + count
      const exerciseStats = new Map<string, {
        exercise: Exercise;
        lastDate: string;
        count: number;
        daysSince: number;
      }>();

      const today = new Date();

      for (const row of data || []) {
        const exerciseId = row.exercise_id;
        const existing = exerciseStats.get(exerciseId);

        if (!existing && row.exercise) {
          const lastDate = row.workout?.date_completed;
          const daysSince = lastDate
            ? Math.floor((today.getTime() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24))
            : 999;

          exerciseStats.set(exerciseId, {
            exercise: row.exercise as Exercise,
            lastDate: lastDate || '',
            count: 1,
            daysSince,
          });
        } else if (existing) {
          existing.count++;
        }
      }

      // Sort by days since last workout (prioritize neglected exercises)
      // But only include exercises user has done at least 3 times (familiar)
      const suggestions = Array.from(exerciseStats.values())
        .filter((s) => s.count >= 3)
        .sort((a, b) => b.daysSince - a.daysSince)
        .slice(0, limit)
        .map((s) => ({
          exercise: s.exercise,
          daysSinceLastWorkout: s.daysSince,
          timesPerformed: s.count,
          message: s.daysSince > 14
            ? `Haven't done in ${s.daysSince} days`
            : s.daysSince > 7
            ? 'Done last week'
            : 'Done recently',
        }));

      return suggestions;
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Get progression target for a single exercise
 */
export function useExerciseProgressionTarget(exerciseId: string | null) {
  const userId = useAppStore((state) => state.userId);

  return useQuery({
    queryKey: ['exerciseProgressionTarget', exerciseId],
    queryFn: async (): Promise<ProgressionTarget | null> => {
      if (!userId || !exerciseId) return null;

      // Fetch exercise details
      const { data: exercise, error: exerciseError } = await supabase
        .from('exercises')
        .select('*')
        .eq('id', exerciseId)
        .single();

      if (exerciseError) throw exerciseError;

      // Fetch last 10 sets for this exercise
      const { data: history, error: historyError } = await supabase
        .from('workout_sets')
        .select(`
          actual_weight,
          actual_reps,
          actual_rpe,
          is_warmup,
          workout:workouts!inner(
            date_completed,
            context,
            user_id
          )
        `)
        .eq('workout.user_id', userId)
        .eq('exercise_id', exerciseId)
        .not('workout.date_completed', 'is', null)
        .order('workout(date_completed)', { ascending: false })
        .limit(10);

      if (historyError) throw historyError;

      const lastSet = (history || []).find(
        (h: any) => !h.is_warmup && h.actual_weight && h.actual_reps
      );
      const lastDate = lastSet?.workout?.date_completed || null;

      let daysSinceLastWorkout: number | null = null;
      if (lastDate) {
        daysSinceLastWorkout = Math.floor(
          (new Date().getTime() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24)
        );
      }

      const suggestion = suggestProgression(
        exercise as Exercise,
        (history || []).filter((h: any) => !h.is_warmup)
      );

      return {
        exerciseId,
        exerciseName: exercise?.name || 'Unknown',
        exercise: exercise as Exercise,
        lastWeight: lastSet?.actual_weight || null,
        lastReps: lastSet?.actual_reps || null,
        lastRPE: lastSet?.actual_rpe || null,
        lastDate,
        daysSinceLastWorkout,
        targetWeight: suggestion?.targetWeight || lastSet?.actual_weight || null,
        targetReps: suggestion?.targetReps || lastSet?.actual_reps || null,
        targetRPE: suggestion?.targetRPE || null,
        message: suggestion?.message || 'No previous data',
        progressionType: suggestion?.progressionType || null,
      };
    },
    enabled: !!userId && !!exerciseId,
    staleTime: 5 * 60 * 1000,
  });
}
