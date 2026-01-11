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
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
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
    staleTime: 1 * 60 * 1000, // 1 minute - recent PRs change more frequently
    gcTime: 5 * 60 * 1000, // 5 minutes
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

// Main lift names for PR leaderboard
const mainLifts = [
  'Barbell Back Squat',
  'Barbell Bench Press',
  'Conventional Deadlift',
  'Overhead Press',
  'Barbell Row',
];

// Get PR leaderboard for main lifts - single query with join
export function useMainLiftPRs() {
  const userId = useAppStore((state) => state.userId);

  return useQuery({
    queryKey: ['mainLiftPRs', userId],
    queryFn: async () => {
      if (!userId) return [];

      // Single query: fetch all e1rm PRs for main lifts with exercise data
      const { data, error } = await supabase
        .from('personal_records')
        .select(`
          *,
          exercise:exercises!inner(id, name)
        `)
        .eq('user_id', userId)
        .eq('record_type', 'e1rm')
        .in('exercise.name', mainLifts)
        .order('value', { ascending: false });

      if (error) throw error;

      // Group by exercise and take the best PR for each
      const prsByExercise = new Map<string, {
        exerciseId: string;
        exerciseName: string;
        e1rm: number | null;
        achievedAt: string | null;
      }>();

      type PRWithExercise = PersonalRecord & {
        exercise: { id: string; name: string };
      };

      for (const pr of (data as PRWithExercise[]) || []) {
        const exerciseId = pr.exercise.id;
        // Since we ordered by value desc, first one for each exercise is the best
        if (!prsByExercise.has(exerciseId)) {
          prsByExercise.set(exerciseId, {
            exerciseId,
            exerciseName: pr.exercise.name,
            e1rm: pr.value,
            achievedAt: pr.achieved_at,
          });
        }
      }

      // Ensure all main lifts are represented (even with null values)
      const { data: allMainExercises } = await supabase
        .from('exercises')
        .select('id, name')
        .in('name', mainLifts);

      const result = (allMainExercises || []).map((ex) => {
        const existing = prsByExercise.get(ex.id);
        return existing || {
          exerciseId: ex.id,
          exerciseName: ex.name,
          e1rm: null,
          achievedAt: null,
        };
      });

      return result;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
  });
}
