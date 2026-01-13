/**
 * NextTimeSummary Component
 *
 * Post-workout summary showing "Next Time" suggestions for all exercises.
 * Displays after workout completion to reinforce progressive overload.
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';

import { NextTimeCard, NextTimeListItem } from '@/components/NextTimeCard';
import { useColorScheme } from '@/components/useColorScheme';
import type { NextTimeSuggestion, PerformanceTrend } from '@/types/database';

interface NextTimeSummaryProps {
  suggestions: NextTimeSuggestion[];
  workoutFocus?: string;
  onDismiss?: () => void;
  mode?: 'cards' | 'list';
}

export function NextTimeSummary({
  suggestions,
  workoutFocus,
  onDismiss,
  mode = 'list',
}: NextTimeSummaryProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Calculate summary stats
  const stats = calculateStats(suggestions);

  if (suggestions.length === 0) {
    return (
      <View className="p-4">
        <EmptyState isDark={isDark} />
      </View>
    );
  }

  return (
    <View className="flex-1">
      {/* Header */}
      <View className={`px-4 py-4 border-b ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}>
        <View className="flex-row items-center justify-between mb-2">
          <View>
            <Text className={`text-xs font-medium ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
              {workoutFocus ? `${workoutFocus} Complete` : 'Workout Complete'}
            </Text>
            <Text className={`text-xl font-bold ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
              Next Time
            </Text>
          </View>
          {onDismiss && (
            <Pressable onPress={onDismiss} className="p-2">
              <Ionicons name="close" size={24} color={isDark ? '#808fb0' : '#607296'} />
            </Pressable>
          )}
        </View>

        {/* Summary Stats */}
        <View className="flex-row mt-2">
          <SummaryStatBadge
            icon="fitness"
            value={suggestions.length.toString()}
            label="Exercises"
            isDark={isDark}
          />
          <SummaryStatBadge
            icon="trending-up"
            value={stats.progressing.toString()}
            label="Progressing"
            color="green"
            isDark={isDark}
          />
          <SummaryStatBadge
            icon="remove"
            value={stats.stable.toString()}
            label="Stable"
            isDark={isDark}
          />
          {stats.regressing > 0 && (
            <SummaryStatBadge
              icon="trending-down"
              value={stats.regressing.toString()}
              label="Regressing"
              color="red"
              isDark={isDark}
            />
          )}
        </View>
      </View>

      {/* Exercise List */}
      <ScrollView className="flex-1 px-4 py-4">
        {mode === 'cards' ? (
          // Full card view
          suggestions.map((suggestion) => (
            <View key={suggestion.exercise_id} className="mb-4">
              <NextTimeCard suggestion={suggestion} />
            </View>
          ))
        ) : (
          // Compact list view
          suggestions.map((suggestion) => (
            <NextTimeListItem key={suggestion.exercise_id} suggestion={suggestion} />
          ))
        )}

        {/* Bottom CTA */}
        <View className={`mt-4 p-4 rounded-xl ${isDark ? 'bg-signal-500/10' : 'bg-signal-500/5'}`}>
          <View className="flex-row items-center">
            <View className="w-10 h-10 rounded-full bg-signal-500/20 items-center justify-center">
              <Ionicons name="bulb" size={20} color="#2F80ED" />
            </View>
            <View className="flex-1 ml-3">
              <Text className={`font-semibold ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
                Progressive Overload
              </Text>
              <Text className={`text-xs ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                Follow these suggestions next time to keep making progress
              </Text>
            </View>
          </View>
        </View>

        {/* Spacing at bottom */}
        <View className="h-8" />
      </ScrollView>
    </View>
  );
}

function SummaryStatBadge({
  icon,
  value,
  label,
  color,
  isDark,
}: {
  icon: string;
  value: string;
  label: string;
  color?: 'green' | 'red';
  isDark: boolean;
}) {
  const iconColor = color === 'green' ? '#22c55e' :
                    color === 'red' ? '#ef4444' :
                    isDark ? '#808fb0' : '#607296';

  return (
    <View className="flex-row items-center mr-4">
      <Ionicons name={icon as any} size={14} color={iconColor} />
      <Text className={`ml-1 font-semibold ${isDark ? 'text-graphite-200' : 'text-graphite-800'}`}>
        {value}
      </Text>
      <Text className={`ml-1 text-xs ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
        {label}
      </Text>
    </View>
  );
}

function EmptyState({ isDark }: { isDark: boolean }) {
  return (
    <View className="items-center py-8">
      <View className={`w-16 h-16 rounded-full items-center justify-center mb-4 ${
        isDark ? 'bg-graphite-700' : 'bg-graphite-100'
      }`}>
        <Ionicons name="barbell-outline" size={32} color={isDark ? '#808fb0' : '#607296'} />
      </View>
      <Text className={`text-center font-semibold ${isDark ? 'text-graphite-300' : 'text-graphite-700'}`}>
        No exercise data yet
      </Text>
      <Text className={`text-center text-sm mt-1 ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
        Log your exercises to see progression suggestions
      </Text>
    </View>
  );
}

function calculateStats(suggestions: NextTimeSuggestion[]): {
  progressing: number;
  stable: number;
  regressing: number;
} {
  return suggestions.reduce(
    (acc, s) => {
      if (s.trend === 'progressing') acc.progressing++;
      else if (s.trend === 'regressing') acc.regressing++;
      else acc.stable++;
      return acc;
    },
    { progressing: 0, stable: 0, regressing: 0 }
  );
}

/**
 * Modal wrapper for NextTimeSummary
 */
export function NextTimeSummaryModal({
  visible,
  suggestions,
  workoutFocus,
  onDismiss,
}: {
  visible: boolean;
  suggestions: NextTimeSuggestion[];
  workoutFocus?: string;
  onDismiss: () => void;
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  if (!visible) return null;

  return (
    <View
      className={`absolute inset-0 ${isDark ? 'bg-graphite-900' : 'bg-white'}`}
      style={{ zIndex: 100 }}
    >
      <NextTimeSummary
        suggestions={suggestions}
        workoutFocus={workoutFocus}
        onDismiss={onDismiss}
        mode="list"
      />
    </View>
  );
}
