/**
 * History Analysis
 * Analyzes training history for the Adaptive Coach system
 */

import type {
  Workout,
  WorkoutSet,
  MovementMemory,
  UserDisruption,
} from '@/types/database';
import type {
  HistoryAnalysis,
  PhaseDetection,
  TrainingPhase,
  ConfidenceLevel,
  ExerciseProgression,
  Disruption,
} from '@/types/coach';

// ============================================================================
// HISTORY ANALYSIS
// ============================================================================

interface WorkoutWithSets extends Workout {
  workout_sets: (WorkoutSet & { exercise?: { name: string; muscle_group: string } })[];
}

/**
 * Analyze the last N weeks of training history
 */
export function analyzeTrainingHistory(
  workouts: WorkoutWithSets[],
  movementMemory: MovementMemory[],
  disruptions: UserDisruption[],
  weeks: number = 6
): HistoryAnalysis {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - weeks * 7);

  const recentWorkouts = workouts.filter((w) => {
    const date = new Date(w.date_completed || w.scheduled_date || '');
    return date >= cutoffDate && w.date_completed;
  });

  // Calculate volume by muscle group
  const volumeByMuscleGroup: Record<string, number> = {};
  let totalVolume = 0;
  let totalDuration = 0;

  for (const workout of recentWorkouts) {
    totalDuration += workout.duration_minutes || 0;
    for (const set of workout.workout_sets || []) {
      const volume = (set.actual_weight || 0) * (set.actual_reps || 0);
      totalVolume += volume;
      const muscle = set.exercise?.muscle_group || 'unknown';
      volumeByMuscleGroup[muscle] = (volumeByMuscleGroup[muscle] || 0) + volume;
    }
  }

  // Detect preferred training days
  const dayCount: Record<string, number> = {};
  for (const workout of recentWorkouts) {
    const date = new Date(workout.date_completed || '');
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    dayCount[dayName] = (dayCount[dayName] || 0) + 1;
  }
  const preferredDays = Object.entries(dayCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([day]) => day);

  // Detect training split pattern
  const detectedSplit = detectTrainingSplit(recentWorkouts);

  // Analyze exercise progression from movement memory
  const { progressingExercises, stagnantExercises, regressingExercises } =
    analyzeExerciseProgression(movementMemory);

  // Detect training gaps
  const gaps = detectTrainingGaps(recentWorkouts);

  // Find recent disruption
  const activeDisruption = disruptions.find((d) => d.is_active);
  const recentDisruption = activeDisruption
    ? {
        id: activeDisruption.id,
        type: activeDisruption.disruption_type as Disruption['type'],
        start_date: activeDisruption.start_date,
        end_date: activeDisruption.end_date || undefined,
        severity: activeDisruption.severity as Disruption['severity'],
        notes: activeDisruption.notes || undefined,
      }
    : undefined;

  // Calculate data quality/confidence
  const dataQuality = calculateDataQuality(recentWorkouts, movementMemory);

  return {
    totalWorkouts: recentWorkouts.length,
    workoutsPerWeek: weeks > 0 ? recentWorkouts.length / weeks : 0,
    averageSessionMinutes: recentWorkouts.length > 0 ? totalDuration / recentWorkouts.length : 0,
    totalVolume,
    volumeByMuscleGroup,
    preferredDays,
    typicalDuration: recentWorkouts.length > 0 ? totalDuration / recentWorkouts.length : 0,
    detectedSplit,
    progressingExercises,
    stagnantExercises,
    regressingExercises,
    missedWorkouts: 0, // Would need scheduled vs completed comparison
    gaps,
    recentDisruption,
    dataQuality,
    weeksAnalyzed: weeks,
  };
}

/**
 * Detect the training split pattern from workout focuses
 */
function detectTrainingSplit(workouts: WorkoutWithSets[]): string | undefined {
  if (workouts.length < 3) return undefined;

  const focuses = workouts.map((w) => w.focus?.toLowerCase() || '').filter(Boolean);

  // Check for common patterns
  const hasPush = focuses.some((f) => f.includes('push'));
  const hasPull = focuses.some((f) => f.includes('pull'));
  const hasLegs = focuses.some((f) => f.includes('leg') || f.includes('lower'));
  const hasUpper = focuses.some((f) => f.includes('upper'));
  const hasFullBody = focuses.some((f) => f.includes('full'));

  if (hasPush && hasPull && hasLegs) return 'push_pull_legs';
  if (hasUpper && hasLegs) return 'upper_lower';
  if (hasFullBody) return 'full_body';
  if (hasPush && hasPull) return 'push_pull';

  return 'custom';
}

/**
 * Analyze exercise progression from movement memory
 */
function analyzeExerciseProgression(movementMemory: MovementMemory[]): {
  progressingExercises: ExerciseProgression[];
  stagnantExercises: ExerciseProgression[];
  regressingExercises: ExerciseProgression[];
} {
  const progressingExercises: ExerciseProgression[] = [];
  const stagnantExercises: ExerciseProgression[] = [];
  const regressingExercises: ExerciseProgression[] = [];

  for (const mm of movementMemory) {
    if (mm.exposure_count < 2) continue;

    const progression: ExerciseProgression = {
      exerciseId: mm.exercise_id,
      exerciseName: mm.exercise_id, // Would need to join with exercises table
      trend: mm.trend,
      recentE1RM: mm.pr_e1rm || undefined,
      previousE1RM: undefined, // Would need historical data
      changePercent: undefined,
      lastPerformed: mm.last_date || undefined,
      exposureCount: mm.exposure_count,
    };

    if (mm.trend === 'progressing') {
      progressingExercises.push(progression);
    } else if (mm.trend === 'stagnant') {
      stagnantExercises.push(progression);
    } else if (mm.trend === 'regressing') {
      regressingExercises.push(progression);
    }
  }

  return { progressingExercises, stagnantExercises, regressingExercises };
}

/**
 * Detect gaps in training (days between workouts)
 */
function detectTrainingGaps(workouts: WorkoutWithSets[]): {
  startDate: string;
  endDate: string;
  days: number;
}[] {
  if (workouts.length < 2) return [];

  const sorted = [...workouts]
    .filter((w) => w.date_completed)
    .sort((a, b) => new Date(a.date_completed!).getTime() - new Date(b.date_completed!).getTime());

  const gaps: { startDate: string; endDate: string; days: number }[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1].date_completed!);
    const curr = new Date(sorted[i].date_completed!);
    const diffDays = Math.floor((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));

    // Consider 7+ days as a gap
    if (diffDays >= 7) {
      gaps.push({
        startDate: sorted[i - 1].date_completed!,
        endDate: sorted[i].date_completed!,
        days: diffDays,
      });
    }
  }

  return gaps;
}

/**
 * Calculate data quality based on workout and movement memory data
 */
function calculateDataQuality(
  workouts: WorkoutWithSets[],
  movementMemory: MovementMemory[]
): ConfidenceLevel {
  let score = 0;

  // Workout count (max 30 points)
  if (workouts.length >= 12) score += 30;
  else if (workouts.length >= 6) score += 20;
  else if (workouts.length >= 3) score += 10;

  // Movement memory entries (max 30 points)
  if (movementMemory.length >= 10) score += 30;
  else if (movementMemory.length >= 5) score += 20;
  else if (movementMemory.length >= 2) score += 10;

  // RPE logging (max 20 points)
  const setsWithRPE = workouts.flatMap((w) => w.workout_sets || []).filter((s) => s.actual_rpe);
  const totalSets = workouts.flatMap((w) => w.workout_sets || []).length;
  const rpeRatio = totalSets > 0 ? setsWithRPE.length / totalSets : 0;
  score += Math.round(rpeRatio * 20);

  // High confidence entries in movement memory (max 20 points)
  const highConfidence = movementMemory.filter((mm) => mm.confidence_level === 'high').length;
  const confidenceRatio = movementMemory.length > 0 ? highConfidence / movementMemory.length : 0;
  score += Math.round(confidenceRatio * 20);

  if (score >= 70) return 'HIGH';
  if (score >= 40) return 'MED';
  return 'LOW';
}

// ============================================================================
// PHASE DETECTION
// ============================================================================

/**
 * Detect the current training phase based on history and context
 */
export function detectCurrentPhase(
  history: HistoryAnalysis,
  recentDisruptions: UserDisruption[],
  currentPhaseFromProfile: string | null,
  weeksInPhase: number
): PhaseDetection {
  // Check for recent disruption first (highest priority for rebuilding)
  const activeDisruption = recentDisruptions.find((d) => d.is_active);
  if (activeDisruption) {
    const severity = activeDisruption.severity;
    return {
      phase: 'rebuilding',
      confidence: severity === 'major' ? 'HIGH' : 'MED',
      reasoning: `You have an active ${activeDisruption.disruption_type} disruption (${severity}). Focus on rebuilding consistency before pushing intensity.`,
      suggestedDuration: severity === 'major' ? 3 : severity === 'moderate' ? 2 : 1,
    };
  }

  // Check for recent gaps in training
  const recentGap = history.gaps.find((g) => {
    const gapEnd = new Date(g.endDate);
    const daysAgo = Math.floor((Date.now() - gapEnd.getTime()) / (1000 * 60 * 60 * 24));
    return daysAgo <= 14; // Gap ended within last 2 weeks
  });

  if (recentGap && recentGap.days >= 10) {
    return {
      phase: 'rebuilding',
      confidence: 'HIGH',
      reasoning: `You had a ${recentGap.days}-day gap in training. Let's rebuild your base before pushing hard.`,
      suggestedDuration: 2,
    };
  }

  if (recentGap && recentGap.days >= 7) {
    return {
      phase: 'rebuilding',
      confidence: 'MED',
      reasoning: `Coming back from a ${recentGap.days}-day break. Ease back in this week.`,
      suggestedDuration: 1,
    };
  }

  // Check workouts per week for consistency
  if (history.workoutsPerWeek < 2 && history.totalWorkouts >= 2) {
    return {
      phase: 'rebuilding',
      confidence: 'MED',
      reasoning: 'Training frequency has been low. Focus on rebuilding consistency.',
      suggestedDuration: 2,
    };
  }

  // Analyze progression trends
  const progressingCount = history.progressingExercises.length;
  const stagnantCount = history.stagnantExercises.length;
  const regressingCount = history.regressingExercises.length;
  const totalTracked = progressingCount + stagnantCount + regressingCount;

  // If regressing on multiple exercises, might need deload
  if (regressingCount >= 3 || (totalTracked > 0 && regressingCount / totalTracked > 0.3)) {
    return {
      phase: 'deloading',
      confidence: 'MED',
      reasoning: 'Multiple exercises showing regression. A deload week may help recovery.',
      suggestedDuration: 1,
    };
  }

  // Check if currently in a phase that should transition
  if (currentPhaseFromProfile) {
    // Deload should be 1 week
    if (currentPhaseFromProfile === 'deload' && weeksInPhase >= 1) {
      return {
        phase: 'accumulating',
        confidence: 'HIGH',
        reasoning: 'Deload complete. Time to build volume again.',
        suggestedDuration: 4,
      };
    }

    // Intensification typically 3-4 weeks, then deload or realization
    if (currentPhaseFromProfile === 'intensification' && weeksInPhase >= 4) {
      return {
        phase: 'deloading',
        confidence: 'MED',
        reasoning: 'You\'ve been intensifying for a while. Consider a deload before pushing further.',
        suggestedDuration: 1,
      };
    }
  }

  // Good progression = accumulating or intensifying
  if (progressingCount > stagnantCount && progressingCount > regressingCount) {
    // Check volume trends to distinguish accumulating vs intensifying
    // For now, default to accumulating
    return {
      phase: 'accumulating',
      confidence: 'MED',
      reasoning: 'Good progress across exercises. Continue building volume.',
      suggestedDuration: 4,
    };
  }

  // Stagnant but not regressing = maintaining
  if (stagnantCount > regressingCount) {
    return {
      phase: 'maintaining',
      confidence: 'MED',
      reasoning: 'Exercises are stable. Consider pushing intensity or adding volume to break plateaus.',
      suggestedDuration: 2,
    };
  }

  // Default to accumulating with low confidence
  return {
    phase: 'accumulating',
    confidence: 'LOW',
    reasoning: 'Not enough data to determine phase confidently. Building base volume.',
    suggestedDuration: 4,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { WorkoutWithSets };
