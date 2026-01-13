/**
 * Pattern Detection Utilities
 *
 * Detects training patterns from workout history:
 * - Training splits (Push/Pull/Legs, Upper/Lower, etc.)
 * - Exercise pairings (exercises commonly done together)
 * - Training day preferences (which days user typically trains)
 * - Rep range preferences
 */

import { format, parseISO, getDay } from 'date-fns';
import type { PatternType } from '@/types/database';

export interface DetectedPattern {
  type: PatternType;
  name: string;
  confidence: number; // 0-1
  data: Record<string, any>;
  description: string;
  firstDetected?: string;
  lastConfirmed?: string;
}

export interface WorkoutForPattern {
  id: string;
  focus: string;
  date_completed: string | null;
  muscle_groups: string[];
  exercises: Array<{
    id: string;
    name: string;
    muscle_group: string;
  }>;
}

/**
 * Detect all patterns from workout history
 */
export function detectAllPatterns(workouts: WorkoutForPattern[]): DetectedPattern[] {
  if (workouts.length < 4) return [];

  const patterns: DetectedPattern[] = [];

  // Detect training split
  const splitPattern = detectTrainingSplit(workouts);
  if (splitPattern) patterns.push(splitPattern);

  // Detect exercise pairings
  const pairingPatterns = detectExercisePairings(workouts);
  patterns.push(...pairingPatterns);

  // Detect training day preferences
  const dayPattern = detectTrainingDays(workouts);
  if (dayPattern) patterns.push(dayPattern);

  // Detect rep range preferences
  // Note: This requires set-level data, handled separately

  return patterns;
}

/**
 * Detect training split pattern
 * E.g., Push/Pull/Legs, Upper/Lower, Full Body
 */
export function detectTrainingSplit(workouts: WorkoutForPattern[]): DetectedPattern | null {
  if (workouts.length < 6) return null;

  // Count workout focus occurrences
  const focusCounts = new Map<string, number>();
  const recentWorkouts = workouts.slice(0, 20); // Last 20 workouts

  recentWorkouts.forEach((w) => {
    const focus = normalizeFocus(w.focus);
    focusCounts.set(focus, (focusCounts.get(focus) || 0) + 1);
  });

  // Get top focuses
  const topFocuses = Array.from(focusCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // Detect common split patterns
  const splitTypes = detectSplitType(topFocuses.map(([focus]) => focus));

  if (!splitTypes) return null;

  // Calculate confidence based on consistency
  const totalWorkouts = recentWorkouts.length;
  const matchingWorkouts = topFocuses.reduce((sum, [_, count]) => sum + count, 0);
  const confidence = Math.min(1, matchingWorkouts / totalWorkouts);

  if (confidence < 0.5) return null;

  return {
    type: 'training_split',
    name: splitTypes.name,
    confidence,
    data: {
      splits: splitTypes.splits,
      days_per_week: estimateDaysPerWeek(workouts),
      focus_distribution: Object.fromEntries(focusCounts),
    },
    description: `You train ${splitTypes.name} approximately ${estimateDaysPerWeek(workouts)} days/week`,
  };
}

/**
 * Normalize focus strings for pattern matching
 */
function normalizeFocus(focus: string): string {
  return focus
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*/g, '') // Remove parentheticals
    .replace(/\s*[+&]\s*/g, ' + ') // Normalize separators
    .trim();
}

/**
 * Detect split type from focus names
 */
function detectSplitType(focuses: string[]): { name: string; splits: string[] } | null {
  const focusLower = focuses.map((f) => f.toLowerCase());

  // Check for PPL
  if (
    focusLower.some((f) => f.includes('push')) &&
    focusLower.some((f) => f.includes('pull')) &&
    focusLower.some((f) => f.includes('leg'))
  ) {
    return { name: 'Push/Pull/Legs', splits: ['Push', 'Pull', 'Legs'] };
  }

  // Check for Upper/Lower
  if (
    focusLower.some((f) => f.includes('upper')) &&
    focusLower.some((f) => f.includes('lower'))
  ) {
    return { name: 'Upper/Lower', splits: ['Upper', 'Lower'] };
  }

  // Check for Bro Split
  const broSplitParts = ['chest', 'back', 'shoulder', 'arm', 'leg'];
  const matchingParts = broSplitParts.filter((part) =>
    focusLower.some((f) => f.includes(part))
  );
  if (matchingParts.length >= 3) {
    return { name: 'Body Part Split', splits: matchingParts.map(capitalize) };
  }

  // Check for Full Body
  if (focusLower.some((f) => f.includes('full body') || f.includes('fullbody'))) {
    return { name: 'Full Body', splits: ['Full Body'] };
  }

  // Generic split detection
  if (focuses.length >= 2) {
    return {
      name: 'Custom Split',
      splits: focuses.slice(0, 4).map((f) => capitalize(f)),
    };
  }

  return null;
}

/**
 * Detect exercise pairings (exercises commonly done together)
 */
export function detectExercisePairings(
  workouts: WorkoutForPattern[]
): DetectedPattern[] {
  if (workouts.length < 5) return [];

  // Build co-occurrence matrix
  const coOccurrence = new Map<string, Map<string, number>>();

  workouts.forEach((workout) => {
    const exercises = workout.exercises;
    for (let i = 0; i < exercises.length; i++) {
      for (let j = i + 1; j < exercises.length; j++) {
        const key1 = exercises[i].name;
        const key2 = exercises[j].name;

        if (!coOccurrence.has(key1)) coOccurrence.set(key1, new Map());
        if (!coOccurrence.has(key2)) coOccurrence.set(key2, new Map());

        coOccurrence.get(key1)!.set(key2, (coOccurrence.get(key1)!.get(key2) || 0) + 1);
        coOccurrence.get(key2)!.set(key1, (coOccurrence.get(key2)!.get(key1) || 0) + 1);
      }
    }
  });

  // Find strong pairings (>= 3 co-occurrences, >= 60% of appearances)
  const patterns: DetectedPattern[] = [];
  const exerciseCounts = new Map<string, number>();

  workouts.forEach((w) => {
    w.exercises.forEach((e) => {
      exerciseCounts.set(e.name, (exerciseCounts.get(e.name) || 0) + 1);
    });
  });

  const processedPairs = new Set<string>();

  coOccurrence.forEach((pairs, exercise1) => {
    pairs.forEach((count, exercise2) => {
      const pairKey = [exercise1, exercise2].sort().join('|');
      if (processedPairs.has(pairKey)) return;
      processedPairs.add(pairKey);

      if (count < 3) return;

      const ex1Count = exerciseCounts.get(exercise1) || 1;
      const ex2Count = exerciseCounts.get(exercise2) || 1;
      const minCount = Math.min(ex1Count, ex2Count);
      const coOccurrenceRate = count / minCount;

      if (coOccurrenceRate >= 0.6) {
        patterns.push({
          type: 'exercise_pairing',
          name: `${exercise1} + ${exercise2}`,
          confidence: coOccurrenceRate,
          data: {
            exercises: [exercise1, exercise2],
            co_occurrence: count,
            co_occurrence_rate: coOccurrenceRate,
          },
          description: `You typically pair ${exercise1} with ${exercise2}`,
        });
      }
    });
  });

  // Return top 5 pairings by confidence
  return patterns.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}

/**
 * Detect preferred training days
 */
export function detectTrainingDays(workouts: WorkoutForPattern[]): DetectedPattern | null {
  if (workouts.length < 8) return null;

  const dayCounts = new Map<number, number>();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  workouts.forEach((w) => {
    if (w.date_completed) {
      const dayOfWeek = getDay(parseISO(w.date_completed));
      dayCounts.set(dayOfWeek, (dayCounts.get(dayOfWeek) || 0) + 1);
    }
  });

  // Find preferred days (top days by count)
  const totalWorkouts = workouts.length;
  const sortedDays = Array.from(dayCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .filter(([_, count]) => count / totalWorkouts >= 0.1); // At least 10% of workouts

  if (sortedDays.length === 0) return null;

  const preferredDays = sortedDays.slice(0, 4).map(([day]) => dayNames[day]);
  const confidence = sortedDays.slice(0, 4).reduce((sum, [_, count]) => sum + count, 0) / totalWorkouts;

  return {
    type: 'training_day',
    name: 'Training Schedule',
    confidence,
    data: {
      preferred_days: preferredDays,
      day_distribution: Object.fromEntries(
        Array.from(dayCounts.entries()).map(([day, count]) => [dayNames[day], count])
      ),
    },
    description: `You typically train on ${preferredDays.join(', ')}`,
  };
}

/**
 * Estimate training frequency (days per week)
 */
function estimateDaysPerWeek(workouts: WorkoutForPattern[]): number {
  if (workouts.length < 2) return 0;

  const completedWorkouts = workouts.filter((w) => w.date_completed);
  if (completedWorkouts.length < 2) return 0;

  const firstDate = parseISO(completedWorkouts[completedWorkouts.length - 1].date_completed!);
  const lastDate = parseISO(completedWorkouts[0].date_completed!);
  const daysDiff = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
  const weeks = daysDiff / 7;

  return Math.round((completedWorkouts.length / weeks) * 10) / 10;
}

/**
 * Capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Check if a workout matches a detected pattern
 */
export function matchesPattern(
  workout: WorkoutForPattern,
  pattern: DetectedPattern
): boolean {
  if (pattern.type !== 'training_split') return false;

  const workoutFocus = normalizeFocus(workout.focus);
  const splits = (pattern.data.splits as string[]).map((s) => s.toLowerCase());

  return splits.some((split) => workoutFocus.includes(split.toLowerCase()));
}

/**
 * Calculate pattern stability score
 */
export function calculatePatternStability(
  pattern: DetectedPattern,
  workouts: WorkoutForPattern[]
): number {
  const recentWorkouts = workouts.slice(0, 12);
  const matchingCount = recentWorkouts.filter((w) => matchesPattern(w, pattern)).length;
  return matchingCount / recentWorkouts.length;
}

/**
 * Should we offer to formalize this pattern into a training block?
 */
export function shouldOfferStructure(
  pattern: DetectedPattern,
  workouts: WorkoutForPattern[]
): boolean {
  if (pattern.type !== 'training_split') return false;
  if (pattern.confidence < 0.7) return false;

  const stability = calculatePatternStability(pattern, workouts);
  return stability >= 0.6 && workouts.length >= 8;
}

/**
 * Get pattern insights for display
 */
export function getPatternInsights(patterns: DetectedPattern[]): Array<{
  icon: string;
  title: string;
  description: string;
  confidence: number;
}> {
  return patterns.map((pattern) => {
    let icon = 'analytics-outline';

    switch (pattern.type) {
      case 'training_split':
        icon = 'calendar-outline';
        break;
      case 'exercise_pairing':
        icon = 'link-outline';
        break;
      case 'training_day':
        icon = 'time-outline';
        break;
      case 'rep_range_preference':
        icon = 'repeat-outline';
        break;
    }

    return {
      icon,
      title: pattern.name,
      description: pattern.description,
      confidence: pattern.confidence,
    };
  });
}
