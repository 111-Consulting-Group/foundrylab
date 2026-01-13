/**
 * Streak Utilities
 *
 * Calculate training streaks and consistency metrics for the social feed.
 */

import { differenceInDays, startOfDay, parseISO, isAfter, isBefore, subDays } from 'date-fns';

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  weeklyAdherence: number; // 0-100%
  totalWorkoutsThisWeek: number;
  lastWorkoutDate: string | null;
}

/**
 * Calculate streak from completed workout dates
 * A streak is maintained if workouts are done within 3 days of each other
 */
export function calculateStreak(completedDates: string[]): StreakInfo {
  if (!completedDates || completedDates.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      weeklyAdherence: 0,
      totalWorkoutsThisWeek: 0,
      lastWorkoutDate: null,
    };
  }

  // Sort dates descending (most recent first)
  const sortedDates = [...completedDates]
    .map((d) => startOfDay(parseISO(d)))
    .sort((a, b) => b.getTime() - a.getTime());

  const today = startOfDay(new Date());
  const lastWorkout = sortedDates[0];
  const daysSinceLastWorkout = differenceInDays(today, lastWorkout);

  // Current streak: count consecutive days with workouts within 3-day gaps
  let currentStreak = 0;
  let previousDate = today;

  // Only count current streak if last workout was within 3 days
  if (daysSinceLastWorkout <= 3) {
    // Get unique days
    const uniqueDays = new Set<number>();
    for (const date of sortedDates) {
      uniqueDays.add(date.getTime());
    }

    const uniqueDaysArray = Array.from(uniqueDays)
      .sort((a, b) => b - a)
      .map((t) => new Date(t));

    for (let i = 0; i < uniqueDaysArray.length; i++) {
      const workoutDate = uniqueDaysArray[i];
      const gap = differenceInDays(previousDate, workoutDate);

      // Allow up to 3 days between workouts to maintain streak
      if (gap <= 3) {
        currentStreak++;
        previousDate = workoutDate;
      } else {
        break;
      }
    }
  }

  // Longest streak calculation
  let longestStreak = 0;
  let tempStreak = 0;
  let prevDate: Date | null = null;

  const uniqueSortedDates = [...new Set(sortedDates.map((d) => d.getTime()))]
    .sort((a, b) => a - b)
    .map((t) => new Date(t));

  for (const date of uniqueSortedDates) {
    if (prevDate === null) {
      tempStreak = 1;
    } else {
      const gap = differenceInDays(date, prevDate);
      if (gap <= 3) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }
    prevDate = date;
  }
  longestStreak = Math.max(longestStreak, tempStreak);

  // Weekly adherence (workouts in last 7 days / target of 4)
  const weekAgo = subDays(today, 7);
  const workoutsThisWeek = sortedDates.filter(
    (d) => isAfter(d, weekAgo) || d.getTime() === weekAgo.getTime()
  ).length;
  const targetWorkoutsPerWeek = 4;
  const weeklyAdherence = Math.min(100, Math.round((workoutsThisWeek / targetWorkoutsPerWeek) * 100));

  return {
    currentStreak,
    longestStreak,
    weeklyAdherence,
    totalWorkoutsThisWeek: workoutsThisWeek,
    lastWorkoutDate: completedDates[0] || null,
  };
}

/**
 * Get streak badge config
 */
export function getStreakBadge(streak: number): {
  label: string;
  icon: string;
  color: string;
  bgColor: string;
} | null {
  if (streak < 2) return null;

  if (streak >= 30) {
    return {
      label: `${streak}-day streak`,
      icon: 'flame',
      color: '#F97316',
      bgColor: 'rgba(249, 115, 22, 0.15)',
    };
  }

  if (streak >= 14) {
    return {
      label: `${streak}-day streak`,
      icon: 'flame',
      color: '#EF4444',
      bgColor: 'rgba(239, 68, 68, 0.15)',
    };
  }

  if (streak >= 7) {
    return {
      label: `${streak}-day streak`,
      icon: 'flame',
      color: '#F59E0B',
      bgColor: 'rgba(245, 158, 11, 0.15)',
    };
  }

  if (streak >= 2) {
    return {
      label: `${streak}-day streak`,
      icon: 'flame-outline',
      color: '#808fb0',
      bgColor: 'rgba(128, 143, 176, 0.15)',
    };
  }

  return null;
}

/**
 * Get adherence badge config
 */
export function getAdherenceBadge(adherencePercent: number): {
  label: string;
  color: string;
} | null {
  if (adherencePercent < 50) return null;

  if (adherencePercent >= 100) {
    return {
      label: `${adherencePercent}% adherence`,
      color: '#22C55E',
    };
  }

  if (adherencePercent >= 75) {
    return {
      label: `${adherencePercent}% adherence`,
      color: '#2F80ED',
    };
  }

  return {
    label: `${adherencePercent}% adherence`,
    color: '#808fb0',
  };
}
