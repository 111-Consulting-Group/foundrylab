/**
 * NextTimeSummary Component
 *
 * Post-workout summary showing "Next Time" suggestions for all exercises.
 * Displays after workout completion to reinforce progressive overload.
 * Uses glass-morphic styling consistent with the rest of the app.
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';

import { NextTimeCard, NextTimeListItem } from '@/components/NextTimeCard';
import { Colors } from '@/constants/Colors';
import type { NextTimeSuggestion } from '@/types/database';

interface NextTimeSummaryProps {
  suggestions: NextTimeSuggestion[];
  workoutFocus?: string;
  onDismiss?: () => void;
  mode?: 'cards' | 'list';
}

export function NextTimeSummary({
  suggestions,
  workoutFocus,
  onDismiss,
  mode = 'list',
}: NextTimeSummaryProps) {
  // Calculate summary stats
  const stats = calculateStats(suggestions);

  if (suggestions.length === 0) {
    return (
      <View style={{ padding: 16 }}>
        <EmptyState />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: Colors.glass.white[10],
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <View>
            <Text style={{ fontSize: 12, fontWeight: '500', color: Colors.graphite[400] }}>
              {workoutFocus ? `${workoutFocus} Complete` : 'Workout Complete'}
            </Text>
            <Text style={{ fontSize: 20, fontWeight: '700', color: Colors.graphite[50] }}>
              Next Time
            </Text>
          </View>
          {onDismiss && (
            <Pressable
              onPress={onDismiss}
              style={({ pressed }) => ({
                padding: 8,
                borderRadius: 20,
                backgroundColor: pressed ? Colors.glass.white[10] : 'transparent',
              })}
            >
              <Ionicons name="close" size={24} color={Colors.graphite[400]} />
            </Pressable>
          )}
        </View>

        {/* Summary Stats */}
        <View style={{ flexDirection: 'row', marginTop: 8 }}>
          <SummaryStatBadge
            icon="fitness"
            value={suggestions.length.toString()}
            label="Exercises"
          />
          <SummaryStatBadge
            icon="trending-up"
            value={stats.progressing.toString()}
            label="Progressing"
            color="green"
          />
          <SummaryStatBadge
            icon="remove"
            value={stats.stable.toString()}
            label="Stable"
          />
          {stats.regressing > 0 && (
            <SummaryStatBadge
              icon="trending-down"
              value={stats.regressing.toString()}
              label="Regressing"
              color="red"
            />
          )}
        </View>
      </View>

      {/* Exercise List */}
      <ScrollView
        style={{ flex: 1, paddingHorizontal: 16, paddingVertical: 16 }}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {mode === 'cards' ? (
          // Full card view
          suggestions.map((suggestion) => (
            <View key={suggestion.exercise_id} style={{ marginBottom: 16 }}>
              <NextTimeCard suggestion={suggestion} />
            </View>
          ))
        ) : (
          // Compact list view
          suggestions.map((suggestion) => (
            <NextTimeListItem key={suggestion.exercise_id} suggestion={suggestion} />
          ))
        )}

        {/* Bottom CTA */}
        <View
          style={{
            marginTop: 16,
            padding: 16,
            borderRadius: 16,
            backgroundColor: Colors.glass.blue[10],
            borderWidth: 1,
            borderColor: Colors.glass.blue[20],
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: Colors.glass.blue[20],
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="bulb" size={20} color={Colors.signal[500]} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ fontWeight: '600', color: Colors.graphite[50] }}>
                Progressive Overload
              </Text>
              <Text style={{ fontSize: 12, color: Colors.graphite[400] }}>
                Follow these suggestions next time to keep making progress
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function SummaryStatBadge({
  icon,
  value,
  label,
  color,
}: {
  icon: string;
  value: string;
  label: string;
  color?: 'green' | 'red';
}) {
  const iconColor = color === 'green' ? Colors.emerald[500] :
                    color === 'red' ? Colors.regression[500] :
                    Colors.graphite[400];

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16 }}>
      <Ionicons name={icon as any} size={14} color={iconColor} />
      <Text style={{ marginLeft: 4, fontWeight: '600', color: Colors.graphite[200] }}>
        {value}
      </Text>
      <Text style={{ marginLeft: 4, fontSize: 12, color: Colors.graphite[400] }}>
        {label}
      </Text>
    </View>
  );
}

function EmptyState() {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 32 }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
          backgroundColor: Colors.glass.white[5],
        }}
      >
        <Ionicons name="barbell-outline" size={32} color={Colors.graphite[500]} />
      </View>
      <Text style={{ textAlign: 'center', fontWeight: '600', color: Colors.graphite[300] }}>
        No exercise data yet
      </Text>
      <Text style={{ textAlign: 'center', fontSize: 14, marginTop: 4, color: Colors.graphite[400] }}>
        Log your exercises to see progression suggestions
      </Text>
    </View>
  );
}

function calculateStats(suggestions: NextTimeSuggestion[]): {
  progressing: number;
  stable: number;
  regressing: number;
} {
  return suggestions.reduce(
    (acc, s) => {
      if (s.trend === 'progressing') acc.progressing++;
      else if (s.trend === 'regressing') acc.regressing++;
      else acc.stable++;
      return acc;
    },
    { progressing: 0, stable: 0, regressing: 0 }
  );
}

/**
 * Modal wrapper for NextTimeSummary
 * Uses glass-morphic styling
 */
export function NextTimeSummaryModal({
  visible,
  suggestions,
  workoutFocus,
  onDismiss,
}: {
  visible: boolean;
  suggestions: NextTimeSuggestion[];
  workoutFocus?: string;
  onDismiss: () => void;
}) {
  if (!visible) return null;

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: Colors.void[900],
        zIndex: 100,
      }}
    >
      <NextTimeSummary
        suggestions={suggestions}
        workoutFocus={workoutFocus}
        onDismiss={onDismiss}
        mode="list"
      />
    </View>
  );
}
