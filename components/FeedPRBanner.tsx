/**
 * Feed PR Banner Component
 *
 * A special banner/badge that appears on feed posts when someone achieved a PR.
 * Features:
 * - Eye-catching gradient background
 * - Trophy icon with glow effect
 * - Animated entrance
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';

import { Colors } from '@/constants/Colors';

interface FeedPRBannerProps {
  prCount: number;
  compact?: boolean;
}

export function FeedPRBanner({ prCount, compact = false }: FeedPRBannerProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Subtle pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  if (prCount <= 0) return null;

  if (compact) {
    return (
      <View style={styles.compactBadge}>
        <Ionicons name="trophy" size={12} color={Colors.oxide[400]} />
        <Text style={styles.compactText}>
          {prCount} PR{prCount > 1 ? 's' : ''}
        </Text>
      </View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.banner,
        { transform: [{ scale: pulseAnim }] },
      ]}
    >
      {/* Glow effect */}
      <View style={styles.glowOuter} />
      <View style={styles.glowInner} />

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.trophyContainer}>
          <Ionicons name="trophy" size={18} color="#FFD700" />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>
            {prCount} Personal Record{prCount > 1 ? 's' : ''}!
          </Text>
          <Text style={styles.subtitle}>New personal best achieved</Text>
        </View>
        <Text style={styles.emoji}>🎉</Text>
      </View>
    </Animated.View>
  );
}

/**
 * Simple PR indicator for feed highlights
 */
interface PRIndicatorProps {
  isPR: boolean;
}

export function PRIndicator({ isPR }: PRIndicatorProps) {
  if (!isPR) return null;

  return (
    <View style={styles.indicator}>
      <Ionicons name="trophy" size={10} color={Colors.oxide[400]} />
      <Text style={styles.indicatorText}>PR</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'relative',
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.3)',
  },
  glowOuter: {
    position: 'absolute',
    top: -20,
    left: '30%',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
  },
  glowInner: {
    position: 'absolute',
    top: -10,
    right: '20%',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  trophyContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.oxide[400],
  },
  subtitle: {
    fontSize: 12,
    color: Colors.graphite[400],
    marginTop: 2,
  },
  emoji: {
    fontSize: 20,
    marginLeft: 8,
  },
  compactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    gap: 4,
  },
  compactText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.oxide[400],
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    gap: 2,
  },
  indicatorText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.oxide[400],
  },
});
