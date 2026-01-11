/**
 * Block Builder Screen
 *
 * AI-powered training block generator using local periodization templates.
 * Guides users through goal selection, configuration, and preview.
 */

import { router } from 'expo-router';
import { useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BlockBuilder } from '@/components/BlockBuilder';
import { useColorScheme } from '@/components/useColorScheme';

export default function BlockBuilderScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

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
      <BlockBuilder onComplete={handleComplete} onCancel={handleCancel} />
    </SafeAreaView>
  );
}
