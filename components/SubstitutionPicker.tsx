import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import { useExerciseSubstitutions, type ExerciseSubstitution } from '@/hooks/useExerciseSubstitutions';
import type { Exercise } from '@/types/database';

interface SubstitutionPickerProps {
  visible: boolean;
  onClose: () => void;
  exercise: Exercise;
  onSelectSubstitution: (newExercise: Exercise) => void;
}

export function SubstitutionPicker({
  visible,
  onClose,
  exercise,
  onSelectSubstitution,
}: SubstitutionPickerProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const { data: substitutions, isLoading } = useExerciseSubstitutions(exercise.id, {
    limit: 8,
  });

  const handleSelect = (sub: ExerciseSubstitution) => {
    onSelectSubstitution(sub.exercise);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className={`flex-1 ${isDark ? 'bg-carbon-950' : 'bg-graphite-50'}`}>
        {/* Header */}
        <View
          className={`px-4 py-4 border-b ${
            isDark ? 'border-graphite-700' : 'border-graphite-200'
          }`}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text
                className={`text-lg font-bold ${
                  isDark ? 'text-graphite-100' : 'text-graphite-900'
                }`}
              >
                Swap Exercise
              </Text>
              <Text
                className={`text-sm ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}
              >
                Alternatives for {exercise.name}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              className={`w-10 h-10 rounded-full items-center justify-center ${
                isDark ? 'bg-graphite-800' : 'bg-graphite-100'
              }`}
            >
              <Ionicons
                name="close"
                size={24}
                color={isDark ? '#E6E8EB' : '#0E1116'}
              />
            </Pressable>
          </View>
        </View>

        {/* Content */}
        <ScrollView className="flex-1 px-4 pt-4">
          {isLoading ? (
            <View className="items-center justify-center py-12">
              <ActivityIndicator size="large" color="#2F80ED" />
              <Text
                className={`mt-4 ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}
              >
                Finding alternatives...
              </Text>
            </View>
          ) : substitutions.length === 0 ? (
            <View className="items-center justify-center py-12">
              <Ionicons
                name="search-outline"
                size={48}
                color={isDark ? '#808fb0' : '#607296'}
              />
              <Text
                className={`mt-4 text-center ${
                  isDark ? 'text-graphite-400' : 'text-graphite-500'
                }`}
              >
                No similar exercises found
              </Text>
            </View>
          ) : (
            <>
              {/* Current Exercise Info */}
              <View
                className={`p-4 rounded-xl mb-4 ${
                  isDark ? 'bg-graphite-800' : 'bg-white'
                } border ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}
              >
                <Text
                  className={`text-xs mb-1 ${
                    isDark ? 'text-graphite-400' : 'text-graphite-500'
                  }`}
                >
                  CURRENT
                </Text>
                <Text
                  className={`font-semibold ${
                    isDark ? 'text-graphite-100' : 'text-graphite-900'
                  }`}
                >
                  {exercise.name}
                </Text>
                <View className="flex-row items-center mt-1">
                  <View
                    className={`px-2 py-0.5 rounded ${
                      exercise.modality === 'Strength'
                        ? 'bg-signal-500/20'
                        : exercise.modality === 'Cardio'
                        ? 'bg-progress-500/20'
                        : 'bg-purple-500/20'
                    }`}
                  >
                    <Text
                      className={`text-xs ${
                        exercise.modality === 'Strength'
                          ? 'text-signal-500'
                          : exercise.modality === 'Cardio'
                          ? 'text-progress-500'
                          : 'text-purple-500'
                      }`}
                    >
                      {exercise.modality}
                    </Text>
                  </View>
                  <Text
                    className={`ml-2 text-xs ${
                      isDark ? 'text-graphite-400' : 'text-graphite-500'
                    }`}
                  >
                    {exercise.muscle_group}
                  </Text>
                </View>
              </View>

              {/* Substitution Options */}
              <Text
                className={`text-xs font-semibold mb-3 ${
                  isDark ? 'text-graphite-400' : 'text-graphite-500'
                }`}
              >
                ALTERNATIVES ({substitutions.length})
              </Text>

              <View className="gap-2 pb-8">
                {substitutions.map((sub) => (
                  <Pressable
                    key={sub.exercise.id}
                    className={`p-4 rounded-xl ${
                      isDark ? 'bg-graphite-800' : 'bg-white'
                    } border ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}
                    onPress={() => handleSelect(sub)}
                  >
                    <View className="flex-row items-center">
                      <View
                        className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
                          sub.exercise.modality === 'Strength'
                            ? 'bg-signal-500/20'
                            : sub.exercise.modality === 'Cardio'
                            ? 'bg-progress-500/20'
                            : 'bg-purple-500/20'
                        }`}
                      >
                        <Ionicons
                          name={
                            sub.exercise.modality === 'Strength'
                              ? 'barbell-outline'
                              : sub.exercise.modality === 'Cardio'
                              ? 'bicycle-outline'
                              : 'fitness-outline'
                          }
                          size={20}
                          color={
                            sub.exercise.modality === 'Strength'
                              ? '#2F80ED'
                              : sub.exercise.modality === 'Cardio'
                              ? '#27AE60'
                              : '#9B59B6'
                          }
                        />
                      </View>
                      <View className="flex-1">
                        <Text
                          className={`font-semibold ${
                            isDark ? 'text-graphite-100' : 'text-graphite-900'
                          }`}
                        >
                          {sub.exercise.name}
                        </Text>
                        <View className="flex-row items-center mt-1">
                          <Text
                            className={`text-xs ${
                              isDark ? 'text-graphite-400' : 'text-graphite-500'
                            }`}
                          >
                            {sub.reason}
                          </Text>
                          {sub.hasHistory && (
                            <View className="ml-2 flex-row items-center">
                              <Ionicons
                                name="checkmark-circle"
                                size={12}
                                color="#22c55e"
                              />
                              <Text className="text-xs text-progress-500 ml-1">
                                Familiar
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <Ionicons
                        name="swap-horizontal"
                        size={20}
                        color="#2F80ED"
                      />
                    </View>
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

/**
 * Inline substitution suggestions (for compact display)
 */
export function InlineSubstitutions({
  exerciseId,
  onSelect,
}: {
  exerciseId: string;
  onSelect: (exercise: Exercise) => void;
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const { data: substitutions, isLoading } = useExerciseSubstitutions(exerciseId, {
    limit: 3,
  });

  if (isLoading || substitutions.length === 0) {
    return null;
  }

  return (
    <View className="mt-2">
      <Text
        className={`text-xs mb-2 ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}
      >
        Quick swap:
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {substitutions.map((sub) => (
          <Pressable
            key={sub.exercise.id}
            className={`px-3 py-1.5 rounded-full border ${
              isDark
                ? 'bg-graphite-800 border-graphite-700'
                : 'bg-white border-graphite-200'
            }`}
            onPress={() => onSelect(sub.exercise)}
          >
            <Text
              className={`text-sm ${isDark ? 'text-graphite-200' : 'text-graphite-700'}`}
            >
              {sub.exercise.name}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
