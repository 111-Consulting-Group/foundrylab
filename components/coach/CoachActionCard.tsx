/**
 * CoachActionCard
 * Modern action cards for coach suggestions
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';

import { Colors } from '@/constants/Colors';
import type { SuggestedAction } from '@/types/database';

interface CoachActionCardProps {
  action: SuggestedAction;
  onApply: () => void;
  onDismiss: () => void;
  isApplying?: boolean;
}

const ACTION_CONFIG: Record<string, { icon: string; color: string; bgColor: string }> = {
  adjust_workout: {
    icon: 'options-outline',
    color: Colors.signal[400],
    bgColor: Colors.glass.blue[10],
  },
  swap_exercise: {
    icon: 'swap-horizontal-outline',
    color: Colors.amber[400],
    bgColor: 'rgba(245, 158, 11, 0.1)',
  },
  schedule_deload: {
    icon: 'battery-charging-outline',
    color: Colors.emerald[400],
    bgColor: 'rgba(16, 185, 129, 0.1)',
  },
  update_targets: {
    icon: 'trending-up-outline',
    color: Colors.signal[400],
    bgColor: Colors.glass.blue[10],
  },
  add_disruption: {
    icon: 'alert-circle-outline',
    color: Colors.amber[400],
    bgColor: 'rgba(245, 158, 11, 0.1)',
  },
  set_goal: {
    icon: 'flag-outline',
    color: Colors.emerald[400],
    bgColor: 'rgba(16, 185, 129, 0.1)',
  },
  update_profile: {
    icon: 'person-outline',
    color: Colors.signal[400],
    bgColor: Colors.glass.blue[10],
  },
  replace_program: {
    icon: 'calendar-outline',
    color: Colors.signal[400],
    bgColor: Colors.glass.blue[10],
  },
};

export const CoachActionCard = React.memo(function CoachActionCard({
  action,
  onApply,
  onDismiss,
  isApplying = false,
}: CoachActionCardProps) {
  const config = ACTION_CONFIG[action.type] || {
    icon: 'flash-outline',
    color: Colors.signal[400],
    bgColor: Colors.glass.blue[10],
  };

  if (action.applied) {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 12,
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 1,
          borderColor: 'rgba(16, 185, 129, 0.2)',
          marginTop: 8,
        }}
      >
        <Ionicons name="checkmark-circle" size={16} color={Colors.emerald[400]} />
        <Text
          style={{
            marginLeft: 8,
            fontSize: 13,
            color: Colors.emerald[400],
            fontWeight: '500',
          }}
        >
          Applied
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        marginTop: 12,
        borderRadius: 16,
        backgroundColor: Colors.void[800],
        borderWidth: 1,
        borderColor: Colors.glass.white[10],
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 12,
          backgroundColor: config.bgColor,
          borderBottomWidth: 1,
          borderBottomColor: Colors.glass.white[5],
        }}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            backgroundColor: Colors.glass.white[10],
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons
            name={config.icon as keyof typeof Ionicons.glyphMap}
            size={14}
            color={config.color}
          />
        </View>
        <Text
          style={{
            marginLeft: 10,
            fontSize: 13,
            fontWeight: '600',
            color: Colors.graphite[100],
            flex: 1,
          }}
        >
          {action.label}
        </Text>
      </View>

      {/* Action Buttons */}
      <View
        style={{
          flexDirection: 'row',
          padding: 8,
        }}
      >
        <Pressable
          onPress={onDismiss}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 10,
            borderRadius: 10,
            backgroundColor: pressed ? Colors.glass.white[10] : Colors.glass.white[5],
            marginRight: 6,
          })}
        >
          <Text style={{ fontSize: 13, color: Colors.graphite[400], fontWeight: '500' }}>
            Not now
          </Text>
        </Pressable>

        <Pressable
          onPress={onApply}
          disabled={isApplying}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 10,
            borderRadius: 10,
            backgroundColor: pressed ? Colors.signal[600] : config.color,
            marginLeft: 6,
            opacity: isApplying ? 0.7 : 1,
          })}
        >
          {isApplying ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark" size={16} color="#fff" />
              <Text
                style={{
                  marginLeft: 6,
                  fontSize: 13,
                  color: '#fff',
                  fontWeight: '600',
                }}
              >
                Apply
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
});
