import { Ionicons } from '@expo/vector-icons';
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import { useExerciseSubstitutions, type ExerciseSubstitution } from '@/hooks/useExerciseSubstitutions';
import type { Exercise } from '@/types/database';

interface SubstitutionPickerProps {
  visible: boolean;
  onClose: () => void;
  exercise: Exercise;
  onSelectSubstitution: (newExercise: Exercise) => void;
}

/**
 * Modal to browse and select exercise substitutions
 * Uses glass-morphic styling consistent with the rest of the app
 */
export function SubstitutionPicker({
  visible,
  onClose,
  exercise,
  onSelectSubstitution,
}: SubstitutionPickerProps) {
  const { data: substitutions, isLoading } = useExerciseSubstitutions(exercise.id, {
    limit: 8,
  });

  const handleSelect = (sub: ExerciseSubstitution) => {
    onSelectSubstitution(sub.exercise);
    onClose();
  };

  const getModalityColor = (modality: string) => {
    switch (modality) {
      case 'Strength':
        return Colors.signal[500];
      case 'Cardio':
        return Colors.emerald[500];
      default:
        return '#9B59B6';
    }
  };

  const getModalityBg = (modality: string) => {
    switch (modality) {
      case 'Strength':
        return Colors.glass.blue[10];
      case 'Cardio':
        return 'rgba(16, 185, 129, 0.1)';
      default:
        return 'rgba(155, 89, 182, 0.1)';
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: Colors.void[900] }}>
        {/* Ambient Background Glow */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -50,
            right: -80,
            width: 200,
            height: 200,
            backgroundColor: 'rgba(37, 99, 235, 0.05)',
            borderRadius: 100,
          }}
        />

        <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
          {/* Header */}
          <View
            style={{
              paddingHorizontal: 16,
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderBottomColor: Colors.glass.white[10],
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: '700',
                    color: Colors.graphite[50],
                  }}
                >
                  Swap Exercise
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: Colors.graphite[400],
                  }}
                >
                  Alternatives for {exercise.name}
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => ({
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: pressed ? Colors.glass.white[20] : Colors.glass.white[10],
                })}
              >
                <Ionicons name="close" size={24} color={Colors.graphite[50]} />
              </Pressable>
            </View>
          </View>

          {/* Content */}
          <ScrollView
            style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}
            contentContainerStyle={{ paddingBottom: 32 }}
          >
            {isLoading ? (
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
                <ActivityIndicator size="large" color={Colors.signal[500]} />
                <Text style={{ marginTop: 16, color: Colors.graphite[400] }}>
                  Finding alternatives...
                </Text>
              </View>
            ) : substitutions.length === 0 ? (
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
                <Ionicons name="search-outline" size={48} color={Colors.graphite[500]} />
                <Text
                  style={{
                    marginTop: 16,
                    textAlign: 'center',
                    color: Colors.graphite[400],
                  }}
                >
                  No similar exercises found
                </Text>
              </View>
            ) : (
              <>
                {/* Current Exercise Info */}
                <View
                  style={{
                    padding: 16,
                    borderRadius: 16,
                    marginBottom: 16,
                    backgroundColor: Colors.glass.white[5],
                    borderWidth: 1,
                    borderColor: Colors.glass.white[10],
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                      marginBottom: 4,
                      color: Colors.graphite[400],
                    }}
                  >
                    CURRENT
                  </Text>
                  <Text
                    style={{
                      fontWeight: '600',
                      fontSize: 16,
                      color: Colors.graphite[50],
                    }}
                  >
                    {exercise.name}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 6,
                        backgroundColor: getModalityBg(exercise.modality),
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          color: getModalityColor(exercise.modality),
                        }}
                      >
                        {exercise.modality}
                      </Text>
                    </View>
                    <Text
                      style={{
                        marginLeft: 8,
                        fontSize: 12,
                        color: Colors.graphite[400],
                      }}
                    >
                      {exercise.muscle_group}
                    </Text>
                  </View>
                </View>

                {/* Substitution Options */}
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    marginBottom: 12,
                    color: Colors.graphite[400],
                  }}
                >
                  ALTERNATIVES ({substitutions.length})
                </Text>

                <View style={{ gap: 8 }}>
                  {substitutions.map((sub) => (
                    <Pressable
                      key={sub.exercise.id}
                      onPress={() => handleSelect(sub)}
                      style={({ pressed }) => ({
                        padding: 16,
                        borderRadius: 16,
                        backgroundColor: pressed ? Colors.glass.white[10] : Colors.glass.white[5],
                        borderWidth: 1,
                        borderColor: Colors.glass.white[10],
                      })}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 12,
                            backgroundColor: getModalityBg(sub.exercise.modality),
                          }}
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
                            color={getModalityColor(sub.exercise.modality)}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              fontWeight: '600',
                              fontSize: 15,
                              color: Colors.graphite[50],
                            }}
                          >
                            {sub.exercise.name}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                            <Text
                              style={{
                                fontSize: 12,
                                color: Colors.graphite[400],
                              }}
                            >
                              {sub.reason}
                            </Text>
                            {sub.hasHistory && (
                              <View style={{ marginLeft: 8, flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name="checkmark-circle" size={12} color={Colors.emerald[500]} />
                                <Text
                                  style={{
                                    fontSize: 12,
                                    marginLeft: 4,
                                    color: Colors.emerald[500],
                                  }}
                                >
                                  Familiar
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                        <Ionicons name="swap-horizontal" size={20} color={Colors.signal[500]} />
                      </View>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

/**
 * Inline substitution suggestions (for compact display)
 * Uses glass-morphic styling
 */
export function InlineSubstitutions({
  exerciseId,
  onSelect,
}: {
  exerciseId: string;
  onSelect: (exercise: Exercise) => void;
}) {
  const { data: substitutions, isLoading } = useExerciseSubstitutions(exerciseId, {
    limit: 3,
  });

  if (isLoading || substitutions.length === 0) {
    return null;
  }

  return (
    <View style={{ marginTop: 8 }}>
      <Text
        style={{
          fontSize: 12,
          marginBottom: 8,
          color: Colors.graphite[400],
        }}
      >
        Quick swap:
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {substitutions.map((sub) => (
          <Pressable
            key={sub.exercise.id}
            onPress={() => onSelect(sub.exercise)}
            style={({ pressed }) => ({
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 100,
              borderWidth: 1,
              backgroundColor: pressed ? Colors.glass.white[10] : Colors.glass.white[5],
              borderColor: Colors.glass.white[10],
            })}
          >
            <Text
              style={{
                fontSize: 14,
                color: Colors.graphite[200],
              }}
            >
              {sub.exercise.name}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
