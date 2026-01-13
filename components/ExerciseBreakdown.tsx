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

  // Get prescription - use ALL sets (including unlogged) to get accurate target count
  // For target, we want the planned sets, not just what was logged
  const allWorkSets = setsWithExercise.filter(s => !s.is_warmup && s.segment_type !== 'warmup');
  const firstSet = sets[0];
  
  // For cardio, we need to count target sets based on planned work sets
  // The target should show what was planned, not what was logged
  const prescription = formatPrescription(
    allWorkSets, // Use all work sets (planned) for target calculation
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

  // Get logged sets (with actual data) and deduplicate
  const loggedSets = sets.filter(s => {
    if (isCardio) {
      return s.distance_meters || s.duration_seconds || s.avg_pace;
    }
    return s.actual_weight !== null || s.actual_reps !== null;
  }).filter((set, index, self) => {
    // Deduplicate by ID or set_order
    if (set.id) {
      return index === self.findIndex(s => s.id === set.id);
    }
    return index === self.findIndex(s => 
      s.set_order === set.set_order && 
      s.exercise_id === set.exercise_id
    );
  });

  return (
    <LabCard noPadding className="mb-3 overflow-hidden">
      {/* Header */}
      <View className="px-4 py-3 border-b border-graphite-700 bg-opacity-50" style={{ borderColor: '#353D4B' }}>
        <View className="flex-row justify-between items-start">
          <View className="flex-1 mr-2">
            <Text className="text-base font-bold text-graphite-100" style={{ color: '#E6E8EB' }}>
              {exercise.name}
            </Text>
            {prescription && (
              <Text className="text-xs text-graphite-400" style={{ color: '#6B7485' }}>
                Target: {prescription}
              </Text>
            )}
          </View>
          
          {/* Best Set & Delta Highlight */}
          {!isCardio && loggedSets.length > 0 && (
            <View className="items-end">
              <View className="flex-row items-center gap-2">
                <Text className="font-lab-mono font-bold text-graphite-200" style={{ color: '#D4D7DC' }}>
                  {bestSet.actual_weight} <Text className="text-xs font-normal text-graphite-500" style={{ color: '#808FB0' }}>lbs</Text> × {bestSet.actual_reps}
                </Text>
                {(weightDelta !== 0 || repsDelta !== 0) && (
                  <View className="flex-row gap-1">
                    {weightDelta !== 0 && <DeltaTag value={weightDelta} unit="lbs" />}
                    {repsDelta > 0 && <DeltaTag value={repsDelta} unit="reps" />}
                  </View>
                )}
              </View>
              <Text className="text-xs text-graphite-500" style={{ color: '#808FB0' }}>
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
            {isCardio ? (() => {
              const warmupSets = loggedSets.filter(s => s.segment_type === 'warmup' || s.is_warmup);
              const workSets = loggedSets.filter(s => (s.segment_type === 'work' || !s.segment_type) && !s.is_warmup);
              
              const parts: string[] = [];
              
              // Show warmup if exists
              if (warmupSets.length > 0) {
                const warmup = warmupSets[0];
                const warmupSummary = generateExerciseSummary(exercise, [warmup as SetWithExercise]);
                parts.push(warmupSummary);
              }
              
              // Show work intervals - this shows what was actually logged
              if (workSets.length > 0) {
                const workSummary = generateExerciseSummary(exercise, workSets.map(s => s as SetWithExercise));
                parts.push(workSummary);
              }
              
              return parts.map((summary, idx) => (
                <Text key={idx} className="text-sm text-graphite-300" style={{ color: '#C4C8D0' }}>
                  {summary}
                </Text>
              ));
            })() : loggedSets
              .sort((a, b) => (a.set_order || 0) - (b.set_order || 0))
              .map((set, index) => {
                const weight = set.actual_weight === 0 ? 'BW' : (set.actual_weight?.toString() || '-');
                const reps = set.actual_reps?.toString() || '-';
                const rpe = set.actual_rpe ? ` @ ${set.actual_rpe}` : '';
                
                return (
                  <View key={set.id || index} className="flex-row items-center justify-between py-1">
                    <View className="flex-row items-center w-16">
                      <Text className="text-xs font-lab-mono text-graphite-500" style={{ color: '#808FB0' }}>
                        Set {index + 1}
                      </Text>
                    </View>
                    <View className="flex-1 flex-row items-center">
                      <Text className="font-lab-mono text-graphite-300" style={{ color: '#C4C8D0' }}>
                        {weight} <Text className="text-xs text-graphite-500" style={{ color: '#808FB0' }}>lbs</Text>
                      </Text>
                      <Text className="mx-2 text-graphite-600" style={{ color: '#4A5568' }}>×</Text>
                      <Text className="font-lab-mono text-graphite-300" style={{ color: '#C4C8D0' }}>
                        {reps} <Text className="text-xs text-graphite-500" style={{ color: '#808FB0' }}>reps</Text>
                      </Text>
                      {set.actual_rpe && (
                        <Text className="ml-3 text-xs font-lab-mono text-graphite-500" style={{ color: '#808FB0' }}>
                          RPE {set.actual_rpe}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
          </View>
        ) : (
          <Text className="text-sm italic py-2 text-graphite-500" style={{ color: '#808FB0' }}>
            Not completed
          </Text>
        )}
      </View>
    </LabCard>
  );
}
