/**
 * Journey Detection Hook
 *
 * Intelligently detects which user journey (Freestyler, Planner, Guided) a user
 * gravitates toward based on their BEHAVIOR, not questionnaires.
 *
 * Signals we observe:
 * - Freestyler: Ad-hoc workouts, no blocks, adds exercises mid-workout
 * - Planner: Uses AI blocks, follows scheduled workouts, completes in order
 * - Guided: Regular readiness, uses coach, follows daily suggestions
 */

import { useQuery } from '@tanstack/react-query';
import { differenceInDays } from 'date-fns';

import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/useAppStore';
import type { TrainingBlock, Workout, DailyReadiness } from '@/types/database';

// ============================================================================
// Types
// ============================================================================

export type UserJourney = 'freestyler' | 'planner' | 'guided';

export interface JourneySignals {
  // Freestyler signals
  unstructuredWorkouts: number; // Workouts without block_id
  exercisesAddedMidWorkout: number; // Times user added exercises during workout
  quickStartUsage: number; // Times user started workout without plan

  // Planner signals
  blockWorkoutsCompleted: number; // Workouts completed within a block
  blocksCreated: number; // Number of training blocks created
  scheduledWorkoutsFollowed: number; // Workouts done on scheduled date

  // Guided signals
  readinessCheckIns: number; // Recent readiness check-ins
  coachInteractions: number; // Messages sent to AI coach
  dailySuggestionsUsed: number; // Daily suggestions accepted
}

export interface JourneyScores {
  freestyler: number; // 0-1 affinity score
  planner: number;
  guided: number;
}

export interface JourneyDetectionResult {
  // Current detected journey
  primaryJourney: UserJourney;
  confidence: 'low' | 'medium' | 'high';

  // Affinity scores for each journey (0-1)
  scores: JourneyScores;

  // Raw signals used for detection
  signals: JourneySignals;

  // Suggested upgrade path (if applicable)
  suggestedUpgrade?: {
    from: UserJourney;
    to: UserJourney;
    reason: string;
    prompt: string;
  };

  // Is user new (not enough data to determine)?
  isNewUser: boolean;
}

// ============================================================================
// Signal Collection
// ============================================================================

async function collectJourneySignals(
  userId: string,
  lookbackDays: number = 30
): Promise<JourneySignals> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);
  const cutoffStr = cutoffDate.toISOString();

  // Fetch data in parallel
  const [workoutsResult, blocksResult, readinessResult, coachResult] = await Promise.all([
    // Recent workouts
    supabase
      .from('workouts')
      .select('id, block_id, date_completed, scheduled_date, context')
      .eq('user_id', userId)
      .gte('created_at', cutoffStr)
      .order('created_at', { ascending: false }),

    // Training blocks
    supabase
      .from('training_blocks')
      .select('id, created_at')
      .eq('user_id', userId)
      .gte('created_at', cutoffStr),

    // Readiness check-ins
    supabase
      .from('daily_readiness')
      .select('id')
      .eq('user_id', userId)
      .gte('check_in_date', cutoffStr.split('T')[0]),

    // Coach conversations (as proxy for coach usage)
    supabase
      .from('coach_messages')
      .select('id')
      .eq('user_id', userId)
      .eq('role', 'user')
      .gte('created_at', cutoffStr),
  ]);

  const workouts = workoutsResult.data || [];
  const blocks = blocksResult.data || [];
  const readiness = readinessResult.data || [];
  const coachMessages = coachResult.data || [];

  // Calculate signals
  const unstructuredWorkouts = workouts.filter((w) => !w.block_id).length;
  const blockWorkoutsCompleted = workouts.filter(
    (w) => w.block_id && w.date_completed
  ).length;

  const scheduledWorkoutsFollowed = workouts.filter((w) => {
    if (!w.scheduled_date || !w.date_completed) return false;
    const scheduled = new Date(w.scheduled_date);
    const completed = new Date(w.date_completed);
    return Math.abs(differenceInDays(completed, scheduled)) <= 1;
  }).length;

  // Quick start = unstructured context or no block
  const quickStartUsage = workouts.filter(
    (w) => w.context === 'unstructured' || (!w.block_id && !w.scheduled_date)
  ).length;

  return {
    unstructuredWorkouts,
    exercisesAddedMidWorkout: 0, // Would need event tracking to measure
    quickStartUsage,
    blockWorkoutsCompleted,
    blocksCreated: blocks.length,
    scheduledWorkoutsFollowed,
    readinessCheckIns: readiness.length,
    coachInteractions: coachMessages.length,
    dailySuggestionsUsed: 0, // Would need event tracking
  };
}

// ============================================================================
// Score Calculation
// ============================================================================

function calculateJourneyScores(signals: JourneySignals): JourneyScores {
  // Normalize each signal to 0-1 range with diminishing returns
  const normalize = (value: number, maxForFull: number) =>
    Math.min(1, value / maxForFull);

  // Freestyler score: high unstructured, low blocks
  const freestylerScore =
    normalize(signals.unstructuredWorkouts, 10) * 0.4 +
    normalize(signals.quickStartUsage, 8) * 0.3 +
    (1 - normalize(signals.blocksCreated, 2)) * 0.2 +
    (1 - normalize(signals.blockWorkoutsCompleted, 15)) * 0.1;

  // Planner score: uses blocks, follows schedule
  const plannerScore =
    normalize(signals.blocksCreated, 2) * 0.3 +
    normalize(signals.blockWorkoutsCompleted, 15) * 0.4 +
    normalize(signals.scheduledWorkoutsFollowed, 10) * 0.3;

  // Guided score: readiness, coach, suggestions
  const guidedScore =
    normalize(signals.readinessCheckIns, 14) * 0.35 +
    normalize(signals.coachInteractions, 10) * 0.35 +
    normalize(signals.dailySuggestionsUsed, 8) * 0.3;

  return {
    freestyler: Math.max(0, Math.min(1, freestylerScore)),
    planner: Math.max(0, Math.min(1, plannerScore)),
    guided: Math.max(0, Math.min(1, guidedScore)),
  };
}

function determineConfidence(
  scores: JourneyScores,
  totalWorkouts: number
): 'low' | 'medium' | 'high' {
  // Not enough data
  if (totalWorkouts < 3) return 'low';

  // Find gap between top and second score
  const sortedScores = Object.values(scores).sort((a, b) => b - a);
  const gap = sortedScores[0] - sortedScores[1];

  if (gap > 0.3 && totalWorkouts >= 10) return 'high';
  if (gap > 0.15 && totalWorkouts >= 5) return 'medium';
  return 'low';
}

function detectUpgradeOpportunity(
  primary: UserJourney,
  signals: JourneySignals,
  scores: JourneyScores
): JourneyDetectionResult['suggestedUpgrade'] | undefined {
  // Freestyler showing consistent patterns → suggest Planner
  if (primary === 'freestyler' && signals.unstructuredWorkouts >= 8) {
    // Check if they have consistent training pattern
    // (This would integrate with pattern detection)
    if (signals.quickStartUsage >= 6) {
      return {
        from: 'freestyler',
        to: 'planner',
        reason: "You've logged consistently. Ready for a structured program?",
        prompt:
          "We noticed you train regularly. Want us to build a personalized program based on your workout history?",
      };
    }
  }

  // Planner not following schedule → might prefer Freestyler flexibility
  if (
    primary === 'planner' &&
    signals.blocksCreated >= 1 &&
    signals.scheduledWorkoutsFollowed < signals.blockWorkoutsCompleted * 0.3
  ) {
    return {
      from: 'planner',
      to: 'freestyler',
      reason: 'Your schedule seems flexible',
      prompt:
        "Looks like you prefer flexibility over rigid schedules. Want to switch to freestyle mode where we just remember your exercises?",
    };
  }

  // Freestyler with high readiness → suggest Guided
  if (
    primary === 'freestyler' &&
    signals.readinessCheckIns >= 7 &&
    scores.guided > 0.4
  ) {
    return {
      from: 'freestyler',
      to: 'guided',
      reason: 'You check in regularly',
      prompt:
        "Since you're tracking readiness, want the AI coach to suggest daily workouts based on how you're feeling?",
    };
  }

  return undefined;
}

// ============================================================================
// Main Hook
// ============================================================================

export function useJourneyDetection() {
  const userId = useAppStore((state) => state.userId);

  return useQuery({
    queryKey: ['journey-detection', userId],
    queryFn: async (): Promise<JourneyDetectionResult> => {
      if (!userId) {
        return {
          primaryJourney: 'freestyler',
          confidence: 'low',
          scores: { freestyler: 0.5, planner: 0.25, guided: 0.25 },
          signals: {
            unstructuredWorkouts: 0,
            exercisesAddedMidWorkout: 0,
            quickStartUsage: 0,
            blockWorkoutsCompleted: 0,
            blocksCreated: 0,
            scheduledWorkoutsFollowed: 0,
            readinessCheckIns: 0,
            coachInteractions: 0,
            dailySuggestionsUsed: 0,
          },
          isNewUser: true,
        };
      }

      const signals = await collectJourneySignals(userId);
      const scores = calculateJourneyScores(signals);

      // Determine primary journey
      const entries = Object.entries(scores) as [UserJourney, number][];
      entries.sort((a, b) => b[1] - a[1]);
      const primaryJourney = entries[0][0];

      // Calculate total activity for confidence
      const totalWorkouts =
        signals.unstructuredWorkouts + signals.blockWorkoutsCompleted;

      const confidence = determineConfidence(scores, totalWorkouts);
      const isNewUser = totalWorkouts < 3;

      // Check for upgrade opportunities
      const suggestedUpgrade = detectUpgradeOpportunity(
        primaryJourney,
        signals,
        scores
      );

      return {
        primaryJourney,
        confidence,
        scores,
        signals,
        suggestedUpgrade,
        isNewUser,
      };
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}

// ============================================================================
// Journey-Specific Feature Flags
// ============================================================================

export interface JourneyFeatures {
  // Which primary actions to show
  showQuickStart: boolean;
  showBuildWithAI: boolean;
  showDailySuggestion: boolean;

  // UI emphasis
  emphasizeMovementMemory: boolean;
  emphasizeSchedule: boolean;
  emphasizeReadiness: boolean;

  // Coach behavior
  coachProactive: boolean;
  coachSuggestsStructure: boolean;

  // Calendar
  showCalendarView: boolean;
  calendarShowsPlanned: boolean;
}

export function getJourneyFeatures(journey: UserJourney): JourneyFeatures {
  switch (journey) {
    case 'freestyler':
      return {
        showQuickStart: true,
        showBuildWithAI: false, // Show as secondary
        showDailySuggestion: false,
        emphasizeMovementMemory: true,
        emphasizeSchedule: false,
        emphasizeReadiness: false,
        coachProactive: false,
        coachSuggestsStructure: true, // Offer to help structure
        showCalendarView: false,
        calendarShowsPlanned: false,
      };
    case 'planner':
      return {
        showQuickStart: false,
        showBuildWithAI: true,
        showDailySuggestion: false,
        emphasizeMovementMemory: true,
        emphasizeSchedule: true,
        emphasizeReadiness: true,
        coachProactive: false,
        coachSuggestsStructure: false,
        showCalendarView: true,
        calendarShowsPlanned: true,
      };
    case 'guided':
      return {
        showQuickStart: false,
        showBuildWithAI: false,
        showDailySuggestion: true,
        emphasizeMovementMemory: true,
        emphasizeSchedule: false,
        emphasizeReadiness: true,
        coachProactive: true,
        coachSuggestsStructure: false,
        showCalendarView: true,
        calendarShowsPlanned: true,
      };
  }
}

/**
 * Hook that combines journey detection with feature flags
 */
export function useJourneyFeatures() {
  const { data: detection, isLoading } = useJourneyDetection();

  const features = detection
    ? getJourneyFeatures(detection.primaryJourney)
    : getJourneyFeatures('freestyler'); // Default

  return {
    journey: detection?.primaryJourney || 'freestyler',
    confidence: detection?.confidence || 'low',
    features,
    isLoading,
    isNewUser: detection?.isNewUser ?? true,
    suggestedUpgrade: detection?.suggestedUpgrade,
    scores: detection?.scores,
  };
}
