/**
 * Coach Screen
 *
 * Full-screen AI coach chat interface.
 * Modern copilot-style UI with mode awareness.
 */

import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { View } from 'react-native';

import { CoachCopilot } from '@/components/coach';
import { Colors } from '@/constants/Colors';
import type { ConversationContextType } from '@/types/database';
import type { CoachMode } from '@/types/coach';

export default function CoachScreen() {
  // Get optional params for context
  const params = useLocalSearchParams<{
    contextType?: ConversationContextType;
    workoutId?: string;
    blockId?: string;
    mode?: CoachMode;
  }>();

  const handleClose = useCallback(() => {
    router.back();
  }, []);

  // Generate initial message based on mode param
  const initialMessage = useMemo(() => {
    if (params.mode === 'weekly_planning') {
      return 'Plan my week';
    }
    return undefined;
  }, [params.mode]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.void[900] }}>
      {/* Ambient Background Glows */}
      <View pointerEvents="none" style={{ position: 'absolute', top: -100, right: -80, width: 300, height: 300, backgroundColor: 'rgba(37, 99, 235, 0.06)', borderRadius: 150 }} />
      <View pointerEvents="none" style={{ position: 'absolute', bottom: 100, left: -100, width: 280, height: 280, backgroundColor: 'rgba(37, 99, 235, 0.04)', borderRadius: 140 }} />

      <CoachCopilot
        contextType={params.contextType}
        workoutId={params.workoutId}
        blockId={params.blockId}
        initialMessage={initialMessage}
        onClose={handleClose}
      />
    </View>
  );
}
