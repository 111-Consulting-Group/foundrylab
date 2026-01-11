/**
 * Workout Templates Hook
 *
 * Manages saving, loading, and using workout templates
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/useAppStore';
import type { WorkoutTemplate, WorkoutTemplateExercise, WorkoutTemplateInsert } from '@/types/database';

/**
 * Get user's workout templates
 */
export function useWorkoutTemplates(): {
  data: WorkoutTemplate[];
  isLoading: boolean;
} {
  const userId = useAppStore((state) => state.userId);

  const { data, isLoading } = useQuery({
    queryKey: ['workoutTemplates', userId],
    queryFn: async (): Promise<WorkoutTemplate[]> => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('workout_templates')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Parse exercises JSON for each template
      return (data || []).map((template) => ({
        ...template,
        exercises: template.exercises as WorkoutTemplateExercise[],
      }));
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return { data: data || [], isLoading };
}

/**
 * Get a single workout template
 */
export function useWorkoutTemplate(templateId: string): {
  data: WorkoutTemplate | null;
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery({
    queryKey: ['workoutTemplate', templateId],
    queryFn: async (): Promise<WorkoutTemplate | null> => {
      if (!templateId) return null;

      const { data, error } = await supabase
        .from('workout_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (error) return null;

      return {
        ...data,
        exercises: data.exercises as WorkoutTemplateExercise[],
      };
    },
    enabled: !!templateId,
  });

  return { data: data || null, isLoading };
}

/**
 * Create a new workout template
 */
export function useCreateWorkoutTemplate() {
  const queryClient = useQueryClient();
  const userId = useAppStore((state) => state.userId);

  return useMutation({
    mutationFn: async (template: Omit<WorkoutTemplateInsert, 'user_id'>): Promise<WorkoutTemplate> => {
      if (!userId) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('workout_templates')
        .insert({
          ...template,
          user_id: userId,
          exercises: template.exercises as unknown as object,
        })
        .select()
        .single();

      if (error) throw error;

      return {
        ...data,
        exercises: data.exercises as WorkoutTemplateExercise[],
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workoutTemplates'] });
    },
  });
}

/**
 * Update a workout template
 */
export function useUpdateWorkoutTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Omit<WorkoutTemplate, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;
    }): Promise<WorkoutTemplate> => {
      const updateData = {
        ...updates,
        exercises: updates.exercises as unknown as object,
      };

      const { data, error } = await supabase
        .from('workout_templates')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return {
        ...data,
        exercises: data.exercises as WorkoutTemplateExercise[],
      };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workoutTemplates'] });
      queryClient.invalidateQueries({ queryKey: ['workoutTemplate', variables.id] });
    },
  });
}

/**
 * Delete a workout template
 */
export function useDeleteWorkoutTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateId: string): Promise<void> => {
      const { error } = await supabase
        .from('workout_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workoutTemplates'] });
    },
  });
}

/**
 * Helper to convert a completed workout to a template
 */
export interface WorkoutForTemplate {
  focus: string;
  exercises: {
    exercise_id: string;
    exercise_name: string;
    sets: {
      actual_weight?: number | null;
      actual_reps?: number | null;
      actual_rpe?: number | null;
    }[];
  }[];
  duration_minutes?: number;
}

export function workoutToTemplate(
  workout: WorkoutForTemplate,
  name: string,
  description?: string
): Omit<WorkoutTemplateInsert, 'user_id'> {
  const exercises: WorkoutTemplateExercise[] = workout.exercises.map((ex) => {
    // Calculate average weight and reps from sets
    const validSets = ex.sets.filter((s) => s.actual_reps);
    const avgWeight = validSets.length > 0
      ? Math.round(validSets.reduce((sum, s) => sum + (s.actual_weight || 0), 0) / validSets.length)
      : undefined;
    const avgReps = validSets.length > 0
      ? Math.round(validSets.reduce((sum, s) => sum + (s.actual_reps || 0), 0) / validSets.length)
      : undefined;
    const avgRpe = validSets.length > 0
      ? Math.round(validSets.reduce((sum, s) => sum + (s.actual_rpe || 8), 0) / validSets.length)
      : undefined;

    return {
      exercise_id: ex.exercise_id,
      exercise_name: ex.exercise_name,
      sets: ex.sets.length,
      target_reps: avgReps,
      target_weight: avgWeight,
      target_rpe: avgRpe,
    };
  });

  return {
    name,
    description: description || null,
    focus: workout.focus || null,
    exercises,
    estimated_duration: workout.duration_minutes || null,
    is_public: false,
  };
}
