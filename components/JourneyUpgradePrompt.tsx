/**
 * Journey Upgrade Prompt
 *
 * Shows contextual prompts when a user's behavior suggests they might
 * benefit from a different journey mode. Non-intrusive, dismissible.
 */

import { Ionicons } from '@expo/vector-icons';
import { useState, useCallback } from 'react';
import { View, Text, Pressable, Animated, Platform } from 'react-native';

import { GlassCard, LabButton } from '@/components/ui/LabPrimitives';
import { Colors } from '@/constants/Colors';
import type { UserJourney } from '@/hooks/useJourneyDetection';

// Platform-specific storage
const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    const AsyncStorage = await import('@react-native-async-storage/async-storage').then(m => m.default);
    return AsyncStorage.getItem(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    const AsyncStorage = await import('@react-native-async-storage/async-storage').then(m => m.default);
    return AsyncStorage.setItem(key, value);
  },
};

interface JourneyUpgradePromptProps {
  from: UserJourney;
  to: UserJourney;
  reason: string;
  prompt: string;
  onAccept: () => void;
  onDismiss?: () => void;
}

const JOURNEY_INFO: Record<UserJourney, { icon: string; label: string; color: string }> = {
  freestyler: {
    icon: 'flash-outline',
    label: 'Freestyle',
    color: Colors.emerald[400],
  },
  planner: {
    icon: 'calendar-outline',
    label: 'Planner',
    color: Colors.signal[400],
  },
  guided: {
    icon: 'sparkles',
    label: 'Guided',
    color: Colors.amber[400],
  },
};

export function JourneyUpgradePrompt({
  from,
  to,
  reason,
  prompt,
  onAccept,
  onDismiss,
}: JourneyUpgradePromptProps) {
  const [dismissed, setDismissed] = useState(false);
  const toInfo = JOURNEY_INFO[to];

  const handleDismiss = useCallback(async () => {
    setDismissed(true);
    // Store dismissal to not show again for a while
    await storage.setItem(
      `journey_upgrade_dismissed_${from}_${to}`,
      new Date().toISOString()
    );
    onDismiss?.();
  }, [from, to, onDismiss]);

  if (dismissed) return null;

  return (
    <GlassCard
      style={{
        borderWidth: 1,
        borderColor: toInfo.color + '40',
        backgroundColor: toInfo.color + '10',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: toInfo.color + '20',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}
        >
          <Ionicons name={toInfo.icon as any} size={20} color={toInfo.color} />
        </View>

        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: '600',
              color: Colors.graphite[100],
              marginBottom: 4,
            }}
          >
            {prompt}
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: Colors.graphite[400],
              marginBottom: 12,
            }}
          >
            {reason}
          </Text>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <LabButton
                label={`Try ${toInfo.label} Mode`}
                size="sm"
                onPress={onAccept}
              />
            </View>
            <Pressable
              onPress={handleDismiss}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
              }}
            >
              <Text style={{ fontSize: 13, color: Colors.graphite[400] }}>
                Maybe Later
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </GlassCard>
  );
}

/**
 * Journey indicator pill - shows current detected journey
 */
export function JourneyIndicator({
  journey,
  confidence,
  onPress,
}: {
  journey: UserJourney;
  confidence: 'low' | 'medium' | 'high';
  onPress?: () => void;
}) {
  const info = JOURNEY_INFO[journey];

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: info.color + '15',
        borderWidth: 1,
        borderColor: info.color + '30',
      }}
    >
      <Ionicons name={info.icon as any} size={14} color={info.color} />
      <Text
        style={{
          marginLeft: 6,
          fontSize: 11,
          fontWeight: '600',
          color: info.color,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {info.label}
      </Text>
      {confidence === 'low' && (
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: Colors.graphite[500],
            marginLeft: 6,
          }}
        />
      )}
    </Pressable>
  );
}

/**
 * New user welcome - helps them discover their preferred journey
 */
export function NewUserJourneyPrompt({
  onSelectFreestyle,
  onSelectPlanner,
  onSelectGuided,
}: {
  onSelectFreestyle: () => void;
  onSelectPlanner: () => void;
  onSelectGuided: () => void;
}) {
  return (
    <GlassCard>
      <View style={{ alignItems: 'center', paddingVertical: 8 }}>
        <Text
          style={{
            fontSize: 16,
            fontWeight: '600',
            color: Colors.graphite[100],
            marginBottom: 4,
          }}
        >
          How would you like to train?
        </Text>
        <Text
          style={{
            fontSize: 12,
            color: Colors.graphite[400],
            textAlign: 'center',
            marginBottom: 16,
          }}
        >
          Pick what feels right - you can always change later
        </Text>

        <View style={{ gap: 10, width: '100%' }}>
          {/* Freestyle */}
          <Pressable
            onPress={onSelectFreestyle}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 14,
              borderRadius: 12,
              backgroundColor: Colors.emerald[500] + '10',
              borderWidth: 1,
              borderColor: Colors.emerald[500] + '30',
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: Colors.emerald[500] + '20',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              <Ionicons name="flash-outline" size={22} color={Colors.emerald[400]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: Colors.graphite[100] }}>
                I'll figure it out
              </Text>
              <Text style={{ fontSize: 12, color: Colors.graphite[400] }}>
                Log exercises as you go, we'll remember them
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.graphite[500]} />
          </Pressable>

          {/* Planner */}
          <Pressable
            onPress={onSelectPlanner}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 14,
              borderRadius: 12,
              backgroundColor: Colors.signal[500] + '10',
              borderWidth: 1,
              borderColor: Colors.signal[500] + '30',
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: Colors.signal[500] + '20',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              <Ionicons name="calendar-outline" size={22} color={Colors.signal[400]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: Colors.graphite[100] }}>
                Build me a program
              </Text>
              <Text style={{ fontSize: 12, color: Colors.graphite[400] }}>
                AI creates a structured training block
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.graphite[500]} />
          </Pressable>

          {/* Guided */}
          <Pressable
            onPress={onSelectGuided}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 14,
              borderRadius: 12,
              backgroundColor: Colors.amber[500] + '10',
              borderWidth: 1,
              borderColor: Colors.amber[500] + '30',
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: Colors.amber[500] + '20',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}
            >
              <Ionicons name="sparkles" size={22} color={Colors.amber[400]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: Colors.graphite[100] }}>
                Guide me daily
              </Text>
              <Text style={{ fontSize: 12, color: Colors.graphite[400] }}>
                Smart suggestions based on how you feel
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.graphite[500]} />
          </Pressable>
        </View>
      </View>
    </GlassCard>
  );
}
