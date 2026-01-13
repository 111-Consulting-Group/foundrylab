/**
 * Pattern Detection Hook
 *
 * Detects and stores training patterns for the current user.
 * Patterns include training splits, exercise pairings, and preferences.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/useAppStore';
import {
  detectAllPatterns,
  shouldOfferStructure,
  getPatternInsights,
  type DetectedPattern,
  type WorkoutForPattern,
} from '@/lib/patternDetection';
import type { PatternType } from '@/types/database';

// Query keys
export const patternKeys = {
  all: ['patterns'] as const,
  detected: (userId: string) => [...patternKeys.all, 'detected', userId] as const,
  stored: (userId: string) => [...patternKeys.all, 'stored', userId] as const,
};

interface StoredPattern {
  id: string;
  user_id: string;
  pattern_type: PatternType;
  pattern_name: string | null;
  pattern_data: Record<string, any>;
  confidence: number;
  confirmation_count: number;
  first_detected: string;
  last_confirmed: string;
  offered_structure: boolean;
  offered_at: string | null;
  structure_accepted: boolean | null;
  accepted_at: string | null;
}

/**
 * Get stored patterns from database
 */
export function useStoredPatterns() {
  const userId = useAppStore((state) => state.userId);

  return useQuery({
    queryKey: patternKeys.stored(userId || ''),
    queryFn: async (): Promise<StoredPattern[]> => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('detected_patterns')
        .select('*')
        .eq('user_id', userId)
        .order('confidence', { ascending: false });

      if (error) throw error;
      return (data || []) as StoredPattern[];
    },
    enabled: !!userId,
  });
}

/**
 * Detect patterns from workout history (computed, not stored)
 */
export function useDetectedPatterns() {
  const userId = useAppStore((state) => state.userId);

  return useQuery({
    queryKey: patternKeys.detected(userId || ''),
    queryFn: async (): Promise<DetectedPattern[]> => {
      if (!userId) return [];

      // Fetch recent workouts with exercises
      const { data: workouts, error: workoutsError } = await supabase
        .from('workouts')
        .select(`
          id,
          focus,
          date_completed,
          workout_sets(
            exercise:exercises(
              id,
              name,
              muscle_group
            )
          )
        `)
        .eq('user_id', userId)
        .not('date_completed', 'is', null)
        .order('date_completed', { ascending: false })
        .limit(30);

      if (workoutsError) throw workoutsError;
      if (!workouts || workouts.length < 4) return [];

      // Transform to WorkoutForPattern format
      const workoutsForPattern: WorkoutForPattern[] = workouts.map((w: any) => {
        const exercises: Array<{ id: string; name: string; muscle_group: string }> = [];
        const muscleGroups = new Set<string>();

        w.workout_sets?.forEach((set: any) => {
          if (set.exercise) {
            const ex = set.exercise;
            if (!exercises.find((e) => e.id === ex.id)) {
              exercises.push({
                id: ex.id,
                name: ex.name,
                muscle_group: ex.muscle_group,
              });
              muscleGroups.add(ex.muscle_group);
            }
          }
        });

        return {
          id: w.id,
          focus: w.focus || '',
          date_completed: w.date_completed,
          muscle_groups: Array.from(muscleGroups),
          exercises,
        };
      });

      // Detect patterns
      return detectAllPatterns(workoutsForPattern);
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Combined hook for all pattern data with insights
 */
export function usePatternInsights() {
  const { data: patterns, isLoading, error } = useDetectedPatterns();

  const insights = patterns ? getPatternInsights(patterns) : [];

  // Check if we should offer structure
  const structureOffer = patterns?.find(
    (p) => p.type === 'training_split' && p.confidence >= 0.7
  );

  return {
    patterns: patterns || [],
    insights,
    isLoading,
    error: error as Error | null,
    shouldOfferBlock: !!structureOffer,
    blockPattern: structureOffer,
  };
}

/**
 * Save a detected pattern to the database
 */
export function useSavePattern() {
  const userId = useAppStore((state) => state.userId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pattern: DetectedPattern) => {
      if (!userId) throw new Error('Not authenticated');

      const { error } = await supabase.from('detected_patterns').upsert(
        {
          user_id: userId,
          pattern_type: pattern.type,
          pattern_name: pattern.name,
          pattern_data: pattern.data,
          confidence: pattern.confidence,
          last_confirmed: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,pattern_type,pattern_name',
        }
      );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: patternKeys.all });
    },
  });
}

/**
 * Mark that structure was offered for a pattern
 */
export function useMarkStructureOffered() {
  const userId = useAppStore((state) => state.userId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      patternId,
      accepted,
    }: {
      patternId: string;
      accepted: boolean;
    }) => {
      if (!userId) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('detected_patterns')
        .update({
          offered_structure: true,
          offered_at: new Date().toISOString(),
          structure_accepted: accepted,
          accepted_at: accepted ? new Date().toISOString() : null,
        })
        .eq('id', patternId)
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: patternKeys.all });
    },
  });
}

/**
 * Get training split summary for display
 */
export function useTrainingSplitSummary() {
  const { data: patterns } = useDetectedPatterns();

  const splitPattern = patterns?.find((p) => p.type === 'training_split');
  const dayPattern = patterns?.find((p) => p.type === 'training_day');

  if (!splitPattern) return null;

  return {
    name: splitPattern.name,
    splits: splitPattern.data.splits as string[],
    daysPerWeek: splitPattern.data.days_per_week as number,
    confidence: splitPattern.confidence,
    preferredDays: dayPattern?.data.preferred_days as string[] | undefined,
  };
}

/**
 * Get exercise pairing suggestions
 */
export function useExercisePairings() {
  const { data: patterns } = useDetectedPatterns();

  const pairings = patterns?.filter((p) => p.type === 'exercise_pairing') || [];

  return pairings.map((p) => ({
    exercises: p.data.exercises as string[],
    coOccurrence: p.data.co_occurrence as number,
    rate: p.data.co_occurrence_rate as number,
    confidence: p.confidence,
  }));
}
