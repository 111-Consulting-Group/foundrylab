/**
 * Block Builder Screen
 *
 * AI-powered training block generator using local periodization templates.
 * Guides users through goal selection, configuration, and preview.
 * Accepts optional params from annual plan recommendations.
 */

import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BlockBuilder } from '@/components/BlockBuilder';
import { useColorScheme } from '@/components/useColorScheme';
import type { BlockType, TrainingGoal } from '@/types/database';

// Map block types to training goals for pre-selection
const BLOCK_TYPE_TO_GOAL: Partial<Record<BlockType, TrainingGoal>> = {
  accumulation: 'strength',
  intensification: 'strength',
  realization: 'strength',
  peaking: 'powerlifting',
  hypertrophy: 'hypertrophy',
  strength: 'strength',
  power: 'athletic',
  base_building: 'general',
};

export default function BlockBuilderScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Get optional params from annual plan recommendations
  const params = useLocalSearchParams<{
    blockType?: BlockType;
    duration?: string;
    goal?: TrainingGoal;
  }>();

  // Pre-fill config from params if provided
  const initialConfig = useMemo(() => {
    const config: {
      goal?: TrainingGoal;
      durationWeeks?: number;
    } = {};

    // Set goal from param or infer from block type
    if (params.goal) {
      config.goal = params.goal;
    } else if (params.blockType && BLOCK_TYPE_TO_GOAL[params.blockType]) {
      config.goal = BLOCK_TYPE_TO_GOAL[params.blockType];
    }

    // Set duration from param
    if (params.duration) {
      config.durationWeeks = parseInt(params.duration, 10);
    }

    return Object.keys(config).length > 0 ? config : undefined;
  }, [params]);

  const handleComplete = useCallback((blockId: string) => {
    // Navigate to the program screen to see the new block
    router.replace('/(tabs)/program');
  }, []);

  const handleCancel = useCallback(() => {
    router.back();
  }, []);

  return (
    <SafeAreaView
      className={`flex-1 ${isDark ? 'bg-carbon-950' : 'bg-graphite-50'}`}
      edges={['left', 'right', 'bottom']}
    >
      <BlockBuilder
        onComplete={handleComplete}
        onCancel={handleCancel}
        initialConfig={initialConfig}
      />
    </SafeAreaView>
  );
}
