/**
 * Feed Badges Components
 *
 * Reusable badge components for the social feed:
 * - KeyLiftBadge: Highlights top exercises with trend
 * - StreakBadge: Shows training streak
 * - TrendBadge: Shows progression/stagnation/regression
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, Text } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import type { PerformanceTrend } from '@/types/database';

/**
 * Streak Badge - Shows training streak with fire icon
 */
interface StreakBadgeProps {
  streak: number;
  size?: 'sm' | 'md';
}

export function StreakBadge({ streak, size = 'sm' }: StreakBadgeProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  if (streak < 2) return null;

  const isHot = streak >= 7;
  const isOnFire = streak >= 14;

  const iconColor = isOnFire ? '#EF4444' : isHot ? '#F59E0B' : '#808fb0';
  const textColor = isOnFire ? '#EF4444' : isHot ? '#F59E0B' : isDark ? '#808fb0' : '#607296';
  const bgColor = isOnFire
    ? 'rgba(239, 68, 68, 0.15)'
    : isHot
    ? 'rgba(245, 158, 11, 0.15)'
    : isDark
    ? 'rgba(128, 143, 176, 0.1)'
    : 'rgba(128, 143, 176, 0.1)';

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5' : 'px-3 py-1';
  const iconSize = size === 'sm' ? 12 : 14;
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <View
      className={`flex-row items-center rounded-full ${sizeClasses}`}
      style={{ backgroundColor: bgColor }}
    >
      <Ionicons name={isOnFire ? 'flame' : 'flame-outline'} size={iconSize} color={iconColor} />
      <Text className={`ml-1 font-semibold ${textSize}`} style={{ color: textColor }}>
        {streak}
      </Text>
    </View>
  );
}

/**
 * Trend Badge - Shows progression trend with icon and label
 */
interface TrendBadgeProps {
  trend: PerformanceTrend;
  compact?: boolean;
}

const TREND_CONFIG: Record<PerformanceTrend, {
  icon: string;
  label: string;
  color: string;
  bgLight: string;
  bgDark: string;
}> = {
  progressing: {
    icon: 'trending-up',
    label: 'Progressing',
    color: '#22C55E',
    bgLight: 'rgba(34, 197, 94, 0.1)',
    bgDark: 'rgba(34, 197, 94, 0.15)',
  },
  stagnant: {
    icon: 'remove',
    label: 'Stable',
    color: '#808fb0',
    bgLight: 'rgba(128, 143, 176, 0.1)',
    bgDark: 'rgba(128, 143, 176, 0.15)',
  },
  regressing: {
    icon: 'trending-down',
    label: 'Regressing',
    color: '#EF4444',
    bgLight: 'rgba(239, 68, 68, 0.1)',
    bgDark: 'rgba(239, 68, 68, 0.15)',
  },
};

export function TrendBadge({ trend, compact = false }: TrendBadgeProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const config = TREND_CONFIG[trend];

  if (compact) {
    return (
      <View className="flex-row items-center">
        <Ionicons name={config.icon as any} size={14} color={config.color} />
      </View>
    );
  }

  return (
    <View
      className="flex-row items-center px-2 py-0.5 rounded-full"
      style={{ backgroundColor: isDark ? config.bgDark : config.bgLight }}
    >
      <Ionicons name={config.icon as any} size={12} color={config.color} />
      <Text className="ml-1 text-xs font-medium" style={{ color: config.color }}>
        {config.label}
      </Text>
    </View>
  );
}

/**
 * Key Lift Badge - Highlights a top exercise with its progression
 */
interface KeyLiftBadgeProps {
  exerciseName: string;
  weight: number;
  reps: number;
  isPR?: boolean;
  delta?: string; // "+10 lbs", "+2 reps"
  trend?: PerformanceTrend;
}

export function KeyLiftBadge({
  exerciseName,
  weight,
  reps,
  isPR,
  delta,
  trend,
}: KeyLiftBadgeProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View
      className={`flex-row items-center justify-between py-2 px-3 rounded-xl mb-2 ${
        isDark ? 'bg-graphite-700/50' : 'bg-graphite-100'
      }`}
    >
      <View className="flex-1">
        <View className="flex-row items-center">
          {isPR && (
            <View className="mr-2 px-1.5 py-0.5 rounded bg-signal-500/20">
              <Ionicons name="trophy" size={10} color="#2F80ED" />
            </View>
          )}
          <Text
            className={`font-semibold ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}
            numberOfLines={1}
          >
            {exerciseName}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center">
        <Text className={`font-bold mr-2 ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
          {weight} × {reps}
        </Text>

        {delta && (
          <View
            className="px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: delta.startsWith('+')
                ? 'rgba(34, 197, 94, 0.15)'
                : delta.startsWith('-')
                ? 'rgba(239, 68, 68, 0.15)'
                : 'rgba(128, 143, 176, 0.15)',
            }}
          >
            <Text
              className="text-xs font-semibold"
              style={{
                color: delta.startsWith('+')
                  ? '#22C55E'
                  : delta.startsWith('-')
                  ? '#EF4444'
                  : '#808fb0',
              }}
            >
              {delta}
            </Text>
          </View>
        )}

        {!delta && trend && <TrendBadge trend={trend} compact />}
      </View>
    </View>
  );
}

/**
 * Adherence Badge - Shows weekly training adherence
 */
interface AdherenceBadgeProps {
  percent: number;
  size?: 'sm' | 'md';
}

export function AdherenceBadge({ percent, size = 'sm' }: AdherenceBadgeProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  if (percent < 50) return null;

  const color = percent >= 100 ? '#22C55E' : percent >= 75 ? '#2F80ED' : '#808fb0';
  const bgColor =
    percent >= 100
      ? 'rgba(34, 197, 94, 0.1)'
      : percent >= 75
      ? 'rgba(47, 128, 237, 0.1)'
      : isDark
      ? 'rgba(128, 143, 176, 0.1)'
      : 'rgba(128, 143, 176, 0.1)';

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5' : 'px-3 py-1';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <View className={`rounded-full ${sizeClasses}`} style={{ backgroundColor: bgColor }}>
      <Text className={`font-medium ${textSize}`} style={{ color }}>
        {percent}%
      </Text>
    </View>
  );
}

/**
 * PR Count Badge - Shows number of PRs in a workout
 */
interface PRCountBadgeProps {
  count: number;
  size?: 'sm' | 'md';
}

export function PRCountBadge({ count, size = 'sm' }: PRCountBadgeProps) {
  if (count <= 0) return null;

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5' : 'px-3 py-1';
  const iconSize = size === 'sm' ? 12 : 14;
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <View
      className={`flex-row items-center rounded-full ${sizeClasses}`}
      style={{ backgroundColor: 'rgba(47, 128, 237, 0.15)' }}
    >
      <Ionicons name="trophy" size={iconSize} color="#2F80ED" />
      <Text className={`ml-1 font-semibold text-signal-500 ${textSize}`}>
        {count} PR{count > 1 ? 's' : ''}
      </Text>
    </View>
  );
}

/**
 * Block Context Badge - Shows training block and phase
 */
interface BlockContextBadgeProps {
  blockName?: string;
  weekNumber?: number;
  context?: string;
}

export function BlockContextBadge({ blockName, weekNumber, context }: BlockContextBadgeProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  if (!blockName && !weekNumber && !context) return null;

  const contextColors: Record<string, { text: string; bg: string }> = {
    building: { text: '#22C55E', bg: 'rgba(34, 197, 94, 0.1)' },
    testing: { text: '#F59E0B', bg: 'rgba(245, 158, 11, 0.1)' },
    deload: { text: '#9B59B6', bg: 'rgba(155, 89, 182, 0.1)' },
    peaking: { text: '#EF4444', bg: 'rgba(239, 68, 68, 0.1)' },
  };

  const colors = contextColors[context || 'building'] || contextColors.building;

  let label = '';
  if (blockName && weekNumber) {
    label = `Week ${weekNumber} of ${blockName}`;
  } else if (blockName) {
    label = blockName;
  } else if (weekNumber) {
    label = `Week ${weekNumber}`;
  } else if (context) {
    label = context.charAt(0).toUpperCase() + context.slice(1);
  }

  return (
    <View className="flex-row items-center px-2 py-0.5 rounded-full" style={{ backgroundColor: colors.bg }}>
      <Text className="text-xs font-medium" style={{ color: colors.text }}>
        {label}
      </Text>
    </View>
  );
}
