import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  Animated,
  Vibration,
  Platform,
} from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';

interface RestTimerProps {
  initialSeconds?: number;
  onComplete?: () => void;
  onDismiss?: () => void;
  autoStart?: boolean;
  exerciseName?: string;
}

// Default rest times in seconds
export const REST_PRESETS = [
  { label: '30s', seconds: 30 },
  { label: '60s', seconds: 60 },
  { label: '90s', seconds: 90 },
  { label: '2m', seconds: 120 },
  { label: '3m', seconds: 180 },
  { label: '5m', seconds: 300 },
];

export function RestTimer({
  initialSeconds = 90,
  onComplete,
  onDismiss,
  autoStart = true,
  exerciseName,
}: RestTimerProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [seconds, setSeconds] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(autoStart);
  const [totalSeconds, setTotalSeconds] = useState(initialSeconds);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const onCompleteRef = useRef(onComplete);

  // Keep callback ref updated
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Format time as MM:SS
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  // Calculate progress percentage
  const progress = totalSeconds > 0 ? ((totalSeconds - seconds) / totalSeconds) * 100 : 0;

  // Start pulse animation when time is low
  useEffect(() => {
    if (seconds <= 10 && seconds > 0 && isRunning) {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [seconds, isRunning, pulseAnim]);

  // Timer logic
  useEffect(() => {
    if (isRunning && seconds > 0) {
      intervalRef.current = setInterval(() => {
        setSeconds((prev) => {
          if (prev <= 1) {
            // Timer complete
            if (Platform.OS !== 'web') {
              Vibration.vibrate([0, 200, 100, 200]);
            }
            onCompleteRef.current?.();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning]);

  // Stop timer when it reaches 0
  useEffect(() => {
    if (seconds === 0) {
      setIsRunning(false);
    }
  }, [seconds]);

  const handleToggle = useCallback(() => {
    setIsRunning((prev) => !prev);
  }, []);

  const handleReset = useCallback(() => {
    setSeconds(totalSeconds);
    setIsRunning(true);
  }, [totalSeconds]);

  const handleSetTime = useCallback((newSeconds: number) => {
    setSeconds(newSeconds);
    setTotalSeconds(newSeconds);
    setIsRunning(true);
  }, []);

  const handleAddTime = useCallback((additionalSeconds: number) => {
    setSeconds((prev) => prev + additionalSeconds);
    setTotalSeconds((prev) => prev + additionalSeconds);
  }, []);

  const isComplete = seconds === 0;
  const isWarning = seconds <= 10 && seconds > 0;

  return (
    <View
      className={`rounded-xl overflow-hidden ${
        isDark ? 'bg-graphite-800' : 'bg-white'
      } border ${
        isComplete
          ? 'border-progress-500'
          : isWarning
          ? 'border-oxide-500'
          : isDark
          ? 'border-graphite-700'
          : 'border-graphite-200'
      }`}
    >
      {/* Progress bar */}
      <View className={`h-1 ${isDark ? 'bg-graphite-700' : 'bg-graphite-200'}`}>
        <View
          className={`h-1 ${
            isComplete
              ? 'bg-progress-500'
              : isWarning
              ? 'bg-oxide-500'
              : 'bg-signal-500'
          }`}
          style={{ width: `${progress}%` }}
        />
      </View>

      <View className="p-4">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center">
            <Ionicons
              name="timer-outline"
              size={18}
              color={isComplete ? '#22c55e' : isWarning ? '#EF4444' : '#2F80ED'}
            />
            <Text
              className={`ml-2 font-semibold ${
                isDark ? 'text-graphite-200' : 'text-graphite-800'
              }`}
            >
              {isComplete ? 'Rest Complete!' : 'Rest Timer'}
            </Text>
          </View>
          <Pressable onPress={onDismiss} className="p-1">
            <Ionicons
              name="close"
              size={20}
              color={isDark ? '#808fb0' : '#607296'}
            />
          </Pressable>
        </View>

        {/* Timer Display */}
        <Animated.View
          style={{ transform: [{ scale: pulseAnim }] }}
          className="items-center mb-4"
        >
          <Text
            className={`text-5xl font-bold ${
              isComplete
                ? 'text-progress-500'
                : isWarning
                ? 'text-oxide-500'
                : 'text-signal-500'
            }`}
          >
            {formatTime(seconds)}
          </Text>
          {exerciseName && (
            <Text
              className={`text-sm mt-1 ${
                isDark ? 'text-graphite-400' : 'text-graphite-500'
              }`}
            >
              before next set of {exerciseName}
            </Text>
          )}
        </Animated.View>

        {/* Controls */}
        <View className="flex-row items-center justify-center gap-3 mb-4">
          {isComplete ? (
            <Pressable
              onPress={handleReset}
              className="flex-row items-center px-6 py-3 rounded-xl bg-signal-500"
            >
              <Ionicons name="refresh" size={20} color="#ffffff" />
              <Text className="text-white font-semibold ml-2">Restart</Text>
            </Pressable>
          ) : (
            <>
              <Pressable
                onPress={handleToggle}
                className={`flex-row items-center px-6 py-3 rounded-xl ${
                  isRunning ? 'bg-oxide-500' : 'bg-signal-500'
                }`}
              >
                <Ionicons
                  name={isRunning ? 'pause' : 'play'}
                  size={20}
                  color="#ffffff"
                />
                <Text className="text-white font-semibold ml-2">
                  {isRunning ? 'Pause' : 'Resume'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleAddTime(30)}
                className={`flex-row items-center px-4 py-3 rounded-xl ${
                  isDark ? 'bg-graphite-700' : 'bg-graphite-100'
                }`}
              >
                <Ionicons
                  name="add"
                  size={20}
                  color={isDark ? '#d3d8e4' : '#607296'}
                />
                <Text
                  className={`font-semibold ml-1 ${
                    isDark ? 'text-graphite-200' : 'text-graphite-700'
                  }`}
                >
                  30s
                </Text>
              </Pressable>
            </>
          )}
        </View>

        {/* Quick presets */}
        <View className="flex-row flex-wrap justify-center gap-2">
          {REST_PRESETS.map((preset) => (
            <Pressable
              key={preset.seconds}
              onPress={() => handleSetTime(preset.seconds)}
              className={`px-3 py-1.5 rounded-full ${
                totalSeconds === preset.seconds
                  ? 'bg-signal-500/20 border border-signal-500/50'
                  : isDark
                  ? 'bg-graphite-700'
                  : 'bg-graphite-100'
              }`}
            >
              <Text
                className={`text-sm ${
                  totalSeconds === preset.seconds
                    ? 'text-signal-500 font-semibold'
                    : isDark
                    ? 'text-graphite-300'
                    : 'text-graphite-600'
                }`}
              >
                {preset.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

/**
 * Compact inline rest timer for use within SetInput
 */
export function InlineRestTimer({
  seconds: initialSeconds,
  onComplete,
  onSkip,
}: {
  seconds: number;
  onComplete?: () => void;
  onSkip?: () => void;
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [seconds, setSeconds] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(true);
  const onCompleteRef = useRef(onComplete);

  // Keep callback ref updated
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          onCompleteRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning]);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  if (seconds === 0) {
    return (
      <View className="flex-row items-center justify-center py-2">
        <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
        <Text className="text-progress-500 font-semibold ml-1">
          Ready for next set!
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-row items-center justify-between py-2">
      <View className="flex-row items-center">
        <Ionicons
          name="timer-outline"
          size={16}
          color={seconds <= 10 ? '#EF4444' : '#2F80ED'}
        />
        <Text
          className={`ml-2 font-semibold ${
            seconds <= 10 ? 'text-oxide-500' : 'text-signal-500'
          }`}
        >
          Rest: {formatTime(seconds)}
        </Text>
      </View>
      <Pressable
        onPress={onSkip}
        className={`px-3 py-1 rounded-full ${
          isDark ? 'bg-graphite-700' : 'bg-graphite-100'
        }`}
      >
        <Text
          className={`text-sm ${isDark ? 'text-graphite-300' : 'text-graphite-600'}`}
        >
          Skip
        </Text>
      </Pressable>
    </View>
  );
}
