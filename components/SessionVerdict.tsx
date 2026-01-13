import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import { LabCard, StatusIndicator } from '@/components/ui/LabPrimitives';
import { evaluateSession, getSessionQualityInfo } from '@/lib/sessionQuality';
import type { WorkoutWithSets } from '@/types/database';

interface SessionVerdictProps {
  workout: WorkoutWithSets;
}

export function SessionVerdict({ workout }: SessionVerdictProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const sessionQuality = useMemo(() => evaluateSession(workout), [workout]);
  
  // Map internal quality to UI Verdict
  const verdictConfig = {
    productive: {
      title: 'Progressed',
      status: 'progress' as const,
      color: 'text-progress-500',
      description: 'Overload achieved. Training targets met.',
    },
    maintaining: {
      title: 'Maintained',
      status: 'maintenance' as const,
      color: 'text-oxide-500',
      description: 'Stimulus matched. Volume consistent.',
    },
    suboptimal: {
      title: 'Regressed',
      status: 'regression' as const,
      color: 'text-regression-500',
      description: 'Performance dip detected. Check recovery.',
    },
    junk: {
      title: 'Unstructured',
      status: 'neutral' as const,
      color: 'text-graphite-400',
      description: 'Session logged without clear progression.',
    },
    recovery: {
      title: 'Recovery',
      status: 'neutral' as const,
      color: 'text-signal-500',
      description: 'Planned deload. Recovery priority.',
    },
  };

  const config = verdictConfig[sessionQuality];

  return (
    <LabCard className="mb-6 border-l-4" style={{ borderLeftColor: sessionQuality === 'productive' ? '#22c55e' : sessionQuality === 'suboptimal' ? '#ef4444' : sessionQuality === 'maintaining' ? '#F2994A' : '#808fb0' }}>
      <View className="flex-row items-center justify-between mb-1">
        <View className="flex-row items-center gap-2">
          <StatusIndicator status={config.status} />
          <Text className={`text-lg font-bold uppercase tracking-wide ${config.color}`}>
            {config.title}
          </Text>
        </View>
        <Text className={`text-xs font-lab-mono ${isDark ? 'text-graphite-500' : 'text-graphite-400'}`}>
          VERDICT
        </Text>
      </View>
      <Text className={`text-sm ${isDark ? 'text-graphite-300' : 'text-graphite-600'}`}>
        {config.description}
      </Text>
    </LabCard>
  );
}
