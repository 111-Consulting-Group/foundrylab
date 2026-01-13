/**
 * ConfidenceBadge Component
 *
 * Displays the confidence level of a suggestion with appropriate styling.
 * Part of the Training Intelligence system.
 */

import React from 'react';
import { View, Text } from 'react-native';

import { Colors } from '@/constants/Colors';
import type { ConfidenceLevel } from '@/types/database';

interface ConfidenceBadgeProps {
  level: ConfidenceLevel;
  exposureCount?: number;
  showTooltip?: boolean;
  size?: 'sm' | 'md';
}

const CONFIG: Record<ConfidenceLevel, {
  bg: string;
  text: string;
  label: string;
}> = {
  low: {
    bg: 'rgba(255, 255, 255, 0.1)',
    text: Colors.graphite[300],
    label: 'Low Confidence',
  },
  medium: {
    bg: 'rgba(245, 158, 11, 0.2)',
    text: '#fbbf24',
    label: 'Suggested',
  },
  high: {
    bg: 'rgba(34, 197, 94, 0.2)',
    text: '#22c55e',
    label: 'Recommended',
  },
};

export function ConfidenceBadge({
  level,
  exposureCount,
  size = 'sm'
}: ConfidenceBadgeProps) {
  const config = CONFIG[level];

  const padding = size === 'sm'
    ? { paddingHorizontal: 8, paddingVertical: 2 }
    : { paddingHorizontal: 12, paddingVertical: 4 };

  const fontSize = size === 'sm' ? 12 : 14;

  return (
    <View style={{ borderRadius: 12, backgroundColor: config.bg, ...padding }}>
      <Text style={{ fontSize, fontWeight: '500', color: config.text }}>
        {config.label}
        {exposureCount !== undefined && level === 'low' && (
          <Text style={{ opacity: 0.7 }}>
            {exposureCount !== 1
              ? ` (${exposureCount} sessions)`
              : ` (${exposureCount} session)`
            }
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
  const colors: Record<ConfidenceLevel, string> = {
    low: Colors.graphite[500],
    medium: '#fbbf24',
    high: '#22c55e',
  };

  return (
    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors[level] }} />
  );
}
