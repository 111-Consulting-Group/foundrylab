import React from 'react';
import { View, Text } from 'react-native';
import { Colors } from '@/constants/Colors';

interface DeltaTagProps {
  value: number;
  unit?: string;
  type?: 'weight' | 'reps' | 'sets' | 'rpe' | 'volume';
  className?: string;
}

export function DeltaTag({ value, unit, type = 'weight', className = '' }: DeltaTagProps) {
  if (value === 0) return null;

  const isPositive = value > 0;

  // For RPE, lower is usually "better" efficiency if load is same, but usually we track load/reps.
  // Standard logic: More is better for Weight, Reps, Sets, Volume.
  const isProgress = isPositive;

  const sign = isPositive ? '+' : '';

  return (
    <View
      style={{
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        backgroundColor: isProgress ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: '700',
          fontFamily: 'monospace',
          color: isProgress ? '#22c55e' : '#ef4444',
        }}
      >
        {sign}{value} {unit}
      </Text>
    </View>
  );
}
