/**
 * ReadinessCheckIn Component
 *
 * Quick 30-second pre-workout check-in for sleep, soreness, and stress.
 * Displays AI coach recommendations based on readiness score.
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, Pressable, TextInput, Animated } from 'react-native';

import { Colors } from '@/constants/Colors';
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
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, paddingHorizontal: 8 }}>
        {([1, 2, 3, 4, 5] as MetricValue[]).map((value) => {
          const isSelected = currentValue === value;
          const metric = formatReadinessMetric(step, value);

          return (
            <Pressable
              key={value}
              onPress={() => handleMetricSelect(value)}
              style={{
                alignItems: 'center',
                padding: 12,
                borderRadius: 12,
                flex: 1,
                marginHorizontal: 4,
                backgroundColor: isSelected ? Colors.signal[500] : 'rgba(255, 255, 255, 0.05)',
                borderWidth: 1,
                borderColor: isSelected ? Colors.signal[500] : 'rgba(255, 255, 255, 0.1)',
              }}
            >
              <Text style={{ fontSize: 24, marginBottom: 4 }}>{metric.emoji}</Text>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '500',
                  color: isSelected ? '#ffffff' : Colors.graphite[300],
                }}
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
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <View
            style={{
              width: 112,
              height: 112,
              borderRadius: 56,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: readinessColors.bgColor || Colors.signal[500],
            }}
          >
            <Text style={{ fontSize: 36, fontWeight: '700', color: '#ffffff' }}>{analysis.score}</Text>
            <Text style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.8)' }}>{readinessColors.label}</Text>
          </View>
        </View>

        {/* AI Message */}
        <View
          style={{
            padding: 16,
            borderRadius: 12,
            marginBottom: 16,
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.1)',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Ionicons name="sparkles" size={18} color={Colors.signal[500]} />
            <Text style={{ marginLeft: 8, fontWeight: '600', color: Colors.graphite[100] }}>
              Coach Recommendation
            </Text>
          </View>
          <Text style={{ fontSize: 16, lineHeight: 24, color: Colors.graphite[300] }}>
            {analysis.message}
          </Text>
        </View>

        {/* Quick metrics summary */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 }}>
          {(['sleep', 'soreness', 'stress'] as MetricType[]).map((type) => {
            const value = type === 'sleep' ? sleep : type === 'soreness' ? soreness : stress;
            const metric = formatReadinessMetric(type, value);
            const impact = analysis.details[
              type === 'sleep' ? 'sleepImpact' : type === 'soreness' ? 'sorenessImpact' : 'stressImpact'
            ];

            return (
              <View key={type} style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 20, marginBottom: 4 }}>{metric.emoji}</Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: impact === 'positive' ? '#22c55e' : impact === 'negative' ? '#ef4444' : Colors.graphite[400],
                  }}
                >
                  {metric.label}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Optional notes */}
        {showNotes ? (
          <View style={{ marginBottom: 16 }}>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Anything else? (optional)"
              placeholderTextColor={Colors.graphite[500]}
              style={{
                padding: 12,
                borderRadius: 12,
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                color: Colors.graphite[100],
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.1)',
              }}
              multiline
              maxLength={200}
            />
          </View>
        ) : (
          <Pressable onPress={() => setShowNotes(true)} style={{ marginBottom: 16 }}>
            <Text style={{ textAlign: 'center', fontSize: 14, color: Colors.graphite[400] }}>
              + Add notes (optional)
            </Text>
          </Pressable>
        )}

        {/* Action buttons */}
        <View style={{ gap: 12 }}>
          <Pressable
            onPress={() => handleConfirm(analysis.suggestion)}
            style={{
              paddingVertical: 16,
              paddingHorizontal: 24,
              borderRadius: 12,
              backgroundColor: readinessColors.bgColor || Colors.signal[500],
            }}
          >
            <Text style={{ textAlign: 'center', color: '#ffffff', fontWeight: '600', fontSize: 18 }}>
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
              style={{
                paddingVertical: 12,
                paddingHorizontal: 24,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.2)',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
              }}
            >
              <Text style={{ textAlign: 'center', fontWeight: '500', color: Colors.graphite[300] }}>
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
      style={{
        padding: 24,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {step !== 'sleep' && (
            <Pressable onPress={handleBack} style={{ marginRight: 12, padding: 4 }}>
              <Ionicons name="arrow-back" size={24} color={Colors.graphite[200]} />
            </Pressable>
          )}
          <View>
            <Text style={{ fontSize: 20, fontWeight: '700', color: Colors.graphite[100] }}>
              {step === 'result' ? 'Your Readiness' : 'Quick Check-In'}
            </Text>
            {step !== 'result' && (
              <Text style={{ fontSize: 14, color: Colors.graphite[400] }}>
                Step {step === 'sleep' ? 1 : step === 'soreness' ? 2 : 3} of 3
              </Text>
            )}
          </View>
        </View>
        <Pressable onPress={onSkip} style={{ padding: 8 }}>
          <Text style={{ fontSize: 14, color: Colors.graphite[400] }}>Skip</Text>
        </Pressable>
      </View>

      {/* Progress dots */}
      {step !== 'result' && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 24 }}>
          {(['sleep', 'soreness', 'stress'] as const).map((s, i) => (
            <View
              key={s}
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                marginHorizontal: 4,
                backgroundColor:
                  step === s
                    ? Colors.signal[500]
                    : i < ['sleep', 'soreness', 'stress'].indexOf(step)
                    ? '#22c55e'
                    : 'rgba(255, 255, 255, 0.1)',
              }}
            />
          ))}
        </View>
      )}

      {/* Content */}
      {step !== 'result' ? (
        <>
          {/* Question */}
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.1)',
              }}
            >
              <Ionicons name={currentConfig!.icon} size={32} color={Colors.graphite[200]} />
            </View>
            <Text style={{ fontSize: 24, fontWeight: '600', textAlign: 'center', color: Colors.graphite[100] }}>
              {currentConfig!.question}
            </Text>
          </View>

          {/* Scale labels */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 8 }}>
            <Text style={{ fontSize: 12, color: Colors.graphite[500] }}>{currentConfig!.lowLabel}</Text>
            <Text style={{ fontSize: 12, color: Colors.graphite[500] }}>{currentConfig!.highLabel}</Text>
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
  const colors = getReadinessColor(score);
  const Container = onPress ? Pressable : View;

  return (
    <Container
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: `${colors.bgColor || Colors.signal[500]}33`,
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          marginRight: 8,
          backgroundColor: colors.bgColor || Colors.signal[500],
        }}
      />
      <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textColor || Colors.graphite[200] }}>
        {colors.label} ({score})
      </Text>
    </Container>
  );
});
