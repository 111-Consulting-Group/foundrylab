/**
 * ReadinessCheckIn Component
 *
 * Quick 30-second pre-workout check-in for sleep, soreness, and stress.
 * Displays AI coach recommendations based on readiness score.
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, Pressable, TextInput, Animated } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import {
  useSubmitReadiness,
  analyzeReadiness,
  formatReadinessMetric,
  getReadinessColor,
} from '@/hooks/useReadiness';
import type { ReadinessAdjustment } from '@/types/database';

interface ReadinessCheckInProps {
  onComplete: (adjustment: ReadinessAdjustment) => void;
  onSkip: () => void;
}

type MetricType = 'sleep' | 'soreness' | 'stress';
type MetricValue = 1 | 2 | 3 | 4 | 5;

const METRIC_CONFIG: Record<MetricType, {
  label: string;
  question: string;
  icon: keyof typeof Ionicons.glyphMap;
  lowLabel: string;
  highLabel: string;
}> = {
  sleep: {
    label: 'Sleep',
    question: 'How did you sleep?',
    icon: 'moon-outline',
    lowLabel: 'Terrible',
    highLabel: 'Great',
  },
  soreness: {
    label: 'Soreness',
    question: 'How sore are you?',
    icon: 'body-outline',
    lowLabel: 'Fresh',
    highLabel: 'Wrecked',
  },
  stress: {
    label: 'Stress',
    question: "What's your stress level?",
    icon: 'pulse-outline',
    lowLabel: 'Calm',
    highLabel: 'Chaos',
  },
};

export const ReadinessCheckIn = React.memo(function ReadinessCheckIn({
  onComplete,
  onSkip,
}: ReadinessCheckInProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [step, setStep] = useState<'sleep' | 'soreness' | 'stress' | 'result'>('sleep');
  const [sleep, setSleep] = useState<MetricValue>(3);
  const [soreness, setSoreness] = useState<MetricValue>(3);
  const [stress, setStress] = useState<MetricValue>(3);
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);

  const submitReadiness = useSubmitReadiness();

  // Analyze readiness when all values are set
  const analysis = useMemo(() => {
    if (step === 'result') {
      return analyzeReadiness(sleep, soreness, stress);
    }
    return null;
  }, [step, sleep, soreness, stress]);

  const readinessColors = useMemo(() => {
    if (analysis) {
      return getReadinessColor(analysis.score);
    }
    return null;
  }, [analysis]);

  const handleMetricSelect = useCallback((value: MetricValue) => {
    if (step === 'sleep') {
      setSleep(value);
      setStep('soreness');
    } else if (step === 'soreness') {
      setSoreness(value);
      setStep('stress');
    } else if (step === 'stress') {
      setStress(value);
      setStep('result');
    }
  }, [step]);

  const handleBack = useCallback(() => {
    if (step === 'soreness') setStep('sleep');
    else if (step === 'stress') setStep('soreness');
    else if (step === 'result') setStep('stress');
  }, [step]);

  const handleConfirm = useCallback(async (adjustment: ReadinessAdjustment) => {
    try {
      await submitReadiness.mutateAsync({
        sleep_quality: sleep,
        muscle_soreness: soreness,
        stress_level: stress,
        notes: notes || undefined,
        adjustment_applied: adjustment,
      });
      onComplete(adjustment);
    } catch (error) {
      console.error('Failed to submit readiness:', error);
      // Still proceed even if save fails
      onComplete(adjustment);
    }
  }, [sleep, soreness, stress, notes, submitReadiness, onComplete]);

  const currentConfig = step !== 'result' ? METRIC_CONFIG[step] : null;

  // Render metric selection buttons
  const renderMetricButtons = () => {
    if (!currentConfig) return null;

    const currentValue = step === 'sleep' ? sleep : step === 'soreness' ? soreness : stress;

    return (
      <View className="flex-row justify-between mt-6 px-2">
        {([1, 2, 3, 4, 5] as MetricValue[]).map((value) => {
          const isSelected = currentValue === value;
          const metric = formatReadinessMetric(step, value);

          return (
            <Pressable
              key={value}
              onPress={() => handleMetricSelect(value)}
              className={`items-center p-3 rounded-xl flex-1 mx-1 ${
                isSelected
                  ? 'bg-signal-500'
                  : isDark
                  ? 'bg-graphite-700'
                  : 'bg-graphite-100'
              }`}
            >
              <Text className="text-2xl mb-1">{metric.emoji}</Text>
              <Text
                className={`text-xs font-medium ${
                  isSelected ? 'text-white' : isDark ? 'text-graphite-300' : 'text-graphite-600'
                }`}
              >
                {value}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  };

  // Render result screen with AI recommendation
  const renderResult = () => {
    if (!analysis || !readinessColors) return null;

    return (
      <View>
        {/* Score Circle */}
        <View className="items-center mb-6">
          <View
            className={`w-28 h-28 rounded-full items-center justify-center ${readinessColors.bg}`}
          >
            <Text className="text-4xl font-bold text-white">{analysis.score}</Text>
            <Text className="text-sm text-white/80">{readinessColors.label}</Text>
          </View>
        </View>

        {/* AI Message */}
        <View
          className={`p-4 rounded-xl mb-4 ${
            isDark ? 'bg-graphite-800' : 'bg-graphite-100'
          }`}
        >
          <View className="flex-row items-center mb-2">
            <Ionicons
              name="sparkles"
              size={18}
              color={isDark ? '#2F80ED' : '#1a5fb4'}
            />
            <Text
              className={`ml-2 font-semibold ${
                isDark ? 'text-graphite-100' : 'text-graphite-900'
              }`}
            >
              Coach Recommendation
            </Text>
          </View>
          <Text
            className={`text-base leading-6 ${
              isDark ? 'text-graphite-300' : 'text-graphite-700'
            }`}
          >
            {analysis.message}
          </Text>
        </View>

        {/* Quick metrics summary */}
        <View className="flex-row justify-around mb-4">
          {(['sleep', 'soreness', 'stress'] as MetricType[]).map((type) => {
            const value = type === 'sleep' ? sleep : type === 'soreness' ? soreness : stress;
            const metric = formatReadinessMetric(type, value);
            const impact = analysis.details[
              type === 'sleep' ? 'sleepImpact' : type === 'soreness' ? 'sorenessImpact' : 'stressImpact'
            ];

            return (
              <View key={type} className="items-center">
                <Text className="text-xl mb-1">{metric.emoji}</Text>
                <Text
                  className={`text-xs ${
                    impact === 'positive'
                      ? 'text-progress-500'
                      : impact === 'negative'
                      ? 'text-oxide-500'
                      : isDark
                      ? 'text-graphite-400'
                      : 'text-graphite-500'
                  }`}
                >
                  {metric.label}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Optional notes */}
        {showNotes ? (
          <View className="mb-4">
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Anything else? (optional)"
              placeholderTextColor={isDark ? '#607296' : '#9ca3af'}
              className={`p-3 rounded-xl ${
                isDark
                  ? 'bg-graphite-800 text-graphite-100'
                  : 'bg-white text-graphite-900'
              } border ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}
              multiline
              maxLength={200}
            />
          </View>
        ) : (
          <Pressable
            onPress={() => setShowNotes(true)}
            className="mb-4"
          >
            <Text className={`text-center text-sm ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
              + Add notes (optional)
            </Text>
          </Pressable>
        )}

        {/* Action buttons */}
        <View className="gap-3">
          <Pressable
            onPress={() => handleConfirm(analysis.suggestion)}
            className={`py-4 px-6 rounded-xl ${readinessColors.bg}`}
          >
            <Text className="text-center text-white font-semibold text-lg">
              {analysis.suggestion === 'full'
                ? "Let's Go Full Send"
                : analysis.suggestion === 'moderate'
                ? 'Train Smart Today'
                : analysis.suggestion === 'light'
                ? 'Take It Easy'
                : 'Focus on Recovery'}
            </Text>
          </Pressable>

          {analysis.suggestion !== 'full' && (
            <Pressable
              onPress={() => handleConfirm('full')}
              className={`py-3 px-6 rounded-xl border ${
                isDark ? 'border-graphite-600' : 'border-graphite-300'
              }`}
            >
              <Text
                className={`text-center font-medium ${
                  isDark ? 'text-graphite-300' : 'text-graphite-600'
                }`}
              >
                Override: Train Full Anyway
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  return (
    <View
      className={`p-6 rounded-2xl ${
        isDark ? 'bg-graphite-900' : 'bg-white'
      }`}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between mb-6">
        <View className="flex-row items-center">
          {step !== 'sleep' && (
            <Pressable onPress={handleBack} className="mr-3 p-1">
              <Ionicons
                name="arrow-back"
                size={24}
                color={isDark ? '#d3d8e4' : '#374151'}
              />
            </Pressable>
          )}
          <View>
            <Text
              className={`text-xl font-bold ${
                isDark ? 'text-graphite-100' : 'text-graphite-900'
              }`}
            >
              {step === 'result' ? 'Your Readiness' : 'Quick Check-In'}
            </Text>
            {step !== 'result' && (
              <Text className={`text-sm ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                Step {step === 'sleep' ? 1 : step === 'soreness' ? 2 : 3} of 3
              </Text>
            )}
          </View>
        </View>
        <Pressable onPress={onSkip} className="p-2">
          <Text className={`text-sm ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
            Skip
          </Text>
        </Pressable>
      </View>

      {/* Progress dots */}
      {step !== 'result' && (
        <View className="flex-row justify-center mb-6">
          {(['sleep', 'soreness', 'stress'] as const).map((s, i) => (
            <View
              key={s}
              className={`w-2 h-2 rounded-full mx-1 ${
                step === s
                  ? 'bg-signal-500'
                  : i < ['sleep', 'soreness', 'stress'].indexOf(step)
                  ? 'bg-progress-500'
                  : isDark
                  ? 'bg-graphite-700'
                  : 'bg-graphite-300'
              }`}
            />
          ))}
        </View>
      )}

      {/* Content */}
      {step !== 'result' ? (
        <>
          {/* Question */}
          <View className="items-center mb-4">
            <View
              className={`w-16 h-16 rounded-full items-center justify-center mb-4 ${
                isDark ? 'bg-graphite-800' : 'bg-graphite-100'
              }`}
            >
              <Ionicons
                name={currentConfig!.icon}
                size={32}
                color={isDark ? '#d3d8e4' : '#374151'}
              />
            </View>
            <Text
              className={`text-2xl font-semibold text-center ${
                isDark ? 'text-graphite-100' : 'text-graphite-900'
              }`}
            >
              {currentConfig!.question}
            </Text>
          </View>

          {/* Scale labels */}
          <View className="flex-row justify-between px-4 mb-2">
            <Text className={`text-xs ${isDark ? 'text-graphite-500' : 'text-graphite-400'}`}>
              {currentConfig!.lowLabel}
            </Text>
            <Text className={`text-xs ${isDark ? 'text-graphite-500' : 'text-graphite-400'}`}>
              {currentConfig!.highLabel}
            </Text>
          </View>

          {/* Metric buttons */}
          {renderMetricButtons()}
        </>
      ) : (
        renderResult()
      )}
    </View>
  );
});

/**
 * Compact readiness display for showing current status
 */
export const ReadinessIndicator = React.memo(function ReadinessIndicator({
  score,
  onPress,
}: {
  score: number;
  onPress?: () => void;
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = getReadinessColor(score);

  const Container = onPress ? Pressable : View;

  return (
    <Container
      onPress={onPress}
      className={`flex-row items-center px-3 py-1.5 rounded-full ${colors.bg}/20`}
    >
      <View className={`w-2 h-2 rounded-full ${colors.bg} mr-2`} />
      <Text className={`text-sm font-medium ${colors.text}`}>
        {colors.label} ({score})
      </Text>
    </Container>
  );
});
