/**
 * Pattern Insights Component
 *
 * Displays detected training patterns and insights.
 * Part of the Training Intelligence pattern detection system.
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, Text, Pressable } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import { ConfidenceIndicator } from '@/components/ConfidenceBadge';
import type { DetectedPattern } from '@/lib/patternDetection';
import type { ConfidenceLevel } from '@/types/database';

/**
 * Convert numeric confidence to level
 */
function confidenceToLevel(confidence: number): ConfidenceLevel {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.6) return 'medium';
  return 'low';
}

/**
 * Single pattern insight card
 */
interface PatternCardProps {
  pattern: DetectedPattern;
  onPress?: () => void;
  compact?: boolean;
}

export function PatternCard({ pattern, onPress, compact = false }: PatternCardProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const iconMap: Record<string, string> = {
    training_split: 'calendar-outline',
    exercise_pairing: 'link-outline',
    training_day: 'time-outline',
    rep_range_preference: 'repeat-outline',
  };

  const icon = iconMap[pattern.type] || 'analytics-outline';
  const confidenceLevel = confidenceToLevel(pattern.confidence);

  if (compact) {
    return (
      <View
        className="flex-row items-center p-3 rounded-xl bg-graphite-800"
        style={{ backgroundColor: '#1A1F2E' }}
      >
        <View
          className="w-8 h-8 rounded-full items-center justify-center mr-3 bg-graphite-700"
          style={{ backgroundColor: '#353D4B' }}
        >
          <Ionicons name={icon as any} size={16} color="#808fb0" />
        </View>
        <View className="flex-1">
          <Text
            className="font-medium text-graphite-200"
            style={{ color: '#D4D7DC' }}
            numberOfLines={1}
          >
            {pattern.name}
          </Text>
          <Text
            className="text-xs text-graphite-400"
            style={{ color: '#6B7485' }}
            numberOfLines={1}
          >
            {pattern.description}
          </Text>
        </View>
        <ConfidenceIndicator level={confidenceLevel} />
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      className="p-4 rounded-xl bg-graphite-800 border border-graphite-700"
      style={{ backgroundColor: '#1A1F2E', borderColor: '#353D4B' }}
    >
      <View className="flex-row items-start">
        <View
          className="w-10 h-10 rounded-full items-center justify-center mr-3 bg-graphite-700"
          style={{ backgroundColor: '#353D4B' }}
        >
          <Ionicons name={icon as any} size={20} color="#808fb0" />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center justify-between mb-1">
            <Text className="font-semibold text-graphite-100" style={{ color: '#E6E8EB' }}>
              {pattern.name}
            </Text>
            <View className="flex-row items-center">
              <ConfidenceIndicator level={confidenceLevel} />
              <Text
                className="text-xs ml-1 text-graphite-400"
                style={{ color: '#6B7485' }}
              >
                {Math.round(pattern.confidence * 100)}%
              </Text>
            </View>
          </View>
          <Text className="text-sm text-graphite-400" style={{ color: '#6B7485' }}>
            {pattern.description}
          </Text>

          {/* Additional pattern-specific data */}
          {pattern.type === 'training_split' && pattern.data.splits && (
            <View className="flex-row flex-wrap mt-2 gap-1">
              {(pattern.data.splits as string[]).map((split, index) => (
                <View
                  key={index}
                  className="px-2 py-0.5 rounded bg-graphite-700"
                  style={{ backgroundColor: '#353D4B' }}
                >
                  <Text className="text-xs text-graphite-300" style={{ color: '#C4C8D0' }}>
                    {split}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {pattern.type === 'training_day' && pattern.data.preferred_days && (
            <View className="flex-row flex-wrap mt-2 gap-1">
              {(pattern.data.preferred_days as string[]).map((day, index) => (
                <View
                  key={index}
                  className={`px-2 py-0.5 rounded ${isDark ? 'bg-graphite-700' : 'bg-graphite-100'}`}
                >
                  <Text className={`text-xs ${isDark ? 'text-graphite-300' : 'text-graphite-600'}`}>
                    {day}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

/**
 * Pattern insights list
 */
interface PatternInsightsListProps {
  patterns: DetectedPattern[];
  title?: string;
  maxItems?: number;
  compact?: boolean;
  onPatternPress?: (pattern: DetectedPattern) => void;
}

export function PatternInsightsList({
  patterns,
  title = 'Training Patterns',
  maxItems = 5,
  compact = false,
  onPatternPress,
}: PatternInsightsListProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const displayPatterns = patterns.slice(0, maxItems);

  if (displayPatterns.length === 0) {
    return (
      <View className="py-8 items-center">
        <Ionicons
          name="analytics-outline"
          size={48}
          color={isDark ? '#808fb0' : '#607296'}
        />
        <Text className="mt-4 text-center text-graphite-400" style={{ color: '#6B7485' }}>
          Keep training to discover your patterns
        </Text>
        <Text
          className="text-sm text-center mt-1 text-graphite-400"
          style={{ color: '#6B7485' }}
        >
          We need at least 4 workouts to detect patterns
        </Text>
      </View>
    );
  }

  return (
    <View>
      {title && (
        <Text
          className="text-lg font-bold mb-4 text-graphite-100"
          style={{ color: '#E6E8EB' }}
        >
          {title}
        </Text>
      )}
      <View className={compact ? 'gap-2' : 'gap-3'}>
        {displayPatterns.map((pattern, index) => (
          <PatternCard
            key={`${pattern.type}-${index}`}
            pattern={pattern}
            compact={compact}
            onPress={onPatternPress ? () => onPatternPress(pattern) : undefined}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * Training split summary card
 */
interface TrainingSplitSummaryProps {
  name: string;
  splits: string[];
  daysPerWeek: number;
  confidence: number;
  preferredDays?: string[];
}

export function TrainingSplitSummary({
  name,
  splits,
  daysPerWeek,
  confidence,
  preferredDays,
}: TrainingSplitSummaryProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View
      className="p-4 rounded-xl bg-graphite-800 border border-graphite-700"
      style={{ backgroundColor: '#1A1F2E', borderColor: '#353D4B' }}
    >
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <View className="w-10 h-10 rounded-full bg-signal-500/20 items-center justify-center mr-3">
            <Ionicons name="calendar" size={20} color="#2F80ED" />
          </View>
          <View>
            <Text className="font-semibold text-graphite-100" style={{ color: '#E6E8EB' }}>
              {name}
            </Text>
            <Text className="text-sm text-graphite-400" style={{ color: '#6B7485' }}>
              ~{daysPerWeek} days/week
            </Text>
          </View>
        </View>
        <View
          className={`px-2 py-1 rounded-full ${
            confidence >= 0.8
              ? 'bg-green-500/20'
              : confidence >= 0.6
              ? 'bg-yellow-500/20'
              : 'bg-graphite-500/20'
          }`}
        >
          <Text
            className={`text-xs font-medium ${
              confidence >= 0.8
                ? 'text-green-500'
                : confidence >= 0.6
                ? 'text-yellow-500'
                : 'text-graphite-400'
            }`}
            style={confidence < 0.6 ? { color: '#6B7485' } : undefined}
          >
            {Math.round(confidence * 100)}% confident
          </Text>
        </View>
      </View>

      {/* Split days */}
      <View className="flex-row flex-wrap gap-2 mb-3">
        {splits.map((split, index) => (
          <View
            key={index}
            className="px-3 py-1.5 rounded-lg bg-graphite-700"
            style={{ backgroundColor: '#353D4B' }}
          >
            <Text className="font-medium text-graphite-200" style={{ color: '#D4D7DC' }}>
              {split}
            </Text>
          </View>
        ))}
      </View>

      {/* Preferred days */}
      {preferredDays && preferredDays.length > 0 && (
        <View className="flex-row items-center">
          <Ionicons
            name="time-outline"
            size={14}
            color={isDark ? '#808fb0' : '#607296'}
            style={{ marginRight: 6 }}
          />
          <Text className="text-sm text-graphite-400" style={{ color: '#6B7485' }}>
            Usually on {preferredDays.join(', ')}
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * Offer to formalize pattern into training block
 */
interface StructureOfferProps {
  pattern: DetectedPattern;
  onAccept: () => void;
  onDismiss: () => void;
}

export function StructureOffer({ pattern, onAccept, onDismiss }: StructureOfferProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View
      className={`p-4 rounded-xl ${isDark ? 'bg-signal-500/10' : 'bg-signal-500/5'} border ${
        isDark ? 'border-signal-500/30' : 'border-signal-500/20'
      }`}
    >
      <View className="flex-row items-start mb-3">
        <View className="w-10 h-10 rounded-full bg-signal-500/20 items-center justify-center mr-3">
          <Ionicons name="sparkles" size={20} color="#2F80ED" />
        </View>
        <View className="flex-1">
          <Text className="font-semibold text-graphite-100" style={{ color: '#E6E8EB' }}>
            We noticed a pattern!
          </Text>
          <Text className="text-sm mt-1 text-graphite-400" style={{ color: '#6B7485' }}>
            You've been training consistently with a {pattern.name} split. Would you like to turn
            this into a structured training block?
          </Text>
        </View>
      </View>

      <View className="flex-row gap-3">
        <Pressable
          onPress={onDismiss}
          className="flex-1 py-3 rounded-xl items-center bg-graphite-800"
          style={{ backgroundColor: '#1A1F2E' }}
        >
          <Text className="font-medium text-graphite-300" style={{ color: '#C4C8D0' }}>
            Keep it Flexible
          </Text>
        </Pressable>
        <Pressable
          onPress={onAccept}
          className="flex-1 py-3 rounded-xl items-center bg-signal-500"
        >
          <Text className="font-medium text-white">Create Block</Text>
        </Pressable>
      </View>
    </View>
  );
}
