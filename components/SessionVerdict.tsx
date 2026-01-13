import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { useColorScheme } from '@/components/useColorScheme';
import { LabCard, StatusIndicator } from '@/components/ui/LabPrimitives';
import { evaluateSession, getSessionQualityInfo } from '@/lib/sessionQuality';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { WorkoutWithSets } from '@/types/database';

interface SessionVerdictProps {
  workout: WorkoutWithSets;
}

export function SessionVerdict({ workout }: SessionVerdictProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const sessionQuality = useMemo(() => evaluateSession(workout), [workout]);
  
  // Check if workout is part of a structured block
  const isStructured = !!workout.block_id || !!workout.week_number || !!workout.day_number;
  
  // Count previous completed workouts in this block to determine baseline status
  const { data: previousWorkoutsCount = 0 } = useQuery({
    queryKey: ['baselineCheck', workout.block_id, workout.id],
    queryFn: async () => {
      if (!workout.block_id) return 0;
      
      const { count, error } = await supabase
        .from('workouts')
        .select('*', { count: 'exact', head: true })
        .eq('block_id', workout.block_id)
        .not('date_completed', 'is', null)
        .lt('date_completed', workout.date_completed || new Date().toISOString());
      
      if (error) return 0;
      return count || 0;
    },
    enabled: !!workout.block_id && !!workout.date_completed,
  });
  
  // We need at least 3-4 previous sessions to establish a meaningful baseline
  const isEstablishingBaseline = isStructured && previousWorkoutsCount < 3;
  
  // Sophisticated baseline messaging
  const baselineMessages = [
    'Calibrating performance baseline. Building training signature from initial data points.',
    'Mapping performance landscape. Constructing baseline metrics for progression analysis.',
    'Initializing training intelligence. Collecting foundational data for adaptive programming.',
  ];
  
  const baselineMessage = baselineMessages[previousWorkoutsCount % baselineMessages.length];
  
  // Map internal quality to UI Verdict
  const verdictConfig = {
    productive: {
      title: 'Progressed',
      status: 'progress' as const,
      color: 'text-progress-500',
      description: 'Overload achieved. Training targets met.',
    },
    maintaining: {
      title: isEstablishingBaseline ? 'Calibrating' : 'Maintained',
      status: 'maintenance' as const,
      color: isEstablishingBaseline ? 'text-signal-500' : 'text-oxide-500',
      description: isEstablishingBaseline 
        ? baselineMessage
        : 'Stimulus matched. Volume consistent.',
    },
    suboptimal: {
      title: 'Regressed',
      status: 'regression' as const,
      color: 'text-regression-500',
      description: 'Performance dip detected. Check recovery.',
    },
    junk: {
      title: isEstablishingBaseline ? 'Calibrating' : 'Unstructured',
      status: 'neutral' as const,
      color: isEstablishingBaseline ? 'text-signal-500' : 'text-graphite-400',
      description: isEstablishingBaseline 
        ? baselineMessage
        : 'Session logged without clear progression.',
    },
    recovery: {
      title: 'Recovery',
      status: 'neutral' as const,
      color: 'text-signal-500',
      description: 'Planned deload. Recovery priority.',
    },
  };

  const config = verdictConfig[sessionQuality];

  // Determine border color based on verdict
  const borderColor = isEstablishingBaseline 
    ? '#2F80ED' // signal-500 for baseline
    : sessionQuality === 'productive' 
      ? '#22c55e' // progress-500
      : sessionQuality === 'suboptimal' 
        ? '#ef4444' // regression-500
        : sessionQuality === 'maintaining' 
          ? '#F2994A' // oxide-500
          : '#808fb0'; // graphite-500

  return (
    <LabCard className="mb-6 border-l-4" style={{ borderLeftColor: borderColor }}>
      <View className="flex-row items-center justify-between mb-1">
        <View className="flex-row items-center gap-2">
          <StatusIndicator status={config.status} />
          <Text className={`text-lg font-bold uppercase tracking-wide ${config.color}`}>
            {config.title}
          </Text>
        </View>
        <Text className="text-xs font-lab-mono text-graphite-400" style={{ color: '#6B7485' }}>
          VERDICT
        </Text>
      </View>
      <Text className="text-sm text-graphite-300 leading-5" style={{ color: '#C4C8D0' }}>
        {config.description}
      </Text>
      {isEstablishingBaseline && previousWorkoutsCount > 0 && (
        <Text className="text-xs mt-2 text-graphite-400 italic" style={{ color: '#6B7485' }}>
          {previousWorkoutsCount + 1} of 3+ sessions logged
        </Text>
      )}
    </LabCard>
  );
}
