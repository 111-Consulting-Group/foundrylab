// Bottom sheet modal for focused exercise entry
// Wraps either CardioEntry or StrengthEntry based on exercise modality

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CardioEntry } from '@/components/CardioEntry';
import { StrengthEntry } from '@/components/StrengthEntry';
import { useColorScheme } from '@/components/useColorScheme';
import { formatPrescription, type SetWithExercise } from '@/lib/workoutSummary';
import type { Exercise, WorkoutSetInsert, SegmentType } from '@/types/database';

interface ExerciseEntryModalProps {
  visible: boolean;
  exercise: Exercise | null;
  sets: SetWithExercise[];
  workoutId: string;
  targetSets?: number;
  targetReps?: number;
  targetRPE?: number;
  targetLoad?: number;
  onClose: () => void;
  onSaveSet: (
    exerciseId: string,
    setOrder: number,
    data: Omit<WorkoutSetInsert, 'workout_id' | 'exercise_id' | 'set_order'>
  ) => Promise<void>;
  onDeleteSet: (setId: string) => Promise<void>;
  onAddSet: () => void;
}

export function ExerciseEntryModal({
  visible,
  exercise,
  sets,
  workoutId,
  targetSets,
  targetReps,
  targetRPE,
  targetLoad,
  onClose,
  onSaveSet,
  onDeleteSet,
  onAddSet,
}: ExerciseEntryModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  if (!exercise) return null;

  const isCardio = exercise.modality === 'Cardio';
  const prescription = formatPrescription(sets, exercise, targetSets, targetReps, targetRPE, targetLoad);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <SafeAreaView
          className="flex-1 bg-carbon-950"
          style={{ backgroundColor: '#0E1116' }}
          edges={['top', 'left', 'right']}
        >
          {/* Header */}
          <View
            className="px-4 py-3 border-b border-graphite-700"
            style={{ borderColor: '#353D4B' }}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text
                  className="text-lg font-bold text-graphite-100"
                  style={{ color: '#E6E8EB' }}
                  numberOfLines={1}
                >
                  {exercise.name}
                </Text>
                <View className="flex-row items-center mt-1">
                  <View
                    className={`px-2 py-0.5 rounded ${
                      isCardio
                        ? 'bg-progress-500/20'
                        : 'bg-signal-500/20'
                    }`}
                  >
                    <Text
                      className={`text-xs ${
                        isCardio ? 'text-progress-500' : 'text-signal-500'
                      }`}
                    >
                      {isCardio ? 'Cardio' : 'Strength'}
                    </Text>
                  </View>
                  <Text
                    className="ml-2 text-sm font-medium text-graphite-300"
                    style={{ color: '#C4C8D0' }}
                  >
                    {prescription || `${sets.length} set${sets.length > 1 ? 's' : ''}`}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={onClose}
                className="p-2 rounded-full bg-graphite-800"
                style={{ backgroundColor: '#1A1F2E' }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name="close"
                  size={24}
                  color="#E6E8EB"
                />
              </Pressable>
            </View>
          </View>

          {/* Content */}
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingBottom: 100 }}
            keyboardShouldPersistTaps="handled"
          >
            {isCardio ? (
              <CardioEntry
                exercise={exercise}
                sets={sets}
                workoutId={workoutId}
                onSaveSet={onSaveSet}
                onDeleteSet={onDeleteSet}
                onAddSet={onAddSet}
              />
            ) : (
              <StrengthEntry
                exercise={exercise}
                sets={sets}
                workoutId={workoutId}
                targetReps={targetReps}
                targetRPE={targetRPE}
                targetLoad={targetLoad}
                onSaveSet={onSaveSet}
                onDeleteSet={onDeleteSet}
                onAddSet={onAddSet}
              />
            )}
          </ScrollView>

          {/* Done button */}
          <SafeAreaView
            edges={['bottom']}
            className="px-4 py-3 border-t border-graphite-700 bg-carbon-950"
            style={{ borderColor: '#353D4B', backgroundColor: '#0E1116' }}
          >
            <Pressable
              onPress={onClose}
              className="py-4 rounded-xl bg-signal-500 items-center"
            >
              <Text className="text-white font-semibold text-lg">Done</Text>
            </Pressable>
          </SafeAreaView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
