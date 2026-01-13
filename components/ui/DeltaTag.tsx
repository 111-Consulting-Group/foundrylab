import React from 'react';
import { View, Text } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';

interface DeltaTagProps {
  value: number;
  unit?: string;
  type?: 'weight' | 'reps' | 'sets' | 'rpe' | 'volume';
  className?: string;
}

export function DeltaTag({ value, unit, type = 'weight', className = '' }: DeltaTagProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  if (value === 0) return null;

  const isPositive = value > 0;
  
  // For RPE, lower is usually "better" efficiency if load is same, but usually we track load/reps.
  // Standard logic: More is better for Weight, Reps, Sets, Volume.
  const isProgress = isPositive; 
  
  // Styles
  const bgStyle = isProgress 
    ? (isDark ? 'bg-progress-500/10' : 'bg-progress-500/10')
    : (isDark ? 'bg-regression-500/10' : 'bg-regression-500/10');
    
  const textStyle = isProgress
    ? 'text-progress-500'
    : 'text-regression-500';

  const sign = isPositive ? '+' : '';

  return (
    <View className={`px-1.5 py-0.5 rounded ${bgStyle} ${className}`}>
      <Text className={`text-xs font-lab-mono font-bold ${textStyle}`}>
        {sign}{value} {unit}
      </Text>
    </View>
  );
}
