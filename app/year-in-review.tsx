import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';
import { useWorkoutHistory } from '@/hooks/useWorkouts';
import { useRecentPRs } from '@/hooks/usePersonalRecords';
import { useTrainingBlocks } from '@/hooks/useTrainingBlocks';

export default function YearInReviewScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Fetch all data for the year
  const { data: allWorkouts = [], isLoading: workoutsLoading } = useWorkoutHistory(1000);
  const { data: allPRs = [] } = useRecentPRs(1000);
  const { data: allBlocks = [] } = useTrainingBlocks();

  // Filter to this year
  const thisYear = new Date().getFullYear();
  const yearStart = new Date(thisYear, 0, 1);
  const yearEnd = new Date(thisYear, 11, 31, 23, 59, 59);

  const yearWorkouts = useMemo(() => {
    return allWorkouts.filter((w) => {
      if (!w.date_completed) return false;
      const date = new Date(w.date_completed);
      return date >= yearStart && date <= yearEnd;
    });
  }, [allWorkouts, yearStart, yearEnd]);

  const yearPRs = useMemo(() => {
    return allPRs.filter((pr) => {
      const date = new Date(pr.achieved_at);
      return date >= yearStart && date <= yearEnd;
    });
  }, [allPRs, yearStart, yearEnd]);

  const completedBlocks = useMemo(() => {
    // Simplified - would need to check block completion logic
    return allBlocks.filter((block) => {
      const startDate = new Date(block.start_date);
      return startDate >= yearStart && startDate <= yearEnd;
    });
  }, [allBlocks, yearStart, yearEnd]);

  // Calculate stats
  const stats = useMemo(() => {
    let totalVolume = 0;
    const exerciseSet = new Set<string>();

    yearWorkouts.forEach((workout) => {
      workout.workout_sets?.forEach((set) => {
        if (set.actual_weight && set.actual_reps && !set.is_warmup) {
          totalVolume += set.actual_weight * set.actual_reps;
          exerciseSet.add(set.exercise_id);
        }
      });
    });

    return {
      totalWorkouts: yearWorkouts.length,
      totalVolume,
      uniqueExercises: exerciseSet.size,
      totalPRs: yearPRs.length,
      completedBlocks: completedBlocks.length,
    };
  }, [yearWorkouts, yearPRs, completedBlocks]);

  // Group PRs by exercise to find lifts that moved
  const prsByExercise = useMemo(() => {
    const map = new Map<string, typeof allPRs>();
    yearPRs.forEach((pr) => {
      if (!map.has(pr.exercise_id)) {
        map.set(pr.exercise_id, []);
      }
      map.get(pr.exercise_id)!.push(pr);
    });
    return map;
  }, [yearPRs]);

  const liftsThatMoved = useMemo(() => {
    return Array.from(prsByExercise.entries()).slice(0, 5);
  }, [prsByExercise]);

  if (workoutsLoading) {
    return (
      <SafeAreaView
        className={`flex-1 items-center justify-center ${isDark ? 'bg-carbon-950' : 'bg-graphite-50'}`}
      >
        <ActivityIndicator size="large" color="#2F80ED" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className={`flex-1 ${isDark ? 'bg-carbon-950' : 'bg-graphite-50'}`} edges={['left', 'right']}>
      {/* Header */}
      <View
        className={`px-4 py-3 border-b ${
          isDark ? 'border-graphite-700 bg-graphite-900' : 'border-graphite-200 bg-white'
        }`}
      >
        <View className="flex-row items-center justify-between">
          <Pressable onPress={() => router.back()} className="p-2 -ml-2">
            <Ionicons name="arrow-back" size={24} color={isDark ? '#E6E8EB' : '#0E1116'} />
          </Pressable>
          <Text className={`font-semibold ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
            {thisYear} Year in Review
          </Text>
          <View className="w-10" />
        </View>
      </View>

      <ScrollView className="flex-1 px-4">
        {/* Summary Stats */}
        <View className="py-6 mb-4">
          <Text className={`text-2xl font-bold mb-4 ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
            Your {thisYear}
          </Text>
          <View className="flex-row flex-wrap gap-3">
            <View
              className={`flex-1 min-w-[48%] p-4 rounded-xl ${
                isDark ? 'bg-graphite-800 border-graphite-700' : 'bg-white border-graphite-200'
              } border`}
            >
              <Text className={`text-3xl font-bold mb-1 text-signal-500`}>
                {stats.totalWorkouts}
              </Text>
              <Text className={`text-sm ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                Workouts
              </Text>
            </View>
            <View
              className={`flex-1 min-w-[48%] p-4 rounded-xl ${
                isDark ? 'bg-graphite-800 border-graphite-700' : 'bg-white border-graphite-200'
              } border`}
            >
              <Text className={`text-3xl font-bold mb-1 text-progress-500`}>
                {stats.totalPRs}
              </Text>
              <Text className={`text-sm ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                Personal Records
              </Text>
            </View>
            <View
              className={`flex-1 min-w-[48%] p-4 rounded-xl ${
                isDark ? 'bg-graphite-800 border-graphite-700' : 'bg-white border-graphite-200'
              } border`}
            >
              <Text className={`text-3xl font-bold mb-1 text-oxide-500`}>
                {stats.completedBlocks}
              </Text>
              <Text className={`text-sm ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                Blocks Completed
              </Text>
            </View>
            <View
              className={`flex-1 min-w-[48%] p-4 rounded-xl ${
                isDark ? 'bg-graphite-800 border-graphite-700' : 'bg-white border-graphite-200'
              } border`}
            >
              <Text className={`text-3xl font-bold mb-1 text-signal-500`}>
                {Math.round(stats.totalVolume / 1000)}k
              </Text>
              <Text className={`text-sm ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                lbs Moved
              </Text>
            </View>
          </View>
        </View>

        {/* Lifts That Moved */}
        {liftsThatMoved.length > 0 && (
          <View className="mb-6">
            <Text className={`text-lg font-bold mb-3 ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
              Lifts That Moved
            </Text>
            <View className="gap-2">
              {liftsThatMoved.map(([exerciseId, prs]) => {
                const topPR = prs[0];
                const exerciseName = (topPR as any).exercise?.name || 'Exercise';
                return (
                  <View
                    key={exerciseId}
                    className={`p-4 rounded-xl ${
                      isDark ? 'bg-graphite-800 border-graphite-700' : 'bg-white border-graphite-200'
                    } border`}
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className={`font-semibold ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
                        {exerciseName}
                      </Text>
                      <Text className="text-oxide-500 font-bold">
                        {topPR.value} {topPR.unit}
                      </Text>
                    </View>
                    <Text className={`text-sm mt-1 ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                      {prs.length} PR{prs.length !== 1 ? 's' : ''} this year
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Volume Trend (simplified) */}
        <View className="mb-6">
          <Text className={`text-lg font-bold mb-3 ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
            Total Volume Trend
          </Text>
          <View
            className={`p-4 rounded-xl ${
              isDark ? 'bg-graphite-800 border-graphite-700' : 'bg-white border-graphite-200'
            } border`}
          >
            <Text className={`text-2xl font-bold text-signal-500 mb-1`}>
              {Math.round(stats.totalVolume / 1000)}k lbs
            </Text>
            <Text className={`text-sm ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
              Total volume for {thisYear}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
