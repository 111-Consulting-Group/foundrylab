import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState, useMemo } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable, Alert, Platform, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoachButton } from '@/components/CoachChat';
import { useLogout } from '@/hooks/useAuth';
import {
  GlassCard,
  LabCard,
  LabStat,
  LabButton,
  StatPill,
  SectionLabel,
  LiveIndicator,
} from '@/components/ui/LabPrimitives';
import { DeltaTag } from '@/components/ui/DeltaTag';
import { MovementMemoryCard } from '@/components/MovementMemoryCard';
import { MuscleGroupBreakdown } from '@/components/MuscleGroupBreakdown';
import { ContinueRotationCard } from '@/components/ContinueRotationCard';
import { FoundryLabLogo } from '@/components/FoundryLabLogo';
import {
  JourneyUpgradePrompt,
  JourneyIndicator,
  NewUserJourneyPrompt,
} from '@/components/JourneyUpgradePrompt';
import { Colors } from '@/constants/Colors';

import {
  useNextWorkout,
  useWorkoutHistory,
  useTodaysWorkout,
  useCreateWorkout,
  useAddWorkoutSet,
} from '@/hooks/useWorkouts';
import { useActiveTrainingBlock } from '@/hooks/useTrainingBlocks';
import { useMainLiftPRs } from '@/hooks/usePersonalRecords';
import { useNextTimeSuggestion } from '@/hooks/useMovementMemory';
import { useDailyWorkoutSuggestion, useQuickWorkoutOptions } from '@/hooks/useDailyWorkout';
import { useReadinessAwareWorkout, useShouldPromptReadiness } from '@/hooks/useReadinessAwareWorkout';
import { useTodaysReadiness, getReadinessColor } from '@/hooks/useReadiness';
import { summarizeWorkoutExercises, formatExerciseForFeed } from '@/lib/feedUtils';
import { generateExerciseSummary } from '@/lib/workoutSummary';
import { useWeekSummary } from '@/hooks/useWeekSummary';
import { useNextInRotation } from '@/hooks/useRotationAwareness';
import { useJourneyFeatures } from '@/hooks/useJourneyDetection';

export default function DashboardScreen() {
  const logoutMutation = useLogout();

  // Data Fetching
  const { data: nextWorkout, isLoading: loadingNext } = useNextWorkout();
  const { data: todaysWorkout, isLoading: loadingToday } = useTodaysWorkout();
  const { data: activeBlock } = useActiveTrainingBlock();
  const { data: history = [], isLoading: loadingHistory, refetch: refetchHistory } = useWorkoutHistory(1);
  const { data: mainLifts = [], isLoading: loadingLifts } = useMainLiftPRs();

  // Week summary for muscle group breakdown
  const { data: weekSummary } = useWeekSummary();

  // Rotation awareness (for Primary user: pattern-based training)
  const { data: rotationSuggestion, isLoading: loadingRotation } = useNextInRotation();

  // Daily workout suggestion (for Journey 3: Guided users)
  const { data: dailySuggestion, isLoading: loadingSuggestion } = useDailyWorkoutSuggestion();
  const { data: readinessAwareWorkout } = useReadinessAwareWorkout();
  const { data: todaysReadiness } = useTodaysReadiness();
  const { shouldPrompt: shouldPromptReadiness } = useShouldPromptReadiness();
  const quickOptions = useQuickWorkoutOptions();
  const createWorkoutMutation = useCreateWorkout();
  const addSetMutation = useAddWorkoutSet();

  // Journey detection - adapts UI based on user behavior
  const {
    journey,
    confidence,
    features,
    isNewUser,
    suggestedUpgrade,
  } = useJourneyFeatures();

  // Modal state for workout generator
  const [showGeneratorModal, setShowGeneratorModal] = useState(false);
  const [isCreatingWorkout, setIsCreatingWorkout] = useState(false);

  // Handle creating a workout from suggestion
  const handleCreateFromSuggestion = async () => {
    if (!dailySuggestion) return;

    setIsCreatingWorkout(true);
    try {
      // Create the workout
      const workout = await createWorkoutMutation.mutateAsync({
        focus: dailySuggestion.focus,
        scheduled_date: new Date().toISOString().split('T')[0],
        block_id: activeBlock?.id || null,
      });

      // Add suggested exercises as sets
      let setOrder = 1;
      for (const suggested of dailySuggestion.exercises) {
        for (let i = 0; i < suggested.sets; i++) {
          await addSetMutation.mutateAsync({
            workout_id: workout.id,
            exercise_id: suggested.exercise.id,
            set_order: setOrder++,
            target_reps: suggested.targetReps,
            target_rpe: suggested.targetRPE,
          });
        }
      }

      setShowGeneratorModal(false);
      router.push(`/workout/${workout.id}`);
    } catch (error) {
      console.error('Failed to create workout:', error);
      Alert.alert('Error', 'Failed to create workout. Please try again.');
    } finally {
      setIsCreatingWorkout(false);
    }
  };

  // Handle selecting a quick option
  const handleQuickOption = async (optionId: string) => {
    const option = quickOptions.find((o) => o.id === optionId);
    if (!option) return;

    setIsCreatingWorkout(true);
    try {
      const workout = await createWorkoutMutation.mutateAsync({
        focus: option.label,
        scheduled_date: new Date().toISOString().split('T')[0],
        block_id: activeBlock?.id || null,
      });

      setShowGeneratorModal(false);
      router.push(`/workout/${workout.id}?autoOpenPicker=true`);
    } catch (error) {
      console.error('Failed to create workout:', error);
      Alert.alert('Error', 'Failed to create workout. Please try again.');
    } finally {
      setIsCreatingWorkout(false);
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to log out?');
      if (confirmed) {
        logoutMutation.mutate();
      }
    } else {
      Alert.alert(
        'Log Out',
        'Are you sure you want to log out?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log Out', style: 'destructive', onPress: () => logoutMutation.mutate() },
        ]
      );
    }
  };

  const activeSession = nextWorkout || todaysWorkout;
  const lastSession = history[0];

  const handleRefresh = () => {
    refetchHistory();
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.void[900] }}>
      {/* Ambient Background Glows */}
      <View
        style={{
          position: 'absolute',
          top: -100,
          left: -100,
          width: 300,
          height: 300,
          backgroundColor: 'rgba(37, 99, 235, 0.08)',
          borderRadius: 150,
          // Note: blur effect requires BlurView on native, this creates a soft glow
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: 50,
          right: -100,
          width: 350,
          height: 350,
          backgroundColor: 'rgba(37, 99, 235, 0.05)',
          borderRadius: 175,
        }}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
          refreshControl={
            <RefreshControl
              refreshing={loadingHistory || loadingToday}
              onRefresh={handleRefresh}
              tintColor={Colors.signal[500]}
            />
          }
        >
          {/* Header */}
          <View
            style={{
              paddingVertical: 16,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <FoundryLabLogo size={40} />
              <View>
                <SectionLabel>Foundry Lab</SectionLabel>
                <LiveIndicator />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={() => router.push('/scan-workout')}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="camera-outline" size={22} color={Colors.signal[500]} />
              </Pressable>
              <Pressable
                onPress={handleLogout}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="log-out-outline" size={22} color={Colors.graphite[400]} />
              </Pressable>
            </View>
          </View>

          {/* Journey Upgrade Prompt - shows when behavior suggests a journey change */}
          {suggestedUpgrade && !isNewUser && (
            <View style={{ marginBottom: 16 }}>
              <JourneyUpgradePrompt
                from={suggestedUpgrade.from}
                to={suggestedUpgrade.to}
                reason={suggestedUpgrade.reason}
                prompt={suggestedUpgrade.prompt}
                onAccept={() => {
                  if (suggestedUpgrade.to === 'planner') {
                    router.push('/block-builder');
                  } else if (suggestedUpgrade.to === 'guided') {
                    router.push('/readiness');
                  }
                }}
              />
            </View>
          )}

          {/* Hero: Today's Target - Glass Card */}
          <View style={{ marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  color: Colors.graphite[300],
                }}
              >
                Today's Target
              </Text>
              {!isNewUser && confidence !== 'low' && (
                <JourneyIndicator journey={journey} confidence={confidence} />
              )}
            </View>

            {/* New user journey selection */}
            {isNewUser && !activeSession ? (
              <NewUserJourneyPrompt
                onSelectFreestyle={() => router.push('/workout/new?autoOpenPicker=true')}
                onSelectPlanner={() => router.push('/block-builder')}
                onSelectGuided={() => router.push('/readiness')}
              />
            ) : activeSession ? (
              <GlassCard
                variant="elevated"
                active={true}
                style={{
                  shadowColor: Colors.signal[500],
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: 0.3,
                  shadowRadius: 30,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={{ fontSize: 20, fontWeight: '700', color: Colors.graphite[50], marginBottom: 4 }}>
                      {activeSession.focus}
                    </Text>
                    <Text style={{ fontSize: 13, color: Colors.graphite[300] }}>
                      {activeSession.workout_sets?.length || 0} Exercises · ~{activeSession.duration_minutes || 45} min
                    </Text>
                    {activeBlock && (
                      <Text style={{ fontSize: 11, fontFamily: 'monospace', color: Colors.graphite[500], marginTop: 4 }}>
                        {activeBlock.name}
                      </Text>
                    )}
                  </View>
                  {activeSession.week_number && (
                    <View
                      style={{
                        backgroundColor: 'rgba(59, 130, 246, 0.2)',
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 6,
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', fontFamily: 'monospace', color: Colors.signal[400] }}>
                        W{activeSession.week_number}:D{activeSession.day_number}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Quick Stats Row */}
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                  <View style={{ flex: 1 }}>
                    <StatPill label="Sets" value={activeSession.workout_sets?.length || 0} unit="total" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <StatPill label="Est." value={activeSession.duration_minutes || 45} unit="min" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <StatPill label="Focus" value="Strength" />
                  </View>
                </View>

                <LabButton
                  label="Start Session"
                  icon={<Ionicons name="play" size={16} color="white" />}
                  onPress={() => router.push(`/workout/${activeSession.id}`)}
                />
              </GlassCard>
            ) : rotationSuggestion ? (
              /* Priority 2: Pattern-based rotation (Primary User Journey) */
              <ContinueRotationCard />
            ) : dailySuggestion ? (
              /* Priority 3: AI-generated suggestion (Journey 3: Guided) */
              <GlassCard>
                <View style={{ paddingVertical: 8 }}>
                  {/* Header with readiness indicator */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="sparkles" size={18} color={Colors.signal[400]} />
                      <Text style={{ marginLeft: 8, fontSize: 14, fontWeight: '600', color: Colors.signal[400] }}>
                        {readinessAwareWorkout?.readinessScore ? 'Adjusted for You' : 'Recommended for You'}
                      </Text>
                    </View>
                    {/* Readiness badge if available */}
                    {readinessAwareWorkout?.readinessScore && (
                      <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 12,
                        backgroundColor: getReadinessColor(readinessAwareWorkout.readinessScore).bgHex + '20',
                      }}>
                        <View style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: getReadinessColor(readinessAwareWorkout.readinessScore).bgHex,
                          marginRight: 6,
                        }} />
                        <Text style={{
                          fontSize: 11,
                          fontWeight: '600',
                          color: getReadinessColor(readinessAwareWorkout.readinessScore).textHex,
                        }}>
                          {getReadinessColor(readinessAwareWorkout.readinessScore).label}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Prompt to check in if no readiness */}
                  {shouldPromptReadiness && journey === 'guided' && (
                    <Pressable
                      onPress={() => router.push('/readiness')}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        padding: 10,
                        borderRadius: 8,
                        backgroundColor: Colors.amber[500] + '15',
                        borderWidth: 1,
                        borderColor: Colors.amber[500] + '30',
                        marginBottom: 12,
                      }}
                    >
                      <Ionicons name="pulse-outline" size={18} color={Colors.amber[400]} />
                      <Text style={{ marginLeft: 8, fontSize: 12, color: Colors.amber[300], flex: 1 }}>
                        Quick check-in helps us tailor your workout
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={Colors.amber[400]} />
                    </Pressable>
                  )}

                  {/* Suggest rest if readiness is very low */}
                  {readinessAwareWorkout?.suggestRest ? (
                    <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                      <Ionicons name="bed-outline" size={48} color={Colors.graphite[400]} />
                      <Text style={{ fontSize: 18, fontWeight: '600', color: Colors.graphite[200], marginTop: 12, marginBottom: 4 }}>
                        Rest Day Recommended
                      </Text>
                      <Text style={{ fontSize: 13, color: Colors.graphite[400], textAlign: 'center', marginBottom: 16 }}>
                        {readinessAwareWorkout.restReason}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <LabButton
                          label="Light Mobility"
                          variant="outline"
                          size="sm"
                          icon={<Ionicons name="body-outline" size={14} color={Colors.graphite[50]} />}
                          onPress={() => router.push('/workout/new?focus=mobility')}
                        />
                        <LabButton
                          label="Train Anyway"
                          variant="outline"
                          size="sm"
                          onPress={handleCreateFromSuggestion}
                        />
                      </View>
                    </View>
                  ) : (
                    <>
                      <View style={{ marginBottom: 16 }}>
                        <Text style={{ fontSize: 20, fontWeight: '700', color: Colors.graphite[50], marginBottom: 4 }}>
                          {dailySuggestion.focus}
                        </Text>
                        <Text style={{ fontSize: 13, color: Colors.graphite[400], marginBottom: 8 }}>
                          {readinessAwareWorkout?.adjustmentSummary || dailySuggestion.reason}
                        </Text>

                        {/* Exercise preview with adjustments */}
                        <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: 8, padding: 10 }}>
                          {(readinessAwareWorkout?.adjustedExercises || dailySuggestion.exercises).slice(0, 3).map((ex, i) => (
                            <View key={ex.exercise.id} style={{ marginBottom: i < 2 ? 6 : 0 }}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ fontSize: 13, color: Colors.graphite[300], flex: 1 }} numberOfLines={1}>
                                  {ex.exercise.name}
                                </Text>
                                <Text style={{ fontSize: 12, fontFamily: 'monospace', color: Colors.graphite[500] }}>
                                  {ex.sets}×{ex.targetReps}
                                </Text>
                              </View>
                              {/* Show adjustment note if exercise was adjusted */}
                              {'wasAdjusted' in ex && ex.wasAdjusted && ex.adjustmentNote && (
                                <Text style={{ fontSize: 10, color: Colors.amber[400], marginTop: 2 }}>
                                  {ex.adjustmentNote}
                                </Text>
                              )}
                            </View>
                          ))}
                          {dailySuggestion.exercises.length > 3 && (
                            <Text style={{ fontSize: 11, color: Colors.graphite[500], marginTop: 4 }}>
                              +{dailySuggestion.exercises.length - 3} more exercises
                            </Text>
                          )}
                        </View>

                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                          <View style={{ flex: 1 }}>
                            <StatPill
                              label="Est."
                              value={readinessAwareWorkout?.estimatedDuration || dailySuggestion.estimatedDuration}
                              unit="min"
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <StatPill label="Exercises" value={dailySuggestion.exercises.length} />
                          </View>
                        </View>
                      </View>

                      <LabButton
                        label="Start This Workout"
                        icon={<Ionicons name="play" size={16} color="white" />}
                        onPress={handleCreateFromSuggestion}
                        loading={isCreatingWorkout}
                      />
                    </>
                  )}

                  <View style={{ height: 1, backgroundColor: 'rgba(255, 255, 255, 0.08)', marginVertical: 16 }} />

                  {/* Alternative options */}
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, color: Colors.graphite[500], textAlign: 'center', marginBottom: 12 }}>
                      Or choose a different option:
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                      <LabButton
                        label="Scan"
                        variant="outline"
                        size="sm"
                        icon={<Ionicons name="camera-outline" size={14} color={Colors.graphite[50]} />}
                        onPress={() => router.push('/scan-workout')}
                      />
                      <LabButton
                        label="Quick Log"
                        variant="outline"
                        size="sm"
                        icon={<Ionicons name="add-circle-outline" size={14} color={Colors.graphite[50]} />}
                        onPress={() => router.push('/workout/new?autoOpenPicker=true')}
                      />
                    </View>
                  </View>
                </View>
              </GlassCard>
            ) : (
              /* Priority 4: Journey-aware fallback */
              <GlassCard>
                <View style={{ paddingVertical: 8, alignItems: 'center' }}>
                  <FoundryLabLogo size={48} style={{ marginBottom: 12 }} />
                  <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.graphite[200], marginBottom: 4 }}>
                    {journey === 'freestyler'
                      ? 'Ready to Train?'
                      : journey === 'planner'
                      ? 'No Workout Scheduled'
                      : 'Check In First'}
                  </Text>
                  <Text style={{ fontSize: 12, color: Colors.graphite[500], textAlign: 'center', marginBottom: 12 }}>
                    {journey === 'freestyler'
                      ? 'Start logging and we\'ll remember your exercises.'
                      : journey === 'planner'
                      ? 'Build a new program or log a freestyle session.'
                      : 'Log your readiness to get a personalized workout.'}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {/* Primary action based on journey */}
                    {journey === 'freestyler' ? (
                      <LabButton
                        label="Start Workout"
                        icon={<Ionicons name="add-circle-outline" size={14} color="white" />}
                        size="sm"
                        onPress={() => router.push('/workout/new?autoOpenPicker=true')}
                      />
                    ) : journey === 'planner' ? (
                      <LabButton
                        label="Build Program"
                        icon={<Ionicons name="calendar-outline" size={14} color="white" />}
                        size="sm"
                        onPress={() => router.push('/block-builder')}
                      />
                    ) : (
                      <LabButton
                        label="Check In"
                        icon={<Ionicons name="pulse-outline" size={14} color="white" />}
                        size="sm"
                        onPress={() => router.push('/readiness')}
                      />
                    )}
                    {/* Secondary options */}
                    <LabButton
                      label="Scan"
                      variant="outline"
                      size="sm"
                      icon={<Ionicons name="camera-outline" size={14} color={Colors.graphite[50]} />}
                      onPress={() => router.push('/scan-workout')}
                    />
                    {journey !== 'freestyler' && (
                      <LabButton
                        label="Quick Log"
                        variant="outline"
                        size="sm"
                        icon={<Ionicons name="add-circle-outline" size={14} color={Colors.graphite[50]} />}
                        onPress={() => router.push('/workout/new?autoOpenPicker=true')}
                      />
                    )}
                  </View>
                </View>
              </GlassCard>
            )}
          </View>

          {/* Last Session Receipt */}
          {lastSession && (
            <View style={{ marginBottom: 24 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  color: Colors.graphite[300],
                  marginBottom: 8,
                }}
              >
                Last Session Receipt
              </Text>
              <Pressable onPress={() => router.push(`/workout-summary/${lastSession.id}`)}>
                <GlassCard variant="subtle">
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: Colors.graphite[200] }}>
                      {lastSession.focus}
                    </Text>
                    <Text style={{ fontSize: 11, fontFamily: 'monospace', color: Colors.graphite[500] }}>
                      {new Date(lastSession.date_completed!).toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                  </View>

                  {/* Exercise Highlights */}
                  <View style={{ gap: 8 }}>
                    {(() => {
                      const exerciseMap = new Map<string, any[]>();
                      (lastSession.workout_sets || []).forEach((set: any) => {
                        if (!set.exercise_id || set.is_warmup || set.segment_type === 'warmup') return;
                        const isCardio = set.exercise?.modality === 'Cardio';
                        if (isCardio && !set.distance_meters && !set.duration_seconds && !set.avg_pace) return;
                        if (!isCardio && set.actual_weight === null && set.actual_reps === null) return;

                        const key = set.exercise_id;
                        if (!exerciseMap.has(key)) exerciseMap.set(key, []);
                        const existing = exerciseMap.get(key)!;
                        const isDuplicate = existing.some(
                          (s) =>
                            (set.id && s.id && set.id === s.id) ||
                            (!set.id && !s.id && set.set_order === s.set_order && set.exercise_id === s.exercise_id)
                        );
                        if (!isDuplicate) existing.push(set);
                      });

                      return Array.from(exerciseMap.entries())
                        .slice(0, 3)
                        .map(([exerciseId, exerciseSets]) => {
                          const exercise = exerciseSets[0]?.exercise;
                          if (!exercise) return null;
                          const summary = generateExerciseSummary(exercise, exerciseSets);
                          return (
                            <View
                              key={exerciseId}
                              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                            >
                              <Text
                                style={{ fontSize: 13, color: Colors.graphite[300], flex: 1 }}
                                numberOfLines={1}
                              >
                                {exercise.name}
                              </Text>
                              <Text style={{ fontSize: 13, fontFamily: 'monospace', color: Colors.graphite[200] }}>
                                {summary}
                              </Text>
                            </View>
                          );
                        })
                        .filter(Boolean);
                    })()}
                  </View>

                  {/* View More Hint */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12 }}>
                    <Text style={{ fontSize: 10, color: Colors.graphite[500], marginRight: 4 }}>View Details</Text>
                    <Ionicons name="chevron-forward" size={12} color={Colors.graphite[500]} />
                  </View>
                </GlassCard>
              </Pressable>
            </View>
          )}

          {/* Weekly Volume by Muscle Group */}
          {weekSummary && weekSummary.muscleGroups.length > 0 && (
            <View style={{ marginBottom: 24 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  color: Colors.graphite[300],
                  marginBottom: 8,
                }}
              >
                Weekly Volume
              </Text>
              <MuscleGroupBreakdown
                muscleGroups={weekSummary.muscleGroups}
                compact={true}
                showTitle={false}
              />
            </View>
          )}

          {/* Next Time Targets */}
          {mainLifts.length > 0 && (
            <View style={{ marginBottom: 24 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  color: Colors.graphite[300],
                  marginBottom: 8,
                }}
              >
                Next Time Targets
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16, paddingHorizontal: 16 }}>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  {mainLifts.slice(0, 3).map((lift) => (
                    <NextTimeHighlight key={lift.exerciseId} exerciseId={lift.exerciseId} exerciseName={lift.exerciseName} />
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Bottom Actions - Journey-aware */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {journey === 'freestyler' ? (
              <>
                <View style={{ flex: 1 }}>
                  <LabButton
                    label="Quick Start"
                    variant="outline"
                    icon={<Ionicons name="flash-outline" size={14} color={Colors.graphite[300]} />}
                    onPress={() => router.push('/workout/new?autoOpenPicker=true')}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <LabButton
                    label="Build Program"
                    variant="outline"
                    icon={<Ionicons name="calendar-outline" size={14} color={Colors.graphite[300]} />}
                    onPress={() => router.push('/block-builder')}
                  />
                </View>
              </>
            ) : journey === 'planner' ? (
              <>
                <View style={{ flex: 1 }}>
                  <LabButton
                    label="Block Builder"
                    variant="outline"
                    icon={<Ionicons name="calendar-outline" size={14} color={Colors.graphite[300]} />}
                    onPress={() => router.push('/block-builder')}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <LabButton
                    label="Templates"
                    variant="outline"
                    icon={<Ionicons name="document-outline" size={14} color={Colors.graphite[300]} />}
                    onPress={() => router.push('/workout/new')}
                  />
                </View>
              </>
            ) : (
              <>
                <View style={{ flex: 1 }}>
                  <LabButton
                    label="Check In"
                    variant="outline"
                    icon={<Ionicons name="pulse-outline" size={14} color={Colors.graphite[300]} />}
                    onPress={() => router.push('/readiness')}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <LabButton
                    label="Ask Coach"
                    variant="outline"
                    icon={<Ionicons name="chatbubble-outline" size={14} color={Colors.graphite[300]} />}
                    onPress={() => router.push('/coach')}
                  />
                </View>
              </>
            )}
          </View>
        </ScrollView>

        {/* AI Coach FAB */}
        <View style={{ position: 'absolute', bottom: 100, right: 16 }}>
          <CoachButton onPress={() => router.push('/coach')} />
        </View>

        {/* Workout Generator Modal */}
        <Modal
          visible={showGeneratorModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowGeneratorModal(false)}
        >
          <View style={{ flex: 1, backgroundColor: Colors.void[900] }}>
            <SafeAreaView style={{ flex: 1 }}>
              {/* Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.08)' }}>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.graphite[50] }}>
                    Generate Workout
                  </Text>
                  <Text style={{ fontSize: 12, color: Colors.graphite[400] }}>
                    Choose a focus or let us recommend
                  </Text>
                </View>
                <Pressable
                  onPress={() => setShowGeneratorModal(false)}
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255, 255, 255, 0.1)', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="close" size={20} color={Colors.graphite[300]} />
                </Pressable>
              </View>

              <ScrollView style={{ flex: 1, padding: 16 }}>
                {/* AI Recommendation */}
                {dailySuggestion && (
                  <View style={{ marginBottom: 24 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                      <Ionicons name="sparkles" size={16} color={Colors.signal[400]} />
                      <Text style={{ marginLeft: 8, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, color: Colors.signal[400] }}>
                        AI Recommendation
                      </Text>
                    </View>

                    <Pressable
                      onPress={handleCreateFromSuggestion}
                      disabled={isCreatingWorkout}
                      style={{
                        padding: 16,
                        borderRadius: 16,
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 2,
                        borderColor: Colors.signal[500],
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.graphite[50], marginBottom: 4 }}>
                            {dailySuggestion.focus}
                          </Text>
                          <Text style={{ fontSize: 13, color: Colors.graphite[400], marginBottom: 8 }}>
                            {dailySuggestion.reason}
                          </Text>
                          <Text style={{ fontSize: 12, fontFamily: 'monospace', color: Colors.graphite[500] }}>
                            {dailySuggestion.exercises.length} exercises · ~{dailySuggestion.estimatedDuration} min
                          </Text>
                        </View>
                        {isCreatingWorkout ? (
                          <ActivityIndicator size="small" color={Colors.signal[500]} />
                        ) : (
                          <Ionicons name="arrow-forward-circle" size={28} color={Colors.signal[500]} />
                        )}
                      </View>
                    </Pressable>
                  </View>
                )}

                {/* Quick Options */}
                <View>
                  <Text style={{ fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, color: Colors.graphite[400], marginBottom: 12 }}>
                    Or Choose a Focus
                  </Text>

                  <View style={{ gap: 10 }}>
                    {quickOptions.map((option) => (
                      <Pressable
                        key={option.id}
                        onPress={() => handleQuickOption(option.id)}
                        disabled={isCreatingWorkout}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          padding: 14,
                          borderRadius: 12,
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          borderWidth: 1,
                          borderColor: 'rgba(255, 255, 255, 0.1)',
                        }}
                      >
                        <View style={{
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                          backgroundColor: 'rgba(59, 130, 246, 0.15)',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 12,
                        }}>
                          <Ionicons name={option.icon as any} size={22} color={Colors.signal[400]} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 15, fontWeight: '600', color: Colors.graphite[100] }}>
                            {option.label}
                          </Text>
                          <Text style={{ fontSize: 12, color: Colors.graphite[500] }}>
                            {option.description} · ~{option.duration} min
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={Colors.graphite[500]} />
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Custom option */}
                <Pressable
                  onPress={() => {
                    setShowGeneratorModal(false);
                    router.push('/workout/new?autoOpenPicker=true');
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 16,
                    borderRadius: 12,
                    marginTop: 24,
                    borderWidth: 1,
                    borderStyle: 'dashed',
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                  }}
                >
                  <Ionicons name="create-outline" size={18} color={Colors.graphite[400]} />
                  <Text style={{ marginLeft: 8, fontSize: 14, color: Colors.graphite[400] }}>
                    Build Custom Workout
                  </Text>
                </Pressable>
              </ScrollView>
            </SafeAreaView>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

// Helper component for async fetching of next time suggestions
function NextTimeHighlight({ exerciseId, exerciseName }: { exerciseId: string; exerciseName: string }) {
  const { data: suggestion } = useNextTimeSuggestion(exerciseId, exerciseName);

  if (!suggestion) return null;

  return (
    <View style={{ width: 240 }}>
      <MovementMemoryCard
        memory={{
          lastWeight: suggestion.last_performance.weight,
          lastReps: suggestion.last_performance.reps,
          lastRPE: suggestion.last_performance.rpe,
          lastDate: suggestion.last_performance.date,
          displayText: '',
          trend: suggestion.trend,
          confidence: suggestion.confidence,
          exposureCount: 0,
          totalLifetimeVolume: 0,
          prWeight: 0,
          prE1RM: 0,
          daysSinceLast: 0,
          lastSets: 0,
          lastDateRelative: '',
          lastContext: null,
          avgRPE: 0,
          typicalRepRange: null,
          trendLabel: '',
          trendColor: '',
        }}
        suggestion={suggestion}
        compact
      />
    </View>
  );
}
