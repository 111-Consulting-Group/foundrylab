/**
 * Pattern Insights Component
 *
 * Displays detected training patterns and insights.
 * Part of the Training Intelligence pattern detection system.
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, Text, Pressable } from 'react-native';

import { Colors } from '@/constants/Colors';
import { ConfidenceIndicator } from '@/components/ConfidenceBadge';
import type { DetectedPattern } from '@/lib/patternDetection';
import type { ConfidenceLevel } from '@/types/database';

/**
 * Convert numeric confidence to level
 */
function confidenceToLevel(confidence: number): ConfidenceLevel {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.6) return 'medium';
  return 'low';
}

/**
 * Single pattern insight card
 */
interface PatternCardProps {
  pattern: DetectedPattern;
  onPress?: () => void;
  compact?: boolean;
}

export function PatternCard({ pattern, onPress, compact = false }: PatternCardProps) {
  const iconMap: Record<string, string> = {
    training_split: 'calendar-outline',
    exercise_pairing: 'link-outline',
    training_day: 'time-outline',
    rep_range_preference: 'repeat-outline',
  };

  const icon = iconMap[pattern.type] || 'analytics-outline';
  const confidenceLevel = confidenceToLevel(pattern.confidence);

  if (compact) {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 12,
          borderRadius: 12,
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.1)',
        }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
          }}
        >
          <Ionicons name={icon as any} size={16} color={Colors.graphite[400]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '500', color: Colors.graphite[200] }} numberOfLines={1}>
            {pattern.name}
          </Text>
          <Text style={{ fontSize: 12, color: Colors.graphite[400] }} numberOfLines={1}>
            {pattern.description}
          </Text>
        </View>
        <ConfidenceIndicator level={confidenceLevel} />
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={{
        padding: 16,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
          }}
        >
          <Ionicons name={icon as any} size={20} color={Colors.graphite[400]} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ fontWeight: '600', color: Colors.graphite[100] }}>
              {pattern.name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ConfidenceIndicator level={confidenceLevel} />
              <Text style={{ fontSize: 12, marginLeft: 4, color: Colors.graphite[400] }}>
                {Math.round(pattern.confidence * 100)}%
              </Text>
            </View>
          </View>
          <Text style={{ fontSize: 14, color: Colors.graphite[400] }}>
            {pattern.description}
          </Text>

          {/* Additional pattern-specific data */}
          {pattern.type === 'training_split' && pattern.data.splits && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 4 }}>
              {(pattern.data.splits as string[]).map((split, index) => (
                <View
                  key={index}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 4,
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <Text style={{ fontSize: 12, color: Colors.graphite[300] }}>{split}</Text>
                </View>
              ))}
            </View>
          )}

          {pattern.type === 'training_day' && pattern.data.preferred_days && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 4 }}>
              {(pattern.data.preferred_days as string[]).map((day, index) => (
                <View
                  key={index}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 4,
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <Text style={{ fontSize: 12, color: Colors.graphite[300] }}>{day}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

/**
 * Pattern insights list
 */
interface PatternInsightsListProps {
  patterns: DetectedPattern[];
  title?: string;
  maxItems?: number;
  compact?: boolean;
  onPatternPress?: (pattern: DetectedPattern) => void;
}

export function PatternInsightsList({
  patterns,
  title = 'Training Patterns',
  maxItems = 5,
  compact = false,
  onPatternPress,
}: PatternInsightsListProps) {
  const displayPatterns = patterns.slice(0, maxItems);

  if (displayPatterns.length === 0) {
    return (
      <View style={{ paddingVertical: 32, alignItems: 'center' }}>
        <Ionicons name="analytics-outline" size={48} color={Colors.graphite[400]} />
        <Text style={{ marginTop: 16, textAlign: 'center', color: Colors.graphite[400] }}>
          Keep training to discover your patterns
        </Text>
        <Text style={{ fontSize: 14, textAlign: 'center', marginTop: 4, color: Colors.graphite[400] }}>
          We need at least 4 workouts to detect patterns
        </Text>
      </View>
    );
  }

  return (
    <View>
      {title && (
        <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 16, color: Colors.graphite[100] }}>
          {title}
        </Text>
      )}
      <View style={{ gap: compact ? 8 : 12 }}>
        {displayPatterns.map((pattern, index) => (
          <PatternCard
            key={`${pattern.type}-${index}`}
            pattern={pattern}
            compact={compact}
            onPress={onPatternPress ? () => onPatternPress(pattern) : undefined}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * Training split summary card
 */
interface TrainingSplitSummaryProps {
  name: string;
  splits: string[];
  daysPerWeek: number;
  confidence: number;
  preferredDays?: string[];
}

export function TrainingSplitSummary({
  name,
  splits,
  daysPerWeek,
  confidence,
  preferredDays,
}: TrainingSplitSummaryProps) {
  return (
    <View
      style={{
        padding: 16,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}
          >
            <Ionicons name="calendar" size={20} color={Colors.signal[500]} />
          </View>
          <View>
            <Text style={{ fontWeight: '600', color: Colors.graphite[100] }}>{name}</Text>
            <Text style={{ fontSize: 14, color: Colors.graphite[400] }}>~{daysPerWeek} days/week</Text>
          </View>
        </View>
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 12,
            backgroundColor:
              confidence >= 0.8
                ? 'rgba(34, 197, 94, 0.2)'
                : confidence >= 0.6
                ? 'rgba(245, 158, 11, 0.2)'
                : 'rgba(255, 255, 255, 0.1)',
          }}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: '500',
              color:
                confidence >= 0.8
                  ? '#22c55e'
                  : confidence >= 0.6
                  ? '#fbbf24'
                  : Colors.graphite[400],
            }}
          >
            {Math.round(confidence * 100)}% confident
          </Text>
        </View>
      </View>

      {/* Split days */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {splits.map((split, index) => (
          <View
            key={index}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 8,
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
            }}
          >
            <Text style={{ fontWeight: '500', color: Colors.graphite[200] }}>{split}</Text>
          </View>
        ))}
      </View>

      {/* Preferred days */}
      {preferredDays && preferredDays.length > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="time-outline" size={14} color={Colors.graphite[400]} style={{ marginRight: 6 }} />
          <Text style={{ fontSize: 14, color: Colors.graphite[400] }}>
            Usually on {preferredDays.join(', ')}
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * Offer to formalize pattern into training block
 */
interface StructureOfferProps {
  pattern: DetectedPattern;
  onAccept: () => void;
  onDismiss: () => void;
}

export function StructureOffer({ pattern, onAccept, onDismiss }: StructureOfferProps) {
  return (
    <View
      style={{
        padding: 16,
        borderRadius: 12,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.3)',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}
        >
          <Ionicons name="sparkles" size={20} color={Colors.signal[500]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '600', color: Colors.graphite[100] }}>
            We noticed a pattern!
          </Text>
          <Text style={{ fontSize: 14, marginTop: 4, color: Colors.graphite[400] }}>
            You've been training consistently with a {pattern.name} split. Would you like to turn
            this into a structured training block?
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Pressable
          onPress={onDismiss}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderRadius: 12,
            alignItems: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.1)',
          }}
        >
          <Text style={{ fontWeight: '500', color: Colors.graphite[300] }}>Keep it Flexible</Text>
        </Pressable>
        <Pressable
          onPress={onAccept}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderRadius: 12,
            alignItems: 'center',
            backgroundColor: Colors.signal[500],
          }}
        >
          <Text style={{ fontWeight: '500', color: '#ffffff' }}>Create Block</Text>
        </Pressable>
      </View>
    </View>
  );
}
