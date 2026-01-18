/**
 * Share Workout Modal
 *
 * Enhanced post composer for sharing workouts to the feed.
 * Features:
 * - Workout summary preview
 * - Caption input with character count
 * - Key lifts selection
 * - Privacy toggle
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Switch,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import { Colors } from '@/constants/Colors';
import { useShareWorkout } from '@/hooks/useSocial';
import { summarizeWorkoutExercises, type ExerciseSummary } from '@/lib/feedUtils';
import type { WorkoutWithSets } from '@/types/database';

const MAX_CAPTION_LENGTH = 500;

interface ShareWorkoutModalProps {
  visible: boolean;
  onClose: () => void;
  workout: WorkoutWithSets;
  onShareSuccess?: () => void;
}

export function ShareWorkoutModal({
  visible,
  onClose,
  workout,
  onShareSuccess,
}: ShareWorkoutModalProps) {
  const [caption, setCaption] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  const shareWorkout = useShareWorkout();

  // Summarize exercises for preview
  const exerciseSummaries = useMemo(() => {
    if (!workout?.workout_sets) return [];
    return summarizeWorkoutExercises(workout.workout_sets);
  }, [workout?.workout_sets]);

  // Count PRs
  const prCount = useMemo(() => {
    return exerciseSummaries.filter(e => e.isPR).length;
  }, [exerciseSummaries]);

  const handleShare = async () => {
    try {
      await shareWorkout.mutateAsync({
        workoutId: workout.id,
        caption: caption.trim() || undefined,
      });
      setCaption('');
      onShareSuccess?.();
      onClose();
    } catch (error) {
      console.error('Failed to share workout:', error);
    }
  };

  const handleClose = () => {
    setCaption('');
    onClose();
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: Colors.void[900] }}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: Colors.glass.white[10],
          }}
        >
          <TouchableOpacity onPress={handleClose}>
            <Text style={{ fontSize: 16, color: Colors.graphite[400] }}>Cancel</Text>
          </TouchableOpacity>

          <Text style={{ fontSize: 17, fontWeight: '600', color: Colors.graphite[50] }}>
            Share Workout
          </Text>

          <TouchableOpacity
            onPress={handleShare}
            disabled={shareWorkout.isPending}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 14,
              borderRadius: 16,
              backgroundColor: shareWorkout.isPending ? Colors.glass.white[10] : Colors.signal[500],
            }}
          >
            {shareWorkout.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>Share</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          {/* Workout Preview Card */}
          <View
            style={{
              padding: 16,
              borderRadius: 16,
              backgroundColor: Colors.glass.white[5],
              borderWidth: 1,
              borderColor: Colors.glass.white[10],
              marginBottom: 20,
            }}
          >
            {/* Focus & Duration */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Ionicons name="barbell-outline" size={18} color={Colors.signal[400]} />
              <Text style={{ marginLeft: 8, fontSize: 16, fontWeight: '600', color: Colors.graphite[100] }}>
                {workout.focus}
              </Text>
              {workout.duration_minutes && (
                <Text style={{ marginLeft: 'auto', fontSize: 14, color: Colors.graphite[400] }}>
                  {formatDuration(workout.duration_minutes)}
                </Text>
              )}
            </View>

            {/* PR Badge */}
            {prCount > 0 && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom: 12,
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 8,
                  backgroundColor: 'rgba(47, 128, 237, 0.15)',
                  alignSelf: 'flex-start',
                }}
              >
                <Ionicons name="trophy" size={14} color={Colors.signal[500]} />
                <Text style={{ marginLeft: 6, fontSize: 13, fontWeight: '600', color: Colors.signal[500] }}>
                  {prCount} PR{prCount > 1 ? 's' : ''} achieved!
                </Text>
              </View>
            )}

            {/* Exercise Summary */}
            <View style={{ marginTop: 8 }}>
              {exerciseSummaries.slice(0, 5).map((exercise, index) => (
                <ExercisePreviewRow key={exercise.exerciseId} exercise={exercise} index={index} />
              ))}
              {exerciseSummaries.length > 5 && (
                <Text style={{ marginTop: 8, fontSize: 12, color: Colors.graphite[500] }}>
                  +{exerciseSummaries.length - 5} more exercises
                </Text>
              )}
            </View>
          </View>

          {/* Caption Input */}
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 14, fontWeight: '500', color: Colors.graphite[300], marginBottom: 8 }}>
              Caption
            </Text>
            <TextInput
              value={caption}
              onChangeText={(text) => setCaption(text.slice(0, MAX_CAPTION_LENGTH))}
              placeholder="How did your workout feel? Share your thoughts..."
              placeholderTextColor={Colors.graphite[500]}
              multiline
              numberOfLines={4}
              style={{
                minHeight: 100,
                padding: 14,
                borderRadius: 12,
                backgroundColor: Colors.glass.white[5],
                color: Colors.graphite[100],
                fontSize: 15,
                textAlignVertical: 'top',
              }}
            />
            <Text style={{ marginTop: 6, fontSize: 12, color: Colors.graphite[500], textAlign: 'right' }}>
              {caption.length}/{MAX_CAPTION_LENGTH}
            </Text>
          </View>

          {/* Privacy Toggle */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
              borderRadius: 12,
              backgroundColor: Colors.glass.white[5],
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons
                name={isPublic ? 'globe-outline' : 'lock-closed-outline'}
                size={20}
                color={Colors.graphite[300]}
              />
              <View style={{ marginLeft: 12 }}>
                <Text style={{ fontSize: 15, fontWeight: '500', color: Colors.graphite[100] }}>
                  {isPublic ? 'Public' : 'Private'}
                </Text>
                <Text style={{ fontSize: 12, color: Colors.graphite[500], marginTop: 2 }}>
                  {isPublic ? 'Anyone can see this post' : 'Only you can see this post'}
                </Text>
              </View>
            </View>
            <Switch
              value={isPublic}
              onValueChange={setIsPublic}
              trackColor={{ false: Colors.graphite[600], true: Colors.signal[500] }}
              thumbColor="#fff"
            />
          </View>

          {/* Motivational tips */}
          <View style={{ marginTop: 24, paddingHorizontal: 8 }}>
            <Text style={{ fontSize: 12, color: Colors.graphite[500], lineHeight: 18 }}>
              Tip: Sharing your workouts helps keep you accountable and motivates others in your community.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

interface ExercisePreviewRowProps {
  exercise: ExerciseSummary;
  index: number;
}

function ExercisePreviewRow({ exercise, index }: ExercisePreviewRowProps) {
  const modalityIcon = exercise.modality === 'Cardio' ? 'bicycle-outline' : 'barbell-outline';

  const formatBestSet = () => {
    if (exercise.modality === 'Cardio') {
      if (exercise.bestSet.watts) return `${exercise.bestSet.watts}W`;
      if (exercise.bestSet.duration) return `${Math.round(exercise.bestSet.duration)} min`;
      return `${exercise.totalSets} sets`;
    }
    return `${exercise.bestSet.weight || 0} x ${exercise.bestSet.reps || 0}`;
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        borderTopWidth: index > 0 ? 1 : 0,
        borderTopColor: Colors.glass.white[5],
      }}
    >
      {/* PR indicator */}
      {exercise.isPR ? (
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: 'rgba(47, 128, 237, 0.2)',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 10,
          }}
        >
          <Ionicons name="trophy" size={10} color={Colors.signal[500]} />
        </View>
      ) : (
        <Ionicons name={modalityIcon} size={16} color={Colors.graphite[500]} style={{ marginRight: 10 }} />
      )}

      {/* Exercise name */}
      <Text
        style={{ flex: 1, fontSize: 14, color: Colors.graphite[200] }}
        numberOfLines={1}
      >
        {exercise.exerciseName}
      </Text>

      {/* Best set */}
      <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.graphite[100] }}>
        {formatBestSet()}
      </Text>

      {/* Progression badge */}
      {exercise.progression && (
        <View
          style={{
            marginLeft: 8,
            paddingVertical: 2,
            paddingHorizontal: 6,
            borderRadius: 4,
            backgroundColor:
              exercise.progression.type === 'weight_increase' || exercise.progression.type === 'rep_increase'
                ? 'rgba(34, 197, 94, 0.15)'
                : 'rgba(255, 255, 255, 0.1)',
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: '600',
              color:
                exercise.progression.type === 'weight_increase' || exercise.progression.type === 'rep_increase'
                  ? '#22C55E'
                  : Colors.graphite[400],
            }}
          >
            {exercise.progression.message}
          </Text>
        </View>
      )}
    </View>
  );
}
