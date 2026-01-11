/**
 * Weekly Insights Component
 * 
 * Shows pattern recognition and quiet education for the week
 */

import { Ionicons } from '@expo/vector-icons';
import { View, Text } from 'react-native';
import { useMemo } from 'react';

import { useColorScheme } from '@/components/useColorScheme';
import type { WorkoutWithSets } from '@/types/database';

interface WeeklyInsightsProps {
  workouts: WorkoutWithSets[];
}

export function WeeklyInsights({ workouts }: WeeklyInsightsProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

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

    // Count exercise exposures
    const exerciseCounts = new Map<string, number>();
    const exerciseNames = new Map<string, string>();

    thisWeekWorkouts.forEach((workout) => {
      workout.workout_sets?.forEach((set) => {
        if (set.exercise && !set.is_warmup) {
          exerciseCounts.set(set.exercise_id, (exerciseCounts.get(set.exercise_id) || 0) + 1);
          exerciseNames.set(set.exercise_id, set.exercise.name);
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
      className={`p-4 rounded-xl mb-4 ${
        isDark ? 'bg-graphite-800 border-graphite-700' : 'bg-white border-graphite-200'
      } border`}
    >
      <View className="flex-row items-center mb-3">
        <Ionicons name="analytics-outline" size={20} color="#2F80ED" />
        <Text className={`text-lg font-bold ml-2 ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
          This Week
        </Text>
      </View>

      {/* Key insights */}
      <View className="gap-2">
        {insights.frequentExercises.length > 0 && (
          <Text className={`text-sm ${isDark ? 'text-graphite-300' : 'text-graphite-700'}`}>
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
