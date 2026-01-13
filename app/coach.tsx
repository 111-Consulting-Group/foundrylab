/**
 * Coach Screen
 *
 * Full-screen AI coach chat interface.
 * Accessible from the home screen FAB or navigation.
 */

import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoachChat } from '@/components/CoachChat';
import { Colors } from '@/constants/Colors';
import type { ConversationContextType } from '@/types/database';

export default function CoachScreen() {
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
    <View style={{ flex: 1, backgroundColor: Colors.void[900] }}>
      {/* Ambient Background Glows */}
      <View style={{ position: 'absolute', top: -100, right: -80, width: 300, height: 300, backgroundColor: 'rgba(37, 99, 235, 0.06)', borderRadius: 150 }} />
      <View style={{ position: 'absolute', bottom: 100, left: -100, width: 280, height: 280, backgroundColor: 'rgba(37, 99, 235, 0.04)', borderRadius: 140 }} />

      <SafeAreaView style={{ flex: 1 }} edges={['left', 'right', 'bottom']}>
        <CoachChat
          contextType={params.contextType}
          workoutId={params.workoutId}
          blockId={params.blockId}
          onClose={handleClose}
        />
      </SafeAreaView>
    </View>
  );
}
