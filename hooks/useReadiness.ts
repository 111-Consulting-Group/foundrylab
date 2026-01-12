/**
 * useReadiness Hook
 *
 * Manages daily readiness check-ins for the AI coach system.
 * Tracks sleep, soreness, and stress to suggest workout adjustments.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/useAppStore';
import type {
  DailyReadiness,
  DailyReadinessInsert,
  ReadinessAdjustment,
  ReadinessAnalysis,
} from '@/types/database';

// Query keys
export const readinessKeys = {
  all: ['readiness'] as const,
  today: () => [...readinessKeys.all, 'today'] as const,
  history: (days: number) => [...readinessKeys.all, 'history', days] as const,
  date: (date: string) => [...readinessKeys.all, 'date', date] as const,
};

/**
 * Get today's readiness check-in (if exists)
 */
export function useTodaysReadiness() {
  const userId = useAppStore((state) => state.userId);
  const today = new Date().toISOString().split('T')[0];

  return useQuery({
    queryKey: readinessKeys.today(),
    queryFn: async (): Promise<DailyReadiness | null> => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from('daily_readiness')
        .select('*')
        .eq('user_id', userId)
        .eq('check_in_date', today)
        .maybeSingle(); // Use maybeSingle instead of single to handle 406 errors gracefully

      // Handle 406 (Not Acceptable) - usually means table doesn't exist or RLS issue
      if (error) {
        if (error.code === 'PGRST116') {
          // No rows found - this is fine
          return null;
        }
        if (error.code === 'PGRST301' || error.status === 406) {
          // Table doesn't exist or RLS blocking - return null gracefully
          console.warn('daily_readiness table not accessible:', error.message);
          return null;
        }
        throw error;
      }
      return data as DailyReadiness | null;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}

/**
 * Get readiness history for the past N days
 */
export function useReadinessHistory(days: number = 7) {
  const userId = useAppStore((state) => state.userId);

  return useQuery({
    queryKey: readinessKeys.history(days),
    queryFn: async (): Promise<DailyReadiness[]> => {
      if (!userId) return [];

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from('daily_readiness')
        .select('*')
        .eq('user_id', userId)
        .gte('check_in_date', startDate.toISOString().split('T')[0])
        .order('check_in_date', { ascending: false });

      // Handle 406 (Not Acceptable) - usually means table doesn't exist or RLS issue
      if (error) {
        if (error.code === 'PGRST301' || error.status === 406) {
          // Table doesn't exist or RLS blocking - return empty array gracefully
          console.warn('daily_readiness table not accessible:', error.message);
          return [];
        }
        throw error;
      }
      return data as DailyReadiness[];
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}

/**
 * Submit a readiness check-in
 */
export function useSubmitReadiness() {
  const queryClient = useQueryClient();
  const userId = useAppStore((state) => state.userId);

  return useMutation({
    mutationFn: async (
      input: Omit<DailyReadinessInsert, 'user_id'>
    ): Promise<DailyReadiness> => {
      if (!userId) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('daily_readiness')
        .upsert(
          {
            user_id: userId,
            check_in_date: input.check_in_date || new Date().toISOString().split('T')[0],
            sleep_quality: input.sleep_quality,
            muscle_soreness: input.muscle_soreness,
            stress_level: input.stress_level,
            notes: input.notes,
            adjustment_applied: input.adjustment_applied,
          },
          {
            onConflict: 'user_id,check_in_date',
          }
        )
        .select()
        .single();

      // Handle 406 (Not Acceptable) - usually means table doesn't exist or RLS issue
      if (error) {
        if (error.code === 'PGRST301' || error.status === 406) {
          throw new Error('Readiness tracking is not available. Please ensure the database migration has been applied.');
        }
        throw error;
      }
      return data as DailyReadiness;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: readinessKeys.today() });
      queryClient.invalidateQueries({ queryKey: readinessKeys.history(7) });
    },
  });
}

/**
 * Update adjustment applied for a readiness entry
 */
export function useUpdateReadinessAdjustment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      readinessId,
      adjustment,
    }: {
      readinessId: string;
      adjustment: ReadinessAdjustment | 'skipped';
    }): Promise<DailyReadiness> => {
      const { data, error } = await supabase
        .from('daily_readiness')
        .update({ adjustment_applied: adjustment })
        .eq('id', readinessId)
        .select()
        .single();

      // Handle 406 (Not Acceptable) - usually means table doesn't exist or RLS issue
      if (error) {
        if (error.code === 'PGRST301' || error.status === 406) {
          throw new Error('Readiness tracking is not available. Please ensure the database migration has been applied.');
        }
        throw error;
      }
      return data as DailyReadiness;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: readinessKeys.today() });
    },
  });
}

// ============================================================================
// Readiness Analysis Utilities
// ============================================================================

/**
 * Analyze readiness inputs and generate recommendations
 */
export function analyzeReadiness(
  sleepQuality: 1 | 2 | 3 | 4 | 5,
  muscleSoreness: 1 | 2 | 3 | 4 | 5,
  stressLevel: 1 | 2 | 3 | 4 | 5
): ReadinessAnalysis {
  // Calculate score (same formula as DB trigger)
  const score =
    sleepQuality * 8 + // 8-40 points
    (6 - muscleSoreness) * 6 + // 6-30 points (inverted)
    (6 - stressLevel) * 6; // 6-30 points (inverted)

  // Determine suggestion
  let suggestion: ReadinessAdjustment;
  let message: string;

  if (score >= 80) {
    suggestion = 'full';
    message = "You're primed for a great session. Let's push it!";
  } else if (score >= 60) {
    suggestion = 'moderate';
    message = "Solid foundation today. We'll keep intensity but watch for fatigue signals.";
  } else if (score >= 40) {
    suggestion = 'light';
    message = "Recovery day vibes. Let's dial back intensity and focus on movement quality.";
  } else {
    suggestion = 'rest';
    message = "Your body's asking for a break. Consider active recovery or rest today.";
  }

  // Analyze individual factors
  const sleepImpact = sleepQuality >= 4 ? 'positive' : sleepQuality >= 3 ? 'neutral' : 'negative';
  const sorenessImpact = muscleSoreness <= 2 ? 'positive' : muscleSoreness <= 3 ? 'neutral' : 'negative';
  const stressImpact = stressLevel <= 2 ? 'positive' : stressLevel <= 3 ? 'neutral' : 'negative';

  // Generate recommendations
  const recommendations: string[] = [];

  if (sleepQuality <= 2) {
    recommendations.push('Poor sleep detected. Consider limiting high-skill movements.');
  }
  if (muscleSoreness >= 4) {
    recommendations.push('High soreness. We\'ll reduce volume on affected muscle groups.');
  }
  if (stressLevel >= 4) {
    recommendations.push('Elevated stress. Training can help, but we\'ll keep it controlled.');
  }
  if (score >= 80) {
    recommendations.push('Great day to attempt PRs or push intensity.');
  }
  if (score >= 60 && score < 80) {
    recommendations.push('Stick to your planned weights and reps.');
  }
  if (score < 40) {
    recommendations.push('Focus on mobility, light cardio, or complete rest.');
  }

  return {
    score,
    suggestion,
    message,
    details: {
      sleepImpact,
      sorenessImpact,
      stressImpact,
    },
    recommendations,
  };
}

/**
 * Get adjustment multipliers based on readiness
 */
export function getAdjustmentMultipliers(adjustment: ReadinessAdjustment): {
  intensityMultiplier: number;
  volumeMultiplier: number;
  rpeAdjustment: number;
} {
  switch (adjustment) {
    case 'full':
      return {
        intensityMultiplier: 1.0,
        volumeMultiplier: 1.0,
        rpeAdjustment: 0,
      };
    case 'moderate':
      return {
        intensityMultiplier: 0.95,
        volumeMultiplier: 0.9,
        rpeAdjustment: -0.5,
      };
    case 'light':
      return {
        intensityMultiplier: 0.85,
        volumeMultiplier: 0.7,
        rpeAdjustment: -1,
      };
    case 'rest':
      return {
        intensityMultiplier: 0.6,
        volumeMultiplier: 0.5,
        rpeAdjustment: -2,
      };
  }
}

/**
 * Get color scheme for readiness score
 */
export function getReadinessColor(score: number): {
  bg: string;
  text: string;
  label: string;
} {
  if (score >= 80) {
    return { bg: 'bg-progress-500', text: 'text-progress-500', label: 'Excellent' };
  } else if (score >= 60) {
    return { bg: 'bg-signal-500', text: 'text-signal-500', label: 'Good' };
  } else if (score >= 40) {
    return { bg: 'bg-warning-500', text: 'text-warning-500', label: 'Moderate' };
  } else {
    return { bg: 'bg-oxide-500', text: 'text-oxide-500', label: 'Low' };
  }
}

/**
 * Format readiness metric for display
 */
export function formatReadinessMetric(
  type: 'sleep' | 'soreness' | 'stress',
  value: 1 | 2 | 3 | 4 | 5
): { emoji: string; label: string } {
  const metrics = {
    sleep: {
      1: { emoji: '😴', label: 'Terrible' },
      2: { emoji: '😕', label: 'Poor' },
      3: { emoji: '😐', label: 'Okay' },
      4: { emoji: '😊', label: 'Good' },
      5: { emoji: '🌟', label: 'Great' },
    },
    soreness: {
      1: { emoji: '💪', label: 'Fresh' },
      2: { emoji: '👍', label: 'Light' },
      3: { emoji: '😐', label: 'Moderate' },
      4: { emoji: '😣', label: 'Sore' },
      5: { emoji: '🔥', label: 'Wrecked' },
    },
    stress: {
      1: { emoji: '😌', label: 'Calm' },
      2: { emoji: '🙂', label: 'Low' },
      3: { emoji: '😐', label: 'Normal' },
      4: { emoji: '😰', label: 'High' },
      5: { emoji: '🤯', label: 'Chaos' },
    },
  };

  return metrics[type][value];
}
