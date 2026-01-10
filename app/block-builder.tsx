import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';
import { useExercises } from '@/hooks/useExercises';
import { useCreateTrainingBlock, useCreateBlockWorkouts } from '@/hooks/useTrainingBlocks';
import { generateTrainingBlock, PROMPT_SUGGESTIONS } from '@/lib/openai';
import type { AIGeneratedBlock, Exercise } from '@/types/database';

export default function BlockBuilderScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // State
  const [prompt, setPrompt] = useState('');
  const [durationWeeks, setDurationWeeks] = useState(4);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedBlock, setGeneratedBlock] = useState<AIGeneratedBlock | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch exercises for context
  const { data: exercises = [] } = useExercises();

  // Mutations
  const createBlockMutation = useCreateTrainingBlock();
  const createWorkoutsMutation = useCreateBlockWorkouts();

  // Generate block
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      Alert.alert('Error', 'Please describe your training goals');
      return;
    }

    if (exercises.length === 0) {
      Alert.alert('Error', 'Exercise library not loaded yet');
      return;
    }

    setIsGenerating(true);
    setGeneratedBlock(null);

    try {
      const block = await generateTrainingBlock({
        prompt: prompt.trim(),
        exercises: exercises as Exercise[],
        durationWeeks,
      });
      setGeneratedBlock(block);
    } catch (error) {
      console.error('Generation error:', error);
      Alert.alert(
        'Generation Failed',
        error instanceof Error ? error.message : 'Failed to generate training block'
      );
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, exercises, durationWeeks]);

  // Save block to database
  const handleSaveBlock = useCallback(async () => {
    if (!generatedBlock) return;

    setIsSaving(true);

    try {
      // Create the training block
      const block = await createBlockMutation.mutateAsync({
        name: generatedBlock.name,
        description: generatedBlock.description,
        goal_prompt: prompt,
        duration_weeks: generatedBlock.duration_weeks,
        start_date: new Date().toISOString().split('T')[0],
        is_active: true,
      });

      // Create all workouts for the block
      await createWorkoutsMutation.mutateAsync({
        blockId: block.id,
        workouts: generatedBlock.workouts,
      });

      Alert.alert('Success', `${generatedBlock.name} has been saved!`, [
        {
          text: 'View Program',
          onPress: () => router.replace('/(tabs)/program'),
        },
      ]);
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', 'Failed to save training block');
    } finally {
      setIsSaving(false);
    }
  }, [generatedBlock, prompt, createBlockMutation, createWorkoutsMutation]);

  // Apply suggestion
  const applySuggestion = useCallback((suggestion: typeof PROMPT_SUGGESTIONS[0]) => {
    setPrompt(suggestion.prompt);
  }, []);

  return (
    <SafeAreaView
      className={`flex-1 ${isDark ? 'bg-steel-950' : 'bg-steel-50'}`}
      edges={['left', 'right', 'bottom']}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Header */}
        <View
          className={`flex-row items-center justify-between px-4 py-3 border-b ${
            isDark ? 'border-steel-700' : 'border-steel-200'
          }`}
        >
          <Pressable onPress={() => router.back()} className="p-2 -ml-2">
            <Ionicons name="close" size={24} color={isDark ? '#f6f7f9' : '#1e232f'} />
          </Pressable>
          <Text className={`text-lg font-bold ${isDark ? 'text-steel-100' : 'text-steel-900'}`}>
            AI Block Builder
          </Text>
          <View className="w-10" />
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          {!generatedBlock ? (
            <>
              {/* Prompt Input */}
              <View className="mb-6">
                <Text
                  className={`text-sm font-semibold mb-2 ${
                    isDark ? 'text-steel-300' : 'text-steel-600'
                  }`}
                >
                  Describe your training goals
                </Text>
                <TextInput
                  className={`p-4 rounded-xl text-base min-h-[120px] ${
                    isDark ? 'bg-steel-800 text-steel-100' : 'bg-white text-steel-900'
                  } border ${isDark ? 'border-steel-700' : 'border-steel-200'}`}
                  placeholder="e.g., I want to build strength in my squat and deadlift while maintaining conditioning for hiking..."
                  placeholderTextColor={isDark ? '#607296' : '#808fb0'}
                  value={prompt}
                  onChangeText={setPrompt}
                  multiline
                  textAlignVertical="top"
                />
              </View>

              {/* Duration Selector */}
              <View className="mb-6">
                <Text
                  className={`text-sm font-semibold mb-2 ${
                    isDark ? 'text-steel-300' : 'text-steel-600'
                  }`}
                >
                  Block Duration
                </Text>
                <View className="flex-row gap-2">
                  {[4, 6, 8, 12].map((weeks) => (
                    <Pressable
                      key={weeks}
                      className={`flex-1 py-3 rounded-xl items-center ${
                        durationWeeks === weeks
                          ? 'bg-forge-500'
                          : isDark
                          ? 'bg-steel-800'
                          : 'bg-white'
                      } ${
                        durationWeeks !== weeks
                          ? `border ${isDark ? 'border-steel-700' : 'border-steel-200'}`
                          : ''
                      }`}
                      onPress={() => setDurationWeeks(weeks)}
                    >
                      <Text
                        className={`font-semibold ${
                          durationWeeks === weeks
                            ? 'text-white'
                            : isDark
                            ? 'text-steel-300'
                            : 'text-steel-600'
                        }`}
                      >
                        {weeks} weeks
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Quick Suggestions */}
              <View className="mb-6">
                <Text
                  className={`text-sm font-semibold mb-3 ${
                    isDark ? 'text-steel-300' : 'text-steel-600'
                  }`}
                >
                  Quick Templates
                </Text>
                <View className="gap-2">
                  {PROMPT_SUGGESTIONS.map((suggestion) => (
                    <Pressable
                      key={suggestion.title}
                      className={`p-4 rounded-xl ${
                        isDark ? 'bg-steel-800' : 'bg-white'
                      } border ${isDark ? 'border-steel-700' : 'border-steel-200'}`}
                      onPress={() => applySuggestion(suggestion)}
                    >
                      <View className="flex-row items-center justify-between">
                        <View className="flex-1">
                          <Text
                            className={`font-semibold ${
                              isDark ? 'text-steel-100' : 'text-steel-900'
                            }`}
                          >
                            {suggestion.title}
                          </Text>
                          <Text
                            className={`text-sm mt-1 ${
                              isDark ? 'text-steel-400' : 'text-steel-500'
                            }`}
                          >
                            {suggestion.description}
                          </Text>
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={18}
                          color={isDark ? '#808fb0' : '#607296'}
                        />
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Generate Button */}
              <Pressable
                className={`py-4 rounded-xl items-center ${
                  prompt.trim() && !isGenerating ? 'bg-forge-500' : isDark ? 'bg-steel-700' : 'bg-steel-200'
                }`}
                onPress={handleGenerate}
                disabled={!prompt.trim() || isGenerating}
              >
                {isGenerating ? (
                  <View className="flex-row items-center">
                    <ActivityIndicator color="#ffffff" size="small" />
                    <Text className="text-white font-semibold ml-2">Generating...</Text>
                  </View>
                ) : (
                  <View className="flex-row items-center">
                    <Ionicons name="sparkles" size={20} color="#ffffff" />
                    <Text className="text-white font-semibold ml-2">Generate Block</Text>
                  </View>
                )}
              </Pressable>
            </>
          ) : (
            <>
              {/* Generated Block Preview */}
              <View
                className={`p-4 rounded-xl mb-4 ${
                  isDark ? 'bg-forge-500/20' : 'bg-forge-50'
                } border ${isDark ? 'border-forge-500/30' : 'border-forge-200'}`}
              >
                <View className="flex-row items-center mb-2">
                  <Ionicons name="checkmark-circle" size={20} color="#ed7411" />
                  <Text className="text-forge-500 font-semibold ml-2">
                    Block Generated!
                  </Text>
                </View>
                <Text className={`font-bold text-lg ${isDark ? 'text-steel-100' : 'text-steel-900'}`}>
                  {generatedBlock.name}
                </Text>
                <Text className={`mt-1 ${isDark ? 'text-steel-300' : 'text-steel-600'}`}>
                  {generatedBlock.description}
                </Text>
                <View className="flex-row gap-3 mt-3">
                  <View className={`px-3 py-1 rounded-full ${isDark ? 'bg-steel-700' : 'bg-steel-100'}`}>
                    <Text className={`text-sm ${isDark ? 'text-steel-300' : 'text-steel-600'}`}>
                      {generatedBlock.duration_weeks} weeks
                    </Text>
                  </View>
                  <View className={`px-3 py-1 rounded-full ${isDark ? 'bg-steel-700' : 'bg-steel-100'}`}>
                    <Text className={`text-sm ${isDark ? 'text-steel-300' : 'text-steel-600'}`}>
                      {generatedBlock.workouts.length} workouts
                    </Text>
                  </View>
                </View>
              </View>

              {/* Workout Preview */}
              <Text
                className={`text-sm font-semibold mb-3 ${
                  isDark ? 'text-steel-300' : 'text-steel-600'
                }`}
              >
                Week 1 Preview
              </Text>
              {generatedBlock.workouts
                .filter((w) => w.week_number === 1)
                .map((workout, index) => (
                  <View
                    key={index}
                    className={`p-4 rounded-xl mb-3 ${
                      isDark ? 'bg-steel-800' : 'bg-white'
                    } border ${isDark ? 'border-steel-700' : 'border-steel-200'}`}
                  >
                    <View className="flex-row items-center justify-between mb-3">
                      <View className="flex-row items-center">
                        <View className="w-8 h-8 rounded-full bg-forge-500 items-center justify-center mr-3">
                          <Text className="text-white font-bold text-sm">
                            D{workout.day_number}
                          </Text>
                        </View>
                        <Text
                          className={`font-semibold ${
                            isDark ? 'text-steel-100' : 'text-steel-900'
                          }`}
                        >
                          {workout.focus}
                        </Text>
                      </View>
                    </View>
                    <View className="gap-1">
                      {workout.exercises.slice(0, 5).map((ex, exIndex) => (
                        <View key={exIndex} className="flex-row items-center">
                          <View
                            className={`w-1.5 h-1.5 rounded-full mr-2 ${
                              isDark ? 'bg-steel-500' : 'bg-steel-300'
                            }`}
                          />
                          <Text
                            className={`text-sm ${
                              isDark ? 'text-steel-300' : 'text-steel-600'
                            }`}
                          >
                            {ex.exercise_name} - {ex.sets.length} sets
                          </Text>
                        </View>
                      ))}
                      {workout.exercises.length > 5 && (
                        <Text
                          className={`text-sm ${
                            isDark ? 'text-steel-500' : 'text-steel-400'
                          }`}
                        >
                          +{workout.exercises.length - 5} more exercises
                        </Text>
                      )}
                    </View>
                  </View>
                ))}

              {/* Action Buttons */}
              <View className="flex-row gap-3 mt-2">
                <Pressable
                  className={`flex-1 py-4 rounded-xl items-center border ${
                    isDark ? 'border-steel-600' : 'border-steel-300'
                  }`}
                  onPress={() => {
                    setGeneratedBlock(null);
                    setPrompt('');
                  }}
                >
                  <Text className={`font-semibold ${isDark ? 'text-steel-300' : 'text-steel-600'}`}>
                    Start Over
                  </Text>
                </Pressable>
                <Pressable
                  className={`flex-1 py-4 rounded-xl items-center ${
                    isSaving ? 'bg-forge-400' : 'bg-forge-500'
                  }`}
                  onPress={handleSaveBlock}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text className="text-white font-semibold">Save Block</Text>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
