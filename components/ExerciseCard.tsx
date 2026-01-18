// Compact exercise card for the workout overview
// Shows exercise name, prescription/summary, and completion status

import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { View, Text, Pressable, Modal } from 'react-native';

import { Colors } from '@/constants/Colors';
import {
  generateExerciseSummary,
  formatPrescription,
  getCompletionStatus,
  type CompletionStatus,
  type SetWithExercise,
} from '@/lib/workoutSummary';
import type { Exercise } from '@/types/database';

interface ExerciseCardProps {
  exercise: Exercise;
  sets: SetWithExercise[];
  targetSets?: number;
  targetReps?: number;
  targetRPE?: number;
  targetLoad?: number;
  onPress: () => void;
  onDelete?: () => void;
  showDelete?: boolean;
  onLongPress?: () => void;
  /** Last performance from movement memory */
  lastPerformance?: {
    weight: number | null;
    reps: number | null;
    rpe: number | null;
    date: string | null;
  };
}

export function ExerciseCard({
  exercise,
  sets,
  targetSets,
  targetReps,
  targetRPE,
  targetLoad,
  onPress,
  onDelete,
  showDelete = false,
  onLongPress,
  lastPerformance,
}: ExerciseCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  const isCardio = exercise.modality === 'Cardio';
  const status = getCompletionStatus(sets, isCardio, targetSets);

  // Check if any sets have been logged
  const hasLoggedSets = sets.some((s) => {
    if (isCardio) {
      return s.distance_meters || s.duration_seconds || s.avg_pace;
    }
    return s.actual_weight !== null || s.actual_reps !== null;
  });

  // Generate display text
  const displayText = hasLoggedSets
    ? generateExerciseSummary(exercise, sets)
    : formatPrescription(sets, exercise, targetSets, targetReps, targetRPE, targetLoad) || getPrescriptionText();

  // Fallback prescription text from props
  function getPrescriptionText(): string {
    if (isCardio) {
      return `${targetSets || sets.length} interval${(targetSets || sets.length) > 1 ? 's' : ''}`;
    }
    let text = `${targetSets || sets.length} x ${targetReps || '?'}`;
    if (targetLoad) {
      text += ` @ ${targetLoad} lbs`;
    } else if (targetRPE) {
      text += ` @ RPE ${targetRPE}`;
    }
    return text;
  }

  // Glass-morphic status styles
  const getStatusStyles = () => {
    switch (status) {
      case 'completed':
        return {
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderColor: 'rgba(16, 185, 129, 0.3)',
          textColor: Colors.emerald[400],
          subtextColor: Colors.emerald[500],
        };
      case 'in_progress':
        return {
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderColor: 'rgba(96, 165, 250, 0.5)',
          textColor: Colors.graphite[50],
          subtextColor: Colors.graphite[400],
        };
      default:
        return {
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          textColor: Colors.graphite[50],
          subtextColor: Colors.graphite[500],
        };
    }
  };

  const styles = getStatusStyles();

  const handleLongPress = () => {
    if (onLongPress) {
      onLongPress();
    } else {
      setShowMenu(true);
    }
  };

  return (
    <>
      <Pressable
        onPress={onPress}
        onLongPress={handleLongPress}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          padding: 16,
          borderRadius: 16,
          marginBottom: 8,
          backgroundColor: styles.backgroundColor,
          borderWidth: 1,
          borderColor: styles.borderColor,
          opacity: pressed ? 0.7 : 1,
          // Glow effect for active state
          ...(status === 'in_progress' && {
            shadowColor: Colors.signal[500],
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
          }),
        })}
      >
        {/* Status indicator */}
        <View style={{ marginRight: 12 }}>
          {status === 'completed' ? (
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: Colors.emerald[500],
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="checkmark" size={16} color="#000" />
            </View>
          ) : status === 'in_progress' ? (
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                borderWidth: 2,
                borderColor: Colors.signal[500],
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: Colors.signal[500],
                }}
              />
            </View>
          ) : (
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                borderWidth: 2,
                borderColor: Colors.graphite[600],
              }}
            />
          )}
        </View>

        {/* Content */}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: '600',
              color: styles.textColor,
            }}
            numberOfLines={1}
          >
            {exercise.name}
          </Text>
          <Text
            style={{
              fontSize: 13,
              marginTop: 2,
              fontFamily: 'monospace',
              color: styles.subtextColor,
            }}
            numberOfLines={1}
          >
            {displayText}
          </Text>
          {/* Show last performance when exercise hasn't been started */}
          {status === 'pending' && lastPerformance?.weight && !targetLoad && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 4 }}>
              <Ionicons name="time-outline" size={11} color={Colors.graphite[500]} />
              <Text
                style={{
                  fontSize: 11,
                  color: Colors.graphite[500],
                }}
                numberOfLines={1}
              >
                Last: {lastPerformance.weight}×{lastPerformance.reps}
                {lastPerformance.rpe ? ` @${lastPerformance.rpe}` : ''}
              </Text>
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {showDelete && onDelete && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                setShowMenu(true);
              }}
              style={{
                padding: 6,
                borderRadius: 20,
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
              }}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={Colors.graphite[400]} />
            </Pressable>
          )}
          <Ionicons name="chevron-forward" size={20} color={Colors.graphite[500]} />
        </View>
      </Pressable>

      {/* Long-press menu */}
      {showMenu && (
        <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
          <Pressable
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
            }}
            onPress={() => setShowMenu(false)}
          >
            <View
              style={{
                backgroundColor: Colors.void[800],
                borderRadius: 16,
                padding: 16,
                minWidth: 200,
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.1)',
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  marginBottom: 12,
                  color: Colors.graphite[50],
                }}
              >
                {exercise.name}
              </Text>
              <Pressable
                onPress={() => {
                  setShowMenu(false);
                  onPress();
                }}
                style={{
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(255, 255, 255, 0.1)',
                }}
              >
                <Text style={{ color: Colors.graphite[200] }}>Edit Exercise</Text>
              </Pressable>
              {onDelete && (
                <Pressable
                  onPress={() => {
                    setShowMenu(false);
                    onDelete();
                  }}
                  style={{ paddingVertical: 12 }}
                >
                  <Text style={{ color: Colors.regression[400] }}>Remove Exercise</Text>
                </Pressable>
              )}
            </View>
          </Pressable>
        </Modal>
      )}
    </>
  );
}

// Section header for grouping exercises
interface SectionHeaderProps {
  title: string;
}

export function SectionHeader({ title }: SectionHeaderProps) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, marginTop: 16 }}>
      <Text
        style={{
          fontSize: 10,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 2,
          color: Colors.signal[400],
        }}
      >
        {title}
      </Text>
      <View
        style={{
          flex: 1,
          height: 1,
          marginLeft: 12,
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
        }}
      />
    </View>
  );
}
