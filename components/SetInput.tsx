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

import { Colors } from '@/constants/Colors';
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
      style={{
        transform: [{ scale: scaleAnim }],
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        backgroundColor: isCompleted ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: isCompleted ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255, 255, 255, 0.1)',
      }}
    >
      {/* Exercise Memory - Last Time (Strength only) */}
      {!isCardio && exerciseMemory && !isWarmup && !isCompleted && (
        <View
          style={{
            marginBottom: 12,
            padding: 12,
            borderRadius: 8,
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 1,
            borderColor: 'rgba(59, 130, 246, 0.2)',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <Ionicons name="time-outline" size={14} color={Colors.signal[500]} />
            <Text style={{ fontSize: 12, fontWeight: '600', marginLeft: 4, color: Colors.signal[500] }}>Last time</Text>
          </View>
          <Text style={{ fontSize: 14, color: Colors.graphite[100] }}>
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
              style={{
                marginBottom: 12,
                padding: 12,
                borderRadius: 8,
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                borderWidth: 1,
                borderColor: 'rgba(34, 197, 94, 0.2)',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Ionicons name="trending-up-outline" size={14} color="#22c55e" />
                <Text style={{ fontSize: 12, fontWeight: '600', marginLeft: 4, color: '#22c55e' }}>Suggested</Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: '500', color: Colors.graphite[100] }}>
                {formatProgressionSuggestion(suggestion)}
              </Text>
              {suggestion.targetWeight && (
                <Text style={{ fontSize: 12, marginTop: 4, color: Colors.graphite[400] }}>
                  {suggestion.targetWeight} lb × {suggestion.targetReps || reps || '?'} reps @ RPE {suggestion.targetRPE?.toFixed(1) || '?'}
                </Text>
              )}
            </View>
          );
        }
        return null;
      })()}

      {/* Set Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 8,
              backgroundColor: isWarmup ? 'rgba(255, 255, 255, 0.1)' : 'rgba(59, 130, 246, 0.2)',
            }}
          >
            <Text
              style={{
                fontWeight: '700',
                fontSize: 14,
                color: isWarmup ? Colors.graphite[400] : Colors.signal[500],
              }}
            >
              {isWarmup ? 'W' : setNumber}
            </Text>
          </View>
          <Text style={{ fontWeight: '500', color: Colors.graphite[100] }}>
            {isWarmup ? 'Warm-up Set' : `Set ${setNumber}`}
          </Text>
        </View>

        {/* Completed Check */}
        {isCompleted && (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
          </View>
        )}
      </View>

      {/* Rest Timer - shown after completing a set */}
      {showRestTimer && isCompleted && (
        <View style={{ marginBottom: 12 }}>
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
        <View style={{ gap: 12, marginBottom: 12 }}>
          {/* Duration and Pace Row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {/* Duration Input */}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, marginBottom: 4, color: Colors.graphite[400] }}>
                Duration (min)
              </Text>
              <TextInput
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                  textAlign: 'center',
                  fontSize: 18,
                  fontWeight: '600',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  color: Colors.graphite[100],
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                }}
                value={durationMinutes}
                onChangeText={setDurationMinutes}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={Colors.graphite[500]}
                editable={!isCompleted}
              />
            </View>

            {/* Pace Input */}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, marginBottom: 4, color: Colors.graphite[400] }}>
                Pace (optional)
              </Text>
              <TextInput
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                  textAlign: 'center',
                  fontSize: 16,
                  fontWeight: '600',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  color: Colors.graphite[100],
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                }}
                value={pace}
                onChangeText={setPace}
                placeholder="7:30/mile"
                placeholderTextColor={Colors.graphite[500]}
                editable={!isCompleted}
              />
            </View>
          </View>

          {/* Heart Rate and RPE Row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {/* Heart Rate Input */}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, marginBottom: 4, color: Colors.graphite[400] }}>
                Heart Rate (bpm)
              </Text>
              <TextInput
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                  textAlign: 'center',
                  fontSize: 18,
                  fontWeight: '600',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  color: Colors.graphite[100],
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                }}
                value={heartRate}
                onChangeText={setHeartRate}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={Colors.graphite[500]}
                editable={!isCompleted}
              />
            </View>

            {/* RPE Button/Display */}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, marginBottom: 4, color: Colors.graphite[400] }}>
                RPE
              </Text>
              <Pressable
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                  alignItems: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                }}
                onPress={() => !isCompleted && setShowRPESlider(!showRPESlider)}
                disabled={isCompleted}
              >
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: '600',
                    color: rpe >= 9 ? '#ef4444' : Colors.graphite[100],
                  }}
                >
                  {rpe}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : (
        // Strength Inputs
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          {/* Weight Input */}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ fontSize: 12, color: Colors.graphite[400] }}>
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
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 4,
                  backgroundColor: isBodyweight ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                }}>
                  <Ionicons
                    name={isBodyweight ? 'checkmark-circle' : 'ellipse-outline'}
                    size={14}
                    color={isBodyweight ? Colors.signal[500] : Colors.graphite[400]}
                  />
                  <Text style={{
                    fontSize: 12,
                    marginLeft: 4,
                    fontWeight: isBodyweight ? '600' : '400',
                    color: isBodyweight ? Colors.signal[500] : Colors.graphite[400],
                  }}>
                    BW
                  </Text>
                </View>
              </Pressable>
            </View>
            <TextInput
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
                textAlign: 'center',
                fontSize: 18,
                fontWeight: '600',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                color: Colors.graphite[100],
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.1)',
              }}
              value={isBodyweight ? 'BW' : weight}
              onChangeText={(text) => {
                if (isBodyweight) return;
                setWeight(text);
              }}
              keyboardType="decimal-pad"
              placeholder={isBodyweight ? 'BW' : '0'}
              placeholderTextColor={Colors.graphite[500]}
              editable={!isCompleted && !isBodyweight}
            />
          </View>

          <Text style={{ fontSize: 20, color: Colors.graphite[400] }}>x</Text>

          {/* Reps Input */}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, marginBottom: 4, color: Colors.graphite[400] }}>
              Reps
            </Text>
            <TextInput
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
                textAlign: 'center',
                fontSize: 18,
                fontWeight: '600',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                color: Colors.graphite[100],
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.1)',
              }}
              value={reps}
              onChangeText={setReps}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={Colors.graphite[500]}
              editable={!isCompleted}
            />
          </View>

          <Text style={{ fontSize: 20, color: Colors.graphite[400] }}>@</Text>

          {/* RPE Button/Display */}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, marginBottom: 4, color: Colors.graphite[400] }}>
              RPE
            </Text>
            <Pressable
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
                alignItems: 'center',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.1)',
              }}
              onPress={() => !isCompleted && setShowRPESlider(!showRPESlider)}
              disabled={isCompleted}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '600',
                  color: rpe >= 9 ? '#ef4444' : Colors.graphite[100],
                }}
              >
                {rpe}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* RPE Slider (expandable) */}
      {showRPESlider && !isCompleted && (
        <View style={{
          padding: 12,
          borderRadius: 8,
          marginBottom: 12,
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontSize: 14, color: Colors.graphite[400] }}>
              RPE {rpe}
            </Text>
            <Text style={{ fontSize: 14, color: Colors.graphite[400] }}>
              {RPE_DESCRIPTIONS[rpe] || ''}
            </Text>
          </View>
          <Slider
            minimumValue={6}
            maximumValue={10}
            step={0.5}
            value={rpe}
            onValueChange={setRpe}
            minimumTrackTintColor={Colors.signal[500]}
            maximumTrackTintColor="rgba(255, 255, 255, 0.2)"
            thumbTintColor={Colors.signal[500]}
          />
        </View>
      )}

      {/* Tempo Input (Strength only) */}
      {!isCardio && !isCompleted && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ fontSize: 12, marginRight: 8, color: Colors.graphite[400] }}>
            Tempo:
          </Text>
          <TextInput
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 8,
              textAlign: 'center',
              fontSize: 14,
              flex: 1,
              maxWidth: 120,
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: Colors.graphite[100],
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.1)',
            }}
            value={tempo}
            onChangeText={setTempo}
            placeholder="3-0-1-0"
            placeholderTextColor={Colors.graphite[500]}
            editable={!isCompleted}
          />
        </View>
      )}

      {/* E1RM and Save Button */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {!isCardio && currentE1RM > 0 && (
          <Text style={{ fontSize: 14, color: Colors.graphite[400] }}>
            Est. 1RM: <Text style={{ fontWeight: '600', color: Colors.signal[500] }}>{currentE1RM} lbs</Text>
          </Text>
        )}

        {/* Save Button */}
        {!isCompleted && (
          <Pressable
            style={{
              paddingHorizontal: 24,
              paddingVertical: 8,
              borderRadius: 20,
              backgroundColor: isCardio
                ? durationMinutes && parseFloat(durationMinutes) > 0
                  ? Colors.signal[500]
                  : 'rgba(255, 255, 255, 0.1)'
                : (isBodyweight || weight) && reps
                ? Colors.signal[500]
                : 'rgba(255, 255, 255, 0.1)',
            }}
            onPress={handleSaveSet}
            disabled={
              isCardio
                ? !durationMinutes || parseFloat(durationMinutes) <= 0
                : (!isBodyweight && !weight) || !reps
            }
          >
            <Text
              style={{
                fontWeight: '600',
                color: isCardio
                  ? durationMinutes && parseFloat(durationMinutes) > 0
                    ? '#ffffff'
                    : Colors.graphite[500]
                  : (isBodyweight || weight) && reps
                  ? '#ffffff'
                  : Colors.graphite[500],
              }}
            >
              Log Set
            </Text>
          </Pressable>
        )}

        {isCompleted && (
          <Pressable
            style={{ flexDirection: 'row', alignItems: 'center' }}
            onPress={() => {
              setIsCompleted(false);
              setShowRestTimer(false);
            }}
          >
            <Ionicons name="create-outline" size={16} color={Colors.graphite[400]} />
            <Text style={{ marginLeft: 4, fontSize: 14, color: Colors.graphite[400] }}>
              Edit
            </Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
});
