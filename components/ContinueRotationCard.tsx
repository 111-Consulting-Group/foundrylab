/**
 * Continue Rotation Card
 *
 * Shows the next workout in the user's detected rotation pattern,
 * with exercises from their last session of that type ready to continue.
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { View, Text, Pressable, Alert, ActivityIndicator } from 'react-native';

import { Colors } from '@/constants/Colors';
import { GlassCard, LabButton, StatPill } from '@/components/ui/LabPrimitives';
import { useRotationWithSession, type ExerciseSummary } from '@/hooks/useRotationAwareness';
import { useCreateWorkout, useAddWorkoutSet } from '@/hooks/useWorkouts';
import { useActiveTrainingBlock } from '@/hooks/useTrainingBlocks';
import { getReadinessColor } from '@/hooks/useReadiness';

interface ContinueRotationCardProps {
  onStartWorkout?: (workoutId: string) => void;
}

export function ContinueRotationCard({ onStartWorkout }: ContinueRotationCardProps) {
  const { data: rotation, isLoading } = useRotationWithSession();
  const { data: activeBlock } = useActiveTrainingBlock();
  const createWorkoutMutation = useCreateWorkout();
  const addSetMutation = useAddWorkoutSet();
  const [isCreating, setIsCreating] = useState(false);

  // Don't render if no rotation detected or still loading
  if (isLoading) {
    return (
      <GlassCard variant="subtle">
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12 }}>
          <ActivityIndicator size="small" color={Colors.signal[500]} />
          <Text style={{ marginLeft: 8, color: Colors.graphite[400], fontSize: 13 }}>
            Analyzing your training pattern...
          </Text>
        </View>
      </GlassCard>
    );
  }

  if (!rotation) {
    return null;
  }

  const { nextFocus, reason, daysSinceLast, lastSession, confidence, splitName, rotationPosition, rotationTotal, readiness } = rotation;

  // Handle starting the workout
  const handleStartWorkout = async () => {
    setIsCreating(true);
    try {
      // Create the workout
      const workout = await createWorkoutMutation.mutateAsync({
        focus: nextFocus,
        scheduled_date: new Date().toISOString().split('T')[0],
        block_id: activeBlock?.id || null,
      });

      // If we have a last session, pre-populate with those exercises
      if (lastSession && lastSession.exercises.length > 0) {
        let setOrder = 1;
        for (const exercise of lastSession.exercises) {
          // Add target sets (typically 3 per exercise)
          const targetSets = Math.max(exercise.sets, 3);
          for (let i = 0; i < targetSets; i++) {
            await addSetMutation.mutateAsync({
              workout_id: workout.id,
              exercise_id: exercise.exerciseId,
              set_order: setOrder++,
              target_reps: exercise.lastReps || 8,
              target_rpe: exercise.lastRPE || 8,
              target_weight: exercise.lastWeight || undefined,
            });
          }
        }
      }

      if (onStartWorkout) {
        onStartWorkout(workout.id);
      } else {
        router.push(`/workout/${workout.id}`);
      }
    } catch (error) {
      console.error('Failed to create workout:', error);
      Alert.alert('Error', 'Failed to create workout. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  // Handle choosing a different focus
  const handleDifferentFocus = () => {
    router.push('/workout/new?autoOpenPicker=true');
  };

  return (
    <GlassCard
      variant="elevated"
      active={confidence === 'high'}
      style={confidence === 'high' ? {
        shadowColor: Colors.signal[500],
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
      } : undefined}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="refresh-outline" size={18} color={Colors.signal[400]} />
          <Text style={{ marginLeft: 8, fontSize: 14, fontWeight: '600', color: Colors.signal[400] }}>
            Continue Your Training
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {/* Readiness Badge */}
          {readiness.hasCheckedIn && readiness.score !== null && (
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: `${getReadinessColor(readiness.score).bgHex}20`,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 6
            }}>
              <View style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: getReadinessColor(readiness.score).bgHex,
                marginRight: 4
              }} />
              <Text style={{ fontSize: 10, fontWeight: '600', color: getReadinessColor(readiness.score).textHex }}>
                {getReadinessColor(readiness.score).label}
              </Text>
            </View>
          )}
          {splitName && (
            <View style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
              <Text style={{ fontSize: 10, fontWeight: '600', fontFamily: 'monospace', color: Colors.signal[400] }}>
                {rotationPosition}/{rotationTotal} {splitName}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Readiness Alert */}
      {readiness.hasCheckedIn && readiness.adjustment && (readiness.adjustment === 'rest' || readiness.adjustment === 'light') && (
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          padding: 10,
          borderRadius: 8,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: 'rgba(245, 158, 11, 0.3)',
        }}>
          <Ionicons name="alert-circle-outline" size={16} color={Colors.oxide[500]} />
          <Text style={{ marginLeft: 8, fontSize: 12, color: Colors.oxide[400], flex: 1 }}>
            {readiness.message}
          </Text>
        </View>
      )}

      {/* Main Focus */}
      <View style={{ marginBottom: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: Colors.graphite[50], marginBottom: 4 }}>
          {nextFocus}
        </Text>
        <Text style={{ fontSize: 13, color: Colors.graphite[400] }}>
          {reason}
        </Text>
      </View>

      {/* Last Session Exercises Preview */}
      {lastSession && lastSession.exercises.length > 0 && (
        <View style={{ marginBottom: 16 }}>
          <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: 10, padding: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, color: Colors.graphite[500], marginBottom: 8 }}>
              From your last {nextFocus} session
            </Text>
            {lastSession.exercises.slice(0, 4).map((exercise, index) => (
              <ExercisePreviewRow key={exercise.exerciseId} exercise={exercise} isLast={index === Math.min(lastSession.exercises.length - 1, 3)} />
            ))}
            {lastSession.exercises.length > 4 && (
              <Text style={{ fontSize: 11, color: Colors.graphite[500], marginTop: 6 }}>
                +{lastSession.exercises.length - 4} more exercises
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Stats Row */}
      {lastSession && (
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          <View style={{ flex: 1 }}>
            <StatPill label="Exercises" value={lastSession.exercises.length} />
          </View>
          <View style={{ flex: 1 }}>
            <StatPill label="Sets" value={lastSession.totalSets} />
          </View>
          {lastSession.durationMinutes && (
            <View style={{ flex: 1 }}>
              <StatPill label="Est." value={lastSession.durationMinutes} unit="min" />
            </View>
          )}
        </View>
      )}

      {/* Action Buttons */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 2 }}>
          <LabButton
            label={`Start ${nextFocus}`}
            icon={<Ionicons name="play" size={16} color="white" />}
            onPress={handleStartWorkout}
            loading={isCreating}
          />
        </View>
        <View style={{ flex: 1 }}>
          <LabButton
            label="Other"
            variant="outline"
            onPress={handleDifferentFocus}
          />
        </View>
      </View>

      {/* Confidence indicator for low confidence */}
      {confidence === 'low' && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.08)' }}>
          <Ionicons name="information-circle-outline" size={14} color={Colors.graphite[500]} />
          <Text style={{ marginLeft: 6, fontSize: 11, color: Colors.graphite[500] }}>
            Based on limited data. Keep logging to improve suggestions.
          </Text>
        </View>
      )}
    </GlassCard>
  );
}

/**
 * Single exercise row in the preview
 */
function ExercisePreviewRow({ exercise, isLast }: { exercise: ExerciseSummary; isLast: boolean }) {
  const hasData = exercise.lastWeight && exercise.lastReps;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 6,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)',
      }}
    >
      <View style={{ flex: 1, marginRight: 8 }}>
        <Text style={{ fontSize: 13, color: Colors.graphite[200] }} numberOfLines={1}>
          {exercise.exerciseName}
        </Text>
      </View>
      {hasData ? (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 12, fontFamily: 'monospace', color: Colors.graphite[400] }}>
            {exercise.lastWeight}×{exercise.lastReps}
          </Text>
          {exercise.lastRPE && (
            <Text style={{ fontSize: 10, color: Colors.graphite[500], marginLeft: 4 }}>
              @{exercise.lastRPE}
            </Text>
          )}
          <Ionicons name="arrow-forward" size={12} color={Colors.graphite[600]} style={{ marginHorizontal: 6 }} />
          <ProgressionHint exercise={exercise} />
        </View>
      ) : (
        <Text style={{ fontSize: 12, fontFamily: 'monospace', color: Colors.graphite[500] }}>
          {exercise.sets} sets
        </Text>
      )}
    </View>
  );
}

/**
 * Simple progression hint based on typical patterns
 */
function ProgressionHint({ exercise }: { exercise: ExerciseSummary }) {
  // Simple heuristic: if RPE was moderate, suggest +5 lbs or +1 rep
  const rpe = exercise.lastRPE || 8;
  const weight = exercise.lastWeight || 0;
  const reps = exercise.lastReps || 8;

  let suggestion: string;
  let color = Colors.signal[400];

  if (rpe < 7) {
    // Easy - add reps
    suggestion = `${weight}×${reps + 1}`;
  } else if (rpe <= 8.5) {
    // Moderate - add weight
    const increment = weight >= 100 ? 5 : 2.5;
    suggestion = `${weight + increment}×${reps}`;
  } else {
    // Hard - maintain
    suggestion = `${weight}×${reps}`;
    color = Colors.graphite[400];
  }

  return (
    <Text style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: '600', color }}>
      {suggestion}
    </Text>
  );
}

/**
 * Compact version for inline display
 */
export function ContinueRotationBadge() {
  const { data: rotation } = useRotationWithSession();

  if (!rotation) return null;

  return (
    <Pressable
      onPress={() => router.push('/workout/new')}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.3)',
      }}
    >
      <Ionicons name="refresh-outline" size={14} color={Colors.signal[400]} />
      <Text style={{ marginLeft: 6, fontSize: 13, fontWeight: '600', color: Colors.signal[400] }}>
        Next: {rotation.nextFocus}
      </Text>
      {rotation.daysSinceLast !== null && (
        <Text style={{ marginLeft: 4, fontSize: 11, color: Colors.graphite[400] }}>
          ({rotation.daysSinceLast}d ago)
        </Text>
      )}
    </Pressable>
  );
}
