/**
 * WeeklyPlanCard
 * Beautiful visual display for weekly training plans
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';

import { Colors } from '@/constants/Colors';
import type { WeeklyPlan, PlannedDay, TrainingPhase } from '@/types/coach';

interface WeeklyPlanCardProps {
  plan: WeeklyPlan;
  onDayPress?: (day: PlannedDay) => void;
}

const PHASE_CONFIG: Record<TrainingPhase, { label: string; color: string; icon: string }> = {
  rebuilding: {
    label: 'Rebuilding',
    color: Colors.amber[400],
    icon: 'construct-outline',
  },
  accumulating: {
    label: 'Building Volume',
    color: Colors.signal[400],
    icon: 'trending-up-outline',
  },
  intensifying: {
    label: 'Intensifying',
    color: Colors.regression[400],
    icon: 'flame-outline',
  },
  maintaining: {
    label: 'Maintaining',
    color: Colors.emerald[400],
    icon: 'shield-checkmark-outline',
  },
  deloading: {
    label: 'Deload Week',
    color: Colors.emerald[400],
    icon: 'battery-charging-outline',
  },
};

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const DayCard = React.memo(function DayCard({
  day,
  onPress,
}: {
  day: PlannedDay;
  onPress?: () => void;
}) {
  const isToday = new Date().getDay() === (day.dayNumber === 7 ? 0 : day.dayNumber);

  return (
    <Pressable
      onPress={onPress}
      disabled={day.isRestDay}
      style={({ pressed }) => ({
        width: 72,
        marginRight: 10,
        borderRadius: 16,
        backgroundColor: day.isRestDay
          ? Colors.glass.white[2]
          : isToday
          ? Colors.glass.blue[20]
          : Colors.glass.white[5],
        borderWidth: 1,
        borderColor: isToday ? Colors.signal[500] : Colors.glass.white[10],
        padding: 10,
        alignItems: 'center',
        opacity: pressed && !day.isRestDay ? 0.8 : 1,
        transform: [{ scale: pressed && !day.isRestDay ? 0.97 : 1 }],
      })}
    >
      {/* Day Name */}
      <Text
        style={{
          fontSize: 10,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 1,
          color: isToday ? Colors.signal[400] : Colors.graphite[400],
          marginBottom: 4,
        }}
      >
        {DAY_NAMES[day.dayNumber - 1]}
      </Text>

      {/* Icon/Status */}
      {day.isRestDay ? (
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: Colors.glass.white[5],
            alignItems: 'center',
            justifyContent: 'center',
            marginVertical: 6,
          }}
        >
          <Ionicons name="bed-outline" size={16} color={Colors.graphite[500]} />
        </View>
      ) : (
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: isToday ? Colors.signal[500] : Colors.glass.white[10],
            alignItems: 'center',
            justifyContent: 'center',
            marginVertical: 6,
          }}
        >
          <Ionicons
            name="barbell-outline"
            size={16}
            color={isToday ? '#fff' : Colors.graphite[200]}
          />
        </View>
      )}

      {/* Focus Label */}
      <Text
        numberOfLines={1}
        style={{
          fontSize: 10,
          fontWeight: '500',
          color: day.isRestDay ? Colors.graphite[500] : Colors.graphite[200],
          textAlign: 'center',
        }}
      >
        {day.isRestDay ? 'Rest' : day.focus || 'Training'}
      </Text>

      {/* Exercise Count */}
      {!day.isRestDay && day.exercises && (
        <Text
          style={{
            fontSize: 9,
            color: Colors.graphite[500],
            marginTop: 2,
          }}
        >
          {day.exercises.length} exercises
        </Text>
      )}
    </Pressable>
  );
});

export const WeeklyPlanCard = React.memo(function WeeklyPlanCard({
  plan,
  onDayPress,
}: WeeklyPlanCardProps) {
  const [expanded, setExpanded] = useState(false);
  const phaseConfig = PHASE_CONFIG[plan.phase];

  const toggleExpanded = () => {
    setExpanded(!expanded);
  };

  return (
    <View
      style={{
        borderRadius: 20,
        backgroundColor: Colors.void[800],
        borderWidth: 1,
        borderColor: Colors.glass.white[10],
        overflow: 'hidden',
        marginVertical: 12,
      }}
    >
      {/* Header */}
      <Pressable
        onPress={toggleExpanded}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          padding: 16,
          backgroundColor: pressed ? Colors.glass.white[5] : Colors.glass.white[2],
          borderBottomWidth: 1,
          borderBottomColor: Colors.glass.white[5],
        })}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            backgroundColor: Colors.glass.white[10],
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="calendar" size={18} color={Colors.signal[400]} />
        </View>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: '600',
              color: Colors.graphite[100],
            }}
          >
            This Week's Plan
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
            <Ionicons
              name={phaseConfig.icon as keyof typeof Ionicons.glyphMap}
              size={12}
              color={phaseConfig.color}
            />
            <Text
              style={{
                fontSize: 12,
                color: phaseConfig.color,
                marginLeft: 4,
                fontWeight: '500',
              }}
            >
              {phaseConfig.label}
            </Text>
          </View>
        </View>

        <View style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}>
          <Ionicons name="chevron-down" size={20} color={Colors.graphite[400]} />
        </View>
      </Pressable>

      {/* Day Cards */}
      <View style={{ padding: 12 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 8 }}
        >
          {plan.days.map((day) => (
            <DayCard
              key={day.dayNumber}
              day={day}
              onPress={() => onDayPress?.(day)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Expanded Rationale */}
      {expanded && (
        <View
          style={{
            padding: 16,
            paddingTop: 8,
            borderTopWidth: 1,
            borderTopColor: Colors.glass.white[5],
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: 1,
              color: Colors.graphite[500],
              marginBottom: 8,
            }}
          >
            Coach's Reasoning
          </Text>
          <Text
            style={{
              fontSize: 14,
              lineHeight: 20,
              color: Colors.graphite[300],
            }}
          >
            {plan.rationale}
          </Text>

          {plan.adjustmentsApplied && plan.adjustmentsApplied.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  color: Colors.graphite[500],
                  marginBottom: 6,
                }}
              >
                Adjustments Applied
              </Text>
              {plan.adjustmentsApplied.map((adj, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 4,
                  }}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={14}
                    color={Colors.emerald[400]}
                  />
                  <Text
                    style={{
                      marginLeft: 6,
                      fontSize: 13,
                      color: Colors.graphite[300],
                    }}
                  >
                    {adj}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
});
