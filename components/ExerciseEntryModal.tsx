// Bottom sheet modal for focused exercise entry
// Wraps either CardioEntry or StrengthEntry based on exercise modality

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
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
import { Colors } from '@/constants/Colors';
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
  if (!exercise) return null;

  // Determine if this exercise should use the CardioEntry (distance/time-based) UI
  // Priority: 1) primary_metric, 2) modality, 3) smart name detection
  const isCardio = React.useMemo(() => {
    // Check primary_metric first - most reliable
    if (exercise.primary_metric) {
      return ['Distance', 'Pace', 'Watts'].includes(exercise.primary_metric);
    }

    // Check modality
    if (exercise.modality === 'Cardio') {
      return true;
    }

    // Smart name detection for exercises that should be distance/time-based
    // even if incorrectly labeled as Strength
    const name = exercise.name.toLowerCase();
    const distanceBasedPatterns = [
      'sled', 'prowler', 'farmers carry', 'farmer carry', 'farmers walk', 'farmer walk',
      'yoke', 'sandbag carry', 'keg carry', 'stone carry', 'loaded carry',
      'walk', 'march', 'sprint', 'run', 'jog', 'swim', 'bike', 'row', 'erg',
      'stair', 'battle rope', 'jump rope', 'skip'
    ];

    // Check if exercise name contains any distance-based pattern
    // BUT exclude exercises that are clearly weight-based (e.g., "Dumbbell Row", "Barbell Row")
    const weightQualifiers = ['dumbbell', 'barbell', 'cable', 'machine', 'seated', 'bent over', 'pendlay', 'upright'];
    const hasWeightQualifier = weightQualifiers.some(q => name.includes(q));

    if (!hasWeightQualifier && distanceBasedPatterns.some(p => name.includes(p))) {
      return true;
    }

    return false;
  }, [exercise.modality, exercise.primary_metric, exercise.name]);

  const prescription = formatPrescription(sets, exercise, targetSets, targetReps, targetRPE, targetLoad);

  // Prevent browser warnings when closing modal on web
  useEffect(() => {
    if (Platform.OS === 'web' && visible) {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        // Prevent browser warning - everything auto-saves
        e.preventDefault();
        e.returnValue = '';
        return '';
      };

      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }
  }, [visible]);

  const handleRequestClose = React.useCallback(() => {
    // Blur any active inputs to prevent browser warnings about unsaved changes
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        activeElement.blur();
      }
    }
    // Always allow closing without warning - everything auto-saves
    onClose();
  }, [onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleRequestClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, backgroundColor: Colors.void[900] }}>
          {/* Ambient Background Glows */}
          <View
            style={{
              position: 'absolute',
              top: -50,
              right: -80,
              width: 200,
              height: 200,
              backgroundColor: 'rgba(37, 99, 235, 0.06)',
              borderRadius: 100,
            }}
          />
          <View
            style={{
              position: 'absolute',
              bottom: 50,
              left: -60,
              width: 180,
              height: 180,
              backgroundColor: 'rgba(37, 99, 235, 0.04)',
              borderRadius: 90,
            }}
          />

          <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
            {/* Header */}
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: 'rgba(255, 255, 255, 0.1)',
                backgroundColor: 'rgba(18, 18, 18, 0.9)',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ fontSize: 18, fontWeight: '700', color: Colors.graphite[50] }}
                    numberOfLines={1}
                  >
                    {exercise.name}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 6,
                        backgroundColor: isCardio ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '600',
                          color: isCardio ? Colors.emerald[400] : Colors.signal[400],
                        }}
                      >
                        {isCardio ? 'CARDIO' : 'STRENGTH'}
                      </Text>
                    </View>
                    <Text
                      style={{ marginLeft: 8, fontSize: 13, fontFamily: 'monospace', color: Colors.graphite[400] }}
                    >
                      {prescription || `${sets.length} set${sets.length > 1 ? 's' : ''}`}
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={(e) => {
                    e?.stopPropagation?.();
                    // Blur any active inputs to prevent browser warnings
                    if (Platform.OS === 'web' && typeof document !== 'undefined') {
                      const activeElement = document.activeElement as HTMLElement;
                      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
                        activeElement.blur();
                      }
                    }
                    handleRequestClose();
                  }}
                  style={{
                    padding: 8,
                    borderRadius: 20,
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={24} color={Colors.graphite[50]} />
                </Pressable>
              </View>
            </View>

            {/* Content */}
            <ScrollView
              style={{ flex: 1 }}
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
                  onClose={handleRequestClose}
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

            {/* Done button - only show for strength exercises, cardio has its own buttons */}
            {!isCardio && (
              <SafeAreaView
                edges={['bottom']}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderTopWidth: 1,
                  borderTopColor: 'rgba(255, 255, 255, 0.1)',
                  backgroundColor: 'rgba(18, 18, 18, 0.95)',
                }}
              >
                <Pressable
                  onPress={(e) => {
                    e?.stopPropagation?.();
                    // Blur any active inputs to prevent browser warnings
                    if (Platform.OS === 'web' && typeof document !== 'undefined') {
                      const activeElement = document.activeElement as HTMLElement;
                      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
                        activeElement.blur();
                      }
                    }
                    handleRequestClose();
                  }}
                  style={{
                    paddingVertical: 16,
                    borderRadius: 12,
                    backgroundColor: Colors.signal[600],
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    shadowColor: Colors.signal[500],
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.3,
                    shadowRadius: 16,
                  }}
                >
                  <Ionicons name="checkmark-circle" size={20} color="white" style={{ marginRight: 8 }} />
                  <Text style={{ color: 'white', fontWeight: '700', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Done
                  </Text>
                </Pressable>
              </SafeAreaView>
            )}
          </SafeAreaView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
