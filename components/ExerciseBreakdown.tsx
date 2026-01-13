// Detailed exercise breakdown component for workout summary
// Shows prescription vs actual performance for each exercise

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, Text } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import { formatPrescription, generateExerciseSummary, type SetWithExercise } from '@/lib/workoutSummary';
import type { Exercise, WorkoutSet } from '@/types/database';
import { LabCard, LabStat } from '@/components/ui/LabPrimitives';
import { DeltaTag } from '@/components/ui/DeltaTag';

interface ExerciseBreakdownProps {
  exercise: Exercise;
  sets: WorkoutSet[];
  targetReps?: number | null;
  targetRPE?: number | null;
  targetLoad?: number | null;
  previousBest?: {
    weight: number | null;
    reps: number | null;
    e1rm: number | null;
  } | null;
}

export function ExerciseBreakdown({
  exercise,
  sets,
  targetReps,
  targetRPE,
  targetLoad,
  previousBest,
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
  
  // Get actual summary (e.g. "3 x 10 @ 135 lbs")
  // For the table view, we might want the "Best Set" specifically
  const bestSet = sets.reduce((best, current) => {
    const currentWeight = current.actual_weight || 0;
    const bestWeight = best.actual_weight || 0;
    if (currentWeight > bestWeight) return current;
    if (currentWeight === bestWeight && (current.actual_reps || 0) > (best.actual_reps || 0)) return current;
    return best;
  }, sets[0]);

  // Calculate Delta if previousBest exists
  let weightDelta = 0;
  let repsDelta = 0;
  
  if (previousBest && bestSet && bestSet.actual_weight && bestSet.actual_reps) {
    if (previousBest.weight) {
      weightDelta = bestSet.actual_weight - previousBest.weight;
    }
    // Only compare reps if weights are similar (within 5%)
    if (previousBest.weight && Math.abs(weightDelta) < previousBest.weight * 0.05 && previousBest.reps) {
      repsDelta = bestSet.actual_reps - previousBest.reps;
    }
  }

  // Get logged sets (with actual data)
  const loggedSets = sets.filter(s => {
    if (isCardio) {
      return s.distance_meters || s.duration_seconds || s.avg_pace;
    }
    return s.actual_weight !== null || s.actual_reps !== null;
  });

  return (
    <LabCard noPadding className="mb-3 overflow-hidden">
      {/* Header */}
      <View className={`px-4 py-3 border-b ${isDark ? 'border-graphite-700' : 'border-graphite-200'} bg-opacity-50`}>
        <View className="flex-row justify-between items-start">
          <View className="flex-1 mr-2">
            <Text className={`text-base font-bold ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
              {exercise.name}
            </Text>
            {prescription && (
              <Text className={`text-xs ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                Target: {prescription}
              </Text>
            )}
          </View>
          
          {/* Best Set & Delta Highlight */}
          {!isCardio && loggedSets.length > 0 && (
            <View className="items-end">
              <View className="flex-row items-center gap-2">
                <Text className={`font-lab-mono font-bold ${isDark ? 'text-graphite-200' : 'text-graphite-800'}`}>
                  {bestSet.actual_weight} <Text className="text-xs font-normal text-graphite-500">lbs</Text> × {bestSet.actual_reps}
                </Text>
                {(weightDelta !== 0 || repsDelta !== 0) && (
                  <View className="flex-row gap-1">
                    {weightDelta !== 0 && <DeltaTag value={weightDelta} unit="lbs" />}
                    {repsDelta > 0 && <DeltaTag value={repsDelta} unit="reps" />}
                  </View>
                )}
              </View>
              <Text className={`text-xs ${isDark ? 'text-graphite-500' : 'text-graphite-400'}`}>
                Top Set
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Set Details Table */}
      <View className="px-4 py-2">
        {loggedSets.length > 0 ? (
          <View className="gap-1">
            {loggedSets
              .sort((a, b) => (a.set_order || 0) - (b.set_order || 0))
              .map((set, index) => {
                if (isCardio) {
                   // Cardio display
                   return (
                    <Text key={set.id || index} className={`text-sm ${isDark ? 'text-graphite-300' : 'text-graphite-700'}`}>
                      {generateExerciseSummary(exercise, [set as SetWithExercise])}
                    </Text>
                   );
                }

                const weight = set.actual_weight === 0 ? 'BW' : (set.actual_weight?.toString() || '-');
                const reps = set.actual_reps?.toString() || '-';
                const rpe = set.actual_rpe ? ` @ ${set.actual_rpe}` : '';
                
                return (
                  <View key={set.id || index} className="flex-row items-center justify-between py-1">
                    <View className="flex-row items-center w-16">
                      <Text className={`text-xs font-lab-mono ${isDark ? 'text-graphite-500' : 'text-graphite-400'}`}>
                        Set {index + 1}
                      </Text>
                    </View>
                    <View className="flex-1 flex-row items-center">
                      <Text className={`font-lab-mono ${isDark ? 'text-graphite-300' : 'text-graphite-700'}`}>
                        {weight} <Text className="text-xs text-graphite-500">lbs</Text>
                      </Text>
                      <Text className={`mx-2 ${isDark ? 'text-graphite-600' : 'text-graphite-400'}`}>×</Text>
                      <Text className={`font-lab-mono ${isDark ? 'text-graphite-300' : 'text-graphite-700'}`}>
                        {reps} <Text className="text-xs text-graphite-500">reps</Text>
                      </Text>
                      {set.actual_rpe && (
                        <Text className={`ml-3 text-xs font-lab-mono ${isDark ? 'text-graphite-500' : 'text-graphite-400'}`}>
                          RPE {set.actual_rpe}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
          </View>
        ) : (
          <Text className={`text-sm italic py-2 ${isDark ? 'text-graphite-500' : 'text-graphite-400'}`}>
            Not completed
          </Text>
        )}
      </View>
    </LabCard>
  );
}
