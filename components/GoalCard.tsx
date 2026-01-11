/**
 * GoalCard Component
 *
 * Displays a fitness goal with progress bar and status
 */

import { Ionicons } from '@expo/vector-icons';
import { View, Text, Pressable } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import { type FitnessGoal, calculateGoalProgress } from '@/hooks/useGoals';

interface GoalCardProps {
  goal: FitnessGoal;
  compact?: boolean;
  onPress?: () => void;
}

export function GoalCard({ goal, compact = false, onPress }: GoalCardProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const progress = calculateGoalProgress(goal);
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
        className={`flex-row items-center justify-between py-2 px-3 rounded-lg ${
          isDark ? 'bg-graphite-800' : 'bg-graphite-100'
        }`}
      >
        <View className="flex-row items-center flex-1 mr-2">
          <Ionicons
            name={isAchieved ? 'checkmark-circle' : 'flag'}
            size={16}
            color={isAchieved ? '#27AE60' : '#2F80ED'}
            style={{ marginRight: 8 }}
          />
          <Text
            className={`text-sm flex-1 ${isDark ? 'text-graphite-200' : 'text-graphite-800'}`}
            numberOfLines={1}
          >
            {exerciseName}
          </Text>
        </View>
        <View className="flex-row items-center">
          <Text className={`text-sm font-semibold ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
            {currentDisplay}/{targetDisplay} {goal.target_unit}
          </Text>
          <View
            className="ml-2 px-1.5 py-0.5 rounded"
            style={{ backgroundColor: `${progressColor}20` }}
          >
            <Text className="text-xs font-semibold" style={{ color: progressColor }}>
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
      className={`p-4 rounded-xl ${
        isDark ? 'bg-graphite-800 border-graphite-700' : 'bg-white border-graphite-200'
      } border`}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center flex-1">
          <Ionicons
            name={isAchieved ? 'trophy' : isPaused ? 'pause-circle' : 'flag'}
            size={20}
            color={isAchieved ? '#FFD700' : isPaused ? '#808fb0' : '#2F80ED'}
            style={{ marginRight: 8 }}
          />
          <Text
            className={`font-semibold flex-1 ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}
            numberOfLines={1}
          >
            {exerciseName}
          </Text>
        </View>
        {isAchieved && (
          <View className="px-2 py-1 rounded-full bg-progress-500/20">
            <Text className="text-xs font-semibold text-progress-500">Achieved!</Text>
          </View>
        )}
      </View>

      {/* Goal description */}
      {goal.description && (
        <Text className={`text-sm mb-2 ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
          {goal.description}
        </Text>
      )}

      {/* Progress display */}
      <View className="flex-row items-end justify-between mb-2">
        <View>
          <Text className={`text-xs ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
            Current
          </Text>
          <Text className={`text-2xl font-bold ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
            {currentDisplay}
            <Text className={`text-sm font-normal ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
              {' '}{goal.target_unit}
            </Text>
          </Text>
        </View>
        <View className="items-end">
          <Text className={`text-xs ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
            Target
          </Text>
          <Text className={`text-lg font-semibold ${isDark ? 'text-graphite-300' : 'text-graphite-700'}`}>
            {targetDisplay} {goal.target_unit}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View className={`h-2 rounded-full ${isDark ? 'bg-graphite-700' : 'bg-graphite-200'}`}>
        <View
          className="h-full rounded-full"
          style={{
            width: `${Math.min(progress, 100)}%`,
            backgroundColor: progressColor,
          }}
        />
      </View>

      {/* Footer info */}
      <View className="flex-row items-center justify-between mt-2">
        <Text className={`text-xs ${isDark ? 'text-graphite-500' : 'text-graphite-400'}`}>
          {Math.round(progress)}% complete
        </Text>
        {daysRemaining !== null && (
          <Text
            className={`text-xs ${
              daysRemaining < 0
                ? 'text-regression-500'
                : daysRemaining < 14
                ? 'text-warning-500'
                : isDark
                ? 'text-graphite-500'
                : 'text-graphite-400'
            }`}
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
}

/**
 * Compact goal display for feed posts
 */
export function GoalProgressBadge({
  goal,
}: {
  goal: FitnessGoal;
}) {
  const progress = calculateGoalProgress(goal);
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
}
