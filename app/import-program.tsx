/**
 * Import Program Screen
 *
 * Quick import of existing training programs via:
 * - Photo/scan of a workout page (book, notebook, screenshot)
 * - Paste text from website or document
 *
 * AI parses the content and creates a structured training block.
 * Zero friction - just capture and confirm.
 */

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
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassCard, LabButton } from '@/components/ui/LabPrimitives';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/useAppStore';
import { useJourneySignals } from '@/hooks/useJourneySignals';

// ============================================================================
// Types
// ============================================================================

interface ParsedProgramDay {
  dayNumber: number;
  name: string; // e.g., "Day 1", "Push Day", "Monday"
  focus: string;
  exercises: ParsedProgramExercise[];
}

interface ParsedProgramExercise {
  name: string;
  sets: number;
  reps: string; // e.g., "8-12", "5", "AMRAP"
  notes?: string;
}

interface ParsedProgram {
  name: string;
  description?: string;
  durationWeeks: number;
  daysPerWeek: number;
  splitType: string;
  days: ParsedProgramDay[];
  source?: string; // Where it came from (for attribution)
  rawText?: string;
}

type ImportMode = 'select' | 'capture' | 'paste' | 'parsing' | 'preview';

// ============================================================================
// Main Component
// ============================================================================

export default function ImportProgramScreen() {
  const { userId } = useAppStore();
  const { trackSignal } = useJourneySignals();

  const [mode, setMode] = useState<ImportMode>('select');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [parsedProgram, setParsedProgram] = useState<ParsedProgram | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============================================================================
  // Image Handling
  // ============================================================================

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

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
        setMode('parsing');
        await parseImage(result.assets[0].base64 || '');
      }
    } catch (err) {
      console.error('Error picking image:', err);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  }, []);

  const takePhoto = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera access is required.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
        setMode('parsing');
        await parseImage(result.assets[0].base64 || '');
      }
    } catch (err) {
      console.error('Error taking photo:', err);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  }, []);

  // ============================================================================
  // Parsing
  // ============================================================================

  const parseImage = async (base64: string) => {
    setIsParsing(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('parse-program', {
        body: {
          image: base64,
          userId,
        },
      });

      if (fnError) throw fnError;

      if (data?.program) {
        setParsedProgram(data.program);
        setMode('preview');
      } else {
        setError('Could not parse program from image. Try a clearer photo or paste the text instead.');
        setMode('select');
      }
    } catch (err) {
      console.error('Parse error:', err);
      setError('Failed to parse program. Please try again.');
      setMode('select');
    } finally {
      setIsParsing(false);
    }
  };

  const parseText = async () => {
    if (!pastedText.trim()) {
      Alert.alert('No text', 'Please paste your program text first.');
      return;
    }

    setMode('parsing');
    setIsParsing(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('parse-program', {
        body: {
          text: pastedText,
          userId,
        },
      });

      if (fnError) throw fnError;

      if (data?.program) {
        setParsedProgram(data.program);
        setMode('preview');
      } else {
        setError('Could not understand the program format. Try including day names and exercises.');
        setMode('paste');
      }
    } catch (err) {
      console.error('Parse error:', err);
      setError('Failed to parse program. Please try again.');
      setMode('paste');
    } finally {
      setIsParsing(false);
    }
  };

  // ============================================================================
  // Create Block
  // ============================================================================

  const createBlock = async () => {
    if (!parsedProgram || !userId) return;

    setIsCreating(true);

    try {
      // Create the training block
      const { data: block, error: blockError } = await supabase
        .from('training_blocks')
        .insert({
          user_id: userId,
          name: parsedProgram.name,
          description: parsedProgram.description || `Imported ${parsedProgram.splitType} program`,
          duration_weeks: parsedProgram.durationWeeks,
          start_date: new Date().toISOString().split('T')[0],
          is_active: true,
        })
        .select()
        .single();

      if (blockError) throw blockError;

      // Deactivate other active blocks
      await supabase
        .from('training_blocks')
        .update({ is_active: false })
        .eq('user_id', userId)
        .neq('id', block.id);

      // Create workouts for each day
      for (let week = 1; week <= parsedProgram.durationWeeks; week++) {
        for (const day of parsedProgram.days) {
          const scheduledDate = new Date();
          scheduledDate.setDate(
            scheduledDate.getDate() + (week - 1) * 7 + (day.dayNumber - 1)
          );

          const { data: workout, error: workoutError } = await supabase
            .from('workouts')
            .insert({
              user_id: userId,
              block_id: block.id,
              week_number: week,
              day_number: day.dayNumber,
              focus: day.focus || day.name,
              scheduled_date: scheduledDate.toISOString().split('T')[0],
            })
            .select()
            .single();

          if (workoutError) {
            console.error('Workout creation error:', workoutError);
            continue;
          }

          // Create sets for exercises
          let setOrder = 1;
          for (const exercise of day.exercises) {
            // Try to find matching exercise
            const { data: matchedExercise } = await supabase
              .from('exercises')
              .select('id')
              .ilike('name', `%${exercise.name}%`)
              .limit(1)
              .maybeSingle();

            if (matchedExercise) {
              // Parse reps (handle ranges like "8-12")
              const reps = exercise.reps.includes('-')
                ? parseInt(exercise.reps.split('-')[0])
                : parseInt(exercise.reps) || 10;

              for (let s = 0; s < exercise.sets; s++) {
                await supabase.from('workout_sets').insert({
                  workout_id: workout.id,
                  exercise_id: matchedExercise.id,
                  set_order: setOrder++,
                  target_reps: reps,
                });
              }
            }
          }
        }
      }

      // Track the import
      trackSignal('create_block', {
        source: 'import',
        weeks: parsedProgram.durationWeeks,
        days_per_week: parsedProgram.daysPerWeek,
      });

      Alert.alert(
        'Program Imported!',
        `${parsedProgram.name} has been created with ${parsedProgram.durationWeeks} weeks of workouts.`,
        [
          {
            text: 'View Program',
            onPress: () => router.replace(`/block/${block.id}`),
          },
        ]
      );
    } catch (err) {
      console.error('Create block error:', err);
      Alert.alert('Error', 'Failed to create program. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <View style={{ flex: 1, backgroundColor: Colors.void[900] }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(255, 255, 255, 0.08)',
          }}
        >
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="arrow-back" size={20} color={Colors.graphite[300]} />
          </Pressable>
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.graphite[50] }}>
              Import Program
            </Text>
            <Text style={{ fontSize: 12, color: Colors.graphite[400] }}>
              Scan or paste your training program
            </Text>
          </View>
        </View>

        {/* Content */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Error Message */}
            {error && (
              <View
                style={{
                  backgroundColor: Colors.regression[500] + '20',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <Ionicons name="warning" size={20} color={Colors.regression[400]} />
                <Text style={{ marginLeft: 8, fontSize: 13, color: Colors.regression[300], flex: 1 }}>
                  {error}
                </Text>
                <Pressable onPress={() => setError(null)}>
                  <Ionicons name="close" size={18} color={Colors.graphite[400]} />
                </Pressable>
              </View>
            )}

            {/* Mode: Select */}
            {mode === 'select' && (
              <View style={{ gap: 16 }}>
                <Text style={{ fontSize: 14, color: Colors.graphite[300], textAlign: 'center', marginBottom: 8 }}>
                  How would you like to import your program?
                </Text>

                {/* Scan Option */}
                <Pressable
                  onPress={() => takePhoto()}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16,
                    borderRadius: 12,
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: Colors.signal[500] + '20',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    <Ionicons name="camera" size={24} color={Colors.signal[400]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.graphite[100] }}>
                      Take Photo
                    </Text>
                    <Text style={{ fontSize: 12, color: Colors.graphite[400] }}>
                      Snap a photo of your program page
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.graphite[500]} />
                </Pressable>

                {/* Pick Image Option */}
                <Pressable
                  onPress={() => pickImage(false)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16,
                    borderRadius: 12,
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: Colors.emerald[500] + '20',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    <Ionicons name="images" size={24} color={Colors.emerald[400]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.graphite[100] }}>
                      Choose Image
                    </Text>
                    <Text style={{ fontSize: 12, color: Colors.graphite[400] }}>
                      Select a screenshot or saved image
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.graphite[500]} />
                </Pressable>

                {/* Paste Text Option */}
                <Pressable
                  onPress={() => setMode('paste')}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16,
                    borderRadius: 12,
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: Colors.amber[500] + '20',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    <Ionicons name="clipboard" size={24} color={Colors.amber[400]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.graphite[100] }}>
                      Paste Text
                    </Text>
                    <Text style={{ fontSize: 12, color: Colors.graphite[400] }}>
                      Copy and paste from a website or document
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.graphite[500]} />
                </Pressable>

                {/* Help Text */}
                <View style={{ marginTop: 16, padding: 16, backgroundColor: 'rgba(255, 255, 255, 0.02)', borderRadius: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.graphite[300], marginBottom: 8 }}>
                    What works best:
                  </Text>
                  <View style={{ gap: 6 }}>
                    {[
                      'Clear photos of workout pages',
                      'Program text with day names and exercises',
                      'Screenshots of online programs',
                      'Handwritten notes (if legible)',
                    ].map((tip, i) => (
                      <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="checkmark-circle" size={14} color={Colors.emerald[400]} />
                        <Text style={{ marginLeft: 8, fontSize: 12, color: Colors.graphite[400] }}>
                          {tip}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {/* Mode: Paste */}
            {mode === 'paste' && (
              <View style={{ gap: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Pressable onPress={() => setMode('select')}>
                    <Ionicons name="arrow-back" size={20} color={Colors.graphite[400]} />
                  </Pressable>
                  <Text style={{ marginLeft: 12, fontSize: 16, fontWeight: '600', color: Colors.graphite[200] }}>
                    Paste Your Program
                  </Text>
                </View>

                <TextInput
                  value={pastedText}
                  onChangeText={setPastedText}
                  placeholder={`Paste your program here...\n\nExample:\nDay 1 - Push\n• Bench Press 4x8-10\n• OHP 3x10-12\n• Tricep Pushdowns 3x12-15\n\nDay 2 - Pull\n• Deadlift 3x5\n• Rows 4x8-10\n• Curls 3x12`}
                  placeholderTextColor={Colors.graphite[600]}
                  multiline
                  textAlignVertical="top"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    padding: 16,
                    fontSize: 14,
                    color: Colors.graphite[200],
                    minHeight: 300,
                    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                  }}
                />

                <LabButton
                  label="Parse Program"
                  icon={<Ionicons name="sparkles" size={16} color="white" />}
                  onPress={parseText}
                  disabled={!pastedText.trim()}
                />
              </View>
            )}

            {/* Mode: Parsing */}
            {mode === 'parsing' && (
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
                {imageUri && (
                  <Image
                    source={{ uri: imageUri }}
                    style={{
                      width: 200,
                      height: 200,
                      borderRadius: 12,
                      marginBottom: 24,
                      opacity: 0.6,
                    }}
                    resizeMode="cover"
                  />
                )}
                <ActivityIndicator size="large" color={Colors.signal[500]} />
                <Text style={{ marginTop: 16, fontSize: 16, fontWeight: '600', color: Colors.graphite[200] }}>
                  Analyzing your program...
                </Text>
                <Text style={{ marginTop: 4, fontSize: 13, color: Colors.graphite[400] }}>
                  Extracting exercises and structure
                </Text>
              </View>
            )}

            {/* Mode: Preview */}
            {mode === 'preview' && parsedProgram && (
              <View style={{ gap: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Pressable onPress={() => setMode('select')}>
                    <Ionicons name="arrow-back" size={20} color={Colors.graphite[400]} />
                  </Pressable>
                  <Text style={{ marginLeft: 12, fontSize: 16, fontWeight: '600', color: Colors.graphite[200] }}>
                    Review Program
                  </Text>
                </View>

                {/* Program Summary */}
                <GlassCard>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <Ionicons name="barbell" size={24} color={Colors.signal[400]} />
                    <Text style={{ marginLeft: 12, fontSize: 18, fontWeight: '700', color: Colors.graphite[100] }}>
                      {parsedProgram.name}
                    </Text>
                  </View>

                  {parsedProgram.description && (
                    <Text style={{ fontSize: 13, color: Colors.graphite[400], marginBottom: 12 }}>
                      {parsedProgram.description}
                    </Text>
                  )}

                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: 10, borderRadius: 8 }}>
                      <Text style={{ fontSize: 20, fontWeight: '700', color: Colors.graphite[200] }}>
                        {parsedProgram.durationWeeks}
                      </Text>
                      <Text style={{ fontSize: 11, color: Colors.graphite[500] }}>weeks</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: 10, borderRadius: 8 }}>
                      <Text style={{ fontSize: 20, fontWeight: '700', color: Colors.graphite[200] }}>
                        {parsedProgram.daysPerWeek}
                      </Text>
                      <Text style={{ fontSize: 11, color: Colors.graphite[500] }}>days/week</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: 10, borderRadius: 8 }}>
                      <Text style={{ fontSize: 20, fontWeight: '700', color: Colors.graphite[200] }}>
                        {parsedProgram.days.reduce((sum, d) => sum + d.exercises.length, 0)}
                      </Text>
                      <Text style={{ fontSize: 11, color: Colors.graphite[500] }}>exercises</Text>
                    </View>
                  </View>
                </GlassCard>

                {/* Workout Days */}
                <Text style={{ fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, color: Colors.graphite[400] }}>
                  Workout Days
                </Text>

                {parsedProgram.days.map((day) => (
                  <GlassCard key={day.dayNumber} variant="subtle">
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                      <View
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          backgroundColor: Colors.signal[500] + '20',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 10,
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.signal[400] }}>
                          {day.dayNumber}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: Colors.graphite[200] }}>
                        {day.focus || day.name}
                      </Text>
                    </View>

                    <View style={{ gap: 4, paddingLeft: 38 }}>
                      {day.exercises.map((ex, i) => (
                        <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 13, color: Colors.graphite[300], flex: 1 }} numberOfLines={1}>
                            {ex.name}
                          </Text>
                          <Text style={{ fontSize: 12, fontFamily: 'monospace', color: Colors.graphite[500] }}>
                            {ex.sets}×{ex.reps}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </GlassCard>
                ))}

                {/* Create Button */}
                <View style={{ marginTop: 8 }}>
                  <LabButton
                    label={isCreating ? 'Creating...' : 'Create Program'}
                    icon={
                      isCreating ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <Ionicons name="checkmark-circle" size={16} color="white" />
                      )
                    }
                    onPress={createBlock}
                    disabled={isCreating}
                  />
                  <Text style={{ fontSize: 11, color: Colors.graphite[500], textAlign: 'center', marginTop: 8 }}>
                    This will create a {parsedProgram.durationWeeks}-week training block
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
