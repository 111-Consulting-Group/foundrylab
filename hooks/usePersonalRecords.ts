import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/useAppStore';
import type { PersonalRecord, PersonalRecordInsert, RecordType } from '@/types/database';

// Query keys
export const prKeys = {
  all: ['personalRecords'] as const,
  lists: () => [...prKeys.all, 'list'] as const,
  byExercise: (exerciseId: string) => [...prKeys.lists(), exerciseId] as const,
  recent: (limit?: number) => [...prKeys.all, 'recent', limit] as const,
};

// Fetch PRs for a specific exercise
export function useExercisePRs(exerciseId: string) {
  const userId = useAppStore((state) => state.userId);

  return useQuery({
    queryKey: prKeys.byExercise(exerciseId),
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('personal_records')
        .select(`
          *,
          exercise:exercises(name, modality)
        `)
        .eq('user_id', userId)
        .eq('exercise_id', exerciseId)
        .order('achieved_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!userId && !!exerciseId,
  });
}

// Fetch recent PRs across all exercises
export function useRecentPRs(limit: number = 10) {
  const userId = useAppStore((state) => state.userId);

  return useQuery({
    queryKey: prKeys.recent(limit),
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('personal_records')
        .select(`
          *,
          exercise:exercises(name, modality)
        `)
        .eq('user_id', userId)
        .order('achieved_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}

// Record a new PR
export function useRecordPR() {
  const queryClient = useQueryClient();
  const userId = useAppStore((state) => state.userId);

  return useMutation({
    mutationFn: async (pr: Omit<PersonalRecordInsert, 'user_id'>): Promise<PersonalRecord> => {
      if (!userId) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('personal_records')
        .insert({ ...pr, user_id: userId } as PersonalRecordInsert)
        .select()
        .single();

      if (error) throw error;
      return data as PersonalRecord;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: prKeys.all });
      queryClient.invalidateQueries({ queryKey: prKeys.byExercise(data.exercise_id) });
    },
  });
}

// Check if a set is a PR and record it if so
export function useCheckAndRecordPR() {
  const queryClient = useQueryClient();
  const userId = useAppStore((state) => state.userId);

  return useMutation({
    mutationFn: async ({
      exerciseId,
      workoutSetId,
      weight,
      reps,
      watts,
    }: {
      exerciseId: string;
      workoutSetId: string;
      weight?: number;
      reps?: number;
      watts?: number;
    }): Promise<PersonalRecord[]> => {
      if (!userId) throw new Error('User not authenticated');

      const prsToRecord: PersonalRecordInsert[] = [];

      // Check weight PR
      if (weight) {
        const { data: existingWeightPR } = await supabase
          .from('personal_records')
          .select('value')
          .eq('user_id', userId)
          .eq('exercise_id', exerciseId)
          .eq('record_type', 'weight' as RecordType)
          .order('value', { ascending: false })
          .limit(1)
          .single();

        const existingValue = (existingWeightPR as { value: number } | null)?.value;
        if (!existingValue || weight > existingValue) {
          prsToRecord.push({
            user_id: userId,
            exercise_id: exerciseId,
            workout_set_id: workoutSetId,
            record_type: 'weight',
            value: weight,
            unit: 'lbs',
            achieved_at: new Date().toISOString(),
          });
        }
      }

      // Check e1RM PR (if weight and reps)
      if (weight && reps) {
        const e1rm = Math.round(weight * (1 + reps / 30)); // Epley formula

        const { data: existingE1rmPR } = await supabase
          .from('personal_records')
          .select('value')
          .eq('user_id', userId)
          .eq('exercise_id', exerciseId)
          .eq('record_type', 'e1rm' as RecordType)
          .order('value', { ascending: false })
          .limit(1)
          .single();

        const existingE1rm = (existingE1rmPR as { value: number } | null)?.value;
        if (!existingE1rm || e1rm > existingE1rm) {
          prsToRecord.push({
            user_id: userId,
            exercise_id: exerciseId,
            workout_set_id: workoutSetId,
            record_type: 'e1rm',
            value: e1rm,
            unit: 'lbs',
            achieved_at: new Date().toISOString(),
          });
        }
      }

      // Check watts PR
      if (watts) {
        const { data: existingWattsPR } = await supabase
          .from('personal_records')
          .select('value')
          .eq('user_id', userId)
          .eq('exercise_id', exerciseId)
          .eq('record_type', 'watts' as RecordType)
          .order('value', { ascending: false })
          .limit(1)
          .single();

        const existingWatts = (existingWattsPR as { value: number } | null)?.value;
        if (!existingWatts || watts > existingWatts) {
          prsToRecord.push({
            user_id: userId,
            exercise_id: exerciseId,
            workout_set_id: workoutSetId,
            record_type: 'watts',
            value: watts,
            unit: 'W',
            achieved_at: new Date().toISOString(),
          });
        }
      }

      // Record all new PRs
      if (prsToRecord.length > 0) {
        const { data, error } = await supabase
          .from('personal_records')
          .insert(prsToRecord)
          .select();

        if (error) throw error;

        // Mark the set as a PR
        await supabase
          .from('workout_sets')
          .update({ is_pr: true })
          .eq('id', workoutSetId);

        return data as PersonalRecord[];
      }

      return [];
    },
    onSuccess: (data) => {
      if (data.length > 0) {
        queryClient.invalidateQueries({ queryKey: prKeys.all });
      }
    },
  });
}

// Get PR leaderboard for main lifts
export function useMainLiftPRs() {
  const userId = useAppStore((state) => state.userId);

  return useQuery({
    queryKey: ['mainLiftPRs'],
    queryFn: async () => {
      if (!userId) return [];

      const mainLifts = [
        'Barbell Back Squat',
        'Barbell Bench Press',
        'Conventional Deadlift',
        'Overhead Press',
        'Barbell Row',
      ];

      const { data: exercises, error: exerciseError } = await supabase
        .from('exercises')
        .select('id, name')
        .in('name', mainLifts);

      if (exerciseError) throw exerciseError;

      const typedExercises = exercises as { id: string; name: string }[];

      const prs = await Promise.all(
        typedExercises.map(async (exercise) => {
          const { data: pr } = await supabase
            .from('personal_records')
            .select('*')
            .eq('user_id', userId)
            .eq('exercise_id', exercise.id)
            .eq('record_type', 'e1rm' as RecordType)
            .order('value', { ascending: false })
            .limit(1)
            .single();

          const typedPR = pr as PersonalRecord | null;

          return {
            exerciseId: exercise.id,
            exerciseName: exercise.name,
            e1rm: typedPR?.value || null,
            achievedAt: typedPR?.achieved_at || null,
          };
        })
      );

      return prs;
    },
    enabled: !!userId,
  });
}
