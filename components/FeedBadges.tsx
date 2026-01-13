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

import { Colors } from '@/constants/Colors';
import type { PerformanceTrend } from '@/types/database';

/**
 * Streak Badge - Shows training streak with fire icon
 */
interface StreakBadgeProps {
  streak: number;
  size?: 'sm' | 'md';
}

export function StreakBadge({ streak, size = 'sm' }: StreakBadgeProps) {
  if (streak < 2) return null;

  const isHot = streak >= 7;
  const isOnFire = streak >= 14;

  const iconColor = isOnFire ? '#EF4444' : isHot ? '#F59E0B' : Colors.graphite[400];
  const textColor = isOnFire ? '#EF4444' : isHot ? '#F59E0B' : Colors.graphite[400];
  const bgColor = isOnFire
    ? 'rgba(239, 68, 68, 0.15)'
    : isHot
    ? 'rgba(245, 158, 11, 0.15)'
    : 'rgba(255, 255, 255, 0.1)';

  const padding = size === 'sm' ? { paddingHorizontal: 8, paddingVertical: 2 } : { paddingHorizontal: 12, paddingVertical: 4 };
  const iconSize = size === 'sm' ? 12 : 14;
  const fontSize = size === 'sm' ? 12 : 14;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        ...padding,
        backgroundColor: bgColor,
      }}
    >
      <Ionicons name={isOnFire ? 'flame' : 'flame-outline'} size={iconSize} color={iconColor} />
      <Text style={{ marginLeft: 4, fontWeight: '600', fontSize, color: textColor }}>
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
  const config = TREND_CONFIG[trend];

  if (compact) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name={config.icon as any} size={14} color={config.color} />
      </View>
    );
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        backgroundColor: config.bgDark,
      }}
    >
      <Ionicons name={config.icon as any} size={12} color={config.color} />
      <Text style={{ marginLeft: 4, fontSize: 12, fontWeight: '500', color: config.color }}>
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
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 12,
        marginBottom: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
      }}
    >
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {isPR && (
            <View
              style={{
                marginRight: 8,
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 4,
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
              }}
            >
              <Ionicons name="trophy" size={10} color={Colors.signal[500]} />
            </View>
          )}
          <Text style={{ fontWeight: '600', color: Colors.graphite[100] }} numberOfLines={1}>
            {exerciseName}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ fontWeight: '700', marginRight: 8, color: Colors.graphite[100] }}>
          {weight} × {reps}
        </Text>

        {delta && (
          <View
            style={{
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 4,
              backgroundColor: delta.startsWith('+')
                ? 'rgba(34, 197, 94, 0.15)'
                : delta.startsWith('-')
                ? 'rgba(239, 68, 68, 0.15)'
                : 'rgba(255, 255, 255, 0.1)',
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: delta.startsWith('+')
                  ? '#22C55E'
                  : delta.startsWith('-')
                  ? '#EF4444'
                  : Colors.graphite[400],
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
  if (percent < 50) return null;

  const color = percent >= 100 ? '#22C55E' : percent >= 75 ? Colors.signal[500] : Colors.graphite[400];
  const bgColor =
    percent >= 100
      ? 'rgba(34, 197, 94, 0.1)'
      : percent >= 75
      ? 'rgba(59, 130, 246, 0.1)'
      : 'rgba(255, 255, 255, 0.1)';

  const padding = size === 'sm' ? { paddingHorizontal: 8, paddingVertical: 2 } : { paddingHorizontal: 12, paddingVertical: 4 };
  const fontSize = size === 'sm' ? 12 : 14;

  return (
    <View style={{ borderRadius: 12, ...padding, backgroundColor: bgColor }}>
      <Text style={{ fontWeight: '500', fontSize, color }}>{percent}%</Text>
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
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
        backgroundColor: colors.bg,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: '500', color: colors.text }}>{label}</Text>
    </View>
  );
}
