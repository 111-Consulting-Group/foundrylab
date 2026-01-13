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
  
  // Force dark mode styling
  const bgColor = status === 'completed' 
    ? 'rgba(34, 197, 94, 0.1)' 
    : status === 'in_progress'
    ? 'rgba(47, 128, 237, 0.1)'
    : '#1A1F2E';
  const borderColor = status === 'completed'
    ? 'rgba(34, 197, 94, 0.3)'
    : status === 'in_progress'
    ? 'rgba(47, 128, 237, 0.3)'
    : '#353D4B';

  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center p-4 rounded-xl mb-2 ${
        statusConfig.bgClass
      } border ${statusConfig.borderClass}`}
      style={({ pressed }) => ({
        opacity: pressed ? 0.7 : 1,
        backgroundColor: bgColor,
        borderColor,
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
          <View className="w-6 h-6 rounded-full border-2 border-graphite-600" style={{ borderColor: '#4A5568' }} />
        )}
      </View>
      
      {/* Content */}
      <View className="flex-1">
        <Text
          className={`font-semibold ${
            status === 'completed'
              ? 'text-progress-500'
              : 'text-graphite-100'
          }`}
          style={status !== 'completed' ? { color: '#E6E8EB' } : undefined}
          numberOfLines={1}
        >
          {exercise.name}
        </Text>
        <Text
          className={`text-sm mt-0.5 ${
            status === 'completed'
              ? 'text-progress-400'
              : 'text-graphite-400'
          }`}
          style={status === 'completed' ? undefined : { color: '#6B7485' }}
          numberOfLines={1}
        >
          {displayText}
        </Text>
      </View>
      
      {/* Chevron */}
      <Ionicons
        name="chevron-forward"
        size={20}
        color="#607296"
      />
    </Pressable>
  );
}

function getStatusConfig(
  status: CompletionStatus,
  isDark: boolean
): { bgClass: string; borderClass: string } {
  // Force dark mode
  switch (status) {
    case 'completed':
      return {
        bgClass: 'bg-progress-500/10',
        borderClass: 'border-progress-500/30',
      };
    case 'in_progress':
      return {
        bgClass: 'bg-signal-500/10',
        borderClass: 'border-signal-500/30',
      };
    default:
      return {
        bgClass: 'bg-graphite-800',
        borderClass: 'border-graphite-700',
      };
  }
}

// Section header for grouping exercises
interface SectionHeaderProps {
  title: string;
}

export function SectionHeader({ title }: SectionHeaderProps) {
  return (
    <View className="flex-row items-center mb-3 mt-4">
      <Text
        className="text-xs font-bold uppercase tracking-wide text-graphite-400"
        style={{ color: '#6B7485' }}
      >
        {title}
      </Text>
      <View
        className="flex-1 h-px ml-3 bg-graphite-700"
        style={{ backgroundColor: '#353D4B' }}
      />
    </View>
  );
}
