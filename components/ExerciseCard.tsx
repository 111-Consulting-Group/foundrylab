// Compact exercise card for the workout overview
// Shows exercise name, prescription/summary, and completion status

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, Text, Pressable } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
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
}

export function ExerciseCard({
  exercise,
  sets,
  targetSets,
  targetReps,
  targetRPE,
  targetLoad,
  onPress,
}: ExerciseCardProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const isCardio = exercise.modality === 'Cardio';
  const status = getCompletionStatus(sets, isCardio, targetSets);
  
  // Check if any sets have been logged
  const hasLoggedSets = sets.some(s => {
    if (isCardio) {
      return s.distance_meters || s.duration_seconds || s.avg_pace;
    }
    return s.actual_weight !== null || s.actual_reps !== null;
  });
  
  // Generate display text
  const displayText = hasLoggedSets
    ? generateExerciseSummary(exercise, sets)
    : formatPrescription(sets, exercise, targetReps, targetRPE, targetLoad) || getPrescriptionText();
  
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
  
  // Status colors and icons
  const statusConfig = getStatusConfig(status, isDark);
  
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center p-4 rounded-xl mb-2 ${
        statusConfig.bgClass
      } border ${statusConfig.borderClass}`}
      style={({ pressed }) => ({
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {/* Status indicator */}
      <View className="mr-3">
        {status === 'completed' ? (
          <View className="w-6 h-6 rounded-full bg-progress-500 items-center justify-center">
            <Ionicons name="checkmark" size={16} color="#fff" />
          </View>
        ) : status === 'in_progress' ? (
          <View className="w-6 h-6 rounded-full border-2 border-signal-500 items-center justify-center">
            <View className="w-3 h-3 rounded-full bg-signal-500" />
          </View>
        ) : (
          <View className={`w-6 h-6 rounded-full border-2 ${
            isDark ? 'border-graphite-600' : 'border-graphite-300'
          }`} />
        )}
      </View>
      
      {/* Content */}
      <View className="flex-1">
        <Text
          className={`font-semibold ${
            status === 'completed'
              ? 'text-progress-600'
              : isDark
              ? 'text-graphite-100'
              : 'text-graphite-900'
          }`}
          numberOfLines={1}
        >
          {exercise.name}
        </Text>
        <Text
          className={`text-sm mt-0.5 ${
            status === 'completed'
              ? isDark
                ? 'text-progress-400'
                : 'text-progress-600'
              : isDark
              ? 'text-graphite-400'
              : 'text-graphite-500'
          }`}
          numberOfLines={1}
        >
          {displayText}
        </Text>
      </View>
      
      {/* Chevron */}
      <Ionicons
        name="chevron-forward"
        size={20}
        color={isDark ? '#607296' : '#808fb0'}
      />
    </Pressable>
  );
}

function getStatusConfig(
  status: CompletionStatus,
  isDark: boolean
): { bgClass: string; borderClass: string } {
  switch (status) {
    case 'completed':
      return {
        bgClass: isDark ? 'bg-progress-500/10' : 'bg-progress-500/5',
        borderClass: isDark ? 'border-progress-500/30' : 'border-progress-500/20',
      };
    case 'in_progress':
      return {
        bgClass: isDark ? 'bg-signal-500/10' : 'bg-signal-500/5',
        borderClass: isDark ? 'border-signal-500/30' : 'border-signal-500/20',
      };
    default:
      return {
        bgClass: isDark ? 'bg-graphite-800' : 'bg-white',
        borderClass: isDark ? 'border-graphite-700' : 'border-graphite-200',
      };
  }
}

// Section header for grouping exercises
interface SectionHeaderProps {
  title: string;
}

export function SectionHeader({ title }: SectionHeaderProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  return (
    <View className="flex-row items-center mb-3 mt-4">
      <Text
        className={`text-xs font-bold uppercase tracking-wide ${
          isDark ? 'text-graphite-400' : 'text-graphite-500'
        }`}
      >
        {title}
      </Text>
      <View
        className={`flex-1 h-px ml-3 ${
          isDark ? 'bg-graphite-700' : 'bg-graphite-200'
        }`}
      />
    </View>
  );
}
