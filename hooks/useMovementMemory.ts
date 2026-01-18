/**
 * Movement Memory Hook
 *
 * Enhanced exercise memory with confidence levels, trends, and suggestions.
 * Falls back to computing from workout_sets until movement_memory table is populated.
 */

import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow, differenceInDays } from 'date-fns';

import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/useAppStore';
import { calculateE1RM } from '@/lib/utils';
import type {
  MovementMemory,
  ConfidenceLevel,
  PerformanceTrend,
  WorkoutContext,
  NextTimeSuggestion,
  NextTimeAlert,
  ConfidenceFactors,
} from '@/types/database';

export interface MovementMemoryData {
  lastWeight: number | null;
  lastReps: number | null;
  lastRPE: number | null;
  lastSets: number | null;
  lastDate: string | null;
  lastDateRelative: string | null;
  lastContext: WorkoutContext | null;
  exposureCount: number;
  avgRPE: number | null;
  typicalRepRange: { min: number; max: number } | null;
  totalLifetimeVolume: number;
  prWeight: number | null;
  prE1RM: number | null;
  confidence: ConfidenceLevel;
  trend: PerformanceTrend;
  daysSinceLast: number | null;
  displayText: string;
  trendLabel: string;
  trendColor: string;
}

function computeConfidence(factors: ConfidenceFactors): ConfidenceLevel {
  let score = 0;
  if (factors.exposureCount >= 5) score += 40;
  else if (factors.exposureCount >= 3) score += 25;
  else score += factors.exposureCount * 5;
  if (factors.recency <= 7) score += 25;
  else if (factors.recency <= 14) score += 15;
  else if (factors.recency <= 28) score += 5;
  score += Math.max(0, 20 - factors.consistency * 2);
  score += Math.round(factors.rpeReporting * 15);
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function detectTrend(recentE1RM: number | null, olderE1RM: number | null): PerformanceTrend {
  if (!recentE1RM || !olderE1RM || olderE1RM === 0) return 'stagnant';
  const delta = (recentE1RM - olderE1RM) / olderE1RM;
  if (delta > 0.02) return 'progressing';
  if (delta < -0.02) return 'regressing';
  return 'stagnant';
}

function getTrendDisplay(trend: PerformanceTrend): { label: string; color: string } {
  switch (trend) {
    case 'progressing': return { label: 'Progressing', color: 'text-green-500' };
    case 'regressing': return { label: 'Regressing', color: 'text-red-500' };
    default: return { label: 'Stable', color: 'text-gray-500' };
  }
}

export function useMovementMemory(exerciseId: string, currentWorkoutId?: string) {
  const userId = useAppStore((state) => state.userId);

  const { data, isLoading, error } = useQuery({
    queryKey: ['movementMemory', exerciseId, currentWorkoutId],
    queryFn: async (): Promise<MovementMemoryData | null> => {
      if (!userId || !exerciseId) return null;

      // Try movement_memory table first
      let memoryData = null;
      try {
        const { data, error: memoryError } = await supabase
          .from('movement_memory')
          .select('*')
          .eq('user_id', userId)
          .eq('exercise_id', exerciseId)
          .maybeSingle();
        
        // Silently handle 404s and missing table - fall back to workout_sets
        if (!memoryError || memoryError.code === 'PGRST116' || memoryError.code === '42P01') {
          memoryData = data;
        }
        // PGRST116 = not found (expected), 42P01 = table doesn't exist (expected during migration)
        // Only log unexpected errors
        else if (memoryError.code !== 'PGRST116' && memoryError.code !== '42P01') {
          console.warn('Movement memory query error:', memoryError);
        }
      } catch (err) {
        // Table might not exist yet - silently fall through to workout_sets fallback
        memoryData = null;
      }

      if (memoryData) {
        const memory = memoryData as MovementMemory;
        const daysSince = memory.last_date ? differenceInDays(new Date(), new Date(memory.last_date)) : null;
        const lastDateRelative = memory.last_date ? formatDistanceToNow(new Date(memory.last_date), { addSuffix: true }) : null;
        const trendDisplay = getTrendDisplay(memory.trend);
        const parts: string[] = [];
        if (memory.last_weight !== null && memory.last_weight > 0) parts.push(`${memory.last_weight} lbs`);
        else if (memory.last_weight === 0) parts.push('BW');
        if (memory.last_reps) parts.push(`x ${memory.last_reps}`);
        if (memory.last_rpe) parts.push(`@ RPE ${memory.last_rpe}`);

        return {
          lastWeight: memory.last_weight, lastReps: memory.last_reps, lastRPE: memory.last_rpe,
          lastSets: memory.last_sets, lastDate: memory.last_date, lastDateRelative,
          lastContext: memory.last_context, exposureCount: memory.exposure_count,
          avgRPE: memory.avg_rpe,
          typicalRepRange: memory.typical_rep_min && memory.typical_rep_max ? { min: memory.typical_rep_min, max: memory.typical_rep_max } : null,
          totalLifetimeVolume: memory.total_lifetime_volume, prWeight: memory.pr_weight,
          prE1RM: memory.pr_e1rm, confidence: memory.confidence_level, trend: memory.trend,
          daysSinceLast: daysSince, displayText: parts.join(' ') || 'No data',
          trendLabel: trendDisplay.label, trendColor: trendDisplay.color,
        };
      }

      // Fallback: compute from workout_sets
      let query = supabase
        .from('workout_sets')
        .select(`*, workout:workouts!inner(id, date_completed, user_id, context)`)
        .eq('exercise_id', exerciseId)
        .eq('workout.user_id', userId)
        .not('workout.date_completed', 'is', null)
        .eq('is_warmup', false)
        .order('workout(date_completed)', { ascending: false })
        .limit(20);

      if (currentWorkoutId) query = query.neq('workout_id', currentWorkoutId);

      const { data: sets, error: setsError } = await query;
      if (setsError) throw setsError;
      if (!sets || sets.length === 0) return null;

      const validSets = (sets as any[]).filter((s) => s.actual_weight !== null && s.actual_reps !== null);
      if (validSets.length === 0) return null;

      const lastSet = validSets[0];
      const uniqueDates = new Set(validSets.map((s) => s.workout.date_completed.split('T')[0]));
      const exposureCount = uniqueDates.size;
      const daysSince = lastSet.workout.date_completed ? differenceInDays(new Date(), new Date(lastSet.workout.date_completed)) : null;
      const lastDateRelative = lastSet.workout.date_completed ? formatDistanceToNow(new Date(lastSet.workout.date_completed), { addSuffix: true }) : null;

      const rpeValues = validSets.filter((s) => s.actual_rpe !== null).map((s) => s.actual_rpe);
      const avgRPE = rpeValues.length > 0 ? rpeValues.reduce((a: number, b: number) => a + b, 0) / rpeValues.length : null;
      const reps = validSets.map((s) => s.actual_reps);
      const typicalRepRange = { min: Math.min(...reps), max: Math.max(...reps) };

      const e1rms = validSets.filter((s) => s.actual_weight && s.actual_reps).map((s) => calculateE1RM(s.actual_weight, s.actual_reps));
      const recentE1RM = e1rms.length >= 2 ? (e1rms[0] + e1rms[1]) / 2 : e1rms[0] || null;
      const olderE1RM = e1rms.length >= 4 ? (e1rms[2] + e1rms[3]) / 2 : e1rms[2] || null;

      const trend = detectTrend(recentE1RM, olderE1RM);
      const trendDisplay = getTrendDisplay(trend);
      const confidence = computeConfidence({ exposureCount, recency: daysSince || 999, consistency: typicalRepRange.max - typicalRepRange.min, rpeReporting: rpeValues.length / validSets.length });

      const parts: string[] = [];
      if (lastSet.actual_weight !== null && lastSet.actual_weight > 0) parts.push(`${lastSet.actual_weight} lbs`);
      else if (lastSet.actual_weight === 0) parts.push('BW');
      if (lastSet.actual_reps) parts.push(`x ${lastSet.actual_reps}`);
      if (lastSet.actual_rpe) parts.push(`@ RPE ${lastSet.actual_rpe}`);

      return {
        lastWeight: lastSet.actual_weight, lastReps: lastSet.actual_reps, lastRPE: lastSet.actual_rpe,
        lastSets: null, lastDate: lastSet.workout.date_completed, lastDateRelative,
        lastContext: lastSet.workout.context, exposureCount, avgRPE, typicalRepRange,
        totalLifetimeVolume: validSets.reduce((sum: number, s: any) => sum + (s.actual_weight || 0) * (s.actual_reps || 0), 0),
        prWeight: Math.max(...validSets.map((s: any) => s.actual_weight || 0)),
        prE1RM: e1rms.length > 0 ? Math.max(...e1rms) : null,
        confidence, trend, daysSinceLast: daysSince,
        displayText: parts.join(' ') || 'No data',
        trendLabel: trendDisplay.label, trendColor: trendDisplay.color,
      };
    },
    enabled: !!exerciseId && !!userId,
    staleTime: 5 * 60 * 1000,
  });

  return { data: data || null, isLoading, error: error as Error | null };
}

export function useNextTimeSuggestion(exerciseId: string, exerciseName: string, currentWorkoutId?: string) {
  const { data: memory, isLoading } = useMovementMemory(exerciseId, currentWorkoutId);

  const suggestion: NextTimeSuggestion | null = memory ? generateSuggestion(exerciseId, exerciseName, memory) : null;
  return { data: suggestion, isLoading };
}

function generateSuggestion(exerciseId: string, exerciseName: string, memory: MovementMemoryData): NextTimeSuggestion {
  const alerts: NextTimeAlert[] = [];
  let suggestedWeight = memory.lastWeight || 0;
  let suggestedReps = memory.lastReps || 8;
  let suggestedRPE = 8;
  let reasoning = '';

  if (memory.daysSinceLast !== null && memory.daysSinceLast > 14) {
    alerts.push({ type: 'missed_session', message: `${memory.daysSinceLast} days since last session`, suggested_action: 'Start lighter to rebuild' });
    suggestedWeight = Math.round((memory.lastWeight || 0) * 0.9);
    reasoning = 'Extended break. Starting conservative.';
  }

  if (memory.trend === 'regressing') {
    alerts.push({ type: 'regression', message: 'Performance declined recently', suggested_action: 'Check recovery' });
    suggestedWeight = Math.round((memory.lastWeight || 0) * 0.9);
    reasoning = 'Regression detected. Recovery load suggested.';
  }

  if (!reasoning && memory.lastWeight && memory.lastReps) {
    const lastRPE = memory.lastRPE || 8;
    if (lastRPE < 7) {
      suggestedReps = memory.lastReps + 1;
      reasoning = `Easy last time (RPE ${lastRPE}). Try +1 rep.`;
    } else if (lastRPE <= 8.5) {
      suggestedWeight = memory.lastWeight + 5;
      reasoning = `Good effort (RPE ${lastRPE}). Try +5 lbs.`;
    } else {
      reasoning = `Challenging (RPE ${lastRPE}). Match before progressing.`;
    }
  }

  if (memory.confidence === 'low') {
    reasoning += ` (Low confidence - ${memory.exposureCount} session${memory.exposureCount !== 1 ? 's' : ''})`;
  }

  if (!memory.lastWeight && !memory.lastReps) {
    reasoning = 'No history. Start with comfortable weight.';
  }

  return {
    exercise_id: exerciseId,
    exercise_name: exerciseName,
    last_performance: { weight: memory.lastWeight, reps: memory.lastReps, sets: memory.lastSets, rpe: memory.lastRPE, date: memory.lastDate, context: memory.lastContext },
    recommendation: { weight: suggestedWeight, reps: suggestedReps, target_rpe: suggestedRPE },
    confidence: memory.confidence,
    trend: memory.trend,
    reasoning,
    exposure_count: memory.exposureCount,
    pr_e1rm: memory.prE1RM,
    alerts: alerts.length > 0 ? alerts : undefined,
  };
}

// ============================================================================
// Cardio Memory - For cardio exercises (running, biking, rowing, etc.)
// ============================================================================

export interface CardioMemoryData {
  lastDistance: number | null;      // in meters
  lastPace: string | null;          // e.g., "8:45/mi" or "180w"
  lastDuration: number | null;      // in seconds
  lastHR: number | null;            // average heart rate
  lastDate: string | null;
  lastDateRelative: string | null;
  exposureCount: number;
  avgDuration: number | null;       // typical session duration
  longestDistance: number | null;   // PR distance
  fastestPace: string | null;       // PR pace
  displayText: string;
  daysSinceLast: number | null;
}

export function useCardioMemory(exerciseId: string, currentWorkoutId?: string) {
  const userId = useAppStore((state) => state.userId);

  const { data, isLoading, error } = useQuery({
    queryKey: ['cardioMemory', exerciseId, currentWorkoutId],
    queryFn: async (): Promise<CardioMemoryData | null> => {
      if (!userId || !exerciseId) return null;

      // Query workout_sets for cardio data
      let query = supabase
        .from('workout_sets')
        .select(`*, workout:workouts!inner(id, date_completed, user_id)`)
        .eq('exercise_id', exerciseId)
        .eq('workout.user_id', userId)
        .not('workout.date_completed', 'is', null)
        .order('workout(date_completed)', { ascending: false })
        .limit(20);

      if (currentWorkoutId) query = query.neq('workout_id', currentWorkoutId);

      const { data: sets, error: setsError } = await query;
      if (setsError) throw setsError;
      if (!sets || sets.length === 0) return null;

      // Filter for cardio sets (have distance, duration, or pace)
      const cardioSets = (sets as any[]).filter(
        (s) => s.distance_meters || s.duration_seconds || s.avg_pace
      );
      if (cardioSets.length === 0) return null;

      const lastSet = cardioSets[0];
      const uniqueDates = new Set(cardioSets.map((s) => s.workout.date_completed.split('T')[0]));
      const exposureCount = uniqueDates.size;
      const daysSince = lastSet.workout.date_completed
        ? differenceInDays(new Date(), new Date(lastSet.workout.date_completed))
        : null;
      const lastDateRelative = lastSet.workout.date_completed
        ? formatDistanceToNow(new Date(lastSet.workout.date_completed), { addSuffix: true })
        : null;

      // Calculate averages and PRs
      const durations = cardioSets.filter((s) => s.duration_seconds).map((s) => s.duration_seconds);
      const avgDuration = durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : null;

      const distances = cardioSets.filter((s) => s.distance_meters).map((s) => s.distance_meters);
      const longestDistance = distances.length > 0 ? Math.max(...distances) : null;

      // Build display text
      const parts: string[] = [];
      if (lastSet.duration_seconds) {
        const mins = Math.round(lastSet.duration_seconds / 60);
        parts.push(`${mins} min`);
      }
      if (lastSet.avg_pace) {
        parts.push(lastSet.avg_pace);
      }
      if (lastSet.distance_meters) {
        const miles = (lastSet.distance_meters / 1609.34).toFixed(1);
        parts.push(`${miles} mi`);
      }
      if (lastSet.avg_hr) {
        parts.push(`${lastSet.avg_hr} bpm`);
      }

      return {
        lastDistance: lastSet.distance_meters,
        lastPace: lastSet.avg_pace,
        lastDuration: lastSet.duration_seconds,
        lastHR: lastSet.avg_hr,
        lastDate: lastSet.workout.date_completed,
        lastDateRelative,
        exposureCount,
        avgDuration,
        longestDistance,
        fastestPace: null, // Could compute this later
        displayText: parts.join(' • ') || 'No data',
        daysSinceLast: daysSince,
      };
    },
    enabled: !!exerciseId && !!userId,
    staleTime: 5 * 60 * 1000,
  });

  return { data: data || null, isLoading, error: error as Error | null };
}

/**
 * Get all next-time suggestions for exercises in a workout
 */
export function useWorkoutSuggestions(
  exerciseIds: string[],
  exerciseNames: Record<string, string>,
  workoutId?: string
) {
  const userId = useAppStore((state) => state.userId);

  const { data, isLoading, error } = useQuery({
    queryKey: ['workoutSuggestions', exerciseIds.join(','), workoutId],
    queryFn: async (): Promise<NextTimeSuggestion[]> => {
      if (!userId || exerciseIds.length === 0) return [];

      const suggestions: NextTimeSuggestion[] = [];

      // Fetch movement memory for all exercises in parallel
      const memoryPromises = exerciseIds.map(async (exerciseId) => {
        // Try movement_memory table first
        let memoryData = null;
        try {
          const { data, error: memoryError } = await supabase
            .from('movement_memory')
            .select('*')
            .eq('user_id', userId)
            .eq('exercise_id', exerciseId)
            .maybeSingle();
          
          // Silently handle 404s and missing table - fall back to workout_sets
          if (!memoryError || memoryError.code === 'PGRST116' || memoryError.code === '42P01') {
            memoryData = data;
          }
          // PGRST116 = not found (expected), 42P01 = table doesn't exist (expected during migration)
          // Only log unexpected errors
          else if (memoryError.code !== 'PGRST116' && memoryError.code !== '42P01') {
            console.warn('Movement memory query error:', memoryError);
          }
        } catch (err) {
          // Table might not exist yet - silently fall through to workout_sets fallback
          memoryData = null;
        }

        if (memoryData) {
          const memory = memoryData as MovementMemory;
          const daysSince = memory.last_date ? differenceInDays(new Date(), new Date(memory.last_date)) : null;
          const lastDateRelative = memory.last_date ? formatDistanceToNow(new Date(memory.last_date), { addSuffix: true }) : null;
          const trendDisplay = getTrendDisplay(memory.trend);

          const memoryData2: MovementMemoryData = {
            lastWeight: memory.last_weight, lastReps: memory.last_reps, lastRPE: memory.last_rpe,
            lastSets: memory.last_sets, lastDate: memory.last_date, lastDateRelative,
            lastContext: memory.last_context, exposureCount: memory.exposure_count,
            avgRPE: memory.avg_rpe,
            typicalRepRange: memory.typical_rep_min && memory.typical_rep_max ? { min: memory.typical_rep_min, max: memory.typical_rep_max } : null,
            totalLifetimeVolume: memory.total_lifetime_volume, prWeight: memory.pr_weight,
            prE1RM: memory.pr_e1rm, confidence: memory.confidence_level, trend: memory.trend,
            daysSinceLast: daysSince, displayText: '',
            trendLabel: trendDisplay.label, trendColor: trendDisplay.color,
          };

          return { exerciseId, memory: memoryData2 };
        }

        // Fallback to workout_sets
        let query = supabase
          .from('workout_sets')
          .select(`*, workout:workouts!inner(id, date_completed, user_id, context)`)
          .eq('exercise_id', exerciseId)
          .eq('workout.user_id', userId)
          .not('workout.date_completed', 'is', null)
          .eq('is_warmup', false)
          .order('workout(date_completed)', { ascending: false })
          .limit(20);

        if (workoutId) query = query.neq('workout_id', workoutId);

        const { data: sets } = await query;
        if (!sets || sets.length === 0) return { exerciseId, memory: null };

        const validSets = (sets as any[]).filter((s) => s.actual_weight !== null && s.actual_reps !== null);
        if (validSets.length === 0) return { exerciseId, memory: null };

        const lastSet = validSets[0];
        const uniqueDates = new Set(validSets.map((s) => s.workout.date_completed.split('T')[0]));
        const exposureCount = uniqueDates.size;
        const daysSince = lastSet.workout.date_completed ? differenceInDays(new Date(), new Date(lastSet.workout.date_completed)) : null;
        const lastDateRelative = lastSet.workout.date_completed ? formatDistanceToNow(new Date(lastSet.workout.date_completed), { addSuffix: true }) : null;

        const rpeValues = validSets.filter((s) => s.actual_rpe !== null).map((s) => s.actual_rpe);
        const avgRPE = rpeValues.length > 0 ? rpeValues.reduce((a: number, b: number) => a + b, 0) / rpeValues.length : null;
        const reps = validSets.map((s) => s.actual_reps);
        const typicalRepRange = { min: Math.min(...reps), max: Math.max(...reps) };

        const e1rms = validSets.filter((s) => s.actual_weight && s.actual_reps).map((s) => calculateE1RM(s.actual_weight, s.actual_reps));
        const recentE1RM = e1rms.length >= 2 ? (e1rms[0] + e1rms[1]) / 2 : e1rms[0] || null;
        const olderE1RM = e1rms.length >= 4 ? (e1rms[2] + e1rms[3]) / 2 : e1rms[2] || null;

        const trend = detectTrend(recentE1RM, olderE1RM);
        const trendDisplay = getTrendDisplay(trend);
        const confidence = computeConfidence({ exposureCount, recency: daysSince || 999, consistency: typicalRepRange.max - typicalRepRange.min, rpeReporting: rpeValues.length / validSets.length });

        const memoryData2: MovementMemoryData = {
          lastWeight: lastSet.actual_weight, lastReps: lastSet.actual_reps, lastRPE: lastSet.actual_rpe,
          lastSets: null, lastDate: lastSet.workout.date_completed, lastDateRelative,
          lastContext: lastSet.workout.context, exposureCount, avgRPE, typicalRepRange,
          totalLifetimeVolume: validSets.reduce((sum: number, s: any) => sum + (s.actual_weight || 0) * (s.actual_reps || 0), 0),
          prWeight: Math.max(...validSets.map((s: any) => s.actual_weight || 0)),
          prE1RM: e1rms.length > 0 ? Math.max(...e1rms) : null,
          confidence, trend, daysSinceLast: daysSince,
          displayText: '',
          trendLabel: trendDisplay.label, trendColor: trendDisplay.color,
        };

        return { exerciseId, memory: memoryData2 };
      });

      const results = await Promise.all(memoryPromises);

      for (const result of results) {
        if (result.memory) {
          const exerciseName = exerciseNames[result.exerciseId] || 'Unknown';
          suggestions.push(generateSuggestion(result.exerciseId, exerciseName, result.memory));
        }
      }

      return suggestions;
    },
    enabled: !!userId && exerciseIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  return { data: data || [], isLoading, error: error as Error | null };
}
