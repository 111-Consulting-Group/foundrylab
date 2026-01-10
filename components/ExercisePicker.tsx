import { Ionicons } from '@expo/vector-icons';
import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import { useExercises, useExerciseSearch } from '@/hooks/useExercises';
import type { Exercise, ExerciseModality } from '@/types/database';

interface ExercisePickerProps {
  visible: boolean;
  onClose: () => void;
  onSelectExercise: (exercise: Exercise) => void;
  recentExerciseIds?: string[];
}

const MODALITY_FILTERS: { label: string; value: ExerciseModality | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Strength', value: 'Strength' },
  { label: 'Cardio', value: 'Cardio' },
  { label: 'Hybrid', value: 'Hybrid' },
];

export function ExercisePicker({
  visible,
  onClose,
  onSelectExercise,
  recentExerciseIds = [],
}: ExercisePickerProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModality, setSelectedModality] = useState<ExerciseModality | 'all'>('all');

  // Fetch all exercises
  const { data: allExercises = [], isLoading } = useExercises(
    selectedModality === 'all' ? undefined : { modality: selectedModality }
  );

  // Search exercises when query changes
  const { data: searchResults = [] } = useExerciseSearch(searchQuery);

  // Get recent exercises from the full list
  const recentExercises = useMemo(() => {
    if (!recentExerciseIds.length || !allExercises.length) return [];
    return recentExerciseIds
      .map((id) => allExercises.find((ex) => ex.id === id))
      .filter((ex): ex is Exercise => ex !== undefined)
      .slice(0, 5);
  }, [recentExerciseIds, allExercises]);

  // Filter exercises based on search or show all
  const displayedExercises = useMemo(() => {
    if (searchQuery.length >= 2) {
      return searchResults;
    }
    return allExercises;
  }, [searchQuery, searchResults, allExercises]);

  const handleSelectExercise = useCallback(
    (exercise: Exercise) => {
      onSelectExercise(exercise);
      setSearchQuery('');
      onClose();
    },
    [onSelectExercise, onClose]
  );

  const renderExerciseItem = useCallback(
    ({ item }: { item: Exercise }) => (
      <Pressable
        className={`p-4 border-b ${isDark ? 'border-steel-700' : 'border-steel-200'} active:opacity-70`}
        onPress={() => handleSelectExercise(item)}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className={`font-medium ${isDark ? 'text-steel-100' : 'text-steel-900'}`}>
              {item.name}
            </Text>
            <View className="flex-row items-center mt-1">
              <View
                className={`px-2 py-0.5 rounded mr-2 ${
                  item.modality === 'Strength'
                    ? 'bg-forge-500/20'
                    : item.modality === 'Cardio'
                    ? 'bg-success-500/20'
                    : 'bg-purple-500/20'
                }`}
              >
                <Text
                  className={`text-xs ${
                    item.modality === 'Strength'
                      ? 'text-forge-500'
                      : item.modality === 'Cardio'
                      ? 'text-success-500'
                      : 'text-purple-500'
                  }`}
                >
                  {item.modality}
                </Text>
              </View>
              <Text className={`text-xs ${isDark ? 'text-steel-400' : 'text-steel-500'}`}>
                {item.muscle_group}
              </Text>
            </View>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={isDark ? '#808fb0' : '#607296'}
          />
        </View>
      </Pressable>
    ),
    [isDark, handleSelectExercise]
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className={`flex-1 ${isDark ? 'bg-steel-950' : 'bg-steel-50'}`}
      >
        {/* Header */}
        <View
          className={`flex-row items-center justify-between px-4 py-3 border-b ${
            isDark ? 'border-steel-700 bg-steel-900' : 'border-steel-200 bg-white'
          }`}
        >
          <Text className={`text-lg font-bold ${isDark ? 'text-steel-100' : 'text-steel-900'}`}>
            Select Exercise
          </Text>
          <Pressable onPress={onClose} className="p-2">
            <Ionicons name="close" size={24} color={isDark ? '#f6f7f9' : '#1e232f'} />
          </Pressable>
        </View>

        {/* Search Input */}
        <View className="px-4 py-3">
          <View
            className={`flex-row items-center px-4 py-3 rounded-xl ${
              isDark ? 'bg-steel-800' : 'bg-white'
            } border ${isDark ? 'border-steel-700' : 'border-steel-200'}`}
          >
            <Ionicons
              name="search"
              size={20}
              color={isDark ? '#808fb0' : '#607296'}
            />
            <TextInput
              className={`flex-1 ml-3 text-base ${isDark ? 'text-steel-100' : 'text-steel-900'}`}
              placeholder="Search exercises..."
              placeholderTextColor={isDark ? '#607296' : '#808fb0'}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <Ionicons
                  name="close-circle"
                  size={20}
                  color={isDark ? '#808fb0' : '#607296'}
                />
              </Pressable>
            )}
          </View>
        </View>

        {/* Modality Filters */}
        <View className="px-4 pb-3">
          <FlatList
            horizontal
            data={MODALITY_FILTERS}
            keyExtractor={(item) => item.value}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
            renderItem={({ item }) => (
              <Pressable
                className={`px-4 py-2 rounded-full ${
                  selectedModality === item.value
                    ? 'bg-forge-500'
                    : isDark
                    ? 'bg-steel-800'
                    : 'bg-white'
                } ${
                  selectedModality !== item.value
                    ? `border ${isDark ? 'border-steel-700' : 'border-steel-200'}`
                    : ''
                }`}
                onPress={() => setSelectedModality(item.value)}
              >
                <Text
                  className={`font-medium ${
                    selectedModality === item.value
                      ? 'text-white'
                      : isDark
                      ? 'text-steel-300'
                      : 'text-steel-600'
                  }`}
                >
                  {item.label}
                </Text>
              </Pressable>
            )}
          />
        </View>

        {/* Recent Exercises */}
        {recentExercises.length > 0 && searchQuery.length === 0 && (
          <View className="px-4 mb-2">
            <Text
              className={`text-sm font-semibold mb-2 ${
                isDark ? 'text-steel-400' : 'text-steel-500'
              }`}
            >
              Recent
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {recentExercises.map((exercise) => (
                <Pressable
                  key={exercise.id}
                  className={`px-3 py-2 rounded-lg ${
                    isDark ? 'bg-steel-800' : 'bg-white'
                  } border ${isDark ? 'border-forge-500/30' : 'border-forge-400/30'}`}
                  onPress={() => handleSelectExercise(exercise)}
                >
                  <Text className={`${isDark ? 'text-steel-100' : 'text-steel-900'}`}>
                    {exercise.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Exercise List */}
        <FlatList
          data={displayedExercises}
          keyExtractor={(item) => item.id}
          renderItem={renderExerciseItem}
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 20 }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View className="items-center justify-center py-12">
              {isLoading ? (
                <Text className={`${isDark ? 'text-steel-400' : 'text-steel-500'}`}>
                  Loading exercises...
                </Text>
              ) : (
                <View className="items-center">
                  <Ionicons
                    name="barbell-outline"
                    size={48}
                    color={isDark ? '#607296' : '#808fb0'}
                  />
                  <Text
                    className={`mt-3 ${isDark ? 'text-steel-400' : 'text-steel-500'}`}
                  >
                    No exercises found
                  </Text>
                </View>
              )}
            </View>
          }
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}
