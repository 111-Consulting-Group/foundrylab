/**
 * GoalCard Component
 *
 * Displays a fitness goal with progress bar and status
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';

import { Colors } from '@/constants/Colors';
import { type FitnessGoal, calculateGoalProgress } from '@/hooks/useGoals';

interface GoalCardProps {
  goal: FitnessGoal;
  compact?: boolean;
  onPress?: () => void;
}

export const GoalCard = React.memo(function GoalCard({ goal, compact = false, onPress }: GoalCardProps) {

  // Memoize expensive progress calculation
  const progress = useMemo(() => calculateGoalProgress(goal), [goal]);
  const isAchieved = goal.status === 'achieved';
  const isPaused = goal.status === 'paused';

  const exerciseName = goal.exercise?.name || 'Custom Goal';
  const currentDisplay = goal.current_value?.toFixed(0) || '0';
  const targetDisplay = goal.target_value.toFixed(0);

  // Calculate days remaining if target date set
  let daysRemaining: number | null = null;
  if (goal.target_date && !isAchieved) {
    const targetDate = new Date(goal.target_date);
    const today = new Date();
    daysRemaining = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  // Progress bar color based on status
  const progressColor = isAchieved
    ? '#27AE60' // green
    : progress >= 75
    ? '#2F80ED' // blue
    : progress >= 50
    ? '#F2994A' // orange
    : '#EB5757'; // red

  const Container = onPress ? Pressable : View;

  if (compact) {
    return (
      <Container
        onPress={onPress}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 8,
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
          <Ionicons
            name={isAchieved ? 'checkmark-circle' : 'flag'}
            size={16}
            color={isAchieved ? '#27AE60' : Colors.signal[500]}
            style={{ marginRight: 8 }}
          />
          <Text style={{ fontSize: 14, flex: 1, color: Colors.graphite[200] }} numberOfLines={1}>
            {exerciseName}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.graphite[100] }}>
            {currentDisplay}/{targetDisplay} {goal.target_unit}
          </Text>
          <View style={{ marginLeft: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: `${progressColor}20` }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: progressColor }}>
              {Math.round(progress)}%
            </Text>
          </View>
        </View>
      </Container>
    );
  }

  return (
    <Container
      onPress={onPress}
      style={{
        padding: 16,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Ionicons
            name={isAchieved ? 'trophy' : isPaused ? 'pause-circle' : 'flag'}
            size={20}
            color={isAchieved ? '#FFD700' : isPaused ? Colors.graphite[400] : Colors.signal[500]}
            style={{ marginRight: 8 }}
          />
          <Text style={{ fontWeight: '600', flex: 1, color: Colors.graphite[100] }} numberOfLines={1}>
            {exerciseName}
          </Text>
        </View>
        {isAchieved && (
          <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(34, 197, 94, 0.2)' }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.emerald[400] }}>Achieved!</Text>
          </View>
        )}
      </View>

      {/* Goal description */}
      {goal.description && (
        <Text style={{ fontSize: 14, marginBottom: 8, color: Colors.graphite[400] }}>
          {goal.description}
        </Text>
      )}

      {/* Progress display */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 8 }}>
        <View>
          <Text style={{ fontSize: 12, color: Colors.graphite[400] }}>Current</Text>
          <Text style={{ fontSize: 24, fontWeight: '700', color: Colors.graphite[100] }}>
            {currentDisplay}
            <Text style={{ fontSize: 14, fontWeight: '400', color: Colors.graphite[400] }}> {goal.target_unit}</Text>
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 12, color: Colors.graphite[400] }}>Target</Text>
          <Text style={{ fontSize: 18, fontWeight: '600', color: Colors.graphite[300] }}>
            {targetDisplay} {goal.target_unit}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
        <View
          style={{
            height: '100%',
            borderRadius: 4,
            width: `${Math.min(progress, 100)}%`,
            backgroundColor: progressColor,
          }}
        />
      </View>

      {/* Footer info */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
        <Text style={{ fontSize: 12, color: Colors.graphite[500] }}>
          {Math.round(progress)}% complete
        </Text>
        {daysRemaining !== null && (
          <Text
            style={{
              fontSize: 12,
              color: daysRemaining < 0 ? '#ef4444' : daysRemaining < 14 ? '#f59e0b' : Colors.graphite[500],
            }}
          >
            {daysRemaining < 0
              ? `${Math.abs(daysRemaining)} days overdue`
              : daysRemaining === 0
              ? 'Due today'
              : `${daysRemaining} days left`}
          </Text>
        )}
      </View>
    </Container>
  );
});

/**
 * Compact goal display for feed posts
 */
export const GoalProgressBadge = React.memo(function GoalProgressBadge({
  goal,
}: {
  goal: FitnessGoal;
}) {
  const progress = useMemo(() => calculateGoalProgress(goal), [goal]);
  const isAchieved = goal.status === 'achieved';

  const progressColor = isAchieved ? '#27AE60' : '#2F80ED';

  return (
    <View
      className="flex-row items-center px-2 py-1 rounded-full"
      style={{ backgroundColor: `${progressColor}20` }}
    >
      <Ionicons
        name={isAchieved ? 'checkmark-circle' : 'flag-outline'}
        size={12}
        color={progressColor}
      />
      <Text className="text-xs font-semibold ml-1" style={{ color: progressColor }}>
        {Math.round(progress)}%
      </Text>
    </View>
  );
});
