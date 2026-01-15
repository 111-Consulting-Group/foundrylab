import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/useAppStore';
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
    staleTime: 30 * 60 * 1000, // 30 minutes - exercise data rarely changes
    gcTime: 60 * 60 * 1000, // 1 hour
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
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
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
    staleTime: 60 * 60 * 1000, // 1 hour - almost never changes
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
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

// Create pending exercise (for unmatched exercises from scan)
export function useCreatePendingExercise() {
  const queryClient = useQueryClient();
  const userId = useAppStore((state) => state.userId);

  return useMutation({
    mutationFn: async (exercise: {
      name: string;
      muscle_group: string;
      equipment?: string | null;
      modality?: ExerciseModality;
    }): Promise<Exercise> => {
      if (!userId) throw new Error('User must be logged in to create exercises');

      const { data, error } = await supabase
        .from('exercises')
        .insert({
          ...exercise,
          is_custom: true,
          created_by: userId,
          status: 'pending',
          modality: exercise.modality || 'Strength',
          primary_metric: 'Weight',
        } as ExerciseInsert)
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
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  });
}
