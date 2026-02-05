/**
 * DayCard Component
 *
 * Shows a preview of a single day's session with:
 * - Session type indicator (color-coded)
 * - Focus name
 * - Exercise list with suggested weights
 * - Estimated duration
 *
 * Can be tapped to expand and show full workout details.
 */

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/Colors';
import { getSessionTypeDisplay } from '@/lib/weekAllocation';
import type { PlannedDay, PlannedExercise, SessionType } from '@/types/coach';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface DayCardProps {
  day: PlannedDay;
  isToday?: boolean;
  onPress?: () => void;
  onSwap?: () => void;
  swapMode?: boolean;
  selected?: boolean;
}

export function DayCard({
  day,
  isToday = false,
  onPress,
  onSwap,
  swapMode = false,
  selected = false,
}: DayCardProps) {
  const [expanded, setExpanded] = useState(false);
  const sessionDisplay = getSessionTypeDisplay(day.sessionType || 'rest');

  const handlePress = () => {
    if (swapMode && onSwap) {
      onSwap();
      return;
    }

    if (day.exercises && day.exercises.length > 0) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setExpanded(!expanded);
    }

    onPress?.();
  };

  const hasExercises = day.exercises && day.exercises.length > 0;

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.container,
        isToday && styles.containerToday,
        swapMode && styles.containerSwapMode,
        selected && styles.containerSelected,
        pressed && styles.containerPressed,
      ]}
    >
      {/* Header Row */}
      <View style={styles.header}>
        {/* Day Name */}
        <View style={styles.dayNameContainer}>
          <Text style={[styles.dayName, isToday && styles.dayNameToday]}>
            {day.dayName.slice(0, 3)}
          </Text>
          {isToday && (
            <View style={styles.todayBadge}>
              <Text style={styles.todayBadgeText}>TODAY</Text>
            </View>
          )}
        </View>

        {/* Session Type Badge */}
        <View style={[styles.sessionBadge, { backgroundColor: sessionDisplay.bgColor }]}>
          <Ionicons
            name={sessionDisplay.icon as keyof typeof Ionicons.glyphMap}
            size={14}
            color={sessionDisplay.color}
          />
          <Text style={[styles.sessionLabel, { color: sessionDisplay.color }]}>
            {sessionDisplay.label}
          </Text>
        </View>
      </View>

      {/* Focus */}
      {!day.isRestDay && (
        <Text style={styles.focus}>{day.focus || 'Training'}</Text>
      )}

      {/* Exercise Preview (collapsed) */}
      {!expanded && hasExercises && (
        <View style={styles.exercisePreview}>
          <Text style={styles.exercisePreviewText}>
            {day.exercises!.slice(0, 2).map(e => e.exerciseName.split(' ')[0]).join(' / ')}
            {day.exercises!.length > 2 && ` +${day.exercises!.length - 2}`}
          </Text>
          <Ionicons name="chevron-down" size={16} color={Colors.graphite[500]} />
        </View>
      )}

      {/* Expanded Exercise List */}
      {expanded && hasExercises && (
        <View style={styles.exerciseList}>
          {day.exercises!.map((exercise, idx) => (
            <ExerciseRow key={exercise.exerciseId + idx} exercise={exercise} />
          ))}
        </View>
      )}

      {/* Footer: Duration & Notes */}
      <View style={styles.footer}>
        {day.estimatedDuration ? (
          <View style={styles.durationBadge}>
            <Ionicons name="time-outline" size={12} color={Colors.graphite[400]} />
            <Text style={styles.durationText}>{day.estimatedDuration} min</Text>
          </View>
        ) : null}

        {day.notes && (
          <Text style={styles.notes} numberOfLines={1}>
            {day.notes}
          </Text>
        )}

        {day.isLocked && (
          <Ionicons name="lock-closed" size={12} color={Colors.graphite[500]} style={styles.lockIcon} />
        )}
      </View>

      {/* Swap Mode Indicator */}
      {swapMode && (
        <View style={[styles.swapOverlay, selected && styles.swapOverlaySelected]}>
          <Ionicons
            name={selected ? 'checkmark-circle' : 'swap-horizontal'}
            size={24}
            color={selected ? Colors.emerald[400] : Colors.signal[400]}
          />
        </View>
      )}
    </Pressable>
  );
}

/**
 * Exercise Row within expanded DayCard
 */
function ExerciseRow({ exercise }: { exercise: PlannedExercise }) {
  return (
    <View style={styles.exerciseRow}>
      <View style={styles.exerciseInfo}>
        <Text style={styles.exerciseName} numberOfLines={1}>
          {exercise.exerciseName}
        </Text>
        <View style={styles.exerciseDetails}>
          <Text style={styles.exerciseSetsReps}>
            {exercise.sets} x {exercise.reps}
          </Text>
          {exercise.loadGuidance && (
            <Text style={styles.loadGuidance}>
              {exercise.loadGuidance}
            </Text>
          )}
        </View>
      </View>
      {exercise.progressionNote && (
        <Ionicons name="trending-up" size={14} color={Colors.emerald[400]} />
      )}
    </View>
  );
}

/**
 * Compact Day Card for horizontal scroll view
 */
export function DayCardCompact({
  day,
  isToday = false,
  onPress,
}: {
  day: PlannedDay;
  isToday?: boolean;
  onPress?: () => void;
}) {
  const sessionDisplay = getSessionTypeDisplay(day.sessionType || 'rest');

  return (
    <Pressable
      onPress={onPress}
      disabled={day.isRestDay}
      style={({ pressed }) => [
        styles.compactContainer,
        isToday && styles.compactContainerToday,
        pressed && !day.isRestDay && styles.compactContainerPressed,
      ]}
    >
      {/* Day Label */}
      <Text style={[styles.compactDayName, isToday && styles.compactDayNameToday]}>
        {day.dayName.slice(0, 3)}
      </Text>

      {/* Icon */}
      <View style={[styles.compactIcon, { backgroundColor: sessionDisplay.bgColor }]}>
        <Ionicons
          name={sessionDisplay.icon as keyof typeof Ionicons.glyphMap}
          size={18}
          color={day.isRestDay ? Colors.graphite[500] : sessionDisplay.color}
        />
      </View>

      {/* Focus Label */}
      <Text style={styles.compactFocus} numberOfLines={1}>
        {day.isRestDay ? 'Rest' : day.focus?.split(' ')[0] || 'Train'}
      </Text>

      {/* Exercise Count */}
      {!day.isRestDay && day.exercises && (
        <Text style={styles.compactExerciseCount}>
          {day.exercises.length} ex
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Full Card Styles
  container: {
    backgroundColor: Colors.void[800],
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.glass.white[10],
    padding: 14,
    marginBottom: 10,
  },
  containerToday: {
    borderColor: Colors.signal[500],
    borderWidth: 2,
    shadowColor: Colors.signal[500],
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  containerSwapMode: {
    borderStyle: 'dashed',
    borderColor: Colors.signal[400],
  },
  containerSelected: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderColor: Colors.signal[500],
  },
  containerPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dayNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dayName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.graphite[200],
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dayNameToday: {
    color: Colors.signal[400],
  },
  todayBadge: {
    backgroundColor: Colors.signal[500],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  todayBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#000',
    letterSpacing: 1,
  },

  sessionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sessionLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  focus: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.graphite[50],
    marginBottom: 8,
  },

  exercisePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exercisePreviewText: {
    fontSize: 13,
    color: Colors.graphite[400],
  },

  exerciseList: {
    marginTop: 8,
    gap: 8,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass.white[5],
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.graphite[200],
    marginBottom: 2,
  },
  exerciseDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  exerciseSetsReps: {
    fontSize: 13,
    fontFamily: 'monospace',
    color: Colors.signal[400],
  },
  loadGuidance: {
    fontSize: 12,
    color: Colors.graphite[400],
    fontStyle: 'italic',
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.glass.white[5],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  durationText: {
    fontSize: 11,
    color: Colors.graphite[400],
  },
  notes: {
    flex: 1,
    fontSize: 11,
    color: Colors.graphite[500],
    fontStyle: 'italic',
  },
  lockIcon: {
    marginLeft: 'auto',
  },

  swapOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swapOverlaySelected: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },

  // Compact Card Styles
  compactContainer: {
    width: 80,
    alignItems: 'center',
    padding: 12,
    backgroundColor: Colors.glass.white[5],
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.glass.white[10],
    marginRight: 10,
  },
  compactContainerToday: {
    borderColor: Colors.signal[500],
    backgroundColor: Colors.glass.blue[10],
  },
  compactContainerPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
  compactDayName: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: Colors.graphite[400],
    marginBottom: 8,
  },
  compactDayNameToday: {
    color: Colors.signal[400],
  },
  compactIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  compactFocus: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.graphite[200],
    textAlign: 'center',
    marginBottom: 4,
  },
  compactExerciseCount: {
    fontSize: 9,
    color: Colors.graphite[500],
  },
});

export default DayCard;
