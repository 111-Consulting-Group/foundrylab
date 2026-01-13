/**
 * ConfidenceBadge Component
 *
 * Displays the confidence level of a suggestion with appropriate styling.
 * Part of the Training Intelligence system.
 */

import React from 'react';
import { View, Text } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import type { ConfidenceLevel } from '@/types/database';

interface ConfidenceBadgeProps {
  level: ConfidenceLevel;
  exposureCount?: number;
  showTooltip?: boolean;
  size?: 'sm' | 'md';
}

const CONFIG: Record<ConfidenceLevel, {
  bgLight: string;
  bgDark: string;
  textLight: string;
  textDark: string;
  label: string;
}> = {
  low: {
    bgLight: 'bg-graphite-100',
    bgDark: 'bg-graphite-700',
    textLight: 'text-graphite-600',
    textDark: 'text-graphite-300',
    label: 'Low Confidence',
  },
  medium: {
    bgLight: 'bg-yellow-100',
    bgDark: 'bg-yellow-900/30',
    textLight: 'text-yellow-700',
    textDark: 'text-yellow-400',
    label: 'Suggested',
  },
  high: {
    bgLight: 'bg-green-100',
    bgDark: 'bg-green-900/30',
    textLight: 'text-green-700',
    textDark: 'text-green-400',
    label: 'Recommended',
  },
};

export function ConfidenceBadge({
  level,
  exposureCount,
  size = 'sm'
}: ConfidenceBadgeProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const config = CONFIG[level];

  const sizeClasses = size === 'sm'
    ? 'px-2 py-0.5'
    : 'px-3 py-1';

  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <View
      className={`rounded-full ${sizeClasses} ${isDark ? config.bgDark : config.bgLight}`}
    >
      <Text
        className={`${textSize} font-medium ${isDark ? config.textDark : config.textLight}`}
      >
        {config.label}
        {exposureCount !== undefined && level === 'low' && (
          <Text className="opacity-70">
            {' '}({exposureCount} session{exposureCount !== 1 ? 's' : ''})
          </Text>
        )}
      </Text>
    </View>
  );
}

/**
 * Inline confidence indicator for compact displays
 */
export function ConfidenceIndicator({ level }: { level: ConfidenceLevel }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const colors: Record<ConfidenceLevel, string> = {
    low: isDark ? 'bg-graphite-500' : 'bg-graphite-400',
    medium: 'bg-yellow-500',
    high: 'bg-green-500',
  };

  return (
    <View className={`w-2 h-2 rounded-full ${colors[level]}`} />
  );
}
