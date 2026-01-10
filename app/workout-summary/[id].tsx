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
import { useWorkout } from '@/hooks/useWorkouts';
import type { WorkoutSet } from '@/types/database';

export default function WorkoutSummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const summaryRef = useRef<View>(null);

  const { data: workout, isLoading } = useWorkout(id);

  // Debug: log the actual sets data
  console.log('Workout sets:', workout?.workout_sets?.map(s => ({
    exercise: s.exercise?.name,
    weight: s.actual_weight,
    reps: s.actual_reps,
    volume: s.actual_weight && s.actual_reps ? s.actual_weight * s.actual_reps : 0
  })));

  // Calculate workout stats
  const stats = workout?.workout_sets?.reduce(
    (acc, set: WorkoutSet) => {
      // Only count sets that were actually performed
      if (set.actual_weight && set.actual_reps) {
        acc.totalSets++;
        acc.totalReps += set.actual_reps;
        acc.totalVolume += set.actual_weight * set.actual_reps;
        
        // Track max weight
        if (set.actual_weight > acc.maxWeight) {
          acc.maxWeight = set.actual_weight;
        }
      }
      return acc;
    },
    { totalSets: 0, totalReps: 0, totalVolume: 0, maxWeight: 0 }
  ) || { totalSets: 0, totalReps: 0, totalVolume: 0, maxWeight: 0 };

  // Group sets by exercise
  const exerciseSummary = workout?.workout_sets?.reduce((acc, set: WorkoutSet) => {
    if (!set.exercise || !set.actual_weight || !set.actual_reps) return acc;
    
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
    acc[key].totalVolume += set.actual_weight * set.actual_reps;
    if (set.actual_weight > acc[key].maxWeight) {
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
          console.log('Share cancelled', error);
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
          isDark ? 'bg-steel-950' : 'bg-steel-50'
        }`}
      >
        <ActivityIndicator size="large" color="#ed7411" />
      </SafeAreaView>
    );
  }

  if (!workout) {
    return (
      <SafeAreaView
        className={`flex-1 items-center justify-center ${
          isDark ? 'bg-steel-950' : 'bg-steel-50'
        }`}
      >
        <Text className={isDark ? 'text-steel-400' : 'text-steel-500'}>
          Workout not found
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView
        className={`flex-1 ${isDark ? 'bg-steel-950' : 'bg-steel-50'}`}
        edges={['left', 'right', 'bottom']}
      >
      {/* Header */}
      <View
        className={`px-4 py-3 border-b flex-row items-center justify-between ${
          isDark ? 'border-steel-700 bg-steel-900' : 'border-steel-200 bg-white'
        }`}
      >
        <Pressable onPress={() => router.back()} className="p-2 -ml-2">
          <Ionicons
            name="close"
            size={24}
            color={isDark ? '#f6f7f9' : '#1e232f'}
          />
        </Pressable>
        <Text
          className={`text-lg font-semibold ${
            isDark ? 'text-steel-100' : 'text-steel-900'
          }`}
        >
          Workout Summary
        </Text>
        <Pressable onPress={handleShare} className="p-2">
          <Ionicons
            name="share-outline"
            size={24}
            color={isDark ? '#ed7411' : '#de5a09'}
          />
        </Pressable>
      </View>

      <ScrollView className="flex-1">
        {/* Shareable Card */}
        <View ref={summaryRef} className="p-4">
          <View
            className={`rounded-2xl p-6 ${
              isDark ? 'bg-steel-900' : 'bg-white'
            } shadow-lg`}
          >
            {/* Workout Title */}
            <View className="items-center mb-6">
              <View className="w-16 h-16 rounded-full bg-forge-500 items-center justify-center mb-3">
                <Ionicons name="barbell" size={32} color="#ffffff" />
              </View>
              <Text
                className={`text-2xl font-bold text-center ${
                  isDark ? 'text-steel-100' : 'text-steel-900'
                }`}
              >
                {workout.focus}
              </Text>
              <Text
                className={`text-sm mt-1 ${
                  isDark ? 'text-steel-400' : 'text-steel-500'
                }`}
              >
                {workoutDate}
              </Text>
              <Text
                className={`text-sm ${
                  isDark ? 'text-steel-400' : 'text-steel-500'
                }`}
              >
                ⏱️ {workout.duration_minutes || 0} minutes
              </Text>
            </View>

            {/* Stats Grid */}
            <View className="flex-row flex-wrap justify-between mb-6">
              <View
                className={`w-[48%] p-4 rounded-xl mb-3 ${
                  isDark ? 'bg-steel-800' : 'bg-steel-50'
                }`}
              >
                <Text className="text-4xl font-bold text-forge-500 mb-1">
                  {stats.totalSets}
                </Text>
                <Text
                  className={`text-sm ${
                    isDark ? 'text-steel-400' : 'text-steel-500'
                  }`}
                >
                  Total Sets
                </Text>
              </View>
              
              <View
                className={`w-[48%] p-4 rounded-xl mb-3 ${
                  isDark ? 'bg-steel-800' : 'bg-steel-50'
                }`}
              >
                <Text className="text-4xl font-bold text-forge-500 mb-1">
                  {stats.totalReps}
                </Text>
                <Text
                  className={`text-sm ${
                    isDark ? 'text-steel-400' : 'text-steel-500'
                  }`}
                >
                  Total Reps
                </Text>
              </View>
              
              <View
                className={`w-[48%] p-4 rounded-xl ${
                  isDark ? 'bg-steel-800' : 'bg-steel-50'
                }`}
              >
                <Text className="text-4xl font-bold text-forge-500 mb-1">
                  {Math.round(stats.totalVolume)}
                </Text>
                <Text
                  className={`text-sm ${
                    isDark ? 'text-steel-400' : 'text-steel-500'
                  }`}
                >
                  lbs Moved
                </Text>
              </View>
              
              <View
                className={`w-[48%] p-4 rounded-xl ${
                  isDark ? 'bg-steel-800' : 'bg-steel-50'
                }`}
              >
                <Text className="text-4xl font-bold text-forge-500 mb-1">
                  {stats.maxWeight}
                </Text>
                <Text
                  className={`text-sm ${
                    isDark ? 'text-steel-400' : 'text-steel-500'
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
                  isDark ? 'text-steel-100' : 'text-steel-900'
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
                      isDark ? 'bg-steel-800' : 'bg-steel-50'
                    }`}
                  >
                    <View className="flex-row items-center justify-between mb-1">
                      <Text
                        className={`font-semibold flex-1 ${
                          isDark ? 'text-steel-200' : 'text-steel-800'
                        }`}
                      >
                        {ex.name}
                      </Text>
                      <Text className="text-forge-500 font-bold">
                        {Math.round(ex.totalVolume)} lbs
                      </Text>
                    </View>
                    <View className="flex-row">
                      <Text
                        className={`text-xs ${
                          isDark ? 'text-steel-400' : 'text-steel-500'
                        }`}
                      >
                        {ex.sets} sets • Max: {ex.maxWeight} lbs
                      </Text>
                    </View>
                  </View>
                ))}
            </View>

            {/* Footer */}
            <View className="mt-6 pt-4 border-t border-steel-700 items-center">
              <Text
                className={`text-xs ${
                  isDark ? 'text-steel-500' : 'text-steel-400'
                }`}
              >
                Powered by Forged Fitness
              </Text>
            </View>
          </View>
        </View>

        {/* Share Button (Mobile) */}
        {Platform.OS !== 'web' && (
          <View className="px-4 pb-4">
            <Pressable
              onPress={handleShare}
              className="bg-forge-500 rounded-xl p-4 flex-row items-center justify-center"
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
