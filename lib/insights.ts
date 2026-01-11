/**
 * Quiet Education Messaging System
 * 
 * Generates contextual education messages based on training patterns
 */

import type { WorkoutWithSets } from '@/types/database';

export interface Insight {
  type: 'positive' | 'warning' | 'info';
  message: string;
}

/**
 * Generate insights from workout history
 */
export function generateInsights(workouts: WorkoutWithSets[]): Insight[] {
  const insights: Insight[] = [];

  if (workouts.length === 0) {
    return insights;
  }

  // Get recent workouts (last 2 weeks)
  const now = new Date();
  const twoWeeksAgo = new Date(now);
  twoWeeksAgo.setDate(now.getDate() - 14);

  const recentWorkouts = workouts.filter((w) => {
    if (!w.date_completed) return false;
    return new Date(w.date_completed) >= twoWeeksAgo;
  });

  // Count exercise frequency
  const exerciseFrequency = new Map<string, { count: number; lastTrained: Date | null; name: string }>();

  recentWorkouts.forEach((workout) => {
    const workoutDate = workout.date_completed ? new Date(workout.date_completed) : null;
    
    workout.workout_sets?.forEach((set) => {
      if (set.exercise && !set.is_warmup) {
        const key = set.exercise_id;
        if (!exerciseFrequency.has(key)) {
          exerciseFrequency.set(key, {
            count: 0,
            lastTrained: null,
            name: set.exercise.name,
          });
        }
        
        const freq = exerciseFrequency.get(key)!;
        freq.count++;
        if (workoutDate && (!freq.lastTrained || workoutDate > freq.lastTrained)) {
          freq.lastTrained = workoutDate;
        }
      }
    });
  });

  // Generate insights
  exerciseFrequency.forEach((freq, exerciseId) => {
    // High frequency exercises (3+ times this week)
    const thisWeek = new Date(now);
    thisWeek.setDate(now.getDate() - now.getDay());
    thisWeek.setHours(0, 0, 0, 0);

    const thisWeekCount = workouts.filter((w) => {
      if (!w.date_completed) return false;
      const date = new Date(w.date_completed);
      return date >= thisWeek;
    }).reduce((count, w) => {
      return count + (w.workout_sets?.filter((s) => s.exercise_id === exerciseId && !s.is_warmup).length || 0);
    }, 0);

    if (thisWeekCount >= 3) {
      insights.push({
        type: 'positive',
        message: `Three exposures to ${freq.name} this week. Volume +8%. Good accumulation.`,
      });
    }

    // Exercise not trained recently
    if (freq.lastTrained) {
      const daysSince = Math.floor((now.getTime() - freq.lastTrained.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince > 6) {
        insights.push({
          type: 'warning',
          message: `${freq.name} frequency dropped. Last trained: ${daysSince} days ago.`,
        });
      }
    }
  });

  // Volume insights
  const thisWeekVolume = workouts
    .filter((w) => {
      if (!w.date_completed) return false;
      const date = new Date(w.date_completed);
      const thisWeek = new Date(now);
      thisWeek.setDate(now.getDate() - now.getDay());
      thisWeek.setHours(0, 0, 0, 0);
      return date >= thisWeek;
    })
    .reduce((sum, w) => {
      return (
        sum +
        (w.workout_sets?.reduce((vol, set) => {
          if (set.actual_weight && set.actual_reps && !set.is_warmup) {
            return vol + set.actual_weight * set.actual_reps;
          }
          return vol;
        }, 0) || 0)
      );
    }, 0);

  const lastWeekVolume = workouts
    .filter((w) => {
      if (!w.date_completed) return false;
      const date = new Date(w.date_completed);
      const lastWeek = new Date(now);
      lastWeek.setDate(now.getDate() - now.getDay() - 7);
      lastWeek.setHours(0, 0, 0, 0);
      const thisWeek = new Date(now);
      thisWeek.setDate(now.getDate() - now.getDay());
      thisWeek.setHours(0, 0, 0, 0);
      return date >= lastWeek && date < thisWeek;
    })
    .reduce((sum, w) => {
      return (
        sum +
        (w.workout_sets?.reduce((vol, set) => {
          if (set.actual_weight && set.actual_reps && !set.is_warmup) {
            return vol + set.actual_weight * set.actual_reps;
          }
          return vol;
        }, 0) || 0)
      );
    }, 0);

  if (lastWeekVolume > 0 && thisWeekVolume > 0) {
    const volumeChange = ((thisWeekVolume - lastWeekVolume) / lastWeekVolume) * 100;
    if (volumeChange > 5) {
      insights.push({
        type: 'positive',
        message: `Volume +${volumeChange.toFixed(0)}% vs last week.`,
      });
    }
  }

  return insights.slice(0, 5); // Limit to 5 insights
}
