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

import { Colors } from '@/constants/Colors';
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
  const [showDetail, setShowDetail] = useState(false);

  const sizes = {
    sm: { badge: 32, icon: 16, text: 12 },
    md: { badge: 48, icon: 24, text: 14 },
    lg: { badge: 64, icon: 32, text: 16 },
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
      <Pressable onPress={handlePress} style={{ alignItems: 'center' }}>
        <View
          style={{
            width: sizeConfig.badge,
            height: sizeConfig.badge,
            borderRadius: sizeConfig.badge / 2,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: achievement.bgColor,
          }}
        >
          <Ionicons
            name={achievement.icon as any}
            size={sizeConfig.icon}
            color={achievement.iconColor}
          />
        </View>
        {showLabel && (
          <Text
            style={{
              marginTop: 4,
              fontWeight: '500',
              textAlign: 'center',
              fontSize: sizeConfig.text,
              color: Colors.graphite[300],
            }}
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
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 32,
          }}
          onPress={() => setShowDetail(false)}
        >
          <View
            style={{
              width: '100%',
              borderRadius: 16,
              padding: 24,
              alignItems: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.1)',
            }}
          >
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
                backgroundColor: achievement.bgColor,
              }}
            >
              <Ionicons name={achievement.icon as any} size={40} color={achievement.iconColor} />
            </View>
            <Text
              style={{
                fontSize: 20,
                fontWeight: '700',
                textAlign: 'center',
                marginBottom: 8,
                color: Colors.graphite[100],
              }}
            >
              {achievement.name}
            </Text>
            <Text style={{ textAlign: 'center', marginBottom: 16, color: Colors.graphite[400] }}>
              {achievement.description}
            </Text>
            {earnedAt && (
              <Text style={{ fontSize: 12, color: Colors.graphite[500] }}>
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
  if (!visible) return null;

  return (
    <Pressable
      onPress={onDismiss}
      style={{
        position: 'absolute',
        top: 60,
        left: 16,
        right: 16,
        borderRadius: 12,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(30, 30, 30, 0.95)',
        borderWidth: 1,
        borderColor: achievement.iconColor,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
          backgroundColor: achievement.bgColor,
        }}
      >
        <Ionicons name={achievement.icon as any} size={20} color={achievement.iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 11, fontWeight: '500', color: Colors.graphite[400] }}>
          Achievement Unlocked!
        </Text>
        <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.graphite[100] }}>
          {achievement.name}
        </Text>
      </View>
      <Ionicons name="close" size={18} color={Colors.graphite[400]} />
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
  if (achievements.length === 0) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 32 }}>
        <Ionicons name="ribbon-outline" size={48} color={Colors.graphite[400]} />
        <Text style={{ marginTop: 16, textAlign: 'center', color: Colors.graphite[400] }}>
          {emptyMessage || 'No achievements yet'}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {achievements.map((item, index) => (
        <View key={item.definition.id || index} style={{ width: '33.33%', padding: 8 }}>
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
  if (count === 0) return null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: 'rgba(139, 92, 246, 0.15)',
      }}
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
      <Text style={{ marginLeft: 4, fontSize: 12, fontWeight: '600', color: '#8B5CF6' }}>
        {count}
      </Text>
    </View>
  );
}
