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

import { useColorScheme } from '@/components/useColorScheme';
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
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

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
        style={{ opacity: opacityAnim }}
        className="flex-1 bg-black/60 items-center justify-center px-6"
      >
        <Animated.View
          style={{
            transform: [{ scale: scaleAnim }],
          }}
          className={`w-full max-w-sm rounded-3xl overflow-hidden ${
            isDark ? 'bg-steel-900' : 'bg-white'
          }`}
        >
          {/* Ember Gradient Header */}
          <View className="bg-gradient-to-br from-ember-500 to-ember-600 py-8 items-center relative overflow-hidden">
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
                <Text className="text-2xl">
                  {['✨', '⭐', '🔥', '💪'][i % 4]}
                </Text>
              </Animated.View>
            ))}

            {/* Trophy Icon */}
            <Animated.View
              style={{
                transform: [{ translateY: trophyBounceAnim }],
              }}
              className="w-20 h-20 rounded-full bg-white/20 items-center justify-center mb-4"
            >
              <Ionicons name="trophy" size={48} color="#ffffff" />
            </Animated.View>

            <Text className="text-white text-2xl font-bold text-center">
              {prMessage.title}
            </Text>
            <Text className="text-white/80 text-center mt-1">
              {prMessage.subtitle}
            </Text>
          </View>

          {/* Content */}
          <View className="p-6 items-center">
            <Text
              className={`text-lg font-semibold mb-2 ${
                isDark ? 'text-steel-100' : 'text-steel-900'
              }`}
            >
              {exercise.name}
            </Text>

            <View className="flex-row items-center justify-center mb-4">
              <Text
                className={`text-4xl font-bold text-ember-500`}
              >
                {value}
              </Text>
            </View>

            {previousValue && (
              <View
                className={`px-4 py-2 rounded-full ${
                  isDark ? 'bg-steel-800' : 'bg-steel-100'
                }`}
              >
                <Text className={`text-sm ${isDark ? 'text-steel-400' : 'text-steel-500'}`}>
                  Previous best: {previousValue}
                </Text>
              </View>
            )}

            {/* Close Button */}
            <Pressable
              className="mt-6 w-full py-3 rounded-xl bg-ember-500 items-center"
              onPress={onClose}
            >
              <Text className="text-white font-semibold text-lg">
                Keep Crushing It!
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
