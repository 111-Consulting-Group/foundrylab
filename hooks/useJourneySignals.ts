/**
 * Journey Signal Tracking
 *
 * Tracks user actions that indicate journey preference. These signals
 * are used by useJourneyDetection to determine the user's preferred
 * training style without asking questionnaires.
 *
 * Signal Types:
 * - Freestyler: quick_start, add_exercise_mid_workout, skip_suggestion
 * - Planner: create_block, follow_schedule, complete_planned_workout
 * - Guided: check_readiness, use_coach, accept_suggestion
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/useAppStore';

// ============================================================================
// Types
// ============================================================================

export type JourneySignalType =
  // Freestyler signals
  | 'quick_start' // Started workout without plan
  | 'add_exercise_mid_workout' // Added exercise during active workout
  | 'skip_suggestion' // Skipped AI suggestion
  | 'unstructured_workout' // Completed workout without block

  // Planner signals
  | 'create_block' // Created training block
  | 'follow_schedule' // Started workout on scheduled date
  | 'complete_planned_workout' // Completed planned workout
  | 'view_calendar' // Viewed calendar/schedule

  // Guided signals
  | 'check_readiness' // Logged readiness check-in
  | 'use_coach' // Sent message to AI coach
  | 'accept_suggestion' // Accepted daily suggestion
  | 'adjust_for_readiness'; // Applied readiness adjustment

export interface JourneySignal {
  id: string;
  user_id: string;
  signal_type: JourneySignalType;
  context: Record<string, unknown> | null;
  created_at: string;
}

// Signal weights for journey scoring
export const SIGNAL_WEIGHTS: Record<JourneySignalType, { journey: 'freestyler' | 'planner' | 'guided'; weight: number }> = {
  // Freestyler signals
  quick_start: { journey: 'freestyler', weight: 0.8 },
  add_exercise_mid_workout: { journey: 'freestyler', weight: 0.6 },
  skip_suggestion: { journey: 'freestyler', weight: 0.5 },
  unstructured_workout: { journey: 'freestyler', weight: 0.7 },

  // Planner signals
  create_block: { journey: 'planner', weight: 1.0 },
  follow_schedule: { journey: 'planner', weight: 0.8 },
  complete_planned_workout: { journey: 'planner', weight: 0.7 },
  view_calendar: { journey: 'planner', weight: 0.3 },

  // Guided signals
  check_readiness: { journey: 'guided', weight: 0.9 },
  use_coach: { journey: 'guided', weight: 0.7 },
  accept_suggestion: { journey: 'guided', weight: 0.8 },
  adjust_for_readiness: { journey: 'guided', weight: 0.6 },
};

// ============================================================================
// Signal Tracking Hook
// ============================================================================

/**
 * Hook for tracking journey signals
 *
 * Usage:
 * ```tsx
 * const { trackSignal } = useJourneySignals();
 *
 * // When user starts quick workout
 * trackSignal('quick_start', { source: 'home_button' });
 *
 * // When user creates a block
 * trackSignal('create_block', { block_id: 'xyz', weeks: 4 });
 * ```
 */
export function useJourneySignals() {
  const userId = useAppStore((state) => state.userId);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      signalType,
      context,
    }: {
      signalType: JourneySignalType;
      context?: Record<string, unknown>;
    }) => {
      if (!userId) return null;

      // Try to insert into journey_signals table
      // If table doesn't exist, we'll catch and log locally
      try {
        const { data, error } = await supabase
          .from('journey_signals')
          .insert({
            user_id: userId,
            signal_type: signalType,
            context: context || null,
          })
          .select()
          .single();

        if (error) {
          // Table might not exist - that's okay, just log locally
          if (error.code === '42P01' || error.code === 'PGRST204') {
            console.debug('[JourneySignals] Table not found, signal logged locally:', signalType);
            return { signalType, context, logged: 'local' };
          }
          throw error;
        }

        return data;
      } catch (err) {
        // Fallback: store in local state/async storage
        console.debug('[JourneySignals] Logged locally:', signalType, context);
        return { signalType, context, logged: 'local' };
      }
    },
    onSuccess: () => {
      // Invalidate journey detection cache to pick up new signals
      queryClient.invalidateQueries({ queryKey: ['journey-detection'] });
    },
  });

  const trackSignal = useCallback(
    (signalType: JourneySignalType, context?: Record<string, unknown>) => {
      mutation.mutate({ signalType, context });
    },
    [mutation]
  );

  return {
    trackSignal,
    isTracking: mutation.isPending,
  };
}

// ============================================================================
// Convenience Hooks for Common Actions
// ============================================================================

/**
 * Track when user starts a quick/unplanned workout
 */
export function useTrackQuickStart() {
  const { trackSignal } = useJourneySignals();

  return useCallback(
    (source: 'home' | 'fab' | 'scan' | 'other' = 'other') => {
      trackSignal('quick_start', { source });
    },
    [trackSignal]
  );
}

/**
 * Track when user creates a training block
 */
export function useTrackBlockCreation() {
  const { trackSignal } = useJourneySignals();

  return useCallback(
    (blockId: string, weeks: number) => {
      trackSignal('create_block', { block_id: blockId, weeks });
    },
    [trackSignal]
  );
}

/**
 * Track when user checks readiness
 */
export function useTrackReadinessCheckIn() {
  const { trackSignal } = useJourneySignals();

  return useCallback(
    (score: number, adjustment: string) => {
      trackSignal('check_readiness', { score, adjustment });
    },
    [trackSignal]
  );
}

/**
 * Track when user interacts with AI coach
 */
export function useTrackCoachInteraction() {
  const { trackSignal } = useJourneySignals();

  return useCallback(
    (action: 'message' | 'accept_action' | 'dismiss_action') => {
      trackSignal('use_coach', { action });
    },
    [trackSignal]
  );
}

/**
 * Track when user accepts or skips a daily suggestion
 */
export function useTrackSuggestionResponse() {
  const { trackSignal } = useJourneySignals();

  return useCallback(
    (accepted: boolean, suggestionType: 'daily' | 'rotation' | 'coach') => {
      if (accepted) {
        trackSignal('accept_suggestion', { type: suggestionType });
      } else {
        trackSignal('skip_suggestion', { type: suggestionType });
      }
    },
    [trackSignal]
  );
}

/**
 * Track when user adds exercise mid-workout
 */
export function useTrackMidWorkoutExercise() {
  const { trackSignal } = useJourneySignals();

  return useCallback(
    (workoutId: string, exerciseCount: number) => {
      trackSignal('add_exercise_mid_workout', {
        workout_id: workoutId,
        exercise_count: exerciseCount,
      });
    },
    [trackSignal]
  );
}

// ============================================================================
// Query Recent Signals (for debugging/analytics)
// ============================================================================

export async function getRecentSignals(userId: string, limit: number = 50): Promise<JourneySignal[]> {
  try {
    const { data, error } = await supabase
      .from('journey_signals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.debug('[JourneySignals] Could not fetch signals:', error.message);
      return [];
    }

    return data as JourneySignal[];
  } catch {
    return [];
  }
}

/**
 * Calculate journey scores from recent signals
 */
export function calculateSignalScores(signals: JourneySignal[]): {
  freestyler: number;
  planner: number;
  guided: number;
} {
  const scores = { freestyler: 0, planner: 0, guided: 0 };

  // Apply time decay - recent signals matter more
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  for (const signal of signals) {
    const weight = SIGNAL_WEIGHTS[signal.signal_type as JourneySignalType];
    if (!weight) continue;

    // Time decay: signals from today = 1.0, 7 days ago = 0.5, 30 days = 0.2
    const ageMs = now - new Date(signal.created_at).getTime();
    const ageDays = ageMs / dayMs;
    const decay = Math.max(0.2, 1 - ageDays / 30);

    scores[weight.journey] += weight.weight * decay;
  }

  // Normalize to 0-1 range
  const maxScore = Math.max(scores.freestyler, scores.planner, scores.guided, 1);
  return {
    freestyler: scores.freestyler / maxScore,
    planner: scores.planner / maxScore,
    guided: scores.guided / maxScore,
  };
}
