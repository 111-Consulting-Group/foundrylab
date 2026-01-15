import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { useColorScheme } from '@/components/useColorScheme';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/useAppStore';
import { workoutKeys } from '@/hooks/useWorkouts';

// Types matching edge function response
interface ParsedSet {
  reps: number;
  weight?: number;
  rpe?: number;
  notes?: string;
}

interface ParsedExercise {
  name: string;
  originalName: string;
  exercise_id?: string;
  matchedName?: string;
  sets: ParsedSet[];
  notes?: string;
  suggestion?: {
    weight: number;
    lastWeight: number;
    lastReps: number;
    lastRpe: number;
    lastDate: string;
    confidence: 'low' | 'medium' | 'high';
    reasoning: string;
    prWeight: number;
    exposureCount: number;
  };
}

interface ParsedWorkout {
  title?: string;
  exercises: ParsedExercise[];
  notes?: string;
  goals?: { exercise: string; target: number }[];
  warmup?: string[];
  mode: 'log' | 'plan';
  rawText?: string;
}

type ScanMode = 'capture' | 'parsing' | 'review';

export default function ScanWorkoutScreen() {
  const { userId } = useAppStore();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<ScanMode>('capture');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [parsedWorkout, setParsedWorkout] = useState<ParsedWorkout | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickImage = useCallback(async (useCamera: boolean) => {
    try {
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Camera access is required to take photos.');
          return;
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Photo library access is required to select images.');
          return;
        }
      }

      const result = await (useCamera
        ? ImagePicker.launchCameraAsync({
            mediaTypes: 'images',
            allowsEditing: true,
            quality: 0.8,
            base64: true,
          })
        : ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images',
            allowsEditing: true,
            quality: 0.8,
            base64: true,
          }));

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setImageUri(asset.uri);
        setError(null);

        if (asset.base64) {
          parseImage(asset.base64);
        }
      }
    } catch (err: any) {
      console.error('Error picking image:', err);
      setError('Failed to select image');
    }
  }, []);

  const parseImage = async (base64: string) => {
    setMode('parsing');
    setIsParsing(true);
    setError(null);

    try {
      // Check if user is logged in
      if (!userId) {
        throw new Error('Please log in to scan workouts.');
      }

      // Get current session for auth
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        throw new Error('Authentication error. Please log in again.');
      }
      
      if (!session) {
        throw new Error('Session expired. Please log in again.');
      }
      
      if (!session.access_token) {
        throw new Error('No access token found. Please log in again.');
      }

      console.log('Session found, user:', session.user?.email, 'token length:', session.access_token?.length);

      // Add timeout wrapper (60 seconds)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timed out. The analysis is taking longer than expected. Please try again.')), 60000);
      });

      // Explicitly pass the authorization header to ensure auth works
      const functionPromise = supabase.functions.invoke('parse-workout-image', {
        body: {
          image_base64: base64,
          user_id: userId,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const { data, error: invokeError } = await Promise.race([functionPromise, timeoutPromise]) as any;

      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      if (!data?.workout) throw new Error('No workout data returned from analysis');

      setParsedWorkout(data.workout);
      setMode('review');
    } catch (err: any) {
      console.error('Error parsing image:', err);
      const errorMessage = err.message || 'Failed to parse workout image. Please check your connection and try again.';
      setError(errorMessage);
      setMode('capture');
    } finally {
      setIsParsing(false);
    }
  };

  const createWorkoutFromParsed = async () => {
    if (!parsedWorkout || !userId) return;

    setIsCreating(true);
    setError(null);

    try {
      const { data: workout, error: workoutError } = await supabase
        .from('workouts')
        .insert({
          user_id: userId,
          focus: parsedWorkout.title || 'Scanned Workout',
          notes: parsedWorkout.notes,
          date_completed: parsedWorkout.mode === 'log' ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (workoutError) throw workoutError;

      const setsToInsert: any[] = [];
      let setOrder = 1;

      for (const exercise of parsedWorkout.exercises) {
        if (!exercise.exercise_id) continue;

        for (const set of exercise.sets) {
          if (parsedWorkout.mode === 'log') {
            setsToInsert.push({
              workout_id: workout.id,
              exercise_id: exercise.exercise_id,
              set_order: setOrder++,
              actual_reps: set.reps,
              actual_weight: set.weight,
              actual_rpe: set.rpe,
              is_warmup: false,
            });
          } else {
            const suggestedWeight = exercise.suggestion?.weight || set.weight;
            setsToInsert.push({
              workout_id: workout.id,
              exercise_id: exercise.exercise_id,
              set_order: setOrder++,
              target_reps: set.reps,
              target_load: suggestedWeight,
              is_warmup: false,
            });
          }
        }
      }

      if (setsToInsert.length > 0) {
        const { error: setsError } = await supabase.from('workout_sets').insert(setsToInsert);
        if (setsError) throw setsError;
      }

      // Invalidate workout history cache so dashboard shows the new workout
      queryClient.invalidateQueries({ queryKey: workoutKeys.history() });
      queryClient.invalidateQueries({ queryKey: workoutKeys.all });

      if (parsedWorkout.mode === 'log') {
        router.replace(`/workout-summary/${workout.id}`);
      } else {
        router.replace(`/workout/${workout.id}`);
      }
    } catch (err: any) {
      console.error('Error creating workout:', err);
      setError(err.message || 'Failed to create workout');
    } finally {
      setIsCreating(false);
    }
  };

  const renderCaptureMode = () => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
      {/* Glass Card */}
      <View
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderRadius: 24,
          padding: 32,
          width: '100%',
          maxWidth: 360,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* Top edge reflection */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 32,
            right: 32,
            height: 1,
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
          }}
        />

        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              borderWidth: 1,
              borderColor: 'rgba(59, 130, 246, 0.3)',
            }}
          >
            <Ionicons name="scan-outline" size={40} color={Colors.signal[400]} />
          </View>
          <Text style={{ fontSize: 24, fontWeight: '700', color: Colors.graphite[50], textAlign: 'center' }}>
            Scan Workout
          </Text>
          <Text style={{ fontSize: 14, color: Colors.graphite[400], textAlign: 'center', marginTop: 8 }}>
            Upload a photo from your camera roll or take a new photo of your whiteboard
          </Text>
        </View>

        <Pressable
          onPress={() => pickImage(false)}
          style={{
            backgroundColor: Colors.signal[600],
            paddingVertical: 16,
            borderRadius: 12,
            marginBottom: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: Colors.signal[500],
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 16,
          }}
        >
          <Ionicons name="images" size={22} color="white" />
          <Text style={{ color: 'white', fontWeight: '600', fontSize: 16, marginLeft: 8 }}>Choose from Library</Text>
        </Pressable>

        <Pressable
          onPress={() => pickImage(true)}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            paddingVertical: 16,
            borderRadius: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.1)',
          }}
        >
          <Ionicons name="camera-outline" size={22} color={Colors.graphite[50]} />
          <Text style={{ color: Colors.graphite[50], fontWeight: '600', fontSize: 16, marginLeft: 8 }}>Take Photo Now</Text>
        </Pressable>

        <View style={{ marginTop: 24, paddingTop: 24, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.1)' }}>
          <Text style={{ fontSize: 12, color: Colors.graphite[500], textAlign: 'center' }}>
            Works with photos of handwritten notes, whiteboards, and printed plans
          </Text>
        </View>
      </View>

      {error && (
        <View style={{ marginTop: 16, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 12, padding: 16 }}>
          <Text style={{ color: Colors.regression[400], textAlign: 'center' }}>{error}</Text>
        </View>
      )}
    </View>
  );

  const renderParsingMode = () => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
      {imageUri && (
        <View
          style={{
            borderRadius: 16,
            overflow: 'hidden',
            marginBottom: 24,
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.1)',
          }}
        >
          <Image source={{ uri: imageUri }} style={{ width: 256, height: 256 }} resizeMode="cover" />
        </View>
      )}
      <ActivityIndicator size="large" color={Colors.signal[500]} />
      <Text style={{ fontSize: 18, fontWeight: '600', color: Colors.graphite[50], marginTop: 16 }}>
        Analyzing workout...
      </Text>
      <Text style={{ fontSize: 14, color: Colors.graphite[400], marginTop: 8, textAlign: 'center' }}>
        Reading exercises, sets, reps, and weights
      </Text>
      <Text style={{ fontSize: 12, color: Colors.graphite[500], marginTop: 12, textAlign: 'center' }}>
        This may take up to a minute
      </Text>
      
      <Pressable
        onPress={() => {
          setMode('capture');
          setImageUri(null);
          setIsParsing(false);
          setError(null);
        }}
        style={{
          marginTop: 32,
          paddingHorizontal: 20,
          paddingVertical: 12,
          borderRadius: 12,
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.1)',
        }}
      >
        <Text style={{ color: Colors.graphite[200], fontWeight: '600', fontSize: 14 }}>Cancel</Text>
      </Pressable>
    </View>
  );

  const renderReviewMode = () => {
    if (!parsedWorkout) return null;
    const isPlan = parsedWorkout.mode === 'plan';

    return (
      <ScrollView style={{ flex: 1, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Header Card */}
        <View
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.1)',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: Colors.graphite[50] }}>
              {parsedWorkout.title || 'Scanned Workout'}
            </Text>
            <View
              style={{
                paddingHorizontal: 12,
                paddingVertical: 4,
                borderRadius: 12,
                backgroundColor: isPlan ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)',
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: isPlan ? Colors.signal[400] : Colors.emerald[400] }}>
                {isPlan ? 'Plan' : 'Log'}
              </Text>
            </View>
          </View>
          {parsedWorkout.notes && <Text style={{ fontSize: 14, color: Colors.graphite[400] }}>{parsedWorkout.notes}</Text>}
        </View>

        {/* Goals */}
        {parsedWorkout.goals && parsedWorkout.goals.length > 0 && (
          <View
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: 16,
              padding: 16,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.1)',
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.graphite[50], marginBottom: 12 }}>Goals Detected</Text>
            {parsedWorkout.goals.map((goal, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Ionicons name="flag" size={16} color={Colors.signal[400]} />
                <Text style={{ fontSize: 14, color: Colors.graphite[200], marginLeft: 8 }}>
                  {goal.exercise}: {goal.target} lbs
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Exercises Section Label */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, color: Colors.signal[400], textTransform: 'uppercase' }}>
            Exercises
          </Text>
          <Text style={{ fontSize: 10, color: Colors.graphite[500], marginLeft: 8 }}>({parsedWorkout.exercises.length})</Text>
        </View>

        {/* Exercise Cards */}
        {parsedWorkout.exercises.map((exercise, index) => (
          <View
            key={index}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: 16,
              padding: 16,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: exercise.exercise_id ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.1)',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: Colors.graphite[50] }}>
                  {exercise.matchedName || exercise.name}
                </Text>
                {exercise.originalName !== exercise.name && (
                  <Text style={{ fontSize: 11, color: Colors.graphite[500], marginTop: 2 }}>
                    Read as: "{exercise.originalName}"
                  </Text>
                )}
              </View>
              {exercise.exercise_id ? (
                <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', padding: 6, borderRadius: 12 }}>
                  <Ionicons name="checkmark" size={14} color={Colors.emerald[400]} />
                </View>
              ) : (
                <View style={{ backgroundColor: 'rgba(251, 191, 36, 0.2)', padding: 6, borderRadius: 12 }}>
                  <Ionicons name="alert" size={14} color="#FBBF24" />
                </View>
              )}
            </View>

            <View style={{ paddingTop: 12, marginTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.1)' }}>
              <Text style={{ fontSize: 13, fontFamily: 'monospace', color: Colors.graphite[400] }}>
                {exercise.sets.length} set{exercise.sets.length !== 1 ? 's' : ''}:{' '}
                {exercise.sets.map((s) => {
                  const parts = [`${s.reps} reps`];
                  if (s.weight) parts.push(`@ ${s.weight} lbs`);
                  return parts.join(' ');
                }).join(', ')}
              </Text>
            </View>

            {isPlan && exercise.suggestion && (
              <View style={{ marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Ionicons name="bulb" size={16} color={Colors.signal[400]} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.signal[400], marginLeft: 6 }}>
                    Suggested: {exercise.suggestion.weight} lbs
                  </Text>
                </View>
                <Text style={{ fontSize: 12, color: Colors.graphite[400] }}>{exercise.suggestion.reasoning}</Text>
              </View>
            )}
          </View>
        ))}

        {/* Unmatched Warning */}
        {parsedWorkout.exercises.some((e) => !e.exercise_id) && (
          <View style={{ backgroundColor: 'rgba(251, 191, 36, 0.1)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Ionicons name="alert-circle" size={18} color="#FBBF24" />
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#FBBF24', marginLeft: 8 }}>Some exercises not matched</Text>
            </View>
            <Text style={{ fontSize: 13, color: Colors.graphite[400] }}>
              Exercises without a match won't be logged. You can add them manually later.
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={{ marginTop: 8 }}>
          <Pressable
            onPress={createWorkoutFromParsed}
            disabled={isCreating}
            style={{
              backgroundColor: isCreating ? 'rgba(37, 99, 235, 0.5)' : Colors.signal[600],
              paddingVertical: 16,
              borderRadius: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: Colors.signal[500],
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.3,
              shadowRadius: 16,
            }}
          >
            {isCreating ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Ionicons name={isPlan ? 'barbell' : 'checkmark-circle'} size={22} color="white" />
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 16, marginLeft: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                  {isPlan ? 'Start Workout' : 'Log Workout'}
                </Text>
              </>
            )}
          </Pressable>

          <Pressable
            onPress={() => {
              setMode('capture');
              setImageUri(null);
              setParsedWorkout(null);
            }}
            style={{
              marginTop: 12,
              paddingVertical: 16,
              borderRadius: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.1)',
            }}
          >
            <Ionicons name="refresh" size={22} color={Colors.graphite[50]} />
            <Text style={{ color: Colors.graphite[50], fontWeight: '600', fontSize: 16, marginLeft: 8 }}>Scan Again</Text>
          </Pressable>
        </View>

        {error && (
          <View style={{ marginTop: 16, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 12, padding: 16 }}>
            <Text style={{ color: Colors.regression[400], textAlign: 'center' }}>{error}</Text>
          </View>
        )}
      </ScrollView>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.void[900] }}>
      {/* Ambient Background Glows */}
      <View
        style={{
          position: 'absolute',
          top: -100,
          right: -100,
          width: 300,
          height: 300,
          backgroundColor: 'rgba(37, 99, 235, 0.08)',
          borderRadius: 150,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: -100,
          width: 350,
          height: 350,
          backgroundColor: 'rgba(37, 99, 235, 0.05)',
          borderRadius: 175,
        }}
      />

      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }}>
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
            }}
          >
            <Ionicons name="close" size={24} color={Colors.graphite[50]} />
          </Pressable>
          <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.graphite[50] }}>
            {mode === 'review' ? 'Review Workout' : 'Scan Workout'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {mode === 'capture' && renderCaptureMode()}
        {mode === 'parsing' && renderParsingMode()}
        {mode === 'review' && renderReviewMode()}
      </SafeAreaView>
    </View>
  );
}
