import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import React, { useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Share,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import { useColorScheme } from '@/components/useColorScheme';
import { ExerciseBreakdown } from '@/components/ExerciseBreakdown';
import { SaveTemplateModal } from '@/components/TemplatePicker';
import { useWorkout, useUncompleteWorkout } from '@/hooks/useWorkouts';
import { useShareWorkout } from '@/hooks/useSocial';
import { useIsBlockComplete, useBlockSummary } from '@/hooks/useBlockSummary';
import { useCreateWorkoutTemplate, workoutToTemplate } from '@/hooks/useWorkoutTemplates';
import { calculateSetVolume } from '@/lib/utils';
import { detectWorkoutContext } from '@/lib/workoutContext';
import { Alert } from 'react-native';
import type { WorkoutSet, WorkoutWithSets, Exercise } from '@/types/database';

export default function WorkoutSummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const summaryRef = useRef<View>(null);

  const { data: workout, isLoading } = useWorkout(id);
  const shareWorkoutMutation = useShareWorkout();
  const createTemplateMutation = useCreateWorkoutTemplate();
  const uncompleteMutation = useUncompleteWorkout();

  // Template modal state
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);

  // Check if this workout completes a block
  const { isBlockComplete, blockId } = useIsBlockComplete(id);
  const { data: blockSummary } = useBlockSummary(blockId || '');
  const [showBlockSummary, setShowBlockSummary] = useState(true);

  // Calculate workout stats
  const stats = workout?.workout_sets?.reduce(
    (acc, set: WorkoutSet) => {
      // Only count sets that were actually performed (not warmup, have actual data)
      if (set.is_warmup) return acc;
      
      const volume = calculateSetVolume(set.actual_weight, set.actual_reps);
      if (volume > 0 && set.actual_weight && set.actual_reps) {
        acc.totalSets++;
        acc.totalReps += set.actual_reps;
        acc.totalVolume += volume;
        
        // Track max weight only from sets with actual volume
        if (set.actual_weight > acc.maxWeight) {
          acc.maxWeight = set.actual_weight;
        }
      }
      return acc;
    },
    { totalSets: 0, totalReps: 0, totalVolume: 0, maxWeight: 0 }
  ) || { totalSets: 0, totalReps: 0, totalVolume: 0, maxWeight: 0 };

  // Parse focus into sections (same logic as workout screen)
  const parseFocusToSections = (focus: string): string[] => {
    const cleanFocus = focus.replace(/\s*\([^)]*\)\s*/g, '');
    const parts = cleanFocus.split(/\s*[+&]\s*/);
    return parts.map((p) => p.trim()).filter(Boolean);
  };

  // Group exercises with their sets and target data
  const exercisesBySection = useMemo(() => {
    if (!workout?.workout_sets) return new Map<string, Array<{ exercise: Exercise; sets: WorkoutSet[]; targetReps?: number | null; targetRPE?: number | null; targetLoad?: number | null }>>();

    const sections = parseFocusToSections(workout.focus || '');
    const exerciseMap = new Map<string, { exercise: Exercise; sets: WorkoutSet[]; targetReps?: number | null; targetRPE?: number | null; targetLoad?: number | null; section?: string }>();
    const sectionMap = new Map<string, string[]>();

    // Group sets by exercise
    workout.workout_sets.forEach((set: WorkoutSet) => {
      if (!set.exercise) return;

      const key = set.exercise_id;
      if (!exerciseMap.has(key)) {
        // Assign section
        const muscleGroup = set.exercise.muscle_group.toLowerCase();
        let section = 'Exercises';
        
        if (set.exercise.modality === 'Cardio') {
          section = sections.find((s) => 
            s.toLowerCase().includes('speed') || 
            s.toLowerCase().includes('cardio') ||
            s.toLowerCase().includes('conditioning') ||
            s.toLowerCase().includes('run')
          ) || sections[0] || 'Conditioning';
        } else {
          for (const s of sections) {
            const sectionLower = s.toLowerCase();
            if (
              (sectionLower.includes('chest') && muscleGroup.includes('chest')) ||
              (sectionLower.includes('back') && muscleGroup.includes('back')) ||
              (sectionLower.includes('push') && (muscleGroup.includes('chest') || muscleGroup.includes('shoulder') || muscleGroup.includes('tricep'))) ||
              (sectionLower.includes('pull') && (muscleGroup.includes('back') || muscleGroup.includes('bicep'))) ||
              (sectionLower.includes('leg') && muscleGroup.includes('leg')) ||
              (sectionLower.includes('upper') && !muscleGroup.includes('leg')) ||
              (sectionLower.includes('lower') && muscleGroup.includes('leg'))
            ) {
              section = s;
              break;
            }
          }
        }

        exerciseMap.set(key, {
          exercise: set.exercise,
          sets: [],
          targetReps: set.target_reps,
          targetRPE: set.target_rpe,
          targetLoad: set.target_load,
          section,
        });

        if (!sectionMap.has(section)) {
          sectionMap.set(section, []);
        }
        if (!sectionMap.get(section)!.includes(key)) {
          sectionMap.get(section)!.push(key);
        }
      }
      exerciseMap.get(key)!.sets.push(set);
    });

    // Build final structure
    const result = new Map<string, Array<{ exercise: Exercise; sets: WorkoutSet[]; targetReps?: number | null; targetRPE?: number | null; targetLoad?: number | null }>>();
    
    // Add sections in order
    for (const section of sections) {
      if (sectionMap.has(section)) {
        const exerciseIds = sectionMap.get(section)!;
        result.set(section, exerciseIds.map(id => {
          const ex = exerciseMap.get(id);
          if (ex) {
            const { section: _, ...rest } = ex;
            return rest;
          }
          return null;
        }).filter((ex): ex is { exercise: Exercise; sets: WorkoutSet[]; targetReps?: number | null; targetRPE?: number | null; targetLoad?: number | null } => ex !== null));
      }
    }
    
    // Add any remaining exercises
    for (const [section, exerciseIds] of sectionMap) {
      if (!sections.includes(section)) {
        result.set(section, exerciseIds.map(id => {
          const ex = exerciseMap.get(id);
          if (ex) {
            const { section: _, ...rest } = ex;
            return rest;
          }
          return null;
        }).filter((ex): ex is { exercise: Exercise; sets: WorkoutSet[]; targetReps?: number | null; targetRPE?: number | null; targetLoad?: number | null } => ex !== null));
      }
    }

    return result;
  }, [workout]);

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
    if (!workout?.workout_sets) return;

    // Group sets by exercise and format them
    const exerciseGroups = new Map<string, Array<WorkoutSet>>();
    
    workout.workout_sets.forEach((set: WorkoutSet) => {
      if (!set.exercise || set.is_warmup) return;
      
      const exerciseId = set.exercise_id;
      if (!exerciseGroups.has(exerciseId)) {
        exerciseGroups.set(exerciseId, []);
      }
      exerciseGroups.get(exerciseId)!.push(set);
    });

    // Build detailed exercise list
    const exerciseDetails: string[] = [];
    
    exerciseGroups.forEach((sets, exerciseId) => {
      const exercise = sets[0].exercise;
      if (!exercise) return;

      const isCardio = exercise.modality === 'Cardio';
      
      if (isCardio) {
        // Format cardio sets
        const cardioSet = sets[0];
        let cardioLine = `${exercise.name}:`;
        
        if (cardioSet.duration_seconds) {
          const minutes = Math.round(cardioSet.duration_seconds / 60);
          cardioLine += ` ${minutes}min`;
        }
        
        if (cardioSet.avg_pace) {
          cardioLine += ` (${cardioSet.avg_pace} pace)`;
        }
        
        if (cardioSet.avg_hr) {
          cardioLine += ` @ ${cardioSet.avg_hr} bpm`;
        }
        
        exerciseDetails.push(cardioLine);
      } else {
        // Format strength sets
        const setLines = sets
          .sort((a, b) => (a.set_order || 0) - (b.set_order || 0))
          .map((set) => {
            const parts: string[] = [];
            
            if (set.actual_weight) {
              parts.push(`${set.actual_weight}x${set.actual_reps || ''}`);
            } else if (set.actual_reps) {
              parts.push(`${set.actual_reps} reps`);
            }
            
            if (set.actual_rpe) {
              parts.push(`@ ${set.actual_rpe}`);
            }
            
            return parts.length > 0 ? `- ${parts.join(' ')}` : null;
          })
          .filter((line): line is string => line !== null);
        
        if (setLines.length > 0) {
          exerciseDetails.push(`${exercise.name}:`);
          exerciseDetails.push(...setLines);
        }
      }
    });

    const summary = `🏋️ ${workout?.focus || 'Workout'} Summary

📅 ${workoutDate}
⏱️ ${workout?.duration_minutes || 0} minutes

${exerciseDetails.join('\n')}

💪 ${stats.totalSets} sets
🔢 ${stats.totalReps} reps
📦 ${Math.round(stats.totalVolume)} lbs moved
🏆 ${stats.maxWeight} lbs max

#FitnessTracking #WorkoutComplete`;

    if (Platform.OS === 'web') {
      // On web, try to use the Web Share API or copy to clipboard
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
            message: summary,
            url: uri,
          });
        }
      } catch (error) {
        console.error('Failed to share:', error);
      }
    }
  };

  // Handle save as template
  const handleSaveAsTemplate = async (name: string, description?: string) => {
    if (!workout?.workout_sets) return;

    // Convert workout sets to exercise list with names
    const exerciseMap = new Map<string, { exercise_id: string; exercise_name: string; sets: { actual_weight?: number | null; actual_reps?: number | null; actual_rpe?: number | null }[] }>();

    workout.workout_sets.forEach((set: WorkoutSet) => {
      if (!set.exercise_id || !set.actual_reps) return;

      if (!exerciseMap.has(set.exercise_id)) {
        exerciseMap.set(set.exercise_id, {
          exercise_id: set.exercise_id,
          exercise_name: (set as any).exercise?.name || 'Unknown',
          sets: [],
        });
      }
      exerciseMap.get(set.exercise_id)?.sets.push({
        actual_weight: set.actual_weight,
        actual_reps: set.actual_reps,
        actual_rpe: set.actual_rpe,
      });
    });

    const workoutForTemplate = {
      focus: workout.focus || 'Workout',
      exercises: Array.from(exerciseMap.values()),
      duration_minutes: workout.duration_minutes || undefined,
    };

    const template = workoutToTemplate(workoutForTemplate, name, description);

    try {
      await createTemplateMutation.mutateAsync(template);
      setShowSaveTemplate(false);
      Alert.alert('Success', 'Workout saved as template!');
    } catch (error) {
      Alert.alert('Error', 'Failed to save template');
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
                className={`text-lg font-bold mb-4 ${
                  isDark ? 'text-graphite-50' : 'text-carbon-950'
                }`}
              >
                Exercise Breakdown
              </Text>
              
              {Array.from(exercisesBySection.entries()).map(([section, exercises]) => (
                <View key={section} className="mb-4">
                  {exercisesBySection.size > 1 && (
                    <Text
                      className={`text-xs font-bold uppercase tracking-wide mb-3 ${
                        isDark ? 'text-graphite-400' : 'text-graphite-500'
                      }`}
                    >
                      {section}
                    </Text>
                  )}
                  {exercises.map((ex) => (
                    <ExerciseBreakdown
                      key={ex.exercise.id}
                      exercise={ex.exercise}
                      sets={ex.sets}
                      targetReps={ex.targetReps}
                      targetRPE={ex.targetRPE}
                      targetLoad={ex.targetLoad}
                    />
                  ))}
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

        {/* Action Buttons */}
        <View className="px-4 pb-4 gap-3">
          {/* Uncomplete Workout */}
          <Pressable
            onPress={() => {
              Alert.alert(
                'Uncomplete Workout',
                'This will mark the workout as incomplete so you can reschedule it. Continue?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Uncomplete',
                    style: 'destructive',
                    onPress: () => {
                      uncompleteMutation.mutate(
                        { id: workout.id },
                        {
                          onSuccess: () => {
                            Alert.alert('Success', 'Workout marked as incomplete. You can now reschedule it.');
                            router.back();
                          },
                          onError: (error) => {
                            console.error('Uncomplete error:', error);
                            Alert.alert('Error', `Failed to uncomplete workout: ${error instanceof Error ? error.message : 'Unknown error'}`);
                          },
                        }
                      );
                    },
                  },
                ]
              );
            }}
            className={`rounded-xl p-4 flex-row items-center justify-center border ${
              isDark ? 'border-graphite-700 bg-graphite-800' : 'border-graphite-200 bg-white'
            }`}
          >
            <Ionicons name="refresh-outline" size={20} color="#2F80ED" />
            <Text className="text-signal-500 font-semibold ml-2">
              Mark as Incomplete
            </Text>
          </Pressable>

          {/* Save as Template */}
          <Pressable
            onPress={() => setShowSaveTemplate(true)}
            className={`rounded-xl p-4 flex-row items-center justify-center border ${
              isDark ? 'border-graphite-700 bg-graphite-800' : 'border-graphite-200 bg-white'
            }`}
          >
            <Ionicons name="bookmark-outline" size={20} color="#2F80ED" />
            <Text className="text-signal-500 font-semibold ml-2">
              Save as Template
            </Text>
          </Pressable>

          {/* Share Button (Mobile) */}
          {Platform.OS !== 'web' && (
            <Pressable
              onPress={handleShare}
              className="bg-signal-500 rounded-xl p-4 flex-row items-center justify-center"
            >
              <Ionicons name="share-social" size={20} color="#ffffff" />
              <Text className="text-white font-semibold ml-2">
                Share Workout
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      {/* Block Completion Modal */}
      {isBlockComplete && blockSummary && (
        <Modal
          visible={showBlockSummary}
          transparent
          animationType="slide"
          onRequestClose={() => setShowBlockSummary(false)}
        >
          <SafeAreaView className="flex-1 bg-black/60">
            <View className="flex-1 justify-center px-4">
              <View
                className={`rounded-3xl p-6 ${isDark ? 'bg-graphite-900' : 'bg-white'}`}
              >
                {/* Celebration Header */}
                <View className="items-center mb-6">
                  <View className="w-20 h-20 rounded-full bg-progress-500 items-center justify-center mb-4">
                    <Ionicons name="trophy" size={40} color="#ffffff" />
                  </View>
                  <Text
                    className={`text-2xl font-bold text-center ${isDark ? 'text-graphite-50' : 'text-carbon-950'}`}
                  >
                    Block Complete!
                  </Text>
                  <Text
                    className={`text-center mt-1 ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}
                  >
                    You finished {blockSummary.blockName}
                  </Text>
                </View>

                {/* Block Stats */}
                <View className={`p-4 rounded-xl mb-4 ${isDark ? 'bg-graphite-800' : 'bg-graphite-50'}`}>
                  <View className="flex-row justify-between">
                    <View className="items-center flex-1">
                      <Text className={`text-2xl font-bold ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
                        {blockSummary.completedWorkouts}
                      </Text>
                      <Text className={`text-xs ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                        Workouts
                      </Text>
                    </View>
                    <View className="items-center flex-1">
                      <Text className={`text-2xl font-bold text-signal-500`}>
                        {blockSummary.totalVolume >= 1000
                          ? `${(blockSummary.totalVolume / 1000).toFixed(0)}k`
                          : Math.round(blockSummary.totalVolume)}
                      </Text>
                      <Text className={`text-xs ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                        lbs Moved
                      </Text>
                    </View>
                    <View className="items-center flex-1">
                      <Text className={`text-2xl font-bold text-oxide-500`}>
                        {blockSummary.prsHit.length}
                      </Text>
                      <Text className={`text-xs ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                        PRs
                      </Text>
                    </View>
                  </View>
                </View>

                {/* PRs Hit */}
                {blockSummary.prsHit.length > 0 && (
                  <View className="mb-4">
                    <Text className={`text-sm font-semibold mb-2 ${isDark ? 'text-graphite-300' : 'text-graphite-600'}`}>
                      PRs Hit This Block
                    </Text>
                    <View className="gap-2">
                      {blockSummary.prsHit.slice(0, 4).map((pr, index) => (
                        <View
                          key={index}
                          className={`flex-row items-center p-2 rounded-lg ${isDark ? 'bg-oxide-500/10' : 'bg-oxide-500/10'}`}
                        >
                          <Ionicons name="trophy" size={16} color="#EF4444" />
                          <Text className={`flex-1 ml-2 ${isDark ? 'text-graphite-200' : 'text-graphite-800'}`}>
                            {pr.exerciseName}
                          </Text>
                          <Text className="text-oxide-500 font-semibold">
                            {pr.value} {pr.unit}
                          </Text>
                        </View>
                      ))}
                      {blockSummary.prsHit.length > 4 && (
                        <Text className={`text-xs text-center ${isDark ? 'text-graphite-500' : 'text-graphite-400'}`}>
                          +{blockSummary.prsHit.length - 4} more PRs
                        </Text>
                      )}
                    </View>
                  </View>
                )}

                {/* Muscle Group Summary */}
                {blockSummary.muscleGroups.length > 0 && (
                  <View className="mb-4">
                    <Text className={`text-sm font-semibold mb-2 ${isDark ? 'text-graphite-300' : 'text-graphite-600'}`}>
                      Volume Distribution
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                      {blockSummary.muscleGroups.slice(0, 6).map((group, index) => (
                        <View
                          key={index}
                          className={`px-3 py-1.5 rounded-full ${isDark ? 'bg-graphite-800' : 'bg-graphite-100'}`}
                        >
                          <Text className={`text-sm ${isDark ? 'text-graphite-300' : 'text-graphite-600'}`}>
                            {group.name}: {group.sets}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Duration Info */}
                <View className={`flex-row items-center justify-center py-3 rounded-xl mb-4 ${isDark ? 'bg-graphite-800' : 'bg-graphite-50'}`}>
                  <Ionicons name="calendar-outline" size={18} color={isDark ? '#808fb0' : '#607296'} />
                  <Text className={`ml-2 ${isDark ? 'text-graphite-300' : 'text-graphite-600'}`}>
                    {blockSummary.durationWeeks} weeks · {Math.round(blockSummary.totalDuration / 60)} hours trained
                  </Text>
                </View>

                {/* Action Buttons */}
                <View className="gap-3">
                  <Pressable
                    onPress={() => {
                      setShowBlockSummary(false);
                      router.push('/block-builder');
                    }}
                    className="bg-signal-500 py-4 rounded-xl items-center"
                  >
                    <View className="flex-row items-center">
                      <Ionicons name="sparkles" size={20} color="#ffffff" />
                      <Text className="text-white font-semibold ml-2">
                        Build Next Block
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => setShowBlockSummary(false)}
                    className={`py-4 rounded-xl items-center ${isDark ? 'bg-graphite-800' : 'bg-graphite-100'}`}
                  >
                    <Text className={`font-semibold ${isDark ? 'text-graphite-300' : 'text-graphite-600'}`}>
                      View Workout Summary
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </SafeAreaView>
        </Modal>
      )}

      {/* Save Template Modal */}
      <SaveTemplateModal
        visible={showSaveTemplate}
        onClose={() => setShowSaveTemplate(false)}
        onSave={handleSaveAsTemplate}
        defaultName=""
        defaultFocus={workout?.focus || ''}
        isSaving={createTemplateMutation.isPending}
      />
    </SafeAreaView>
    </>
  );
}
