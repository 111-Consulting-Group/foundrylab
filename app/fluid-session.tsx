import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FluidSessionView } from '@/components/FluidSessionView';
import { ExercisePicker } from '@/components/ExercisePicker';
import { Colors } from '@/constants/Colors';
import { useFluidSessionStore } from '@/stores/useFluidSessionStore';
import {
  useFluidSessionData,
  useTodayReadiness,
  useCreateFluidWorkout,
  useSaveFluidSet,
  useCompleteFluidSession,
  useWorkoutForFluidSession,
} from '@/hooks/useFluidSession';
import type { Exercise, MovementMemory } from '@/types/database';

// ============================================================================
// FREESTYLE SETUP VIEW
// ============================================================================

interface FreestyleSetupProps {
  onStartSession: (exercises: Exercise[], memoryMap: Map<string, MovementMemory>) => void;
}

function FreestyleSetupView({ onStartSession }: FreestyleSetupProps) {
  const insets = useSafeAreaInsets();
  const [selectedExercises, setSelectedExercises] = useState<Exercise[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  // Fetch movement memory for selected exercises
  const exerciseIds = selectedExercises.map((e) => e.id);
  const { data: memoryMap = new Map(), isLoading: loadingMemory } = useFluidSessionData(exerciseIds);

  const handleAddExercise = useCallback((exercise: Exercise) => {
    setSelectedExercises((prev) => {
      // Don't add duplicates
      if (prev.some((e) => e.id === exercise.id)) return prev;
      return [...prev, exercise];
    });
  }, []);

  const handleRemoveExercise = useCallback((exerciseId: string) => {
    setSelectedExercises((prev) => prev.filter((e) => e.id !== exerciseId));
  }, []);

  const handleStartSession = useCallback(() => {
    if (selectedExercises.length === 0) return;
    onStartSession(selectedExercises, memoryMap);
  }, [selectedExercises, memoryMap, onStartSession]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.void[900] }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 16,
          backgroundColor: 'rgba(10, 10, 10, 0.95)',
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255, 255, 255, 0.08)',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={() => router.back()} style={{ padding: 8, marginLeft: -8 }}>
            <Ionicons name="close" size={24} color={Colors.graphite[300]} />
          </Pressable>
          <Text style={{ fontSize: 17, fontWeight: '600', color: Colors.graphite[50] }}>
            Build Your Session
          </Text>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        {/* Instructions */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 14, color: Colors.graphite[400], lineHeight: 20 }}>
            Select exercises for your session. The coach will guide you through each movement with intelligent weight suggestions.
          </Text>
        </View>

        {/* Selected Exercises */}
        {selectedExercises.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                color: Colors.graphite[500],
                textTransform: 'uppercase',
                letterSpacing: 1.5,
                marginBottom: 12,
              }}
            >
              Your Session ({selectedExercises.length} exercises)
            </Text>
            {selectedExercises.map((exercise, idx) => {
              const memory = memoryMap.get(exercise.id);
              return (
                <View
                  key={exercise.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 14,
                    marginBottom: 8,
                    borderRadius: 12,
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: Colors.signal[500],
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>{idx + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: Colors.graphite[50] }}>
                      {exercise.name}
                    </Text>
                    {memory && (
                      <Text style={{ fontSize: 12, color: Colors.graphite[400], marginTop: 2 }}>
                        Last: {memory.last_weight}lbs × {memory.last_reps}
                      </Text>
                    )}
                    {!memory && (
                      <Text style={{ fontSize: 12, color: Colors.graphite[500], marginTop: 2 }}>
                        First time logging
                      </Text>
                    )}
                  </View>
                  <Pressable
                    onPress={() => handleRemoveExercise(exercise.id)}
                    style={{ padding: 8, marginRight: -8 }}
                  >
                    <Ionicons name="close-circle" size={22} color={Colors.graphite[500]} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        {/* Add Exercise Button */}
        <Pressable
          onPress={() => setShowPicker(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: 'rgba(59, 130, 246, 0.3)',
            borderStyle: 'dashed',
          }}
        >
          <Ionicons name="add-circle-outline" size={24} color={Colors.signal[400]} />
          <Text style={{ fontSize: 15, fontWeight: '600', color: Colors.signal[400], marginLeft: 8 }}>
            Add Exercise
          </Text>
        </Pressable>
      </ScrollView>

      {/* Start Session Button */}
      {selectedExercises.length > 0 && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: 16,
            paddingBottom: insets.bottom + 16,
            backgroundColor: 'rgba(10, 10, 10, 0.95)',
            borderTopWidth: 1,
            borderTopColor: 'rgba(255, 255, 255, 0.08)',
          }}
        >
          <Pressable
            onPress={handleStartSession}
            disabled={loadingMemory}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
              borderRadius: 12,
              backgroundColor: pressed ? Colors.signal[600] : Colors.signal[500],
              opacity: loadingMemory ? 0.6 : 1,
            })}
          >
            {loadingMemory ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="play" size={20} color="#fff" />
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff', marginLeft: 8 }}>
                  Start Session
                </Text>
              </>
            )}
          </Pressable>
        </View>
      )}

      {/* Exercise Picker Modal */}
      <ExercisePicker
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        onSelectExercise={handleAddExercise}
      />
    </View>
  );
}

// ============================================================================
// MAIN SCREEN COMPONENT
// ============================================================================

export default function FluidSessionScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ workoutId?: string; focus?: string }>();

  const {
    isActive,
    sessionQueue,
    workoutId: storeWorkoutId,
    initializeSession,
    setWorkoutId,
    setOnSetCompleted,
    resetSession,
  } = useFluidSessionStore();

  // Mutations
  const createWorkout = useCreateFluidWorkout();
  const saveSet = useSaveFluidSet();
  const completeSession = useCompleteFluidSession();

  // Fetch existing workout if workoutId provided
  const { data: existingWorkout, isLoading: loadingWorkout } = useWorkoutForFluidSession(
    params.workoutId || null
  );

  // Fetch today's readiness
  const { data: readiness } = useTodayReadiness();

  // Track if we've initialized from params
  const [initialized, setInitialized] = useState(false);

  // Initialize from existing workout
  useEffect(() => {
    if (params.workoutId && existingWorkout && !initialized && !isActive) {
      // Extract exercises from the workout
      const exerciseMap = new Map<string, Exercise>();
      const memoryArray: MovementMemory[] = [];

      const workout = existingWorkout as any;
      workout.workout_sets?.forEach((set: any) => {
        if (set.exercise && !exerciseMap.has(set.exercise.id)) {
          exerciseMap.set(set.exercise.id, set.exercise);
        }
      });

      const exercises = Array.from(exerciseMap.values());

      if (exercises.length > 0) {
        initializeSession(exercises, readiness || null, memoryArray, workout.context || 'building', workout.id);
        setInitialized(true);
      }
    }
  }, [params.workoutId, existingWorkout, initialized, isActive, readiness]);

  // Set up persistence callback
  useEffect(() => {
    if (storeWorkoutId) {
      setOnSetCompleted((data) => {
        saveSet.mutate({
          workoutId: storeWorkoutId,
          exerciseId: data.exerciseId,
          setOrder: data.setOrder,
          targetReps: data.targetReps,
          targetRpe: data.targetRpe,
          targetLoad: data.targetLoad,
          actualWeight: data.actualWeight,
          actualReps: data.actualReps,
          actualRpe: data.actualRpe,
        });
      });
    }

    return () => {
      setOnSetCompleted(null);
    };
  }, [storeWorkoutId]);

  // Handle freestyle session start
  const handleFreestyleStart = useCallback(
    async (exercises: Exercise[], memoryMap: Map<string, MovementMemory>) => {
      // Create workout in database
      const workout = await createWorkout.mutateAsync({
        focus: 'Freestyle Session',
        context: 'building',
      });

      // Convert memory map to array
      const memoryArray = Array.from(memoryMap.values());

      // Initialize session with the new workout ID
      initializeSession(exercises, readiness || null, memoryArray, 'building', workout.id);
      setWorkoutId(workout.id);
    },
    [readiness, createWorkout, initializeSession, setWorkoutId]
  );

  const handleClose = useCallback(() => {
    // Complete the session if there's a workout
    if (storeWorkoutId && isActive) {
      const startTime = useFluidSessionStore.getState().sessionStartTime;
      const durationMinutes = startTime
        ? Math.round((Date.now() - startTime.getTime()) / 60000)
        : undefined;

      completeSession.mutate({ workoutId: storeWorkoutId, durationMinutes });
    }

    resetSession();
    router.back();
  }, [storeWorkoutId, isActive, completeSession, resetSession]);

  const handleRestart = useCallback(() => {
    resetSession();
    setInitialized(false);
  }, [resetSession]);

  // Loading state for existing workout
  if (params.workoutId && loadingWorkout) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.void[900], alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={Colors.signal[500]} />
        <Text style={{ marginTop: 16, color: Colors.graphite[400] }}>Loading workout...</Text>
      </View>
    );
  }

  // Show freestyle setup if no workout provided and session not active
  if (!params.workoutId && !isActive) {
    return <FreestyleSetupView onStartSession={handleFreestyleStart} />;
  }

  // Get current focus from session
  const currentFocus = sessionQueue[0]?.base.muscle_group || params.focus || 'Workout';

  return (
    <View style={{ flex: 1, backgroundColor: Colors.void[900] }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 12,
          backgroundColor: 'rgba(10, 10, 10, 0.95)',
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255, 255, 255, 0.08)',
        }}
      >
        <Pressable
          onPress={handleClose}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: 8,
            marginLeft: -8,
          }}
        >
          <Ionicons name="close" size={24} color={Colors.graphite[300]} />
        </Pressable>

        <View style={{ alignItems: 'center' }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: Colors.signal[400],
              textTransform: 'uppercase',
              letterSpacing: 1.5,
            }}
          >
            Fluid Session
          </Text>
          <Text
            style={{
              fontSize: 16,
              fontWeight: '600',
              color: Colors.graphite[50],
              marginTop: 2,
            }}
          >
            {currentFocus}
          </Text>
        </View>

        <Pressable
          onPress={handleRestart}
          style={{
            padding: 8,
            marginRight: -8,
          }}
        >
          <Ionicons name="refresh" size={22} color={Colors.graphite[400]} />
        </Pressable>
      </View>

      {/* Fluid Session View */}
      <FluidSessionView />
    </View>
  );
}
