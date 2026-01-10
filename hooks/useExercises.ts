import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Exercise, ExerciseInsert, ExerciseModality } from '@/types/database';

// Query keys
export const exerciseKeys = {
  all: ['exercises'] as const,
  lists: () => [...exerciseKeys.all, 'list'] as const,
  list: (filters: { modality?: ExerciseModality; muscleGroup?: string; search?: string }) =>
    [...exerciseKeys.lists(), filters] as const,
  details: () => [...exerciseKeys.all, 'detail'] as const,
  detail: (id: string) => [...exerciseKeys.details(), id] as const,
};

// Fetch all exercises with optional filters
export function useExercises(filters?: {
  modality?: ExerciseModality;
  muscleGroup?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: exerciseKeys.list(filters || {}),
    queryFn: async (): Promise<Exercise[]> => {
      let query = supabase.from('exercises').select('*').order('name');

      if (filters?.modality) {
        query = query.eq('modality', filters.modality);
      }

      if (filters?.muscleGroup) {
        query = query.eq('muscle_group', filters.muscleGroup);
      }

      if (filters?.search) {
        query = query.ilike('name', `%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Exercise[];
    },
  });
}

// Fetch single exercise by ID
export function useExercise(id: string) {
  return useQuery({
    queryKey: exerciseKeys.detail(id),
    queryFn: async (): Promise<Exercise> => {
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Exercise;
    },
    enabled: !!id,
  });
}

// Get unique muscle groups for filtering
export function useMuscleGroups() {
  return useQuery({
    queryKey: ['muscleGroups'],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('exercises')
        .select('muscle_group')
        .order('muscle_group');

      if (error) throw error;

      const uniqueGroups = [...new Set((data as { muscle_group: string }[]).map((e) => e.muscle_group))];
      return uniqueGroups;
    },
  });
}

// Create custom exercise
export function useCreateExercise() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (exercise: Omit<ExerciseInsert, 'is_custom'>): Promise<Exercise> => {
      const { data, error } = await supabase
        .from('exercises')
        .insert({ ...exercise, is_custom: true } as ExerciseInsert)
        .select()
        .single();

      if (error) throw error;
      return data as Exercise;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: exerciseKeys.all });
    },
  });
}

// Search exercises by name (for autocomplete)
export function useExerciseSearch(searchTerm: string) {
  return useQuery({
    queryKey: ['exerciseSearch', searchTerm],
    queryFn: async (): Promise<Exercise[]> => {
      if (!searchTerm || searchTerm.length < 2) {
        return [];
      }

      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .ilike('name', `%${searchTerm}%`)
        .limit(10)
        .order('name');

      if (error) throw error;
      return data as Exercise[];
    },
    enabled: searchTerm.length >= 2,
  });
}
