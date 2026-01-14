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
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
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
        style={{
          padding: 16,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255, 255, 255, 0.08)',
        }}
        onPress={() => handleSelectExercise(item)}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 14,
                backgroundColor:
                  item.modality === 'Strength'
                    ? 'rgba(59, 130, 246, 0.15)'
                    : item.modality === 'Cardio'
                    ? 'rgba(16, 185, 129, 0.15)'
                    : 'rgba(155, 89, 182, 0.15)',
                borderWidth: 1,
                borderColor:
                  item.modality === 'Strength'
                    ? 'rgba(59, 130, 246, 0.3)'
                    : item.modality === 'Cardio'
                    ? 'rgba(16, 185, 129, 0.3)'
                    : 'rgba(155, 89, 182, 0.3)',
              }}
            >
              <Ionicons
                name={
                  item.modality === 'Strength'
                    ? 'barbell-outline'
                    : item.modality === 'Cardio'
                    ? 'bicycle-outline'
                    : 'fitness-outline'
                }
                size={22}
                color={
                  item.modality === 'Strength'
                    ? Colors.signal[400]
                    : item.modality === 'Cardio'
                    ? Colors.emerald[400]
                    : '#9B59B6'
                }
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '600', fontSize: 15, color: Colors.graphite[50] }}>
                {item.name}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 }}>
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 8,
                    backgroundColor:
                      item.modality === 'Strength'
                        ? 'rgba(59, 130, 246, 0.2)'
                        : item.modality === 'Cardio'
                        ? 'rgba(16, 185, 129, 0.2)'
                        : 'rgba(155, 89, 182, 0.2)',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '600',
                      color:
                        item.modality === 'Strength'
                          ? Colors.signal[400]
                          : item.modality === 'Cardio'
                          ? Colors.emerald[400]
                          : '#9B59B6',
                    }}
                  >
                    {item.modality}
                  </Text>
                </View>
                <Text style={{ fontSize: 12, color: Colors.graphite[500] }}>
                  {item.muscle_group}
                </Text>
              </View>
            </View>
          </View>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="add" size={18} color={Colors.signal[400]} />
          </View>
        </View>
      </Pressable>
    ),
    [handleSelectExercise]
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
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
            bottom: 100,
            left: -80,
            width: 250,
            height: 250,
            backgroundColor: 'rgba(37, 99, 235, 0.05)',
            borderRadius: 125,
          }}
        />

        <SafeAreaView style={{ flex: 1 }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                paddingVertical: 16,
                borderBottomWidth: 1,
                borderBottomColor: 'rgba(255, 255, 255, 0.08)',
                backgroundColor: 'rgba(12, 12, 12, 0.95)',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                    borderWidth: 1,
                    borderColor: 'rgba(59, 130, 246, 0.3)',
                  }}
                >
                  <Ionicons name="search" size={20} color={Colors.signal[400]} />
                </View>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.graphite[50] }}>
                    Select Exercise
                  </Text>
                  <Text style={{ fontSize: 12, color: Colors.graphite[500], marginTop: 2 }}>
                    {displayedExercises.length} exercises available
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={onClose}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="close" size={22} color={Colors.graphite[300]} />
              </Pressable>
            </View>

            {/* Search Input */}
            <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  borderRadius: 16,
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                }}
              >
                <Ionicons name="search" size={20} color={Colors.graphite[500]} style={{ marginRight: 12 }} />
                <TextInput
                  style={{ flex: 1, fontSize: 16, color: Colors.graphite[50] }}
                  placeholder="Search exercises..."
                  placeholderTextColor={Colors.graphite[500]}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={20} color={Colors.graphite[500]} />
                  </Pressable>
                )}
              </View>
            </View>

            {/* Modality Filters */}
            <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
              <FlatList
                horizontal
                data={MODALITY_FILTERS}
                keyExtractor={(item) => item.value}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10 }}
                renderItem={({ item }) => (
                  <Pressable
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 12,
                      backgroundColor:
                        selectedModality === item.value
                          ? Colors.signal[600]
                          : 'rgba(255, 255, 255, 0.05)',
                      borderWidth: selectedModality !== item.value ? 1 : 0,
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                    }}
                    onPress={() => setSelectedModality(item.value)}
                  >
                    <Text
                      style={{
                        fontWeight: '600',
                        fontSize: 13,
                        color:
                          selectedModality === item.value ? '#ffffff' : Colors.graphite[300],
                      }}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                )}
              />
            </View>

            {/* Recent Exercises */}
            {recentExercises.length > 0 && searchQuery.length === 0 && (
              <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: 2,
                    color: Colors.signal[400],
                    marginBottom: 10,
                  }}
                >
                  Recent
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {recentExercises.map((exercise) => (
                    <Pressable
                      key={exercise.id}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderRadius: 12,
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 1,
                        borderColor: 'rgba(59, 130, 246, 0.3)',
                      }}
                      onPress={() => handleSelectExercise(exercise)}
                    >
                      <Text style={{ color: Colors.graphite[100], fontWeight: '500' }}>
                        {exercise.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Section Label */}
            <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: 2,
                  color: Colors.graphite[500],
                }}
              >
                {searchQuery.length >= 2 ? 'Search Results' : 'All Exercises'}
              </Text>
            </View>

            {/* Exercise List */}
            <FlatList
              data={displayedExercises}
              keyExtractor={(item) => item.id}
              renderItem={renderExerciseItem}
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 40 }}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
                  {isLoading ? (
                    <View style={{ alignItems: 'center' }}>
                      <View
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 32,
                          backgroundColor: 'rgba(59, 130, 246, 0.1)',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: 16,
                        }}
                      >
                        <Ionicons name="barbell-outline" size={32} color={Colors.signal[400]} />
                      </View>
                      <Text style={{ color: Colors.graphite[400], fontSize: 14 }}>
                        Loading exercises...
                      </Text>
                    </View>
                  ) : (
                    <View style={{ alignItems: 'center' }}>
                      <View
                        style={{
                          width: 80,
                          height: 80,
                          borderRadius: 40,
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: 16,
                          borderWidth: 1,
                          borderColor: 'rgba(255, 255, 255, 0.1)',
                        }}
                      >
                        <Ionicons name="search-outline" size={40} color={Colors.graphite[500]} />
                      </View>
                      <Text style={{ color: Colors.graphite[400], fontSize: 16, fontWeight: '600' }}>
                        No exercises found
                      </Text>
                      <Text style={{ color: Colors.graphite[500], fontSize: 13, marginTop: 4 }}>
                        Try a different search term
                      </Text>
                    </View>
                  )}
                </View>
              }
            />
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
