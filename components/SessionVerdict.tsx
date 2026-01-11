/**
 * Session Verdict Component
 * 
 * Displays honest feedback about workout progression
 * Shows which exercises progressed, matched, or regressed
 */

import { Ionicons } from '@expo/vector-icons';
import { View, Text } from 'react-native';
import { useMemo } from 'react';

import { useColorScheme } from '@/components/useColorScheme';
import { evaluateSession, getSessionQualityInfo } from '@/lib/sessionQuality';
import type { WorkoutWithSets } from '@/types/database';

interface SessionVerdictProps {
  workout: WorkoutWithSets;
}

interface ExerciseProgression {
  exerciseName: string;
  exerciseId: string;
  progression: ReturnType<typeof detectProgression> | null;
  progressionCount: number;
  matchCount: number;
  regressionCount: number;
}

export function SessionVerdict({ workout }: SessionVerdictProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Evaluate session quality
  const sessionQuality = useMemo(() => evaluateSession(workout), [workout]);
  const qualityInfo = getSessionQualityInfo(sessionQuality);

  // Group sets by exercise and count PRs
  const exerciseProgressions = useMemo(() => {
    if (!workout.workout_sets) return [];

    const exerciseMap = new Map<string, ExerciseProgression>();

    workout.workout_sets.forEach((set) => {
      if (!set.exercise || set.is_warmup || !set.actual_weight || !set.actual_reps) return;

      const exerciseId = set.exercise_id;
      if (!exerciseMap.has(exerciseId)) {
        exerciseMap.set(exerciseId, {
          exerciseName: set.exercise.name,
          exerciseId,
          progression: null,
          progressionCount: 0,
          matchCount: 0,
          regressionCount: 0,
        });
      }

      const exercise = exerciseMap.get(exerciseId)!;
      
      if (set.is_pr) {
        exercise.progressionCount++;
      }
    });

    return Array.from(exerciseMap.values());
  }, [workout.workout_sets]);

  // Calculate overall session stats
  const sessionStats = useMemo(() => {
    const progressions = exerciseProgressions.reduce((sum, ex) => sum + ex.progressionCount, 0);
    const totalExercises = exerciseProgressions.length;

    return { progressions, totalExercises, quality: sessionQuality };
  }, [exerciseProgressions, sessionQuality]);

  if (exerciseProgressions.length === 0) {
    return null;
  }

  return (
    <View
      className={`p-4 rounded-xl mb-4 ${
        isDark ? 'bg-graphite-800 border-graphite-700' : 'bg-white border-graphite-200'
      } border`}
    >
      <View className="flex-row items-center mb-3">
        <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
        <Text className={`text-lg font-bold ml-2 ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
          Session Verdict
        </Text>
      </View>

      {/* Exercise breakdown */}
      <View className="mb-4 gap-2">
        {exerciseProgressions.slice(0, 5).map((ex) => (
          <View
            key={ex.exerciseId}
            className="flex-row items-center justify-between py-2"
          >
            <Text className={`flex-1 ${isDark ? 'text-graphite-200' : 'text-graphite-800'}`}>
              {ex.exerciseName}
            </Text>
            <View className="flex-row items-center gap-2">
              {ex.progressionCount > 0 && (
                <View className="flex-row items-center">
                  <Ionicons name="arrow-up-circle" size={16} color="#22c55e" />
                  <Text className="text-progress-500 text-sm ml-1 font-semibold">
                    {ex.progressionCount} PR{ex.progressionCount > 1 ? 's' : ''}
                  </Text>
                </View>
              )}
              {ex.progressionCount === 0 && ex.matchCount === 0 && ex.regressionCount === 0 && (
                <Text className={`text-sm ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                  No comparison
                </Text>
              )}
            </View>
          </View>
        ))}
      </View>

      {/* Overall summary */}
      <View
        className={`pt-3 border-t ${
          isDark ? 'border-graphite-700' : 'border-graphite-200'
        }`}
      >
        <View className="flex-row items-center justify-between mb-2">
          <Text className={`text-sm ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
            Overall:
          </Text>
          <Text className={`text-sm font-semibold ${isDark ? 'text-graphite-200' : 'text-graphite-800'}`}>
            {sessionStats.progressions} progression{sessionStats.progressions !== 1 ? 's' : ''} across {sessionStats.totalExercises} exercise{sessionStats.totalExercises !== 1 ? 's' : ''}
          </Text>
        </View>
        <View className="flex-row items-center justify-between">
          <Text className={`text-sm font-semibold ${isDark ? 'text-graphite-300' : 'text-graphite-600'}`}>
            Status:
          </Text>
          <Text
            className="text-sm font-bold"
            style={{ color: qualityInfo.color }}
          >
            {qualityInfo.label}
          </Text>
        </View>
      </View>
    </View>
  );
}
