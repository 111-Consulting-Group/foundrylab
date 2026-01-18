/**
 * Inferred Program Card
 *
 * Shows users the program we've learned from watching their workouts.
 * "We've been paying attention. Here's what you do. Want us to structure it?"
 *
 * Non-intrusive, dismissible, and shows clear value proposition.
 */

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';

import { GlassCard, LabButton } from '@/components/ui/LabPrimitives';
import { Colors } from '@/constants/Colors';
import {
  usePatternToProgram,
  useAcceptInferredProgram,
  type InferredProgram,
  type InferredWorkoutDay,
} from '@/hooks/usePatternToProgram';
import { useBlockBuilder } from '@/hooks/useBlockBuilder';

// ============================================================================
// Subcomponents
// ============================================================================

function WorkoutDayPreview({ day }: { day: InferredWorkoutDay }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Pressable
      onPress={() => setExpanded(!expanded)}
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 8,
        padding: 10,
        marginBottom: 8,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.graphite[200] }}>
            {day.focus}
          </Text>
          <Text style={{ fontSize: 11, color: Colors.graphite[500] }}>
            {day.exercises.length} exercises · ~{day.typicalDuration} min
          </Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={Colors.graphite[400]}
        />
      </View>

      {expanded && (
        <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.05)' }}>
          {day.exercises.slice(0, 5).map((ex, i) => (
            <View
              key={ex.exercise.id}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginBottom: i < day.exercises.length - 1 ? 4 : 0,
              }}
            >
              <Text style={{ fontSize: 12, color: Colors.graphite[300], flex: 1 }} numberOfLines={1}>
                {ex.exercise.name}
              </Text>
              <Text style={{ fontSize: 11, fontFamily: 'monospace', color: Colors.graphite[500] }}>
                {ex.typicalSets}×{ex.typicalReps}
              </Text>
            </View>
          ))}
          {day.exercises.length > 5 && (
            <Text style={{ fontSize: 10, color: Colors.graphite[500], marginTop: 4 }}>
              +{day.exercises.length - 5} more
            </Text>
          )}
        </View>
      )}
    </Pressable>
  );
}

function ConfidenceMeter({ confidence }: { confidence: number }) {
  const percentage = Math.round(confidence * 100);
  const color =
    confidence >= 0.8 ? Colors.emerald[400] :
    confidence >= 0.6 ? Colors.signal[400] :
    Colors.amber[400];

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View
        style={{
          flex: 1,
          height: 4,
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${percentage}%`,
            height: '100%',
            backgroundColor: color,
            borderRadius: 2,
          }}
        />
      </View>
      <Text style={{ fontSize: 11, fontFamily: 'monospace', color }}>
        {percentage}%
      </Text>
    </View>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface InferredProgramCardProps {
  onDismiss?: () => void;
}

export function InferredProgramCard({ onDismiss }: InferredProgramCardProps) {
  const { data, isLoading } = usePatternToProgram();
  const acceptProgram = useAcceptInferredProgram();
  const [isCreating, setIsCreating] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  if (isLoading || !data?.isReady || !data.inferredProgram || isDismissed) {
    return null;
  }

  const program = data.inferredProgram;

  const handleAccept = async () => {
    setIsCreating(true);
    try {
      // Mark as accepted
      await acceptProgram(true);

      // Navigate to block builder with pre-filled data
      router.push({
        pathname: '/block-builder',
        params: {
          prefill: JSON.stringify({
            splitName: program.splitName,
            splitType: program.splitType,
            daysPerWeek: program.daysPerWeek,
            workoutDays: program.workoutDays,
          }),
        },
      });
    } catch (error) {
      console.error('Failed to accept program:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDismiss = async () => {
    await acceptProgram(false);
    setIsDismissed(true);
    onDismiss?.();
  };

  return (
    <GlassCard
      style={{
        borderWidth: 1,
        borderColor: Colors.emerald[500] + '30',
        backgroundColor: Colors.emerald[500] + '08',
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: Colors.emerald[500] + '20',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}
        >
          <Ionicons name="bulb" size={20} color={Colors.emerald[400]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: Colors.graphite[100] }}>
            We've learned your routine
          </Text>
          <Text style={{ fontSize: 12, color: Colors.graphite[400], marginTop: 2 }}>
            {program.workoutsAnalyzed} workouts over {program.weeksOfData} weeks
          </Text>
        </View>
        <Pressable
          onPress={handleDismiss}
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="close" size={16} color={Colors.graphite[500]} />
        </Pressable>
      </View>

      {/* Split Summary */}
      <View
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          borderRadius: 8,
          padding: 12,
          marginBottom: 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Ionicons name="calendar-outline" size={16} color={Colors.signal[400]} />
          <Text style={{ marginLeft: 8, fontSize: 14, fontWeight: '600', color: Colors.graphite[200] }}>
            {program.splitName}
          </Text>
          <View
            style={{
              marginLeft: 'auto',
              paddingHorizontal: 8,
              paddingVertical: 2,
              backgroundColor: Colors.signal[500] + '20',
              borderRadius: 4,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '600', color: Colors.signal[400] }}>
              {program.daysPerWeek}x/week
            </Text>
          </View>
        </View>

        <Text style={{ fontSize: 13, color: Colors.graphite[300], marginBottom: 8 }}>
          {program.summary}
        </Text>

        {/* Highlights */}
        <View style={{ gap: 4 }}>
          {program.highlights.map((highlight, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: Colors.graphite[500],
                  marginRight: 8,
                }}
              />
              <Text style={{ fontSize: 12, color: Colors.graphite[400] }}>
                {highlight}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Workout Days Preview */}
      <Text
        style={{
          fontSize: 11,
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          color: Colors.graphite[400],
          marginBottom: 8,
        }}
      >
        Your typical rotation
      </Text>

      <ScrollView
        style={{ maxHeight: 200 }}
        showsVerticalScrollIndicator={false}
      >
        {program.workoutDays.map((day) => (
          <WorkoutDayPreview key={day.dayNumber} day={day} />
        ))}
      </ScrollView>

      {/* Confidence */}
      <View style={{ marginTop: 12, marginBottom: 16 }}>
        <Text style={{ fontSize: 11, color: Colors.graphite[500], marginBottom: 4 }}>
          Pattern confidence
        </Text>
        <ConfidenceMeter confidence={program.confidence} />
      </View>

      {/* Actions */}
      <View style={{ gap: 8 }}>
        <LabButton
          label="Build My Program"
          icon={
            isCreating ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Ionicons name="hammer" size={16} color="white" />
            )
          }
          onPress={handleAccept}
          disabled={isCreating}
        />
        <Text style={{ fontSize: 11, color: Colors.graphite[500], textAlign: 'center' }}>
          We'll create a 4-week block based on your routine
        </Text>
      </View>
    </GlassCard>
  );
}

// ============================================================================
// Progress Card (shown while learning)
// ============================================================================

export function LearningProgressCard() {
  const { data, isLoading } = usePatternToProgram();

  if (isLoading || !data || data.isReady) {
    return null;
  }

  const progress = Math.min(100, Math.round((data.workoutsLogged / data.workoutsNeeded) * 100));

  return (
    <View
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        borderRadius: 8,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: Colors.signal[500] + '15',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}
      >
        <Ionicons name="eye-outline" size={16} color={Colors.signal[400]} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 12, color: Colors.graphite[300] }}>
          Learning your routine...
        </Text>
        <Text style={{ fontSize: 11, color: Colors.graphite[500] }}>
          {data.readyReason}
        </Text>
      </View>
      <Text style={{ fontSize: 12, fontFamily: 'monospace', color: Colors.signal[400] }}>
        {progress}%
      </Text>
    </View>
  );
}
