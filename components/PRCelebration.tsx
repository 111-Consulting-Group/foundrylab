import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  Animated,
  Easing,
} from 'react-native';

import { Colors } from '@/constants/Colors';
import type { Exercise } from '@/types/database';

type PRType = 'weight' | 'reps' | 'volume' | 'e1rm';

interface PRCelebrationProps {
  visible: boolean;
  onClose: () => void;
  exercise: Exercise | null;
  prType: PRType | null;
  value: string;
  previousValue?: string;
}

const PR_MESSAGES: Record<PRType, { title: string; subtitle: string }> = {
  weight: {
    title: 'New Weight PR!',
    subtitle: 'You lifted heavier than ever before',
  },
  reps: {
    title: 'New Rep PR!',
    subtitle: 'More reps at this weight than ever',
  },
  volume: {
    title: 'New Volume PR!',
    subtitle: 'Most volume in a single session',
  },
  e1rm: {
    title: 'New E1RM PR!',
    subtitle: 'Estimated 1RM just got stronger',
  },
};

export function PRCelebration({
  visible,
  onClose,
  exercise,
  prType,
  value,
  previousValue,
}: PRCelebrationProps) {
  // Animation values
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const trophyBounceAnim = useRef(new Animated.Value(0)).current;
  const confettiAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Reset animations
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      trophyBounceAnim.setValue(0);
      confettiAnim.setValue(0);

      // Start entrance animation
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 6,
          useNativeDriver: true,
        }),
      ]).start();

      // Trophy bounce animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(trophyBounceAnim, {
            toValue: -10,
            duration: 300,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(trophyBounceAnim, {
            toValue: 0,
            duration: 300,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        { iterations: 3 }
      ).start();

      // Confetti spread animation
      Animated.timing(confettiAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }
  }, [visible, scaleAnim, opacityAnim, trophyBounceAnim, confettiAnim]);

  if (!exercise || !prType) return null;

  const prMessage = PR_MESSAGES[prType];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          opacity: opacityAnim,
        }}
      >
        <Animated.View
          style={{
            width: '100%',
            maxWidth: 384,
            borderRadius: 24,
            overflow: 'hidden',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.1)',
            transform: [{ scale: scaleAnim }],
          }}
        >
          {/* Oxide Orange Gradient Header - Special PR moment */}
          <View
            style={{
              paddingVertical: 32,
              alignItems: 'center',
              position: 'relative',
              overflow: 'hidden',
              backgroundColor: '#F2994A',
            }}
          >
            {/* Animated confetti/sparkles */}
            {[...Array(8)].map((_, i) => (
              <Animated.View
                key={i}
                style={{
                  position: 'absolute',
                  top: 20,
                  left: `${15 + i * 10}%`,
                  transform: [
                    {
                      translateY: confettiAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 80 + Math.random() * 40],
                      }),
                    },
                    {
                      translateX: confettiAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, (i % 2 === 0 ? 1 : -1) * (20 + Math.random() * 20)],
                      }),
                    },
                  ],
                  opacity: confettiAnim.interpolate({
                    inputRange: [0, 0.8, 1],
                    outputRange: [0, 1, 0],
                  }),
                }}
              >
                <Text style={{ fontSize: 24 }}>
                  {['✨', '⭐', '🔥', '💪'][i % 4]}
                </Text>
              </Animated.View>
            ))}

            {/* Trophy Icon */}
            <Animated.View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
                transform: [{ translateY: trophyBounceAnim }],
              }}
            >
              <Ionicons name="trophy" size={48} color="#ffffff" />
            </Animated.View>

            <Text style={{ color: '#ffffff', fontSize: 24, fontWeight: '700', textAlign: 'center' }}>
              {prMessage.title}
            </Text>
            <Text style={{ color: 'rgba(255, 255, 255, 0.8)', textAlign: 'center', marginTop: 4 }}>
              {prMessage.subtitle}
            </Text>
          </View>

          {/* Content */}
          <View style={{ padding: 24, alignItems: 'center' }}>
            <Text
              style={{
                fontSize: 18,
                fontWeight: '600',
                marginBottom: 8,
                color: Colors.graphite[100],
              }}
            >
              {exercise.name}
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 36, fontWeight: '700', color: '#F2994A' }}>
                {value}
              </Text>
            </View>

            {previousValue && (
              <View
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                }}
              >
                <Text style={{ fontSize: 14, color: Colors.graphite[400] }}>
                  Previous best: {previousValue}
                </Text>
              </View>
            )}

            {/* Close Button */}
            <Pressable
              style={{
                marginTop: 24,
                width: '100%',
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: '#F2994A',
                alignItems: 'center',
              }}
              onPress={onClose}
            >
              <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 18 }}>
                Keep Crushing It!
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
