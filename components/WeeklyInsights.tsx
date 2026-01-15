/**
 * Weekly Insights Component
 *
 * Shows pattern recognition and quiet education for the week
 */

import { Ionicons } from '@expo/vector-icons';
import { View, Text } from 'react-native';
import { useMemo } from 'react';

import { Colors } from '@/constants/Colors';
import type { WorkoutWithSets } from '@/types/database';

interface WeeklyInsightsProps {
  workouts: WorkoutWithSets[];
}

export function WeeklyInsights({ workouts }: WeeklyInsightsProps) {

  // Calculate weekly stats
  const insights = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);

    const thisWeekWorkouts = workouts.filter((w) => {
      if (!w.date_completed) return false;
      const date = new Date(w.date_completed);
      return date >= startOfWeek;
    });

    // Count exercise exposures (by workout, not by set)
    const exerciseCounts = new Map<string, number>();
    const exerciseNames = new Map<string, string>();

    thisWeekWorkouts.forEach((workout) => {
      // Track which exercises were done in this workout (to avoid double-counting)
      const exercisesInWorkout = new Set<string>();
      
      workout.workout_sets?.forEach((set) => {
        if (set.exercise && !set.is_warmup && set.exercise_id) {
          // Only count each exercise once per workout
          if (!exercisesInWorkout.has(set.exercise_id)) {
            exercisesInWorkout.add(set.exercise_id);
            exerciseCounts.set(set.exercise_id, (exerciseCounts.get(set.exercise_id) || 0) + 1);
            exerciseNames.set(set.exercise_id, set.exercise.name);
          }
        }
      });
    });

    // Find exercises with 3+ exposures
    const frequentExercises = Array.from(exerciseCounts.entries())
      .filter(([_, count]) => count >= 3)
      .map(([id, count]) => ({ id, count, name: exerciseNames.get(id) || 'Unknown' }));

    // Calculate volume trend (simplified)
    const totalVolume = thisWeekWorkouts.reduce((sum, w) => {
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

    // Count progressions (PRs)
    const progressionCount = thisWeekWorkouts.reduce((sum, w) => {
      return sum + (w.workout_sets?.filter((set) => set.is_pr && !set.is_warmup).length || 0);
    }, 0);

    return {
      workoutCount: thisWeekWorkouts.length,
      frequentExercises,
      totalVolume,
      progressionCount,
    };
  }, [workouts]);

  if (insights.workoutCount === 0) {
    return null;
  }

  return (
    <View
      style={{
        padding: 16,
        borderRadius: 16,
        marginBottom: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <Ionicons name="analytics-outline" size={20} color={Colors.signal[400]} />
        <Text style={{ fontSize: 18, fontWeight: '700', marginLeft: 8, color: Colors.graphite[50] }}>
          This Week
        </Text>
      </View>

      {/* Key insights */}
      <View style={{ gap: 8 }}>
        {insights.frequentExercises.length > 0 && (
          <Text style={{ fontSize: 14, color: Colors.graphite[300] }}>
            {insights.frequentExercises[0]?.count} exposures to {insights.frequentExercises[0]?.name}.{' '}
            {insights.totalVolume >= 1000
              ? `Volume: ${(insights.totalVolume / 1000).toFixed(1)}k lbs.`
              : `Volume: ${Math.round(insights.totalVolume)} lbs.`}
            {' '}
            {insights.progressionCount > 0 && (
              <>
                {insights.progressionCount} progression{insights.progressionCount !== 1 ? 's' : ''}. Good.
              </>
            )}
          </Text>
        )}
      </View>
    </View>
  );
}
