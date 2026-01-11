/**
 * Exercise Substitution Hook
 *
 * Suggests alternative exercises based on:
 * - Same primary muscle group
 * - Same modality (Strength/Cardio/Mobility)
 * - User's exercise history (exercises they've done before)
 */

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/useAppStore';
import type { Exercise } from '@/types/database';

export interface ExerciseSubstitution {
  exercise: Exercise;
  reason: string;
  score: number; // Higher = better match
  hasHistory: boolean; // User has done this exercise before
}

/**
 * Get substitution suggestions for an exercise
 */
export function useExerciseSubstitutions(
  exerciseId: string,
  options?: {
    limit?: number;
    includeVariations?: boolean;
  }
): {
  data: ExerciseSubstitution[];
  isLoading: boolean;
} {
  const userId = useAppStore((state) => state.userId);
  const { limit = 5, includeVariations = true } = options || {};

  const { data, isLoading } = useQuery({
    queryKey: ['exerciseSubstitutions', exerciseId, userId, limit],
    queryFn: async (): Promise<ExerciseSubstitution[]> => {
      if (!exerciseId) return [];

      // Get the source exercise details
      const { data: sourceExercise, error: sourceError } = await supabase
        .from('exercises')
        .select('*')
        .eq('id', exerciseId)
        .single();

      if (sourceError || !sourceExercise) return [];

      // Get user's exercise history (exercises they've done)
      let userExerciseIds: string[] = [];
      if (userId) {
        const { data: userHistory } = await supabase
          .from('workout_sets')
          .select('exercise_id, workout:workouts!inner(user_id)')
          .eq('workout.user_id', userId)
          .not('actual_weight', 'is', null);

        if (userHistory) {
          userExerciseIds = [...new Set(userHistory.map((h) => h.exercise_id))];
        }
      }

      // Build query for similar exercises
      let query = supabase
        .from('exercises')
        .select('*')
        .neq('id', exerciseId);

      // Filter by muscle group and modality
      if (sourceExercise.muscle_group) {
        query = query.eq('muscle_group', sourceExercise.muscle_group);
      }
      if (sourceExercise.modality) {
        query = query.eq('modality', sourceExercise.modality);
      }

      const { data: candidates, error: candidatesError } = await query.limit(50);

      if (candidatesError || !candidates) return [];

      // Score and rank candidates
      const scored: ExerciseSubstitution[] = candidates.map((candidate) => {
        let score = 0;
        const reasons: string[] = [];

        // Same muscle group (base match)
        if (candidate.muscle_group === sourceExercise.muscle_group) {
          score += 10;
          reasons.push(`Works ${candidate.muscle_group}`);
        }

        // Same modality
        if (candidate.modality === sourceExercise.modality) {
          score += 5;
        }

        // User has done this exercise before (familiarity bonus)
        const hasHistory = userExerciseIds.includes(candidate.id);
        if (hasHistory) {
          score += 8;
          reasons.push("You've done this before");
        }

        // Similar name patterns (variations)
        if (includeVariations) {
          const sourceName = sourceExercise.name.toLowerCase();
          const candidateName = candidate.name.toLowerCase();

          // Check for common exercise patterns
          const sourceWords = sourceName.split(' ');
          const candidateWords = candidateName.split(' ');
          const sharedWords = sourceWords.filter((w) =>
            candidateWords.includes(w) && w.length > 3
          );

          if (sharedWords.length > 0) {
            score += sharedWords.length * 3;
            reasons.push('Similar movement');
          }
        }

        // Equipment consideration (prefer same equipment type)
        // This would require equipment data in the exercise table
        // For now, we infer from name
        const equipmentPatterns = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'];
        for (const pattern of equipmentPatterns) {
          const sourceHas = sourceExercise.name.toLowerCase().includes(pattern);
          const candidateHas = candidate.name.toLowerCase().includes(pattern);
          if (sourceHas && candidateHas) {
            score += 2;
          }
        }

        // Build reason string
        let reason = reasons[0] || `Same ${sourceExercise.muscle_group} exercise`;
        if (hasHistory && reasons.length > 1) {
          reason = reasons.slice(0, 2).join(' • ');
        }

        return {
          exercise: candidate,
          reason,
          score,
          hasHistory,
        };
      });

      // Sort by score (descending) and take top results
      return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    },
    enabled: !!exerciseId,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  return { data: data || [], isLoading };
}

/**
 * Get quick substitution suggestions (for inline display)
 */
export function useQuickSubstitutions(exerciseId: string): {
  data: Exercise[];
  isLoading: boolean;
} {
  const { data, isLoading } = useExerciseSubstitutions(exerciseId, { limit: 3 });

  return {
    data: data.map((s) => s.exercise),
    isLoading,
  };
}
