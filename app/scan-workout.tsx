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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/useAppStore';

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
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { userId } = useAppStore();

  const [mode, setMode] = useState<ScanMode>('capture');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [parsedWorkout, setParsedWorkout] = useState<ParsedWorkout | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Theme colors
  const bgColor = isDark ? 'bg-black' : 'bg-gray-50';
  const cardBg = isDark ? 'bg-zinc-900' : 'bg-white';
  const textColor = isDark ? 'text-white' : 'text-gray-900';
  const subtextColor = isDark ? 'text-zinc-400' : 'text-gray-500';
  const borderColor = isDark ? 'border-zinc-800' : 'border-gray-200';
  const accentColor = 'text-orange-500';

  const pickImage = useCallback(async (useCamera: boolean) => {
    try {
      // Request permissions
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

        // Start parsing immediately
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
      const { data, error: invokeError } = await supabase.functions.invoke('parse-workout-image', {
        body: {
          image_base64: base64,
          user_id: userId,
        },
      });

      if (invokeError) {
        throw invokeError;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setParsedWorkout(data.workout);
      setMode('review');
    } catch (err: any) {
      console.error('Error parsing image:', err);
      setError(err.message || 'Failed to parse workout image');
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
      // Create the workout
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

      // Create workout sets for each exercise
      const setsToInsert: any[] = [];
      let setOrder = 1;

      for (const exercise of parsedWorkout.exercises) {
        if (!exercise.exercise_id) continue;

        for (const set of exercise.sets) {
          // For logged workouts, use the scanned values
          // For planned workouts, use suggestions as targets
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
            // Plan mode - use suggestions
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
        const { error: setsError } = await supabase
          .from('workout_sets')
          .insert(setsToInsert);

        if (setsError) throw setsError;
      }

      // Navigate based on mode
      if (parsedWorkout.mode === 'log') {
        // Logged workout - go to summary
        router.replace(`/workout-summary/${workout.id}`);
      } else {
        // Planned workout - go to active workout to fill in
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
    <View className="flex-1 justify-center items-center px-6">
      <View className={`${cardBg} rounded-3xl p-8 w-full max-w-sm`}>
        <View className="items-center mb-8">
          <View className="w-20 h-20 rounded-full bg-orange-500/10 items-center justify-center mb-4">
            <Ionicons name="camera-outline" size={40} color="#f97316" />
          </View>
          <Text className={`text-2xl font-bold ${textColor} text-center`}>
            Scan Workout
          </Text>
          <Text className={`${subtextColor} text-center mt-2`}>
            Upload a photo from your camera roll or take a new photo of your whiteboard
          </Text>
        </View>

        <Pressable
          onPress={() => pickImage(false)}
          className="bg-orange-500 py-4 rounded-xl mb-3 flex-row items-center justify-center"
        >
          <Ionicons name="images" size={22} color="white" />
          <Text className="text-white font-semibold text-lg ml-2">Choose from Library</Text>
        </Pressable>

        <Pressable
          onPress={() => pickImage(true)}
          className={`${isDark ? 'bg-zinc-800' : 'bg-gray-100'} py-4 rounded-xl flex-row items-center justify-center`}
        >
          <Ionicons name="camera-outline" size={22} color={isDark ? '#fff' : '#374151'} />
          <Text className={`${textColor} font-semibold text-lg ml-2`}>Take Photo Now</Text>
        </Pressable>

        <View className={`mt-6 pt-6 border-t ${borderColor}`}>
          <Text className={`${subtextColor} text-sm text-center`}>
            Works with photos you've already taken or new photos of handwritten notes, whiteboards, and printed plans
          </Text>
        </View>
      </View>

      {error && (
        <View className="mt-4 bg-red-500/10 rounded-xl p-4">
          <Text className="text-red-500 text-center">{error}</Text>
        </View>
      )}
    </View>
  );

  const renderParsingMode = () => (
    <View className="flex-1 justify-center items-center px-6">
      {imageUri && (
        <Image
          source={{ uri: imageUri }}
          className="w-64 h-64 rounded-2xl mb-6"
          resizeMode="cover"
        />
      )}
      <ActivityIndicator size="large" color="#f97316" />
      <Text className={`${textColor} text-lg font-semibold mt-4`}>Analyzing workout...</Text>
      <Text className={`${subtextColor} mt-2 text-center`}>
        Reading exercises, sets, reps, and weights
      </Text>
    </View>
  );

  const renderReviewMode = () => {
    if (!parsedWorkout) return null;

    const isPlan = parsedWorkout.mode === 'plan';

    return (
      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className={`${cardBg} rounded-2xl p-4 mb-4`}>
          <View className="flex-row items-center justify-between mb-2">
            <Text className={`text-xl font-bold ${textColor}`}>
              {parsedWorkout.title || 'Scanned Workout'}
            </Text>
            <View className={`px-3 py-1 rounded-full ${isPlan ? 'bg-blue-500/20' : 'bg-green-500/20'}`}>
              <Text className={isPlan ? 'text-blue-500' : 'text-green-500'}>
                {isPlan ? 'Plan' : 'Log'}
              </Text>
            </View>
          </View>
          {parsedWorkout.notes && (
            <Text className={subtextColor}>{parsedWorkout.notes}</Text>
          )}
        </View>

        {/* Goals if present */}
        {parsedWorkout.goals && parsedWorkout.goals.length > 0 && (
          <View className={`${cardBg} rounded-2xl p-4 mb-4`}>
            <Text className={`font-semibold ${textColor} mb-2`}>Goals Detected</Text>
            {parsedWorkout.goals.map((goal, i) => (
              <View key={i} className="flex-row items-center mb-1">
                <Ionicons name="flag" size={16} color="#f97316" />
                <Text className={`${textColor} ml-2`}>
                  {goal.exercise}: {goal.target} lbs
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Exercises */}
        <Text className={`font-semibold ${textColor} mb-2 ml-1`}>
          Exercises ({parsedWorkout.exercises.length})
        </Text>

        {parsedWorkout.exercises.map((exercise, index) => (
          <View key={index} className={`${cardBg} rounded-2xl p-4 mb-3`}>
            <View className="flex-row items-start justify-between mb-2">
              <View className="flex-1">
                <Text className={`font-semibold ${textColor}`}>
                  {exercise.matchedName || exercise.name}
                </Text>
                {exercise.originalName !== exercise.name && (
                  <Text className={`${subtextColor} text-xs`}>
                    Read as: "{exercise.originalName}"
                  </Text>
                )}
              </View>
              {exercise.exercise_id ? (
                <View className="bg-green-500/20 px-2 py-1 rounded-full">
                  <Ionicons name="checkmark" size={14} color="#22c55e" />
                </View>
              ) : (
                <View className="bg-yellow-500/20 px-2 py-1 rounded-full">
                  <Ionicons name="alert" size={14} color="#eab308" />
                </View>
              )}
            </View>

            {/* Sets summary */}
            <View className={`border-t ${borderColor} pt-2 mt-2`}>
              <Text className={subtextColor}>
                {exercise.sets.length} set{exercise.sets.length !== 1 ? 's' : ''}:{' '}
                {exercise.sets.map((s, i) => {
                  const parts = [];
                  parts.push(`${s.reps} reps`);
                  if (s.weight) parts.push(`@ ${s.weight} lbs`);
                  return parts.join(' ');
                }).join(', ')}
              </Text>
            </View>

            {/* Suggestion for plan mode */}
            {isPlan && exercise.suggestion && (
              <View className={`mt-3 p-3 rounded-xl ${isDark ? 'bg-orange-500/10' : 'bg-orange-50'}`}>
                <View className="flex-row items-center mb-1">
                  <Ionicons name="bulb" size={16} color="#f97316" />
                  <Text className={`${accentColor} font-semibold ml-1`}>
                    Suggested: {exercise.suggestion.weight} lbs
                  </Text>
                </View>
                <Text className={`${subtextColor} text-sm`}>
                  {exercise.suggestion.reasoning}
                </Text>
                {exercise.suggestion.lastDate && (
                  <Text className={`${subtextColor} text-xs mt-1`}>
                    Last: {exercise.suggestion.lastWeight} lbs x {exercise.suggestion.lastReps} reps
                  </Text>
                )}
              </View>
            )}
          </View>
        ))}

        {/* Unmatched exercises warning */}
        {parsedWorkout.exercises.some(e => !e.exercise_id) && (
          <View className="bg-yellow-500/10 rounded-xl p-4 mb-4">
            <View className="flex-row items-center mb-1">
              <Ionicons name="alert-circle" size={18} color="#eab308" />
              <Text className="text-yellow-500 font-semibold ml-2">Some exercises not matched</Text>
            </View>
            <Text className={subtextColor}>
              Exercises without a match won't be logged. You can add them manually later.
            </Text>
          </View>
        )}

        {/* Action buttons */}
        <View className="mt-2 mb-8">
          <Pressable
            onPress={createWorkoutFromParsed}
            disabled={isCreating}
            className={`py-4 rounded-xl flex-row items-center justify-center ${
              isCreating ? 'bg-orange-500/50' : 'bg-orange-500'
            }`}
          >
            {isCreating ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Ionicons name={isPlan ? 'barbell' : 'checkmark-circle'} size={22} color="white" />
                <Text className="text-white font-semibold text-lg ml-2">
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
            className={`mt-3 py-4 rounded-xl flex-row items-center justify-center ${
              isDark ? 'bg-zinc-800' : 'bg-gray-100'
            }`}
          >
            <Ionicons name="refresh" size={22} color={isDark ? '#fff' : '#374151'} />
            <Text className={`${textColor} font-semibold text-lg ml-2`}>Scan Again</Text>
          </Pressable>
        </View>

        {error && (
          <View className="mb-4 bg-red-500/10 rounded-xl p-4">
            <Text className="text-red-500 text-center">{error}</Text>
          </View>
        )}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView className={`flex-1 ${bgColor}`}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full items-center justify-center"
        >
          <Ionicons name="close" size={28} color={isDark ? '#fff' : '#374151'} />
        </Pressable>
        <Text className={`text-lg font-semibold ${textColor}`}>
          {mode === 'review' ? 'Review Workout' : 'Scan Workout'}
        </Text>
        <View className="w-10" />
      </View>

      {/* Content based on mode */}
      {mode === 'capture' && renderCaptureMode()}
      {mode === 'parsing' && renderParsingMode()}
      {mode === 'review' && renderReviewMode()}
    </SafeAreaView>
  );
}
