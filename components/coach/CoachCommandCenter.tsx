/**
 * CoachCommandCenter
 *
 * The hero entry point for the hybrid training coach.
 * Designed as a command center that makes weekly planning prominent
 * while providing quick access to logging and current status.
 *
 * Aesthetic: Industrial control panel meets sports dashboard
 * - Dominant emerald accent for the primary action
 * - Status indicators with amber/signal accents
 * - Glass-morphic cards with depth
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { GlassCard } from '@/components/ui/LabPrimitives';

// Types
interface DayStatus {
  dayName: string;
  dayShort: string;
  isToday: boolean;
  status: 'completed' | 'scheduled' | 'rest' | 'missed' | 'future';
  focus?: string;
}

interface CoachCommandCenterProps {
  weekStatus?: DayStatus[];
  currentPhase?: string;
  daysLogged?: number;
  totalDays?: number;
  hasScheduledWorkout?: boolean;
  todaysFocus?: string;
  onPlanWeek: () => void;
  onLogWorkout: () => void;
  onOpenCoach: () => void;
}

// Day of week helpers
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getDefaultWeekStatus(): DayStatus[] {
  const today = new Date();
  const currentDayIndex = today.getDay();

  return DAYS.map((dayShort, index) => ({
    dayName: FULL_DAYS[index],
    dayShort,
    isToday: index === currentDayIndex,
    status: index < currentDayIndex ? 'future' : index === currentDayIndex ? 'scheduled' : 'future',
    focus: undefined,
  }));
}

export function CoachCommandCenter({
  weekStatus,
  currentPhase = 'Ready to plan',
  daysLogged = 0,
  totalDays = 0,
  hasScheduledWorkout = false,
  todaysFocus,
  onPlanWeek,
  onLogWorkout,
  onOpenCoach,
}: CoachCommandCenterProps) {
  const router = useRouter();

  // Default week status if not provided
  const days = weekStatus || getDefaultWeekStatus();

  // Calculate week progress
  const completedDays = days.filter(d => d.status === 'completed').length;
  const scheduledDays = days.filter(d => d.status === 'scheduled' || d.status === 'completed').length;

  // Find today
  const today = days.find(d => d.isToday);

  return (
    <View style={styles.container}>
      {/* Ambient glow effect */}
      <View style={styles.ambientGlow} />

      {/* Main Command Card */}
      <GlassCard variant="elevated" style={styles.commandCard}>
        {/* Header - Phase indicator */}
        <View style={styles.header}>
          <View style={styles.phaseContainer}>
            <View style={styles.phaseDot} />
            <Text style={styles.phaseText}>{currentPhase}</Text>
          </View>
          <Pressable onPress={onOpenCoach} style={styles.coachButton}>
            <Ionicons name="chatbubble-ellipses" size={18} color={Colors.signal[400]} />
          </Pressable>
        </View>

        {/* Week Progress Strip */}
        <View style={styles.weekStrip}>
          {days.map((day, index) => (
            <DayIndicator key={day.dayShort} day={day} />
          ))}
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{completedDays}</Text>
            <Text style={styles.statLabel}>LOGGED</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{scheduledDays}</Text>
            <Text style={styles.statLabel}>PLANNED</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{7 - scheduledDays}</Text>
            <Text style={styles.statLabel}>REST</Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Primary Action - Plan My Week */}
        <Pressable
          onPress={onPlanWeek}
          style={({ pressed }) => [
            styles.primaryAction,
            pressed && styles.primaryActionPressed,
          ]}
        >
          <View style={styles.primaryActionContent}>
            <View style={styles.primaryActionIcon}>
              <Ionicons name="calendar" size={24} color="#000" />
            </View>
            <View style={styles.primaryActionText}>
              <Text style={styles.primaryActionTitle}>Plan My Week</Text>
              <Text style={styles.primaryActionSubtitle}>
                {hasScheduledWorkout
                  ? 'Review and adjust your plan'
                  : 'Get your lifting scheduled around running'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(0,0,0,0.5)" />
          </View>
        </Pressable>

        {/* Secondary Actions */}
        <View style={styles.secondaryActions}>
          {/* Log Today's Workout */}
          <Pressable
            onPress={onLogWorkout}
            style={({ pressed }) => [
              styles.secondaryAction,
              pressed && styles.secondaryActionPressed,
            ]}
          >
            <View style={styles.secondaryIcon}>
              <Ionicons name="barbell" size={20} color={Colors.signal[400]} />
            </View>
            <View style={styles.secondaryText}>
              <Text style={styles.secondaryTitle}>Log Workout</Text>
              <Text style={styles.secondarySubtitle}>
                {todaysFocus || 'Quick capture'}
              </Text>
            </View>
          </Pressable>

          {/* Quick Chat */}
          <Pressable
            onPress={onOpenCoach}
            style={({ pressed }) => [
              styles.secondaryAction,
              pressed && styles.secondaryActionPressed,
            ]}
          >
            <View style={styles.secondaryIcon}>
              <Ionicons name="flash" size={20} color={Colors.amber[400]} />
            </View>
            <View style={styles.secondaryText}>
              <Text style={styles.secondaryTitle}>Ask Coach</Text>
              <Text style={styles.secondarySubtitle}>Get quick advice</Text>
            </View>
          </Pressable>
        </View>
      </GlassCard>

      {/* Today's Quick Status (if there's a scheduled workout) */}
      {hasScheduledWorkout && todaysFocus && (
        <Pressable
          onPress={onLogWorkout}
          style={({ pressed }) => [
            styles.todayCard,
            pressed && { opacity: 0.8 },
          ]}
        >
          <View style={styles.todayPulse} />
          <View style={styles.todayContent}>
            <Text style={styles.todayLabel}>TODAY</Text>
            <Text style={styles.todayFocus}>{todaysFocus}</Text>
          </View>
          <View style={styles.todayAction}>
            <Text style={styles.todayActionText}>START</Text>
            <Ionicons name="play" size={14} color={Colors.emerald[400]} />
          </View>
        </Pressable>
      )}
    </View>
  );
}

// Day Indicator Component
function DayIndicator({ day }: { day: DayStatus }) {
  const getStatusStyle = () => {
    switch (day.status) {
      case 'completed':
        return {
          bg: Colors.emerald[500],
          border: Colors.emerald[400],
          textColor: '#000',
        };
      case 'scheduled':
        return {
          bg: day.isToday ? Colors.signal[500] : 'transparent',
          border: day.isToday ? Colors.signal[400] : Colors.graphite[600],
          textColor: day.isToday ? '#fff' : Colors.graphite[300],
        };
      case 'missed':
        return {
          bg: 'transparent',
          border: Colors.regression[500],
          textColor: Colors.regression[400],
        };
      case 'rest':
        return {
          bg: 'transparent',
          border: Colors.graphite[700],
          textColor: Colors.graphite[500],
        };
      default:
        return {
          bg: 'transparent',
          border: Colors.graphite[700],
          textColor: Colors.graphite[500],
        };
    }
  };

  const status = getStatusStyle();

  return (
    <View style={styles.dayContainer}>
      <Text style={[styles.dayLabel, { color: day.isToday ? Colors.signal[400] : Colors.graphite[500] }]}>
        {day.dayShort}
      </Text>
      <View
        style={[
          styles.dayDot,
          {
            backgroundColor: status.bg,
            borderColor: status.border,
          },
          day.isToday && styles.dayDotToday,
        ]}
      >
        {day.status === 'completed' && (
          <Ionicons name="checkmark" size={10} color="#000" />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  ambientGlow: {
    position: 'absolute',
    top: -50,
    left: '50%',
    marginLeft: -100,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.emerald[500],
    opacity: 0.05,
  },
  commandCard: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  phaseContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  phaseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.emerald[500],
    marginRight: 8,
  },
  phaseText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.emerald[400],
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  coachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.glass.white[5],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.glass.white[10],
  },
  weekStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  dayContainer: {
    alignItems: 'center',
    flex: 1,
  },
  dayLabel: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  dayDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayDotToday: {
    shadowColor: Colors.signal[500],
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  stat: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.graphite[50],
    fontFamily: 'monospace',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.graphite[500],
    letterSpacing: 1,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.glass.white[10],
  },
  divider: {
    height: 1,
    backgroundColor: Colors.glass.white[5],
    marginVertical: 16,
  },
  primaryAction: {
    backgroundColor: Colors.emerald[500],
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  primaryActionPressed: {
    backgroundColor: Colors.emerald[600],
    transform: [{ scale: 0.98 }],
  },
  primaryActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  primaryActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  primaryActionText: {
    flex: 1,
  },
  primaryActionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
    marginBottom: 2,
  },
  primaryActionSubtitle: {
    fontSize: 12,
    color: 'rgba(0, 0, 0, 0.6)',
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.glass.white[5],
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.glass.white[10],
  },
  secondaryActionPressed: {
    backgroundColor: Colors.glass.white[10],
  },
  secondaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.glass.white[5],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  secondaryText: {
    flex: 1,
  },
  secondaryTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.graphite[100],
    marginBottom: 1,
  },
  secondarySubtitle: {
    fontSize: 10,
    color: Colors.graphite[500],
  },
  todayCard: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.glass.blue[10],
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.glass.blue[20],
  },
  todayPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.signal[500],
    marginRight: 12,
  },
  todayContent: {
    flex: 1,
  },
  todayLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.signal[400],
    letterSpacing: 2,
    marginBottom: 2,
  },
  todayFocus: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.graphite[50],
  },
  todayAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  todayActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.emerald[400],
    letterSpacing: 1,
  },
});

export default CoachCommandCenter;
