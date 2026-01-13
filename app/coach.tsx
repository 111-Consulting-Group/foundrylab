/**
 * Coach Screen
 *
 * Full-screen AI coach chat interface.
 * Accessible from the home screen FAB or navigation.
 */

import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoachChat } from '@/components/CoachChat';
import { useColorScheme } from '@/components/useColorScheme';
import type { ConversationContextType } from '@/types/database';

export default function CoachScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Get optional params for context
  const params = useLocalSearchParams<{
    contextType?: ConversationContextType;
    workoutId?: string;
    blockId?: string;
  }>();

  const handleClose = useCallback(() => {
    router.back();
  }, []);

  return (
    <SafeAreaView
      className="flex-1 bg-carbon-950"
      style={{ backgroundColor: '#0E1116' }}
      edges={['left', 'right', 'bottom']}
    >
      <CoachChat
        contextType={params.contextType}
        workoutId={params.workoutId}
        blockId={params.blockId}
        onClose={handleClose}
      />
    </SafeAreaView>
  );
}
