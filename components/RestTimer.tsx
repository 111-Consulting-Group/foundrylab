import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  Animated,
  Vibration,
  Platform,
} from 'react-native';

import { Colors } from '@/constants/Colors';

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

export const RestTimer = React.memo(function RestTimer({
  initialSeconds = 90,
  onComplete,
  onDismiss,
  autoStart = true,
  exerciseName,
}: RestTimerProps) {
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
      style={{
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: isComplete ? '#22c55e' : isWarning ? '#ef4444' : 'rgba(255, 255, 255, 0.1)',
      }}
    >
      {/* Progress bar */}
      <View style={{ height: 4, backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
        <View
          style={{
            height: 4,
            backgroundColor: isComplete ? '#22c55e' : isWarning ? '#ef4444' : Colors.signal[500],
            width: `${progress}%`,
          }}
        />
      </View>

      <View style={{ padding: 16 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons
              name="timer-outline"
              size={18}
              color={isComplete ? '#22c55e' : isWarning ? '#EF4444' : Colors.signal[500]}
            />
            <Text style={{ marginLeft: 8, fontWeight: '600', color: Colors.graphite[200] }}>
              {isComplete ? 'Rest Complete!' : 'Rest Timer'}
            </Text>
          </View>
          <Pressable onPress={onDismiss} style={{ padding: 4 }}>
            <Ionicons name="close" size={20} color={Colors.graphite[400]} />
          </Pressable>
        </View>

        {/* Timer Display */}
        <Animated.View
          style={{ transform: [{ scale: pulseAnim }], alignItems: 'center', marginBottom: 16 }}
        >
          <Text
            style={{
              fontSize: 48,
              fontWeight: '700',
              color: isComplete ? '#22c55e' : isWarning ? '#ef4444' : Colors.signal[500],
            }}
          >
            {formatTime(seconds)}
          </Text>
          {exerciseName && (
            <Text style={{ fontSize: 14, marginTop: 4, color: Colors.graphite[400] }}>
              before next set of {exerciseName}
            </Text>
          )}
        </Animated.View>

        {/* Controls */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 16 }}>
          {isComplete ? (
            <Pressable
              onPress={handleReset}
              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.signal[500] }}
            >
              <Ionicons name="refresh" size={20} color="#ffffff" />
              <Text style={{ color: '#fff', fontWeight: '600', marginLeft: 8 }}>Restart</Text>
            </Pressable>
          ) : (
            <>
              <Pressable
                onPress={handleToggle}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: isRunning ? '#ef4444' : Colors.signal[500],
                }}
              >
                <Ionicons name={isRunning ? 'pause' : 'play'} size={20} color="#ffffff" />
                <Text style={{ color: '#fff', fontWeight: '600', marginLeft: 8 }}>
                  {isRunning ? 'Pause' : 'Resume'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleAddTime(30)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                }}
              >
                <Ionicons name="add" size={20} color={Colors.graphite[200]} />
                <Text style={{ fontWeight: '600', marginLeft: 4, color: Colors.graphite[200] }}>30s</Text>
              </Pressable>
            </>
          )}
        </View>

        {/* Quick presets */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
          {REST_PRESETS.map((preset) => (
            <Pressable
              key={preset.seconds}
              onPress={() => handleSetTime(preset.seconds)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 12,
                backgroundColor: totalSeconds === preset.seconds ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                borderWidth: totalSeconds === preset.seconds ? 1 : 0,
                borderColor: totalSeconds === preset.seconds ? 'rgba(59, 130, 246, 0.5)' : 'transparent',
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: totalSeconds === preset.seconds ? '600' : '400',
                  color: totalSeconds === preset.seconds ? Colors.signal[500] : Colors.graphite[300],
                }}
              >
                {preset.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
});

/**
 * Compact inline rest timer for use within SetInput
 */
export const InlineRestTimer = React.memo(function InlineRestTimer({
  seconds: initialSeconds,
  onComplete,
  onSkip,
}: {
  seconds: number;
  onComplete?: () => void;
  onSkip?: () => void;
}) {
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
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8 }}>
        <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
        <Text style={{ fontWeight: '600', marginLeft: 4, color: '#22c55e' }}>
          Ready for next set!
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons
          name="timer-outline"
          size={16}
          color={seconds <= 10 ? '#EF4444' : Colors.signal[500]}
        />
        <Text style={{ marginLeft: 8, fontWeight: '600', color: seconds <= 10 ? '#ef4444' : Colors.signal[500] }}>
          Rest: {formatTime(seconds)}
        </Text>
      </View>
      <Pressable
        onPress={onSkip}
        style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
      >
        <Text style={{ fontSize: 14, color: Colors.graphite[300] }}>Skip</Text>
      </Pressable>
    </View>
  );
});
