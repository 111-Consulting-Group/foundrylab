/**
 * useTrainingProfile Hook
 *
 * Manages the user's training profile - learned preferences, recovery patterns,
 * and periodization state. This data evolves over time as the user trains.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/useAppStore';
import type {
  TrainingProfile,
  TrainingProfileUpdate,
  TrainingExperience,
  TrainingGoal,
  TrainingPhase,
} from '@/types/database';

// Query keys
export const profileKeys = {
  all: ['trainingProfile'] as const,
  current: () => [...profileKeys.all, 'current'] as const,
};

/**
 * Get the current user's training profile
 */
export function useTrainingProfile() {
  const userId = useAppStore((state) => state.userId);

  return useQuery({
    queryKey: profileKeys.current(),
    queryFn: async (): Promise<TrainingProfile | null> => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from('training_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
      return data as TrainingProfile | null;
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000, // 10 minutes - profile doesn't change often
    gcTime: 60 * 60 * 1000, // 1 hour
  });
}

/**
 * Update the training profile
 */
export function useUpdateTrainingProfile() {
  const queryClient = useQueryClient();
  const userId = useAppStore((state) => state.userId);

  return useMutation({
    mutationFn: async (updates: TrainingProfileUpdate): Promise<TrainingProfile> => {
      if (!userId) throw new Error('User not authenticated');

      // Upsert to handle case where profile doesn't exist yet
      const { data, error } = await supabase
        .from('training_profiles')
        .upsert(
          {
            user_id: userId,
            ...updates,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id',
          }
        )
        .select()
        .single();

      if (error) throw error;
      return data as TrainingProfile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.current() });
    },
  });
}

/**
 * Set initial training experience and goal (onboarding)
 */
export function useSetupTrainingProfile() {
  const queryClient = useQueryClient();
  const userId = useAppStore((state) => state.userId);

  return useMutation({
    mutationFn: async ({
      experience,
      goal,
      weeklyDays,
    }: {
      experience: TrainingExperience;
      goal: TrainingGoal;
      weeklyDays?: number;
    }): Promise<TrainingProfile> => {
      if (!userId) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('training_profiles')
        .upsert(
          {
            user_id: userId,
            training_experience: experience,
            primary_goal: goal,
            typical_weekly_days: weeklyDays || null,
            current_training_phase: 'accumulation', // Default starting phase
          },
          {
            onConflict: 'user_id',
          }
        )
        .select()
        .single();

      if (error) throw error;
      return data as TrainingProfile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.current() });
    },
  });
}

/**
 * Update training phase
 */
export function useUpdateTrainingPhase() {
  const queryClient = useQueryClient();
  const userId = useAppStore((state) => state.userId);

  return useMutation({
    mutationFn: async ({
      phase,
      resetWeeks = true,
    }: {
      phase: TrainingPhase;
      resetWeeks?: boolean;
    }): Promise<TrainingProfile> => {
      if (!userId) throw new Error('User not authenticated');

      const updates: Partial<TrainingProfile> = {
        current_training_phase: phase,
      };

      if (resetWeeks) {
        updates.weeks_in_current_phase = 0;
      }

      const { data, error } = await supabase
        .from('training_profiles')
        .update(updates)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return data as TrainingProfile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.current() });
    },
  });
}

/**
 * Add exercise to preferred list (learned from behavior)
 */
export function useAddPreferredExercise() {
  const queryClient = useQueryClient();
  const userId = useAppStore((state) => state.userId);

  return useMutation({
    mutationFn: async (exerciseId: string): Promise<void> => {
      if (!userId) throw new Error('User not authenticated');

      // Get current profile
      const { data: profile } = await supabase
        .from('training_profiles')
        .select('preferred_exercises')
        .eq('user_id', userId)
        .single();

      const currentPreferred = (profile?.preferred_exercises as string[]) || [];

      // Don't add duplicates
      if (currentPreferred.includes(exerciseId)) return;

      // Keep max 20 preferred exercises
      const newPreferred = [...currentPreferred, exerciseId].slice(-20);

      const { error } = await supabase
        .from('training_profiles')
        .upsert(
          {
            user_id: userId,
            preferred_exercises: newPreferred,
          },
          { onConflict: 'user_id' }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.current() });
    },
  });
}

/**
 * Add exercise to avoided list (learned from substitutions)
 */
export function useAddAvoidedExercise() {
  const queryClient = useQueryClient();
  const userId = useAppStore((state) => state.userId);

  return useMutation({
    mutationFn: async (exerciseId: string): Promise<void> => {
      if (!userId) throw new Error('User not authenticated');

      const { data: profile } = await supabase
        .from('training_profiles')
        .select('avoided_exercises')
        .eq('user_id', userId)
        .single();

      const currentAvoided = (profile?.avoided_exercises as string[]) || [];

      if (currentAvoided.includes(exerciseId)) return;

      const newAvoided = [...currentAvoided, exerciseId].slice(-20);

      const { error } = await supabase
        .from('training_profiles')
        .upsert(
          {
            user_id: userId,
            avoided_exercises: newAvoided,
          },
          { onConflict: 'user_id' }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.current() });
    },
  });
}

// ============================================================================
// Profile Analysis Utilities
// ============================================================================

/**
 * Determine if user needs onboarding (no profile or incomplete)
 */
export function needsOnboarding(profile: TrainingProfile | null): boolean {
  if (!profile) return true;
  return !profile.training_experience || !profile.primary_goal;
}

/**
 * Get training phase recommendations
 */
export function getPhaseRecommendation(
  profile: TrainingProfile,
  weeksSinceBlockStart: number
): {
  suggestedPhase: TrainingPhase;
  reason: string;
} {
  const currentPhase = profile.current_training_phase || 'accumulation';
  const weeksInPhase = profile.weeks_in_current_phase || 0;

  // Standard periodization cycle
  if (currentPhase === 'accumulation' && weeksInPhase >= 4) {
    return {
      suggestedPhase: 'intensification',
      reason: "You've built a solid volume base. Time to increase intensity.",
    };
  }

  if (currentPhase === 'intensification' && weeksInPhase >= 3) {
    return {
      suggestedPhase: 'realization',
      reason: 'Intensity is peaking. Perfect time to test your strength.',
    };
  }

  if (currentPhase === 'realization' && weeksInPhase >= 2) {
    return {
      suggestedPhase: 'deload',
      reason: "You've pushed hard. Let's recover before the next cycle.",
    };
  }

  if (currentPhase === 'deload' && weeksInPhase >= 1) {
    return {
      suggestedPhase: 'accumulation',
      reason: 'Recovered and ready. Starting a new training cycle.',
    };
  }

  // Stay in current phase
  return {
    suggestedPhase: currentPhase,
    reason: `Continuing ${currentPhase} phase (week ${weeksInPhase + 1}).`,
  };
}

/**
 * Get experience-based defaults
 */
export function getExperienceDefaults(experience: TrainingExperience): {
  defaultRPE: number;
  volumeMultiplier: number;
  suggestedFrequency: number;
  progressionRate: number; // % per week
} {
  switch (experience) {
    case 'beginner':
      return {
        defaultRPE: 7,
        volumeMultiplier: 0.7,
        suggestedFrequency: 3,
        progressionRate: 2.5, // Beginners progress faster
      };
    case 'intermediate':
      return {
        defaultRPE: 8,
        volumeMultiplier: 1.0,
        suggestedFrequency: 4,
        progressionRate: 1.0,
      };
    case 'advanced':
      return {
        defaultRPE: 8.5,
        volumeMultiplier: 1.2,
        suggestedFrequency: 5,
        progressionRate: 0.5, // Advanced progress slower
      };
  }
}

/**
 * Get goal-based training emphasis
 */
export function getGoalEmphasis(goal: TrainingGoal): {
  repRangeEmphasis: { low: number; high: number };
  intensityFocus: 'high' | 'moderate' | 'varied';
  volumeFocus: 'high' | 'moderate' | 'low';
  restPeriods: 'short' | 'moderate' | 'long';
} {
  switch (goal) {
    case 'strength':
    case 'powerlifting':
      return {
        repRangeEmphasis: { low: 1, high: 5 },
        intensityFocus: 'high',
        volumeFocus: 'moderate',
        restPeriods: 'long',
      };
    case 'hypertrophy':
    case 'bodybuilding':
      return {
        repRangeEmphasis: { low: 8, high: 12 },
        intensityFocus: 'moderate',
        volumeFocus: 'high',
        restPeriods: 'moderate',
      };
    case 'athletic':
      return {
        repRangeEmphasis: { low: 3, high: 8 },
        intensityFocus: 'varied',
        volumeFocus: 'moderate',
        restPeriods: 'moderate',
      };
    case 'general':
    default:
      return {
        repRangeEmphasis: { low: 5, high: 10 },
        intensityFocus: 'moderate',
        volumeFocus: 'moderate',
        restPeriods: 'moderate',
      };
  }
}
