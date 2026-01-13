/**
 * MovementMemoryCard Component
 *
 * Displays the "memory" of an exercise - last performance, trend, and suggestion.
 * Core UI element for the "Every movement has memory" principle.
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, Text, Pressable } from 'react-native';

import { ConfidenceBadge, ConfidenceIndicator } from '@/components/ConfidenceBadge';
import { useColorScheme } from '@/components/useColorScheme';
import type { MovementMemoryData } from '@/hooks/useMovementMemory';
import type { NextTimeSuggestion } from '@/types/database';

interface MovementMemoryCardProps {
  memory: MovementMemoryData;
  suggestion?: NextTimeSuggestion | null;
  compact?: boolean;
  onApplySuggestion?: (weight: number, reps: number) => void;
}

export function MovementMemoryCard({
  memory,
  suggestion,
  compact = false,
  onApplySuggestion,
}: MovementMemoryCardProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  if (compact) {
    return (
      <CompactMemoryCard memory={memory} suggestion={suggestion} onApplySuggestion={onApplySuggestion} />
    );
  }

  const trendIcon = memory.trend === 'progressing'
    ? 'trending-up'
    : memory.trend === 'regressing'
    ? 'trending-down'
    : 'remove';

  const trendColor = memory.trend === 'progressing'
    ? '#22c55e'
    : memory.trend === 'regressing'
    ? '#ef4444'
    : isDark ? '#808fb0' : '#607296';

  return (
    <View
      className={`rounded-xl border ${
        isDark ? 'bg-graphite-800 border-graphite-700' : 'bg-white border-graphite-200'
      }`}
    >
      {/* Last Performance Section */}
      <View className="p-4 border-b border-graphite-200 dark:border-graphite-700">
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center">
            <Ionicons name="time-outline" size={14} color="#2F80ED" />
            <Text className="text-xs font-semibold ml-1 text-signal-500">
              Last time
            </Text>
            {memory.lastDateRelative && (
              <Text className={`text-xs ml-2 ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                {memory.lastDateRelative}
              </Text>
            )}
          </View>
          <View className="flex-row items-center">
            <Ionicons name={trendIcon} size={16} color={trendColor} />
            <Text className={`text-xs ml-1 ${memory.trendColor}`}>
              {memory.trendLabel}
            </Text>
          </View>
        </View>

        <Text className={`text-lg font-bold ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
          {memory.displayText}
        </Text>

        {/* Stats Row */}
        <View className="flex-row mt-2 gap-4">
          <View>
            <Text className={`text-xs ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
              Sessions
            </Text>
            <Text className={`text-sm font-semibold ${isDark ? 'text-graphite-200' : 'text-graphite-700'}`}>
              {memory.exposureCount}
            </Text>
          </View>
          {memory.prE1RM && (
            <View>
              <Text className={`text-xs ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                E1RM PR
              </Text>
              <Text className={`text-sm font-semibold ${isDark ? 'text-graphite-200' : 'text-graphite-700'}`}>
                {Math.round(memory.prE1RM)} lbs
              </Text>
            </View>
          )}
          {memory.typicalRepRange && (
            <View>
              <Text className={`text-xs ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                Rep Range
              </Text>
              <Text className={`text-sm font-semibold ${isDark ? 'text-graphite-200' : 'text-graphite-700'}`}>
                {memory.typicalRepRange.min}-{memory.typicalRepRange.max}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Suggestion Section */}
      {suggestion && (
        <View className="p-4">
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center">
              <Ionicons name="bulb-outline" size={14} color={isDark ? '#fbbf24' : '#d97706'} />
              <Text className={`text-xs font-semibold ml-1 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>
                Next time
              </Text>
            </View>
            <ConfidenceBadge level={suggestion.confidence} exposureCount={suggestion.exposure_count} />
          </View>

          <View className="flex-row items-center justify-between">
            <View>
              <Text className={`text-lg font-bold ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
                {suggestion.recommendation.weight} lbs x {suggestion.recommendation.reps}
              </Text>
              <Text className={`text-xs mt-1 ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                {suggestion.reasoning}
              </Text>
            </View>

            {onApplySuggestion && (
              <Pressable
                onPress={() => onApplySuggestion(
                  suggestion.recommendation.weight,
                  suggestion.recommendation.reps
                )}
                className="px-3 py-2 rounded-lg bg-signal-500/20"
              >
                <Text className="text-signal-500 font-semibold text-sm">
                  Apply
                </Text>
              </Pressable>
            )}
          </View>

          {/* Alerts */}
          {suggestion.alerts && suggestion.alerts.length > 0 && (
            <View className="mt-3">
              {suggestion.alerts.map((alert, index) => (
                <View
                  key={index}
                  className={`flex-row items-start p-2 rounded-lg mt-1 ${
                    alert.type === 'regression' || alert.type === 'missed_session'
                      ? isDark ? 'bg-oxide-500/10' : 'bg-oxide-500/5'
                      : isDark ? 'bg-yellow-500/10' : 'bg-yellow-500/5'
                  }`}
                >
                  <Ionicons
                    name={alert.type === 'regression' ? 'warning' : 'information-circle'}
                    size={14}
                    color={alert.type === 'regression' ? '#ef4444' : '#f59e0b'}
                    style={{ marginTop: 2 }}
                  />
                  <View className="ml-2 flex-1">
                    <Text className={`text-xs font-medium ${
                      alert.type === 'regression' ? 'text-oxide-500' : 'text-yellow-600'
                    }`}>
                      {alert.message}
                    </Text>
                    <Text className={`text-xs ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                      {alert.suggested_action}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

/**
 * Compact version for inline display in set entry
 */
function CompactMemoryCard({
  memory,
  suggestion,
  onApplySuggestion,
}: {
  memory: MovementMemoryData;
  suggestion?: NextTimeSuggestion | null;
  onApplySuggestion?: (weight: number, reps: number) => void;
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View
      className={`p-3 rounded-xl ${
        isDark ? 'bg-signal-500/10' : 'bg-signal-500/5'
      } border ${isDark ? 'border-signal-500/30' : 'border-signal-500/20'}`}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <View className="flex-row items-center mb-1">
            <Ionicons name="time-outline" size={12} color="#2F80ED" />
            <Text className="text-xs font-semibold ml-1 text-signal-500">
              Last: {memory.displayText}
            </Text>
            {memory.lastDateRelative && (
              <Text className={`text-xs ml-1 ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                ({memory.lastDateRelative})
              </Text>
            )}
          </View>

          {suggestion && (
            <View className="flex-row items-center">
              <ConfidenceIndicator level={suggestion.confidence} />
              <Text className={`text-xs ml-1.5 ${isDark ? 'text-graphite-300' : 'text-graphite-600'}`}>
                Try: {suggestion.recommendation.weight} x {suggestion.recommendation.reps}
              </Text>
              {suggestion.confidence === 'low' && (
                <Text className={`text-xs ml-1 ${isDark ? 'text-graphite-500' : 'text-graphite-400'}`}>
                  (limited data)
                </Text>
              )}
            </View>
          )}
        </View>

        {onApplySuggestion && suggestion && (
          <Pressable
            onPress={() => onApplySuggestion(
              suggestion.recommendation.weight,
              suggestion.recommendation.reps
            )}
            className="p-2"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-forward-circle" size={24} color="#2F80ED" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

/**
 * Empty state when no memory exists
 */
export function EmptyMemoryCard() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View
      className={`p-3 rounded-xl ${
        isDark ? 'bg-graphite-800' : 'bg-graphite-50'
      } border ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}
    >
      <View className="flex-row items-center">
        <Ionicons name="add-circle-outline" size={16} color={isDark ? '#808fb0' : '#607296'} />
        <Text className={`text-sm ml-2 ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
          First time logging this exercise
        </Text>
      </View>
    </View>
  );
}
