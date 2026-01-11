import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Animated,
} from 'react-native';
import Slider from '@react-native-community/slider';

import { useColorScheme } from '@/components/useColorScheme';
import { InlineRestTimer } from '@/components/RestTimer';
import { usePreviousPerformance } from '@/hooks/useWorkouts';
import { useExerciseMemory } from '@/hooks/useExerciseMemory';
import { suggestProgression, formatProgressionSuggestion, type SetData as ProgressionSetData } from '@/lib/autoProgress';
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
  restSeconds?: number; // Default rest time after logging set (0 = no timer)
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

export const SetInput = React.memo(function SetInput({
  exercise,
  setNumber,
  workoutId,
  previousSet,
  targetReps,
  targetRPE,
  targetLoad,
  isWarmup = false,
  restSeconds = 90,
  onSave,
  onPRDetected,
}: SetInputProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Fetch previous performance for this exercise
  const { data: rawPreviousPerformance = [] } = usePreviousPerformance(exercise.id, workoutId);
  
  // Fetch exercise memory (last performance)
  const { data: exerciseMemory } = useExerciseMemory(exercise.id, workoutId);

  // Check if this is a cardio exercise
  const isCardio = exercise.modality === 'Cardio';

  // Type assertion for previous performance data
  const previousPerformance = rawPreviousPerformance as Array<{
    actual_weight?: number | null;
    actual_reps?: number | null;
    actual_rpe?: number | null;
    duration_seconds?: number | null;
    avg_pace?: string | null;
    avg_hr?: number | null;
    is_warmup: boolean;
    set_order: number;
  }>;

  // Get the most recent comparable set
  const lastSessionSet = previousPerformance.find(
    (p) => !p.is_warmup && p.set_order === setNumber
  );

  // Local state for inputs - Strength
  const [weight, setWeight] = useState(
    targetLoad?.toString() || lastSessionSet?.actual_weight?.toString() || ''
  );
  const [reps, setReps] = useState(
    targetReps?.toString() || lastSessionSet?.actual_reps?.toString() || ''
  );
  const [tempo, setTempo] = useState<string>('');
  const [isBodyweight, setIsBodyweight] = useState(false);

  // Local state for inputs - Cardio
  const [durationMinutes, setDurationMinutes] = useState<string>(
    lastSessionSet?.duration_seconds 
      ? Math.round(lastSessionSet.duration_seconds / 60).toString()
      : ''
  );
  const [pace, setPace] = useState<string>(
    lastSessionSet?.avg_pace || ''
  );
  const [heartRate, setHeartRate] = useState<string>(
    lastSessionSet?.avg_hr?.toString() || ''
  );

  const [rpe, setRpe] = useState(targetRPE || lastSessionSet?.actual_rpe || 8);
  const [isCompleted, setIsCompleted] = useState(false);
  
  // Use exercise memory for auto-populating weight if not already set (strength only)
  useEffect(() => {
    if (!isCardio && exerciseMemory?.lastWeight && !weight && !isBodyweight && !isCompleted && !targetLoad) {
      setWeight(exerciseMemory.lastWeight.toString());
    }
  }, [exerciseMemory?.lastWeight, weight, isBodyweight, isCompleted, targetLoad, isCardio]);
  const [showRPESlider, setShowRPESlider] = useState(false);
  const [showRestTimer, setShowRestTimer] = useState(false);

  // Animation for completion
  const [scaleAnim] = useState(new Animated.Value(1));

  // Calculate current E1RM
  const currentE1RM =
    !isBodyweight && weight && reps ? calculateE1RM(parseFloat(weight), parseInt(reps, 10)) : 0;

  // Check for PR when set is logged
  const handleSaveSet = useCallback(() => {
    if (isCardio) {
      // Cardio validation: require duration (pace and HR are optional)
      const durationMin = parseFloat(durationMinutes) || 0;
      if (durationMin <= 0) return;

      const setData: Omit<WorkoutSetInsert, 'workout_id' | 'exercise_id' | 'set_order'> = {
        duration_seconds: Math.round(durationMin * 60),
        avg_pace: pace.trim() || null,
        avg_hr: heartRate ? parseInt(heartRate, 10) : null,
        actual_rpe: rpe,
        is_warmup: isWarmup,
        is_pr: false, // TODO: Add PR detection for cardio (pace, duration)
      };

      // TODO: Add PR detection for cardio exercises
      
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
      // No rest timer for cardio
      onSave(setData);
      return;
    }

    // Strength exercise logic
    const weightNum = isBodyweight ? 0 : (parseFloat(weight) || 0);
    const repsNum = parseInt(reps, 10) || 0;

    // Allow 0 weight (bodyweight) or require weight > 0
    if ((!isBodyweight && weightNum <= 0) || repsNum <= 0) return;

    const setData: Omit<WorkoutSetInsert, 'workout_id' | 'exercise_id' | 'set_order'> = {
      actual_weight: isBodyweight ? 0 : weightNum,
      actual_reps: repsNum,
      actual_rpe: rpe,
      tempo: tempo || null,
      is_warmup: isWarmup,
      is_pr: false, // Will be updated if PR is detected
    };

    // Check for PRs (only for non-warmup sets with weight > 0)
    if (!isWarmup && weightNum > 0 && previousPerformance.length > 0) {
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
    // Start rest timer if enabled and not a warmup set (strength only)
    if (restSeconds > 0 && !isWarmup && !isCardio) {
      setShowRestTimer(true);
    }
    onSave(setData);
  }, [
    weight,
    reps,
    rpe,
    isWarmup,
    isBodyweight,
    tempo,
    previousPerformance,
    currentE1RM,
    restSeconds,
    onSave,
    onPRDetected,
    scaleAnim,
    workoutId,
    exercise.id,
    setNumber,
    isCardio,
    durationMinutes,
    pace,
    heartRate,
  ]);

  return (
    <Animated.View
      style={{ transform: [{ scale: scaleAnim }] }}
      className={`p-4 rounded-xl mb-3 ${
        isCompleted
          ? isDark
            ? 'bg-progress-500/20 border-progress-500/50'
            : 'bg-progress-500/20 border-progress-500/50'
          : isDark
          ? 'bg-graphite-800'
          : 'bg-white'
      } border ${
        isCompleted
          ? ''
          : isDark
          ? 'border-graphite-700'
          : 'border-graphite-200'
      }`}
    >
      {/* Exercise Memory - Last Time (Strength only) */}
      {!isCardio && exerciseMemory && !isWarmup && !isCompleted && (
        <View
          className={`mb-3 p-3 rounded-lg ${
            isDark ? 'bg-signal-500/10 border-signal-500/30' : 'bg-signal-500/5 border-signal-500/20'
          } border`}
        >
          <View className="flex-row items-center mb-1">
            <Ionicons name="time-outline" size={14} color="#2F80ED" />
            <Text className={`text-xs font-semibold ml-1 text-signal-500`}>Last time</Text>
          </View>
          <Text className={`text-sm ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
            {exerciseMemory.displayText}
          </Text>
        </View>
      )}

      {/* Progression Suggestion (Strength only) */}
      {!isCardio && (() => {
        // Convert previous performance to SetData format for suggestProgression
        const historyForSuggestion: ProgressionSetData[] = previousPerformance
          .filter(p => !p.is_warmup && p.actual_weight && p.actual_reps)
          .slice(0, 10)
          .map(p => ({
            actual_weight: p.actual_weight || null,
            actual_reps: p.actual_reps || null,
            actual_rpe: p.actual_rpe || null,
          }));
        
        const suggestion = suggestProgression(exercise, historyForSuggestion);
        
        if (suggestion && !isWarmup && !isCompleted) {
          return (
            <View
              className={`mb-3 p-3 rounded-lg ${
                isDark ? 'bg-progress-500/10 border-progress-500/30' : 'bg-progress-500/5 border-progress-500/20'
              } border`}
            >
              <View className="flex-row items-center mb-1">
                <Ionicons name="trending-up-outline" size={14} color="#22c55e" />
                <Text className={`text-xs font-semibold ml-1 text-progress-500`}>Suggested</Text>
              </View>
              <Text className={`text-sm font-medium ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
                {formatProgressionSuggestion(suggestion)}
              </Text>
              {suggestion.targetWeight && (
                <Text className={`text-xs mt-1 ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                  {suggestion.targetWeight} lb × {suggestion.targetReps || reps || '?'} reps @ RPE {suggestion.targetRPE?.toFixed(1) || '?'}
                </Text>
              )}
            </View>
          );
        }
        return null;
      })()}

      {/* Set Header */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <View
            className={`w-8 h-8 rounded-full items-center justify-center mr-2 ${
              isWarmup
                ? isDark
                  ? 'bg-graphite-700'
                  : 'bg-graphite-200'
                : isDark
                ? 'bg-signal-500/30'
                : 'bg-graphite-100'
            }`}
          >
            <Text
              className={`font-bold text-sm ${
                isWarmup
                  ? isDark
                    ? 'text-graphite-400'
                    : 'text-graphite-500'
                  : 'text-signal-500'
              }`}
            >
              {isWarmup ? 'W' : setNumber}
            </Text>
          </View>
          <Text className={`font-medium ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
            {isWarmup ? 'Warm-up Set' : `Set ${setNumber}`}
          </Text>
        </View>

        {/* Completed Check */}
        {isCompleted && (
          <View className="flex-row items-center">
            <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
          </View>
        )}
      </View>

      {/* Rest Timer - shown after completing a set */}
      {showRestTimer && isCompleted && (
        <View className="mb-3">
          <InlineRestTimer
            seconds={restSeconds}
            onComplete={() => setShowRestTimer(false)}
            onSkip={() => setShowRestTimer(false)}
          />
        </View>
      )}

      {/* Input Row */}
      {isCardio ? (
        // Cardio Inputs
        <View className="gap-3 mb-3">
          {/* Duration and Pace Row */}
          <View className="flex-row items-center gap-3">
            {/* Duration Input */}
            <View className="flex-1">
              <Text className={`text-xs mb-1 ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                Duration (min)
              </Text>
              <TextInput
                className={`px-3 py-2 rounded-lg text-center text-lg font-semibold ${
                  isDark ? 'bg-graphite-900 text-graphite-100' : 'bg-graphite-50 text-graphite-900'
                } border ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}
                value={durationMinutes}
                onChangeText={setDurationMinutes}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={isDark ? '#607296' : '#808fb0'}
                editable={!isCompleted}
              />
            </View>

            {/* Pace Input */}
            <View className="flex-1">
              <Text className={`text-xs mb-1 ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                Pace (optional)
              </Text>
              <TextInput
                className={`px-3 py-2 rounded-lg text-center text-base font-semibold ${
                  isDark ? 'bg-graphite-900 text-graphite-100' : 'bg-graphite-50 text-graphite-900'
                } border ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}
                value={pace}
                onChangeText={setPace}
                placeholder="7:30/mile"
                placeholderTextColor={isDark ? '#607296' : '#808fb0'}
                editable={!isCompleted}
              />
            </View>
          </View>

          {/* Heart Rate and RPE Row */}
          <View className="flex-row items-center gap-3">
            {/* Heart Rate Input */}
            <View className="flex-1">
              <Text className={`text-xs mb-1 ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                Heart Rate (bpm)
              </Text>
              <TextInput
                className={`px-3 py-2 rounded-lg text-center text-lg font-semibold ${
                  isDark ? 'bg-graphite-900 text-graphite-100' : 'bg-graphite-50 text-graphite-900'
                } border ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}
                value={heartRate}
                onChangeText={setHeartRate}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={isDark ? '#607296' : '#808fb0'}
                editable={!isCompleted}
              />
            </View>

            {/* RPE Button/Display */}
            <View className="flex-1">
              <Text className={`text-xs mb-1 ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                RPE
              </Text>
              <Pressable
                className={`px-3 py-2 rounded-lg items-center ${
                  isDark ? 'bg-graphite-900' : 'bg-graphite-50'
                } border ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}
                onPress={() => !isCompleted && setShowRPESlider(!showRPESlider)}
                disabled={isCompleted}
              >
                <Text
                  className={`text-lg font-semibold ${
                    rpe >= 9 ? 'text-oxide-500' : isDark ? 'text-graphite-100' : 'text-graphite-900'
                  }`}
                >
                  {rpe}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : (
        // Strength Inputs
        <View className="flex-row items-center gap-3 mb-3">
          {/* Weight Input */}
          <View className="flex-1">
            <View className="flex-row items-center justify-between mb-1">
              <Text className={`text-xs ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                Weight (lbs)
              </Text>
              <Pressable
                onPress={() => {
                  if (!isCompleted) {
                    setIsBodyweight(!isBodyweight);
                    if (!isBodyweight) {
                      setWeight('0');
                    }
                  }
                }}
                disabled={isCompleted}
              >
                <View className={`flex-row items-center px-2 py-0.5 rounded ${
                  isBodyweight 
                    ? 'bg-signal-500/20' 
                    : isDark 
                      ? 'bg-graphite-700' 
                      : 'bg-graphite-100'
                }`}>
                  <Ionicons 
                    name={isBodyweight ? 'checkmark-circle' : 'ellipse-outline'} 
                    size={14} 
                    color={isBodyweight ? '#2F80ED' : (isDark ? '#808fb0' : '#607296')} 
                  />
                  <Text className={`text-xs ml-1 ${
                    isBodyweight 
                      ? 'text-signal-500 font-semibold' 
                      : isDark 
                        ? 'text-graphite-400' 
                        : 'text-graphite-500'
                  }`}>
                    BW
                  </Text>
                </View>
              </Pressable>
            </View>
            <TextInput
              className={`px-3 py-2 rounded-lg text-center text-lg font-semibold ${
                isDark ? 'bg-graphite-900 text-graphite-100' : 'bg-graphite-50 text-graphite-900'
              } border ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}
              value={isBodyweight ? 'BW' : weight}
              onChangeText={(text) => {
                if (isBodyweight) return;
                setWeight(text);
              }}
              keyboardType="decimal-pad"
              placeholder={isBodyweight ? 'BW' : '0'}
              placeholderTextColor={isDark ? '#607296' : '#808fb0'}
              editable={!isCompleted && !isBodyweight}
            />
          </View>

          <Text className={`text-xl ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>x</Text>

          {/* Reps Input */}
          <View className="flex-1">
            <Text className={`text-xs mb-1 ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
              Reps
            </Text>
            <TextInput
              className={`px-3 py-2 rounded-lg text-center text-lg font-semibold ${
                isDark ? 'bg-graphite-900 text-graphite-100' : 'bg-graphite-50 text-graphite-900'
              } border ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}
              value={reps}
              onChangeText={setReps}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={isDark ? '#607296' : '#808fb0'}
              editable={!isCompleted}
            />
          </View>

          <Text className={`text-xl ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>@</Text>

          {/* RPE Button/Display */}
          <View className="flex-1">
            <Text className={`text-xs mb-1 ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
              RPE
            </Text>
            <Pressable
              className={`px-3 py-2 rounded-lg items-center ${
                isDark ? 'bg-graphite-900' : 'bg-graphite-50'
              } border ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}
              onPress={() => !isCompleted && setShowRPESlider(!showRPESlider)}
              disabled={isCompleted}
            >
              <Text
                className={`text-lg font-semibold ${
                  rpe >= 9 ? 'text-oxide-500' : isDark ? 'text-graphite-100' : 'text-graphite-900'
                }`}
              >
                {rpe}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* RPE Slider (expandable) */}
      {showRPESlider && !isCompleted && (
        <View className={`p-3 rounded-lg mb-3 ${isDark ? 'bg-graphite-900' : 'bg-graphite-50'}`}>
          <View className="flex-row justify-between mb-2">
            <Text className={`text-sm ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
              RPE {rpe}
            </Text>
            <Text className={`text-sm ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
              {RPE_DESCRIPTIONS[rpe] || ''}
            </Text>
          </View>
          <Slider
            minimumValue={6}
            maximumValue={10}
            step={0.5}
            value={rpe}
            onValueChange={setRpe}
            minimumTrackTintColor="#2F80ED"
            maximumTrackTintColor={isDark ? '#353D4B' : '#A5ABB6'}
            thumbTintColor="#2F80ED"
          />
        </View>
      )}

      {/* Tempo Input (Strength only) */}
      {!isCardio && !isCompleted && (
        <View className="flex-row items-center mb-3">
          <Text className={`text-xs mr-2 ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
            Tempo:
          </Text>
          <TextInput
            className={`px-3 py-2 rounded-lg text-center text-sm flex-1 ${
              isDark ? 'bg-graphite-900 text-graphite-100' : 'bg-graphite-50 text-graphite-900'
            } border ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}
            value={tempo}
            onChangeText={setTempo}
            placeholder="3-0-1-0"
            placeholderTextColor={isDark ? '#607296' : '#808fb0'}
            editable={!isCompleted}
            style={{ maxWidth: 120 }}
          />
        </View>
      )}

      {/* E1RM and Save Button */}
      <View className="flex-row items-center justify-between">
        {!isCardio && currentE1RM > 0 && (
          <Text className={`text-sm ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
            Est. 1RM: <Text className="font-semibold text-signal-500">{currentE1RM} lbs</Text>
          </Text>
        )}

        {/* Save Button */}
        {!isCompleted && (
          <Pressable
            className={`px-6 py-2 rounded-full ${
              isCardio
                ? durationMinutes && parseFloat(durationMinutes) > 0
                  ? 'bg-signal-500'
                  : isDark
                  ? 'bg-graphite-700'
                  : 'bg-graphite-200'
                : (isBodyweight || weight) && reps
                ? 'bg-signal-500'
                : isDark
                ? 'bg-graphite-700'
                : 'bg-graphite-200'
            }`}
            onPress={handleSaveSet}
            disabled={
              isCardio
                ? !durationMinutes || parseFloat(durationMinutes) <= 0
                : (!isBodyweight && !weight) || !reps
            }
          >
            <Text
              className={`font-semibold ${
                isCardio
                  ? durationMinutes && parseFloat(durationMinutes) > 0
                    ? 'text-white'
                    : isDark
                    ? 'text-graphite-500'
                    : 'text-graphite-400'
                  : (isBodyweight || weight) && reps
                  ? 'text-white'
                  : isDark
                  ? 'text-graphite-500'
                  : 'text-graphite-400'
              }`}
            >
              Log Set
            </Text>
          </Pressable>
        )}

        {isCompleted && (
          <Pressable
            className="flex-row items-center"
            onPress={() => {
              setIsCompleted(false);
              setShowRestTimer(false);
            }}
          >
            <Ionicons
              name="create-outline"
              size={16}
              color={isDark ? '#808fb0' : '#607296'}
            />
            <Text className={`ml-1 text-sm ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
              Edit
            </Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
});
