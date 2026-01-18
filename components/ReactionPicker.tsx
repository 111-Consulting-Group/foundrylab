/**
 * Reaction Picker Component
 *
 * Allows users to select from multiple reaction types.
 * Features:
 * - Long press on like button to show picker
 * - Tap reaction to select
 * - Animated appearance
 * - Visual feedback
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Animated,
  StyleSheet,
} from 'react-native';

import { Colors } from '@/constants/Colors';
import type { ReactionType, ReactionCounts } from '@/types/database';

// Reaction configuration
export const REACTIONS: {
  type: ReactionType;
  emoji: string;
  label: string;
  color: string;
}[] = [
  { type: 'heart', emoji: '❤️', label: 'Love', color: '#EF4444' },
  { type: 'fire', emoji: '🔥', label: 'Fire', color: '#F59E0B' },
  { type: 'strong', emoji: '💪', label: 'Strong', color: '#3B82F6' },
  { type: 'clap', emoji: '👏', label: 'Congrats', color: '#10B981' },
  { type: 'mindblown', emoji: '🤯', label: 'Wow', color: '#8B5CF6' },
];

export function getReactionEmoji(type: ReactionType): string {
  return REACTIONS.find(r => r.type === type)?.emoji || '❤️';
}

export function getReactionColor(type: ReactionType): string {
  return REACTIONS.find(r => r.type === type)?.color || '#EF4444';
}

interface ReactionPickerProps {
  visible: boolean;
  onSelect: (type: ReactionType) => void;
  onClose: () => void;
  currentReaction?: ReactionType | null;
}

export function ReactionPicker({
  visible,
  onSelect,
  onClose,
  currentReaction,
}: ReactionPickerProps) {
  const [scaleAnim] = useState(() => new Animated.Value(0));

  React.useEffect(() => {
    if (visible) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 100,
        useNativeDriver: true,
      }).start();
    } else {
      scaleAnim.setValue(0);
    }
  }, [visible, scaleAnim]);

  if (!visible) return null;

  return (
    <Pressable style={styles.overlay} onPress={onClose}>
      <Animated.View
        style={[
          styles.pickerContainer,
          {
            transform: [{ scale: scaleAnim }],
            opacity: scaleAnim,
          },
        ]}
      >
        {REACTIONS.map((reaction, index) => (
          <TouchableOpacity
            key={reaction.type}
            onPress={() => {
              onSelect(reaction.type);
              onClose();
            }}
            style={[
              styles.reactionButton,
              currentReaction === reaction.type && styles.selectedReaction,
            ]}
          >
            <Text style={styles.emoji}>{reaction.emoji}</Text>
          </TouchableOpacity>
        ))}
      </Animated.View>
    </Pressable>
  );
}

interface ReactionButtonProps {
  postId: string;
  reactionCounts: ReactionCounts;
  userReaction: ReactionType | null;
  onReact: (postId: string, reactionType: ReactionType | null) => void;
  totalCount: number;
  onShowLikers?: () => void;
}

export function ReactionButton({
  postId,
  reactionCounts,
  userReaction,
  onReact,
  totalCount,
  onShowLikers,
}: ReactionButtonProps) {
  const [showPicker, setShowPicker] = useState(false);

  const handlePress = useCallback(() => {
    if (userReaction) {
      // Already reacted - remove reaction
      onReact(postId, null);
    } else {
      // Quick tap = heart
      onReact(postId, 'heart');
    }
  }, [postId, userReaction, onReact]);

  const handleLongPress = useCallback(() => {
    setShowPicker(true);
  }, []);

  const handleSelectReaction = useCallback((type: ReactionType) => {
    if (userReaction === type) {
      // Remove if same reaction
      onReact(postId, null);
    } else {
      onReact(postId, type);
    }
  }, [postId, userReaction, onReact]);

  // Get the dominant reaction for display
  const dominantReaction = getDominantReaction(reactionCounts);
  const displayEmoji = userReaction
    ? getReactionEmoji(userReaction)
    : dominantReaction
    ? getReactionEmoji(dominantReaction)
    : '🤍';

  const displayColor = userReaction
    ? getReactionColor(userReaction)
    : Colors.graphite[500];

  return (
    <View style={styles.buttonContainer}>
      <TouchableOpacity
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={300}
        style={styles.mainButton}
      >
        <Text style={[styles.buttonEmoji, { opacity: userReaction ? 1 : 0.7 }]}>
          {displayEmoji}
        </Text>
        <TouchableOpacity onPress={onShowLikers}>
          <Text style={[styles.countText, { color: displayColor }]}>
            {totalCount > 0 ? totalCount : ''}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Reaction Summary Pills */}
      {totalCount > 0 && (
        <ReactionSummary reactionCounts={reactionCounts} />
      )}

      <ReactionPicker
        visible={showPicker}
        onSelect={handleSelectReaction}
        onClose={() => setShowPicker(false)}
        currentReaction={userReaction}
      />
    </View>
  );
}

interface ReactionSummaryProps {
  reactionCounts: ReactionCounts;
  maxDisplay?: number;
}

export function ReactionSummary({ reactionCounts, maxDisplay = 3 }: ReactionSummaryProps) {
  // Get top reactions by count
  const sortedReactions = Object.entries(reactionCounts)
    .filter(([_, count]) => count && count > 0)
    .sort((a, b) => (b[1] || 0) - (a[1] || 0))
    .slice(0, maxDisplay);

  if (sortedReactions.length === 0) return null;

  return (
    <View style={styles.summaryContainer}>
      {sortedReactions.map(([type]) => (
        <Text key={type} style={styles.summaryEmoji}>
          {getReactionEmoji(type as ReactionType)}
        </Text>
      ))}
    </View>
  );
}

function getDominantReaction(counts: ReactionCounts): ReactionType | null {
  let maxCount = 0;
  let dominant: ReactionType | null = null;

  for (const [type, count] of Object.entries(counts)) {
    if (count && count > maxCount) {
      maxCount = count;
      dominant = type as ReactionType;
    }
  }

  return dominant;
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: -60,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  pickerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    flexDirection: 'row',
    backgroundColor: Colors.void[800],
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.glass.white[10],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  reactionButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
  },
  selectedReaction: {
    backgroundColor: Colors.glass.white[10],
  },
  emoji: {
    fontSize: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  mainButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonEmoji: {
    fontSize: 18,
  },
  countText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '700',
  },
  summaryContainer: {
    flexDirection: 'row',
    marginLeft: 4,
  },
  summaryEmoji: {
    fontSize: 12,
    marginLeft: -2,
  },
});
