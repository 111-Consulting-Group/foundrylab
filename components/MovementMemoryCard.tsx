/**
 * MovementMemoryCard Component
 *
 * Displays the "memory" of an exercise - last performance, trend, and suggestion.
 * Core UI element for the "Every movement has memory" principle.
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, Text, Pressable } from 'react-native';

import { ConfidenceBadge, ConfidenceIndicator } from '@/components/ConfidenceBadge';
import { Colors } from '@/constants/Colors';
import type { MovementMemoryData } from '@/hooks/useMovementMemory';
import type { NextTimeSuggestion } from '@/types/database';

interface MovementMemoryCardProps {
  memory: MovementMemoryData;
  suggestion?: NextTimeSuggestion | null;
  compact?: boolean;
  onApplySuggestion?: (weight: number, reps: number) => void;
}

export function MovementMemoryCard({
  memory,
  suggestion,
  compact = false,
  onApplySuggestion,
}: MovementMemoryCardProps) {
  if (compact) {
    return (
      <CompactMemoryCard memory={memory} suggestion={suggestion} onApplySuggestion={onApplySuggestion} />
    );
  }

  const trendIcon = memory.trend === 'progressing'
    ? 'trending-up'
    : memory.trend === 'regressing'
    ? 'trending-down'
    : 'remove';

  const trendColor = memory.trend === 'progressing'
    ? '#22c55e'
    : memory.trend === 'regressing'
    ? '#ef4444'
    : Colors.graphite[400];

  return (
    <View
      style={{
        borderRadius: 12,
        borderWidth: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
      }}
    >
      {/* Last Performance Section */}
      <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.1)' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="time-outline" size={14} color={Colors.signal[500]} />
            <Text style={{ fontSize: 12, fontWeight: '600', marginLeft: 4, color: Colors.signal[500] }}>
              Last time
            </Text>
            {memory.lastDateRelative && (
              <Text style={{ fontSize: 12, marginLeft: 8, color: Colors.graphite[400] }}>
                {memory.lastDateRelative}
              </Text>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name={trendIcon} size={16} color={trendColor} />
            <Text style={{ fontSize: 12, marginLeft: 4, color: trendColor }}>
              {memory.trendLabel}
            </Text>
          </View>
        </View>

        <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.graphite[50] }}>
          {memory.displayText}
        </Text>

        {/* Stats Row */}
        <View style={{ flexDirection: 'row', marginTop: 8, gap: 16 }}>
          <View>
            <Text style={{ fontSize: 12, color: Colors.graphite[400] }}>Sessions</Text>
            <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.graphite[200] }}>
              {memory.exposureCount}
            </Text>
          </View>
          {memory.prE1RM && (
            <View>
              <Text style={{ fontSize: 12, color: Colors.graphite[400] }}>E1RM PR</Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.graphite[200] }}>
                {Math.round(memory.prE1RM)} lbs
              </Text>
            </View>
          )}
          {memory.typicalRepRange && (
            <View>
              <Text style={{ fontSize: 12, color: Colors.graphite[400] }}>Rep Range</Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.graphite[200] }}>
                {memory.typicalRepRange.min}-{memory.typicalRepRange.max}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Suggestion Section */}
      {suggestion && (
        <View style={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="bulb-outline" size={14} color="#fbbf24" />
              <Text style={{ fontSize: 12, fontWeight: '600', marginLeft: 4, color: '#fbbf24' }}>
                Next time
              </Text>
            </View>
            <ConfidenceBadge level={suggestion.confidence} exposureCount={suggestion.exposure_count} />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.graphite[50] }}>
                {suggestion.recommendation.weight} lbs x {suggestion.recommendation.reps}
              </Text>
              <Text style={{ fontSize: 12, marginTop: 4, color: Colors.graphite[400] }}>
                {suggestion.reasoning}
              </Text>
            </View>

            {onApplySuggestion && (
              <Pressable
                onPress={() => onApplySuggestion(
                  suggestion.recommendation.weight,
                  suggestion.recommendation.reps
                )}
                style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: 'rgba(59, 130, 246, 0.2)' }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.signal[500] }}>
                  Apply
                </Text>
              </Pressable>
            )}
          </View>

          {/* Alerts */}
          {suggestion.alerts && suggestion.alerts.length > 0 && (
            <View style={{ marginTop: 12 }}>
              {suggestion.alerts.map((alert, index) => (
                <View
                  key={index}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    padding: 8,
                    borderRadius: 8,
                    marginTop: 4,
                    backgroundColor: alert.type === 'regression' || alert.type === 'missed_session'
                      ? 'rgba(239, 68, 68, 0.1)'
                      : 'rgba(245, 158, 11, 0.1)',
                  }}
                >
                  <Ionicons
                    name={alert.type === 'regression' ? 'warning' : 'information-circle'}
                    size={14}
                    color={alert.type === 'regression' ? '#ef4444' : '#f59e0b'}
                    style={{ marginTop: 2 }}
                  />
                  <View style={{ marginLeft: 8, flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: '500', color: alert.type === 'regression' ? '#ef4444' : '#f59e0b' }}>
                      {alert.message}
                    </Text>
                    <Text style={{ fontSize: 12, color: Colors.graphite[400] }}>
                      {alert.suggested_action}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

/**
 * Compact version for inline display in set entry
 */
function CompactMemoryCard({
  memory,
  suggestion,
  onApplySuggestion,
}: {
  memory: MovementMemoryData;
  suggestion?: NextTimeSuggestion | null;
  onApplySuggestion?: (weight: number, reps: number) => void;
}) {
  const [applied, setApplied] = React.useState(false);

  const handleApply = () => {
    if (onApplySuggestion && suggestion) {
      onApplySuggestion(suggestion.recommendation.weight, suggestion.recommendation.reps);
      setApplied(true);
      setTimeout(() => setApplied(false), 2000);
    }
  };

  return (
    <View
      style={{
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
      }}
    >
      {/* Last Performance Row */}
      <View style={{ padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="time-outline" size={14} color={Colors.graphite[400]} />
          {memory.displayText && memory.displayText.trim() ? (
            <Text style={{ fontSize: 14, marginLeft: 8, color: Colors.graphite[300] }}>
              Last: <Text style={{ fontWeight: '600' }}>{memory.displayText}</Text>
            </Text>
          ) : (
            <Text style={{ fontSize: 14, marginLeft: 8, color: Colors.graphite[300] }}>
              No previous data
            </Text>
          )}
        </View>
        {memory.lastDateRelative && memory.lastDateRelative.trim() && (
          <Text style={{ fontSize: 12, color: Colors.graphite[400] }}>
            {memory.lastDateRelative}
          </Text>
        )}
      </View>

      {/* Suggestion Row - more prominent */}
      {suggestion && suggestion.recommendation && (
        <View
          style={{
            padding: 12,
            borderTopWidth: 1,
            borderTopColor: 'rgba(255, 255, 255, 0.1)',
            backgroundColor: 'rgba(59, 130, 246, 0.05)',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flex: 1, marginRight: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Ionicons name="bulb" size={14} color={Colors.signal[500]} />
              <Text style={{ fontSize: 12, fontWeight: '600', marginLeft: 8, color: Colors.signal[500] }}>
                Suggested
              </Text>
              {suggestion.confidence && (
                <View style={{ marginLeft: 8 }}>
                  <ConfidenceIndicator level={suggestion.confidence} />
                </View>
              )}
            </View>
            <Text style={{ fontSize: 16, fontWeight: '700', color: Colors.graphite[50] }}>
              {suggestion.recommendation?.weight ?? 0} lbs x {suggestion.recommendation?.reps ?? 0} reps
            </Text>
            {suggestion.reasoning && suggestion.reasoning.trim() && suggestion.reasoning.trim().length > 1 && (
              <Text style={{ fontSize: 12, color: Colors.graphite[400] }}>
                {suggestion.reasoning.trim()}
              </Text>
            )}
          </View>

          {onApplySuggestion && suggestion.recommendation && (
            <Pressable
              onPress={handleApply}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: applied ? '#22c55e' : Colors.signal[500],
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {applied ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="checkmark" size={16} color="#ffffff" />
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14, marginLeft: 4 }}>Applied</Text>
                </View>
              ) : (
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Use This</Text>
              )}
            </Pressable>
          )}
        </View>
      )}

      {/* No suggestion - just show memory */}
      {!suggestion && memory.confidence && (
        <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ marginRight: 8 }}>
              <ConfidenceIndicator level={memory.confidence} />
            </View>
            <Text style={{ fontSize: 12, color: Colors.graphite[400] }}>
              {(memory.exposureCount || 0) !== 1
                ? `${memory.exposureCount || 0} sessions logged`
                : `${memory.exposureCount || 0} session logged`
              }
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

/**
 * Empty state when no memory exists
 */
export function EmptyMemoryCard() {
  return (
    <View
      style={{
        padding: 12,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name="add-circle-outline" size={16} color={Colors.graphite[400]} />
        <Text style={{ fontSize: 14, marginLeft: 8, color: Colors.graphite[300] }}>
          First time logging this exercise
        </Text>
      </View>
    </View>
  );
}
