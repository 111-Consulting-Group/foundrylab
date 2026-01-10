import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Animated,
} from 'react-native';
import Slider from '@react-native-community/slider';

import { useColorScheme } from '@/components/useColorScheme';
import { usePreviousPerformance } from '@/hooks/useWorkouts';
import type { Exercise, WorkoutSet, WorkoutSetInsert } from '@/types/database';
import { calculateE1RM } from '@/types/database';

interface SetInputProps {
  exercise: Exercise;
  setNumber: number;
  workoutId: string;
  previousSet?: WorkoutSet | null;
  targetReps?: number;
  targetRPE?: number;
  targetLoad?: number;
  isWarmup?: boolean;
  onSave: (set: Omit<WorkoutSetInsert, 'workout_id' | 'exercise_id' | 'set_order'>) => void;
  onPRDetected?: (set: WorkoutSetInsert, type: 'weight' | 'reps' | 'volume' | 'e1rm') => void;
}

const RPE_DESCRIPTIONS: Record<number, string> = {
  6: '4+ reps left',
  7: '2-3 reps left',
  8: '1-2 reps left',
  9: '1 rep left',
  10: 'Max effort',
};

export function SetInput({
  exercise,
  setNumber,
  workoutId,
  previousSet,
  targetReps,
  targetRPE,
  targetLoad,
  isWarmup = false,
  onSave,
  onPRDetected,
}: SetInputProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Fetch previous performance for this exercise
  const { data: rawPreviousPerformance = [] } = usePreviousPerformance(exercise.id, workoutId);

  // Type assertion for previous performance data
  const previousPerformance = rawPreviousPerformance as Array<{
    actual_weight?: number | null;
    actual_reps?: number | null;
    actual_rpe?: number | null;
    is_warmup: boolean;
    set_order: number;
  }>;

  // Get the most recent comparable set
  const lastSessionSet = previousPerformance.find(
    (p) => !p.is_warmup && p.set_order === setNumber
  );

  // Local state for inputs
  const [weight, setWeight] = useState(
    targetLoad?.toString() || lastSessionSet?.actual_weight?.toString() || ''
  );
  const [reps, setReps] = useState(
    targetReps?.toString() || lastSessionSet?.actual_reps?.toString() || ''
  );
  const [rpe, setRpe] = useState(targetRPE || lastSessionSet?.actual_rpe || 8);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showRPESlider, setShowRPESlider] = useState(false);

  // Animation for completion
  const [scaleAnim] = useState(new Animated.Value(1));

  // Calculate current E1RM
  const currentE1RM =
    weight && reps ? calculateE1RM(parseFloat(weight), parseInt(reps, 10)) : 0;

  // Check for PR when set is logged
  const handleSaveSet = useCallback(() => {
    const weightNum = parseFloat(weight) || 0;
    const repsNum = parseInt(reps, 10) || 0;

    if (weightNum <= 0 || repsNum <= 0) return;

    const setData: Omit<WorkoutSetInsert, 'workout_id' | 'exercise_id' | 'set_order'> = {
      actual_weight: weightNum,
      actual_reps: repsNum,
      actual_rpe: rpe,
      is_warmup: isWarmup,
      is_pr: false, // Will be updated if PR is detected
    };

    // Check for PRs (only for non-warmup sets)
    if (!isWarmup && previousPerformance.length > 0) {
      const maxWeight = Math.max(
        ...previousPerformance.map((p) => p.actual_weight || 0)
      );
      const maxRepsAtWeight = Math.max(
        ...previousPerformance
          .filter((p) => p.actual_weight === weightNum)
          .map((p) => p.actual_reps || 0)
      );
      const maxE1RM = Math.max(
        ...previousPerformance.map((p) =>
          p.actual_weight && p.actual_reps
            ? calculateE1RM(p.actual_weight, p.actual_reps)
            : 0
        )
      );

      if (weightNum > maxWeight) {
        setData.is_pr = true;
        onPRDetected?.({ ...setData, workout_id: workoutId, exercise_id: exercise.id, set_order: setNumber }, 'weight');
      } else if (repsNum > maxRepsAtWeight && maxRepsAtWeight > 0) {
        setData.is_pr = true;
        onPRDetected?.({ ...setData, workout_id: workoutId, exercise_id: exercise.id, set_order: setNumber }, 'reps');
      } else if (currentE1RM > maxE1RM) {
        setData.is_pr = true;
        onPRDetected?.({ ...setData, workout_id: workoutId, exercise_id: exercise.id, set_order: setNumber }, 'e1rm');
      }
    }

    // Animate completion
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    setIsCompleted(true);
    onSave(setData);
  }, [
    weight,
    reps,
    rpe,
    isWarmup,
    previousPerformance,
    currentE1RM,
    onSave,
    onPRDetected,
    scaleAnim,
    workoutId,
    exercise.id,
    setNumber,
  ]);

  return (
    <Animated.View
      style={{ transform: [{ scale: scaleAnim }] }}
      className={`p-4 rounded-xl mb-3 ${
        isCompleted
          ? isDark
            ? 'bg-success-500/20 border-success-500/50'
            : 'bg-success-100 border-success-300'
          : isDark
          ? 'bg-steel-800'
          : 'bg-white'
      } border ${
        isCompleted
          ? ''
          : isDark
          ? 'border-steel-700'
          : 'border-steel-200'
      }`}
    >
      {/* Set Header */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <View
            className={`w-8 h-8 rounded-full items-center justify-center mr-2 ${
              isWarmup
                ? isDark
                  ? 'bg-steel-700'
                  : 'bg-steel-200'
                : isDark
                ? 'bg-forge-500/30'
                : 'bg-forge-100'
            }`}
          >
            <Text
              className={`font-bold text-sm ${
                isWarmup
                  ? isDark
                    ? 'text-steel-400'
                    : 'text-steel-500'
                  : 'text-forge-500'
              }`}
            >
              {isWarmup ? 'W' : setNumber}
            </Text>
          </View>
          <Text className={`font-medium ${isDark ? 'text-steel-100' : 'text-steel-900'}`}>
            {isWarmup ? 'Warm-up Set' : `Set ${setNumber}`}
          </Text>
        </View>

        {/* Previous Performance Badge */}
        {lastSessionSet && !isWarmup && (
          <View
            className={`px-2 py-1 rounded-full ${
              isDark ? 'bg-steel-700' : 'bg-steel-100'
            }`}
          >
            <Text className={`text-xs ${isDark ? 'text-steel-400' : 'text-steel-500'}`}>
              Last: {lastSessionSet.actual_weight}lbs x {lastSessionSet.actual_reps}
            </Text>
          </View>
        )}

        {/* Completed Check */}
        {isCompleted && (
          <View className="flex-row items-center">
            <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
          </View>
        )}
      </View>

      {/* Input Row */}
      <View className="flex-row items-center gap-3 mb-3">
        {/* Weight Input */}
        <View className="flex-1">
          <Text className={`text-xs mb-1 ${isDark ? 'text-steel-400' : 'text-steel-500'}`}>
            Weight (lbs)
          </Text>
          <TextInput
            className={`px-3 py-2 rounded-lg text-center text-lg font-semibold ${
              isDark ? 'bg-steel-900 text-steel-100' : 'bg-steel-50 text-steel-900'
            } border ${isDark ? 'border-steel-700' : 'border-steel-200'}`}
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={isDark ? '#607296' : '#808fb0'}
            editable={!isCompleted}
          />
        </View>

        <Text className={`text-xl ${isDark ? 'text-steel-400' : 'text-steel-500'}`}>x</Text>

        {/* Reps Input */}
        <View className="flex-1">
          <Text className={`text-xs mb-1 ${isDark ? 'text-steel-400' : 'text-steel-500'}`}>
            Reps
          </Text>
          <TextInput
            className={`px-3 py-2 rounded-lg text-center text-lg font-semibold ${
              isDark ? 'bg-steel-900 text-steel-100' : 'bg-steel-50 text-steel-900'
            } border ${isDark ? 'border-steel-700' : 'border-steel-200'}`}
            value={reps}
            onChangeText={setReps}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={isDark ? '#607296' : '#808fb0'}
            editable={!isCompleted}
          />
        </View>

        <Text className={`text-xl ${isDark ? 'text-steel-400' : 'text-steel-500'}`}>@</Text>

        {/* RPE Button/Display */}
        <View className="flex-1">
          <Text className={`text-xs mb-1 ${isDark ? 'text-steel-400' : 'text-steel-500'}`}>
            RPE
          </Text>
          <Pressable
            className={`px-3 py-2 rounded-lg items-center ${
              isDark ? 'bg-steel-900' : 'bg-steel-50'
            } border ${isDark ? 'border-steel-700' : 'border-steel-200'}`}
            onPress={() => !isCompleted && setShowRPESlider(!showRPESlider)}
            disabled={isCompleted}
          >
            <Text
              className={`text-lg font-semibold ${
                rpe >= 9 ? 'text-ember-500' : isDark ? 'text-steel-100' : 'text-steel-900'
              }`}
            >
              {rpe}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* RPE Slider (expandable) */}
      {showRPESlider && !isCompleted && (
        <View className={`p-3 rounded-lg mb-3 ${isDark ? 'bg-steel-900' : 'bg-steel-50'}`}>
          <View className="flex-row justify-between mb-2">
            <Text className={`text-sm ${isDark ? 'text-steel-400' : 'text-steel-500'}`}>
              RPE {rpe}
            </Text>
            <Text className={`text-sm ${isDark ? 'text-steel-400' : 'text-steel-500'}`}>
              {RPE_DESCRIPTIONS[rpe] || ''}
            </Text>
          </View>
          <Slider
            minimumValue={6}
            maximumValue={10}
            step={0.5}
            value={rpe}
            onValueChange={setRpe}
            minimumTrackTintColor="#ed7411"
            maximumTrackTintColor={isDark ? '#3e4965' : '#d3d8e4'}
            thumbTintColor="#ed7411"
          />
        </View>
      )}

      {/* E1RM and Target Display */}
      <View className="flex-row items-center justify-between">
        {currentE1RM > 0 && (
          <Text className={`text-sm ${isDark ? 'text-steel-400' : 'text-steel-500'}`}>
            Est. 1RM: <Text className="font-semibold text-forge-500">{currentE1RM} lbs</Text>
          </Text>
        )}

        {/* Save Button */}
        {!isCompleted && (
          <Pressable
            className={`px-6 py-2 rounded-full ${
              weight && reps ? 'bg-forge-500' : isDark ? 'bg-steel-700' : 'bg-steel-200'
            }`}
            onPress={handleSaveSet}
            disabled={!weight || !reps}
          >
            <Text
              className={`font-semibold ${
                weight && reps ? 'text-white' : isDark ? 'text-steel-500' : 'text-steel-400'
              }`}
            >
              Log Set
            </Text>
          </Pressable>
        )}

        {isCompleted && (
          <Pressable
            className="flex-row items-center"
            onPress={() => setIsCompleted(false)}
          >
            <Ionicons
              name="create-outline"
              size={16}
              color={isDark ? '#808fb0' : '#607296'}
            />
            <Text className={`ml-1 text-sm ${isDark ? 'text-steel-400' : 'text-steel-500'}`}>
              Edit
            </Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}
