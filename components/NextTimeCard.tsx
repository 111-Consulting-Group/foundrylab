/**
 * NextTimeCard Component
 *
 * Full "Next Time" card for post-workout summary.
 * Shows last performance, recommended progression, reasoning, and alerts.
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, Text, Pressable } from 'react-native';

import { ConfidenceBadge } from '@/components/ConfidenceBadge';
import { useColorScheme } from '@/components/useColorScheme';
import type { NextTimeSuggestion, PerformanceTrend } from '@/types/database';

interface NextTimeCardProps {
  suggestion: NextTimeSuggestion;
  onDismiss?: () => void;
}

export function NextTimeCard({ suggestion, onDismiss }: NextTimeCardProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const trendConfig = getTrendConfig(suggestion.trend, isDark);

  return (
    <View
      className="rounded-xl border overflow-hidden bg-graphite-800 border-graphite-700"
      style={{ backgroundColor: '#1A1F2E', borderColor: '#353D4B' }}
    >
      {/* Header */}
      <View className={`px-4 py-3 border-b ${isDark ? 'border-graphite-700' : 'border-graphite-100'}`}>
        <View className="flex-row items-center justify-between">
          <Text className="font-bold text-base text-graphite-100" style={{ color: '#E6E8EB' }}>
            {suggestion.exercise_name}
          </Text>
          <View className="flex-row items-center">
            <View className={`flex-row items-center px-2 py-1 rounded-full ${trendConfig.bg}`}>
              <Ionicons name={trendConfig.icon as any} size={12} color={trendConfig.iconColor} />
              <Text className={`text-xs ml-1 font-medium ${trendConfig.text}`}>
                {trendConfig.label}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Content */}
      <View className="p-4">
        {/* Last Performance Row */}
        <View className="flex-row items-center mb-3">
          <View 
            className="w-8 h-8 rounded-full items-center justify-center bg-graphite-700"
            style={{ backgroundColor: '#353D4B' }}
          >
            <Ionicons name="time-outline" size={16} color={isDark ? '#808fb0' : '#607296'} />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-xs text-graphite-400" style={{ color: '#6B7485' }}>
              Last time
            </Text>
            <Text className="font-semibold text-graphite-200" style={{ color: '#D4D7DC' }}>
              {formatPerformance(suggestion.last_performance)}
            </Text>
          </View>
        </View>

        {/* Suggestion Row */}
        <View className="flex-row items-center mb-3">
          <View className="w-8 h-8 rounded-full items-center justify-center bg-signal-500/20">
            <Ionicons name="arrow-forward" size={16} color="#2F80ED" />
          </View>
          <View className="ml-3 flex-1">
            <View className="flex-row items-center">
              <Text className="text-xs text-graphite-400" style={{ color: '#6B7485' }}>
                Next time
              </Text>
              <View className="ml-2">
                <ConfidenceBadge level={suggestion.confidence} exposureCount={suggestion.exposure_count} size="sm" />
              </View>
            </View>
            <Text className="font-bold text-lg text-graphite-100" style={{ color: '#E6E8EB' }}>
              {suggestion.recommendation.weight} lbs x {suggestion.recommendation.reps}
            </Text>
          </View>
        </View>

        {/* Reasoning */}
        <View 
          className="p-3 rounded-lg bg-graphite-700/50"
          style={{ backgroundColor: 'rgba(53, 61, 75, 0.5)' }}
        >
          <Text className="text-sm text-graphite-300" style={{ color: '#C4C8D0' }}>
            {suggestion.reasoning}
          </Text>
        </View>

        {/* Alerts */}
        {suggestion.alerts && suggestion.alerts.length > 0 && (
          <View className="mt-3">
            {suggestion.alerts.map((alert, index) => (
              <AlertBadge key={index} alert={alert} isDark={isDark} />
            ))}
          </View>
        )}

        {/* Stats Row */}
        <View className="flex-row mt-4 pt-3 border-t border-graphite-200 dark:border-graphite-700">
          <StatItem
            label="Sessions"
            value={suggestion.exposure_count.toString()}
            isDark={isDark}
          />
          {suggestion.pr_e1rm && (
            <StatItem
              label="E1RM PR"
              value={`${Math.round(suggestion.pr_e1rm)} lbs`}
              isDark={isDark}
            />
          )}
          {suggestion.last_performance.rpe && (
            <StatItem
              label="Last RPE"
              value={suggestion.last_performance.rpe.toString()}
              isDark={isDark}
            />
          )}
        </View>
      </View>
    </View>
  );
}

function StatItem({ label, value, isDark }: { label: string; value: string; isDark: boolean }) {
  return (
    <View className="flex-1">
      <Text className="text-xs text-graphite-400" style={{ color: '#6B7485' }}>
        {label}
      </Text>
      <Text className="font-semibold text-graphite-200" style={{ color: '#D4D7DC' }}>
        {value}
      </Text>
    </View>
  );
}

function AlertBadge({ alert, isDark }: { alert: NextTimeSuggestion['alerts'][0]; isDark: boolean }) {
  const isWarning = alert.type === 'regression' || alert.type === 'missed_session';

  return (
    <View
      className={`flex-row items-start p-2 rounded-lg mb-1 ${
        isWarning
          ? isDark ? 'bg-oxide-500/10' : 'bg-oxide-500/5'
          : isDark ? 'bg-yellow-500/10' : 'bg-yellow-500/5'
      }`}
    >
      <Ionicons
        name={isWarning ? 'warning' : 'information-circle'}
        size={14}
        color={isWarning ? '#ef4444' : '#f59e0b'}
        style={{ marginTop: 1 }}
      />
      <View className="ml-2 flex-1">
        <Text className={`text-xs font-medium ${isWarning ? 'text-oxide-500' : 'text-yellow-600'}`}>
          {alert.message}
        </Text>
        <Text className="text-xs text-graphite-400" style={{ color: '#6B7485' }}>
          {alert.suggested_action}
        </Text>
      </View>
    </View>
  );
}

function formatPerformance(perf: NextTimeSuggestion['last_performance']): string {
  const parts: string[] = [];

  if (perf.weight !== null) {
    if (perf.weight === 0) {
      parts.push('BW');
    } else {
      parts.push(`${perf.weight} lbs`);
    }
  }

  if (perf.reps !== null) {
    parts.push(`x ${perf.reps}`);
  }

  if (perf.rpe !== null) {
    parts.push(`@ RPE ${perf.rpe}`);
  }

  return parts.length > 0 ? parts.join(' ') : 'No data';
}

function getTrendConfig(trend: PerformanceTrend, isDark: boolean) {
  switch (trend) {
    case 'progressing':
      return {
        icon: 'trending-up',
        iconColor: '#22c55e',
        bg: isDark ? 'bg-green-900/30' : 'bg-green-100',
        text: isDark ? 'text-green-400' : 'text-green-700',
        label: 'Progressing',
      };
    case 'regressing':
      return {
        icon: 'trending-down',
        iconColor: '#ef4444',
        bg: isDark ? 'bg-red-900/30' : 'bg-red-100',
        text: isDark ? 'text-red-400' : 'text-red-700',
        label: 'Regressing',
      };
    default:
      return {
        icon: 'remove',
        iconColor: isDark ? '#808fb0' : '#607296',
        bg: 'bg-graphite-700',
        text: 'text-graphite-400',
        label: 'Stable',
      };
  }
}

/**
 * Compact list item version for summary lists
 */
export function NextTimeListItem({ suggestion }: { suggestion: NextTimeSuggestion }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const trendConfig = getTrendConfig(suggestion.trend, isDark);

  return (
    <View
      className={`flex-row items-center p-3 rounded-xl mb-2 ${
        'bg-graphite-800 border border-graphite-700'
      }
      style={{ backgroundColor: '#1A1F2E', borderColor: '#353D4B' }}
    >
      {/* Trend Indicator */}
      <View className={`w-8 h-8 rounded-full items-center justify-center ${trendConfig.bg}`}>
        <Ionicons name={trendConfig.icon as any} size={14} color={trendConfig.iconColor} />
      </View>

      {/* Exercise Info */}
      <View className="flex-1 ml-3">
        <Text className="font-semibold text-graphite-100" style={{ color: '#E6E8EB' }}>
          {suggestion.exercise_name}
        </Text>
        <Text className="text-xs text-graphite-400" style={{ color: '#6B7485' }}>
          {formatPerformance(suggestion.last_performance)}
        </Text>
      </View>

      {/* Suggestion */}
      <View className="items-end">
        <Text className={`font-bold ${isDark ? 'text-signal-400' : 'text-signal-500'}`}>
          {suggestion.recommendation.weight} x {suggestion.recommendation.reps}
        </Text>
        <View className="flex-row items-center mt-0.5">
          <View className={`w-1.5 h-1.5 rounded-full mr-1 ${
            suggestion.confidence === 'high' ? 'bg-green-500' :
            suggestion.confidence === 'medium' ? 'bg-yellow-500' : 'bg-gray-400'
          }`} />
          <Text className="text-xs text-graphite-400" style={{ color: '#6B7485' }}>
            {suggestion.confidence === 'high' ? 'Recommended' :
             suggestion.confidence === 'medium' ? 'Suggested' : 'Limited data'}
          </Text>
        </View>
      </View>
    </View>
  );
}
