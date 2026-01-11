import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Share,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import { useColorScheme } from '@/components/useColorScheme';
import { SessionVerdict } from '@/components/SessionVerdict';
import { useWorkout } from '@/hooks/useWorkouts';
import { useShareWorkout } from '@/hooks/useSocial';
import { calculateSetVolume } from '@/lib/utils';
import { Alert } from 'react-native';
import type { WorkoutSet, WorkoutWithSets } from '@/types/database';

export default function WorkoutSummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const summaryRef = useRef<View>(null);

  const { data: workout, isLoading } = useWorkout(id);
  const shareWorkoutMutation = useShareWorkout();

  // Calculate workout stats
  const stats = workout?.workout_sets?.reduce(
    (acc, set: WorkoutSet) => {
      // Only count sets that were actually performed
      const volume = calculateSetVolume(set.actual_weight, set.actual_reps);
      if (volume > 0) {
        acc.totalSets++;
        acc.totalReps += set.actual_reps || 0;
        acc.totalVolume += volume;
        
        // Track max weight
        if (set.actual_weight && set.actual_weight > acc.maxWeight) {
          acc.maxWeight = set.actual_weight;
        }
      }
      return acc;
    },
    { totalSets: 0, totalReps: 0, totalVolume: 0, maxWeight: 0 }
  ) || { totalSets: 0, totalReps: 0, totalVolume: 0, maxWeight: 0 };

  // Group sets by exercise
  const exerciseSummary = workout?.workout_sets?.reduce((acc, set: WorkoutSet) => {
    if (!set.exercise) return acc;
    
    const volume = calculateSetVolume(set.actual_weight, set.actual_reps);
    if (volume === 0) return acc;
    
    const key = set.exercise_id;
    if (!acc[key]) {
      acc[key] = {
        name: set.exercise.name,
        sets: 0,
        totalVolume: 0,
        maxWeight: 0,
      };
    }
    
    acc[key].sets++;
    acc[key].totalVolume += volume;
    if (set.actual_weight && set.actual_weight > acc[key].maxWeight) {
      acc[key].maxWeight = set.actual_weight;
    }
    
    return acc;
  }, {} as Record<string, { name: string; sets: number; totalVolume: number; maxWeight: number }>) || {};

  // Format date
  const workoutDate = workout?.date_completed
    ? new Date(workout.date_completed).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Not completed';

  // Handle share
  const handleShare = async () => {
    if (Platform.OS === 'web') {
      // On web, try to use the Web Share API or copy to clipboard
      const summary = `🏋️ ${workout?.focus || 'Workout'} Summary

📅 ${workoutDate}
⏱️ ${workout?.duration_minutes || 0} minutes

💪 ${stats.totalSets} sets
🔢 ${stats.totalReps} reps
📦 ${Math.round(stats.totalVolume)} lbs moved
🏆 ${stats.maxWeight} lbs max

Top Exercises:
${Object.values(exerciseSummary)
  .sort((a, b) => b.totalVolume - a.totalVolume)
  .slice(0, 3)
  .map((ex, i) => `${i + 1}. ${ex.name}: ${ex.sets} sets, ${Math.round(ex.totalVolume)} lbs`)
  .join('\n')}

#FitnesTracking #WorkoutComplete`;

      if (navigator.share) {
        try {
          await navigator.share({
            title: `${workout?.focus || 'Workout'} Summary`,
            text: summary,
          });
        } catch (error) {
          // User cancelled or error
        }
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(summary);
        alert('Summary copied to clipboard!');
      }
    } else {
      // On mobile, capture screenshot
      try {
        if (summaryRef.current) {
          const uri = await captureRef(summaryRef, {
            format: 'png',
            quality: 1,
          });
          
          await Share.share({
            message: `Check out my ${workout?.focus || 'workout'}! 💪`,
            url: uri,
          });
        }
      } catch (error) {
        console.error('Failed to share:', error);
      }
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView
        className={`flex-1 items-center justify-center ${
          isDark ? 'bg-carbon-950' : 'bg-graphite-50'
        }`}
      >
        <ActivityIndicator size="large" color="#2F80ED" />
      </SafeAreaView>
    );
  }

  if (!workout) {
    return (
      <SafeAreaView
        className={`flex-1 items-center justify-center ${
          isDark ? 'bg-carbon-950' : 'bg-graphite-50'
        }`}
      >
        <Text className={isDark ? 'text-graphite-400' : 'text-graphite-500'}>
          Workout not found
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView
        className={`flex-1 ${isDark ? 'bg-carbon-950' : 'bg-graphite-50'}`}
        edges={['left', 'right', 'bottom']}
      >
      {/* Header */}
      <View
        className={`px-4 py-3 border-b flex-row items-center justify-between ${
          isDark ? 'border-graphite-700 bg-graphite-900' : 'border-graphite-200 bg-white'
        }`}
      >
        <Pressable onPress={() => router.back()} className="p-2 -ml-2">
          <Ionicons
            name="close"
            size={24}
            color={isDark ? '#E6E8EB' : '#0E1116'}
          />
        </Pressable>
        <Text
          className={`text-lg font-semibold ${
            isDark ? 'text-graphite-50' : 'text-carbon-950'
          }`}
        >
          Workout Summary
        </Text>
        <View className="flex-row gap-2">
          <Pressable
            onPress={async () => {
              if (!workout) return;
              try {
                await shareWorkoutMutation.mutateAsync({ workoutId: workout.id });
                Alert.alert('Success', 'Workout shared to feed!');
              } catch (error) {
                Alert.alert('Error', 'Failed to share workout');
              }
            }}
            className="p-2"
          >
            <Ionicons
              name="people-outline"
              size={24}
              color={isDark ? '#2F80ED' : '#2F80ED'}
            />
          </Pressable>
          <Pressable onPress={handleShare} className="p-2">
            <Ionicons
              name="share-outline"
              size={24}
              color={isDark ? '#2F80ED' : '#2F80ED'}
            />
          </Pressable>
        </View>
      </View>

      <ScrollView className="flex-1">
        {/* Shareable Card */}
        <View ref={summaryRef} className="p-4">
          <View
            className={`rounded-2xl p-6 ${
              isDark ? 'bg-graphite-900' : 'bg-white'
            } shadow-lg`}
          >
            {/* Workout Title */}
            <View className="items-center mb-6">
              <View className="w-16 h-16 rounded-full bg-signal-500 items-center justify-center mb-3">
                <Ionicons name="barbell" size={32} color="#ffffff" />
              </View>
              <Text
                className={`text-2xl font-bold text-center ${
                  isDark ? 'text-graphite-50' : 'text-carbon-950'
                }`}
              >
                {workout.focus}
              </Text>
              <Text
                className={`text-sm mt-1 ${
                  isDark ? 'text-graphite-400' : 'text-graphite-500'
                }`}
              >
                {workoutDate}
              </Text>
              <Text
                className={`text-sm ${
                  isDark ? 'text-graphite-400' : 'text-graphite-500'
                }`}
              >
                ⏱️ {workout.duration_minutes || 0} minutes
              </Text>
            </View>

            {/* Session Verdict */}
            {workout && <SessionVerdict workout={workout as WorkoutWithSets} />}

            {/* Stats Grid */}
            <View className="flex-row flex-wrap justify-between mb-6">
              <View
                className={`w-[48%] p-4 rounded-xl mb-3 ${
                  isDark ? 'bg-graphite-800' : 'bg-graphite-50'
                }`}
              >
                <Text className="text-4xl font-bold text-signal-500 mb-1">
                  {stats.totalSets}
                </Text>
                <Text
                  className={`text-sm ${
                    isDark ? 'text-graphite-400' : 'text-graphite-500'
                  }`}
                >
                  Total Sets
                </Text>
              </View>
              
              <View
                className={`w-[48%] p-4 rounded-xl mb-3 ${
                  isDark ? 'bg-graphite-800' : 'bg-graphite-50'
                }`}
              >
                <Text className="text-4xl font-bold text-signal-500 mb-1">
                  {stats.totalReps}
                </Text>
                <Text
                  className={`text-sm ${
                    isDark ? 'text-graphite-400' : 'text-graphite-500'
                  }`}
                >
                  Total Reps
                </Text>
              </View>
              
              <View
                className={`w-[48%] p-4 rounded-xl ${
                  isDark ? 'bg-graphite-800' : 'bg-graphite-50'
                }`}
              >
                <Text className="text-4xl font-bold text-signal-500 mb-1">
                  {Math.round(stats.totalVolume)}
                </Text>
                <Text
                  className={`text-sm ${
                    isDark ? 'text-graphite-400' : 'text-graphite-500'
                  }`}
                >
                  lbs Moved
                </Text>
              </View>
              
              <View
                className={`w-[48%] p-4 rounded-xl ${
                  isDark ? 'bg-graphite-800' : 'bg-graphite-50'
                }`}
              >
                <Text className="text-4xl font-bold text-signal-500 mb-1">
                  {stats.maxWeight}
                </Text>
                <Text
                  className={`text-sm ${
                    isDark ? 'text-graphite-400' : 'text-graphite-500'
                  }`}
                >
                  lbs Max
                </Text>
              </View>
            </View>

            {/* Exercise Breakdown */}
            <View>
              <Text
                className={`text-lg font-bold mb-3 ${
                  isDark ? 'text-graphite-50' : 'text-carbon-950'
                }`}
              >
                Exercise Breakdown
              </Text>
              {Object.values(exerciseSummary)
                .sort((a, b) => b.totalVolume - a.totalVolume)
                .map((ex, index) => (
                  <View
                    key={index}
                    className={`p-3 rounded-lg mb-2 ${
                      isDark ? 'bg-graphite-800' : 'bg-graphite-50'
                    }`}
                  >
                    <View className="flex-row items-center justify-between mb-1">
                      <Text
                        className={`font-semibold flex-1 ${
                          isDark ? 'text-graphite-200' : 'text-graphite-800'
                        }`}
                      >
                        {ex.name}
                      </Text>
                      <Text className="text-signal-500 font-bold">
                        {Math.round(ex.totalVolume)} lbs
                      </Text>
                    </View>
                    <View className="flex-row">
                      <Text
                        className={`text-xs ${
                          isDark ? 'text-graphite-400' : 'text-graphite-500'
                        }`}
                      >
                        {ex.sets} sets • Max: {ex.maxWeight} lbs
                      </Text>
                    </View>
                  </View>
                ))}
            </View>

            {/* Footer */}
            <View className="mt-6 pt-4 border-t border-graphite-700 items-center">
              <Text
                className={`text-xs ${
                  isDark ? 'text-graphite-500' : 'text-graphite-400'
                }`}
              >
                Powered by Foundry Lab
              </Text>
            </View>
          </View>
        </View>

        {/* Share Button (Mobile) */}
        {Platform.OS !== 'web' && (
          <View className="px-4 pb-4">
            <Pressable
              onPress={handleShare}
              className="bg-signal-500 rounded-xl p-4 flex-row items-center justify-center"
            >
              <Ionicons name="share-social" size={20} color="#ffffff" />
              <Text className="text-white font-semibold ml-2">
                Share Workout
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
    </>
  );
}
