/**
 * ModeIndicator
 * Subtle chip showing current coach mode with icon
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, Text, Pressable } from 'react-native';

import { Colors } from '@/constants/Colors';
import type { CoachMode } from '@/types/coach';

interface ModeIndicatorProps {
  mode: CoachMode;
  onPress?: () => void;
}

const MODE_CONFIG: Record<CoachMode, { icon: string; label: string; color: string }> = {
  intake: {
    icon: 'clipboard-outline',
    label: 'Getting to know you',
    color: Colors.signal[400],
  },
  reflect: {
    icon: 'bulb-outline',
    label: 'Reflecting',
    color: Colors.amber[400],
  },
  history: {
    icon: 'analytics-outline',
    label: 'Analyzing history',
    color: Colors.signal[400],
  },
  phase: {
    icon: 'compass-outline',
    label: 'Phase check',
    color: Colors.emerald[400],
  },
  weekly_planning: {
    icon: 'calendar-outline',
    label: 'Planning week',
    color: Colors.signal[400],
  },
  daily: {
    icon: 'today-outline',
    label: 'Today\'s plan',
    color: Colors.emerald[400],
  },
  post_workout: {
    icon: 'checkmark-circle-outline',
    label: 'Session review',
    color: Colors.emerald[400],
  },
  explain: {
    icon: 'help-circle-outline',
    label: 'Explaining',
    color: Colors.amber[400],
  },
  general: {
    icon: 'chatbubble-outline',
    label: 'Chat',
    color: Colors.graphite[400],
  },
};

export const ModeIndicator = React.memo(function ModeIndicator({
  mode,
  onPress,
}: ModeIndicatorProps) {
  const config = MODE_CONFIG[mode];

  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: Colors.glass.white[5],
        borderWidth: 1,
        borderColor: Colors.glass.white[10],
      }}
    >
      <Ionicons
        name={config.icon as keyof typeof Ionicons.glyphMap}
        size={12}
        color={config.color}
      />
      <Text
        style={{
          marginLeft: 6,
          fontSize: 11,
          fontWeight: '500',
          color: Colors.graphite[300],
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {config.label}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} hitSlop={8}>
        {content}
      </Pressable>
    );
  }

  return content;
});
