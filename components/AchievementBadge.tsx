/**
 * AchievementBadge Component
 *
 * Displays achievement badges for user accomplishments.
 * Part of the Training Intelligence achievement system.
 */

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import { useState } from 'react';

import { useColorScheme } from '@/components/useColorScheme';
import type { AchievementDefinition } from '@/lib/achievementUtils';

interface AchievementBadgeProps {
  achievement: AchievementDefinition;
  earnedAt?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  onPress?: () => void;
}

/**
 * Single achievement badge
 */
export function AchievementBadge({
  achievement,
  earnedAt,
  size = 'md',
  showLabel = true,
  onPress,
}: AchievementBadgeProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [showDetail, setShowDetail] = useState(false);

  const sizes = {
    sm: { badge: 'w-8 h-8', icon: 16, text: 'text-xs' },
    md: { badge: 'w-12 h-12', icon: 24, text: 'text-sm' },
    lg: { badge: 'w-16 h-16', icon: 32, text: 'text-base' },
  };

  const sizeConfig = sizes[size];

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      setShowDetail(true);
    }
  };

  return (
    <>
      <Pressable onPress={handlePress} className="items-center">
        <View
          className={`${sizeConfig.badge} rounded-full items-center justify-center`}
          style={{ backgroundColor: achievement.bgColor }}
        >
          <Ionicons
            name={achievement.icon as any}
            size={sizeConfig.icon}
            color={achievement.iconColor}
          />
        </View>
        {showLabel && (
          <Text
            className={`mt-1 font-medium text-center ${sizeConfig.text} ${
              isDark ? 'text-graphite-300' : 'text-graphite-700'
            }`}
            numberOfLines={1}
          >
            {achievement.name}
          </Text>
        )}
      </Pressable>

      {/* Detail Modal */}
      <Modal
        visible={showDetail}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDetail(false)}
      >
        <Pressable
          className="flex-1 bg-black/50 items-center justify-center px-8"
          onPress={() => setShowDetail(false)}
        >
          <View
            className={`w-full rounded-2xl p-6 items-center ${
              isDark ? 'bg-graphite-800' : 'bg-white'
            }`}
          >
            <View
              className="w-20 h-20 rounded-full items-center justify-center mb-4"
              style={{ backgroundColor: achievement.bgColor }}
            >
              <Ionicons name={achievement.icon as any} size={40} color={achievement.iconColor} />
            </View>
            <Text
              className={`text-xl font-bold text-center mb-2 ${
                isDark ? 'text-graphite-100' : 'text-graphite-900'
              }`}
            >
              {achievement.name}
            </Text>
            <Text
              className={`text-center mb-4 ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}
            >
              {achievement.description}
            </Text>
            {earnedAt && (
              <Text className={`text-xs ${isDark ? 'text-graphite-500' : 'text-graphite-400'}`}>
                Earned {new Date(earnedAt).toLocaleDateString()}
              </Text>
            )}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

/**
 * Achievement Row - Horizontal scrollable list of achievements
 */
interface AchievementRowProps {
  achievements: Array<{ definition: AchievementDefinition; earnedAt?: string }>;
  size?: 'sm' | 'md';
}

export function AchievementRow({ achievements, size = 'sm' }: AchievementRowProps) {
  if (achievements.length === 0) return null;

  return (
    <View className="flex-row flex-wrap gap-2">
      {achievements.map((item, index) => (
        <AchievementBadge
          key={item.definition.id || index}
          achievement={item.definition}
          earnedAt={item.earnedAt}
          size={size}
          showLabel={false}
        />
      ))}
    </View>
  );
}

/**
 * New Achievement Toast - Shows when a new achievement is earned
 */
interface NewAchievementToastProps {
  achievement: AchievementDefinition;
  visible: boolean;
  onDismiss: () => void;
}

export function NewAchievementToast({
  achievement,
  visible,
  onDismiss,
}: NewAchievementToastProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  if (!visible) return null;

  return (
    <Pressable
      onPress={onDismiss}
      className={`absolute bottom-24 left-4 right-4 rounded-2xl p-4 flex-row items-center ${
        isDark ? 'bg-graphite-800' : 'bg-white'
      } shadow-lg`}
      style={{ elevation: 5 }}
    >
      <View
        className="w-14 h-14 rounded-full items-center justify-center mr-4"
        style={{ backgroundColor: achievement.bgColor }}
      >
        <Ionicons name={achievement.icon as any} size={28} color={achievement.iconColor} />
      </View>
      <View className="flex-1">
        <Text className={`text-xs font-medium ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
          Achievement Unlocked!
        </Text>
        <Text className={`text-lg font-bold ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
          {achievement.name}
        </Text>
        <Text className={`text-sm ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
          {achievement.description}
        </Text>
      </View>
      <Ionicons name="close" size={20} color={isDark ? '#808fb0' : '#607296'} />
    </Pressable>
  );
}

/**
 * Achievement Grid - Grid display for profile pages
 */
interface AchievementGridProps {
  achievements: Array<{ definition: AchievementDefinition; earnedAt?: string }>;
  emptyMessage?: string;
}

export function AchievementGrid({ achievements, emptyMessage }: AchievementGridProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  if (achievements.length === 0) {
    return (
      <View className="items-center py-8">
        <Ionicons
          name="ribbon-outline"
          size={48}
          color={isDark ? '#808fb0' : '#607296'}
        />
        <Text className={`mt-4 text-center ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
          {emptyMessage || 'No achievements yet'}
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-row flex-wrap">
      {achievements.map((item, index) => (
        <View key={item.definition.id || index} className="w-1/3 p-2">
          <AchievementBadge
            achievement={item.definition}
            earnedAt={item.earnedAt}
            size="md"
            showLabel
          />
        </View>
      ))}
    </View>
  );
}

/**
 * Compact achievement count badge
 */
interface AchievementCountBadgeProps {
  count: number;
  recentAchievement?: AchievementDefinition;
}

export function AchievementCountBadge({ count, recentAchievement }: AchievementCountBadgeProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  if (count === 0) return null;

  return (
    <View
      className="flex-row items-center px-2 py-1 rounded-full"
      style={{ backgroundColor: isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.1)' }}
    >
      {recentAchievement ? (
        <Ionicons
          name={recentAchievement.icon as any}
          size={14}
          color={recentAchievement.iconColor}
        />
      ) : (
        <Ionicons name="ribbon" size={14} color="#8B5CF6" />
      )}
      <Text className="ml-1 text-xs font-semibold" style={{ color: '#8B5CF6' }}>
        {count}
      </Text>
    </View>
  );
}
