// Detailed exercise breakdown component for workout summary
// Shows prescription vs actual performance for each exercise

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, Text } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import { formatPrescription, generateExerciseSummary, formatDistance, formatPace, type SetWithExercise } from '@/lib/workoutSummary';
import type { Exercise, WorkoutSet } from '@/types/database';

interface ExerciseBreakdownProps {
  exercise: Exercise;
  sets: WorkoutSet[];
  targetReps?: number | null;
  targetRPE?: number | null;
  targetLoad?: number | null;
}

export function ExerciseBreakdown({
  exercise,
  sets,
  targetReps,
  targetRPE,
  targetLoad,
}: ExerciseBreakdownProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const isCardio = exercise.modality === 'Cardio';
  
  // Convert WorkoutSet to SetWithExercise for summary functions
  const setsWithExercise: SetWithExercise[] = sets.map(s => ({
    ...s,
    exercise,
    segment_type: (s as any).segment_type || 'work',
  }));

  // Get prescription - use first set's target data if not provided
  const firstSet = sets[0];
  const prescription = formatPrescription(
    setsWithExercise, 
    exercise, 
    targetReps ?? firstSet?.target_reps ?? undefined, 
    targetRPE ?? firstSet?.target_rpe ?? undefined, 
    targetLoad ?? firstSet?.target_load ?? undefined
  );
  
  // Get actual summary
  const actualSummary = generateExerciseSummary(exercise, setsWithExercise);

  // Get logged sets (with actual data)
  const loggedSets = sets.filter(s => {
    if (isCardio) {
      return s.distance_meters || s.duration_seconds || s.avg_pace;
    }
    return s.actual_weight !== null || s.actual_reps !== null;
  });

  return (
    <View
      className={`p-4 rounded-xl mb-3 ${
        isDark ? 'bg-graphite-800 border-graphite-700' : 'bg-white border-graphite-200'
      } border`}
    >
      {/* Exercise Name */}
      <Text
        className={`text-lg font-bold mb-2 ${
          isDark ? 'text-graphite-100' : 'text-graphite-900'
        }`}
      >
        {exercise.name}
      </Text>

      {/* Prescription */}
      {prescription && (
        <View className="mb-3">
          <Text
            className={`text-xs font-semibold mb-1 ${
              isDark ? 'text-graphite-400' : 'text-graphite-500'
            }`}
          >
            Prescribed:
          </Text>
          <Text
            className={`text-sm ${
              isDark ? 'text-graphite-300' : 'text-graphite-700'
            }`}
          >
            {prescription}
          </Text>
        </View>
      )}

      {/* Actual Performance */}
      {loggedSets.length > 0 ? (
        <View>
          <Text
            className={`text-xs font-semibold mb-2 ${
              isDark ? 'text-graphite-400' : 'text-graphite-500'
            }`}
          >
            Actual:
          </Text>
          
          {isCardio ? (
            // Cardio: Show summary
            <Text
              className={`text-sm font-medium ${
                isDark ? 'text-graphite-200' : 'text-graphite-800'
              }`}
            >
              {actualSummary}
            </Text>
          ) : (
            // Strength: Show individual sets
            <View className="gap-1">
              {loggedSets
                .sort((a, b) => (a.set_order || 0) - (b.set_order || 0))
                .map((set, index) => {
                  const weight = set.actual_weight === 0 ? 'BW' : (set.actual_weight?.toString() || '?');
                  const reps = set.actual_reps?.toString() || '?';
                  const rpe = set.actual_rpe ? ` @ ${set.actual_rpe}` : '';
                  
                  return (
                    <View key={set.id || index} className="flex-row items-center">
                      <Text className="text-graphite-500 mr-2">•</Text>
                      <Text
                        className={`text-sm ${
                          isDark ? 'text-graphite-200' : 'text-graphite-800'
                        }`}
                      >
                        Set {set.set_order || index + 1}: {weight} x {reps}{rpe}
                      </Text>
                    </View>
                  );
                })}
            </View>
          )}
        </View>
      ) : (
        <Text
          className={`text-sm italic ${
            isDark ? 'text-graphite-500' : 'text-graphite-400'
          }`}
        >
          Not completed
        </Text>
      )}
    </View>
  );
}
