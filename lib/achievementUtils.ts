/**
 * Achievement Utilities
 *
 * Defines achievement types, thresholds, and detection logic.
 * Achievements are earned automatically based on user activity.
 */

import type { AchievementType } from '@/types/database';

export interface AchievementDefinition {
  type: AchievementType;
  id: string;
  name: string;
  description: string;
  icon: string;
  iconColor: string;
  bgColor: string;
  threshold?: number;
}

/**
 * Streak Achievements - Consecutive training days (with 3-day gap allowance)
 */
export const STREAK_ACHIEVEMENTS: AchievementDefinition[] = [
  {
    type: 'streak',
    id: 'streak_3',
    name: '3-Day Streak',
    description: 'Train 3 days in a row',
    icon: 'flame-outline',
    iconColor: '#808fb0',
    bgColor: 'rgba(128, 143, 176, 0.15)',
    threshold: 3,
  },
  {
    type: 'streak',
    id: 'streak_7',
    name: 'Week Warrior',
    description: 'Train for 7 consecutive days',
    icon: 'flame',
    iconColor: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.15)',
    threshold: 7,
  },
  {
    type: 'streak',
    id: 'streak_14',
    name: 'Two Week Titan',
    description: 'Train for 14 consecutive days',
    icon: 'flame',
    iconColor: '#EF4444',
    bgColor: 'rgba(239, 68, 68, 0.15)',
    threshold: 14,
  },
  {
    type: 'streak',
    id: 'streak_30',
    name: 'Monthly Monster',
    description: 'Train for 30 consecutive days',
    icon: 'flame',
    iconColor: '#F97316',
    bgColor: 'rgba(249, 115, 22, 0.15)',
    threshold: 30,
  },
  {
    type: 'streak',
    id: 'streak_60',
    name: 'Iron Discipline',
    description: 'Train for 60 consecutive days',
    icon: 'flame',
    iconColor: '#8B5CF6',
    bgColor: 'rgba(139, 92, 246, 0.15)',
    threshold: 60,
  },
  {
    type: 'streak',
    id: 'streak_90',
    name: 'Legendary',
    description: 'Train for 90 consecutive days',
    icon: 'flame',
    iconColor: '#EC4899',
    bgColor: 'rgba(236, 72, 153, 0.15)',
    threshold: 90,
  },
];

/**
 * Consistency Achievements - Weekly adherence percentage
 */
export const CONSISTENCY_ACHIEVEMENTS: AchievementDefinition[] = [
  {
    type: 'consistency',
    id: 'consistency_80',
    name: 'Reliable',
    description: 'Hit 80% weekly adherence',
    icon: 'checkmark-circle',
    iconColor: '#22C55E',
    bgColor: 'rgba(34, 197, 94, 0.15)',
    threshold: 80,
  },
  {
    type: 'consistency',
    id: 'consistency_90',
    name: 'Consistent',
    description: 'Hit 90% weekly adherence',
    icon: 'checkmark-done-circle',
    iconColor: '#2F80ED',
    bgColor: 'rgba(47, 128, 237, 0.15)',
    threshold: 90,
  },
  {
    type: 'consistency',
    id: 'consistency_100',
    name: 'Perfect Week',
    description: 'Hit 100% weekly adherence',
    icon: 'star',
    iconColor: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.15)',
    threshold: 100,
  },
];

/**
 * Volume Milestones - Total weight lifted (lifetime)
 */
export const VOLUME_ACHIEVEMENTS: AchievementDefinition[] = [
  {
    type: 'volume_milestone',
    id: 'volume_100k',
    name: '100K Club',
    description: 'Move 100,000 lbs total',
    icon: 'barbell',
    iconColor: '#22C55E',
    bgColor: 'rgba(34, 197, 94, 0.15)',
    threshold: 100000,
  },
  {
    type: 'volume_milestone',
    id: 'volume_250k',
    name: 'Quarter Million',
    description: 'Move 250,000 lbs total',
    icon: 'barbell',
    iconColor: '#2F80ED',
    bgColor: 'rgba(47, 128, 237, 0.15)',
    threshold: 250000,
  },
  {
    type: 'volume_milestone',
    id: 'volume_500k',
    name: 'Half Million',
    description: 'Move 500,000 lbs total',
    icon: 'barbell',
    iconColor: '#8B5CF6',
    bgColor: 'rgba(139, 92, 246, 0.15)',
    threshold: 500000,
  },
  {
    type: 'volume_milestone',
    id: 'volume_1m',
    name: 'Million Pound Club',
    description: 'Move 1,000,000 lbs total',
    icon: 'trophy',
    iconColor: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.15)',
    threshold: 1000000,
  },
];

/**
 * PR Achievement (dynamic - created when PR is hit)
 */
export const PR_ACHIEVEMENT_TEMPLATE: Omit<AchievementDefinition, 'id' | 'name' | 'description'> = {
  type: 'pr',
  icon: 'trophy',
  iconColor: '#2F80ED',
  bgColor: 'rgba(47, 128, 237, 0.15)',
};

/**
 * Block Complete Achievement (dynamic - created when block is finished)
 */
export const BLOCK_COMPLETE_TEMPLATE: Omit<AchievementDefinition, 'id' | 'name' | 'description'> = {
  type: 'block_complete',
  icon: 'flag',
  iconColor: '#22C55E',
  bgColor: 'rgba(34, 197, 94, 0.15)',
};

/**
 * All static achievements
 */
export const ALL_ACHIEVEMENTS: AchievementDefinition[] = [
  ...STREAK_ACHIEVEMENTS,
  ...CONSISTENCY_ACHIEVEMENTS,
  ...VOLUME_ACHIEVEMENTS,
];

/**
 * Get achievement definition by ID
 */
export function getAchievementById(id: string): AchievementDefinition | undefined {
  return ALL_ACHIEVEMENTS.find((a) => a.id === id);
}

/**
 * Check which streak achievements are newly earned
 */
export function checkStreakAchievements(
  currentStreak: number,
  earnedAchievementIds: string[]
): AchievementDefinition[] {
  return STREAK_ACHIEVEMENTS.filter(
    (a) => a.threshold && currentStreak >= a.threshold && !earnedAchievementIds.includes(a.id)
  );
}

/**
 * Check which consistency achievements are newly earned
 */
export function checkConsistencyAchievements(
  adherencePercent: number,
  earnedAchievementIds: string[]
): AchievementDefinition[] {
  return CONSISTENCY_ACHIEVEMENTS.filter(
    (a) => a.threshold && adherencePercent >= a.threshold && !earnedAchievementIds.includes(a.id)
  );
}

/**
 * Check which volume achievements are newly earned
 */
export function checkVolumeAchievements(
  totalVolume: number,
  earnedAchievementIds: string[]
): AchievementDefinition[] {
  return VOLUME_ACHIEVEMENTS.filter(
    (a) => a.threshold && totalVolume >= a.threshold && !earnedAchievementIds.includes(a.id)
  );
}

/**
 * Create a PR achievement
 */
export function createPRAchievement(
  exerciseName: string,
  value: number,
  unit: string
): AchievementDefinition {
  return {
    ...PR_ACHIEVEMENT_TEMPLATE,
    id: `pr_${Date.now()}`,
    name: `${exerciseName} PR`,
    description: `New personal record: ${value} ${unit}`,
  };
}

/**
 * Create a block complete achievement
 */
export function createBlockCompleteAchievement(blockName: string): AchievementDefinition {
  return {
    ...BLOCK_COMPLETE_TEMPLATE,
    id: `block_${Date.now()}`,
    name: `Block Complete`,
    description: `Finished: ${blockName}`,
  };
}

/**
 * Format volume number for display
 */
export function formatVolume(volume: number): string {
  if (volume >= 1000000) {
    return `${(volume / 1000000).toFixed(1)}M`;
  }
  if (volume >= 1000) {
    return `${(volume / 1000).toFixed(0)}K`;
  }
  return volume.toFixed(0);
}
