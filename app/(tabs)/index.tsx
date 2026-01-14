import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState, useMemo } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable, Alert, Platform } from 'react-native';
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
import { FoundryLabLogo } from '@/components/FoundryLabLogo';
import { Colors } from '@/constants/Colors';

import {
  useNextWorkout,
  useWorkoutHistory,
  useTodaysWorkout,
} from '@/hooks/useWorkouts';
import { useActiveTrainingBlock } from '@/hooks/useTrainingBlocks';
import { useMainLiftPRs } from '@/hooks/usePersonalRecords';
import { useNextTimeSuggestion } from '@/hooks/useMovementMemory';
import { summarizeWorkoutExercises, formatExerciseForFeed } from '@/lib/feedUtils';
import { generateExerciseSummary } from '@/lib/workoutSummary';

export default function DashboardScreen() {
  const logoutMutation = useLogout();

  // Data Fetching
  const { data: nextWorkout, isLoading: loadingNext } = useNextWorkout();
  const { data: todaysWorkout, isLoading: loadingToday } = useTodaysWorkout();
  const { data: activeBlock } = useActiveTrainingBlock();
  const { data: history = [], isLoading: loadingHistory, refetch: refetchHistory } = useWorkoutHistory(1);
  const { data: mainLifts = [], isLoading: loadingLifts } = useMainLiftPRs();

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

          {/* Hero: Today's Target - Glass Card */}
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
              Today's Target
            </Text>

            {activeSession ? (
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
            ) : (
              <GlassCard>
                <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                  <FoundryLabLogo size={64} style={{ marginBottom: 12 }} />
                  <Text style={{ fontSize: 18, fontWeight: '600', color: Colors.graphite[200], marginBottom: 4 }}>
                    Calibration Mode
                  </Text>
                  <Text style={{ fontSize: 13, color: Colors.graphite[500], textAlign: 'center', marginBottom: 16 }}>
                    No scheduled session. Scan a workout or log manually.
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <LabButton
                      label="Scan Workout"
                      icon={<Ionicons name="camera-outline" size={14} color="white" />}
                      size="sm"
                      onPress={() => router.push('/scan-workout')}
                    />
                    <LabButton
                      label="Quick Log"
                      variant="outline"
                      size="sm"
                      onPress={() => router.push('/workout/new')}
                    />
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

          {/* Fluid Session Test */}
          <View style={{ marginBottom: 16 }}>
            <Pressable
              onPress={() => router.push('/fluid-session')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                paddingVertical: 16,
                borderRadius: 14,
                backgroundColor: 'rgba(139, 92, 246, 0.15)',
                borderWidth: 1,
                borderColor: 'rgba(139, 92, 246, 0.4)',
              }}
            >
              <Ionicons name="sparkles" size={20} color="#A78BFA" />
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#A78BFA' }}>
                Test Fluid Session
              </Text>
            </Pressable>
          </View>

          {/* Bottom Actions */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <LabButton
                label="Block Builder"
                variant="outline"
                onPress={() => router.push('/block-builder')}
              />
            </View>
            <View style={{ flex: 1 }}>
              <LabButton
                label="Templates"
                variant="outline"
                onPress={() => router.push('/workout/new')}
              />
            </View>
          </View>
        </ScrollView>

        {/* AI Coach FAB */}
        <View style={{ position: 'absolute', bottom: 100, right: 16 }}>
          <CoachButton onPress={() => router.push('/coach')} />
        </View>
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
