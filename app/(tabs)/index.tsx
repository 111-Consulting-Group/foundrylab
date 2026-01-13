import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState, useMemo } from 'react';
import { View, Text, ScrollView, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';
import { CoachButton } from '@/components/CoachChat';
import { 
  LabCard, 
  LabStat, 
  LabButton, 
  StatusIndicator 
} from '@/components/ui/LabPrimitives';
import { DeltaTag } from '@/components/ui/DeltaTag';
import { MovementMemoryCard } from '@/components/MovementMemoryCard';

import { 
  useNextWorkout, 
  useWorkoutHistory, 
  useTodaysWorkout 
} from '@/hooks/useWorkouts';
import { useActiveTrainingBlock } from '@/hooks/useTrainingBlocks';
import { useMainLiftPRs } from '@/hooks/usePersonalRecords';
import { useNextTimeSuggestion } from '@/hooks/useMovementMemory';
import { summarizeWorkoutExercises, formatExerciseForFeed } from '@/lib/feedUtils';

export default function DashboardScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Debug: Verify new design is loading
  console.log('🎨 NEW UI DESIGN LOADED - Foundry Lab Home Screen', { colorScheme, isDark });

  // Data Fetching - Prioritize active block workouts over date-based
  const { data: nextWorkout, isLoading: loadingNext } = useNextWorkout(); // This gets next workout from active block
  const { data: todaysWorkout, isLoading: loadingToday } = useTodaysWorkout(); // Fallback to date-based
  const { data: activeBlock } = useActiveTrainingBlock();
  const { data: history = [], isLoading: loadingHistory, refetch: refetchHistory } = useWorkoutHistory(1);
  const { data: mainLifts = [], isLoading: loadingLifts } = useMainLiftPRs();

  // Prioritize: Next workout from active block > Date-based workout
  const activeSession = nextWorkout || todaysWorkout;
  const lastSession = history[0];

  const handleRefresh = () => {
    refetchHistory();
    // Invalidate other queries if needed
  };

  return (
    <SafeAreaView 
      className="flex-1 bg-carbon-950" 
      style={{ backgroundColor: '#0E1116' }}
      edges={['top', 'left', 'right']}
    >
      <ScrollView 
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={loadingHistory || loadingToday} onRefresh={handleRefresh} tintColor="#2F80ED" />
        }
      >
        {/* Header - NEW DESIGN */}
        <View 
          className="py-4 flex-row justify-between items-center border-b border-graphite-700 mb-4"
          style={{ borderBottomColor: '#353D4B' }}
        >
          <View>
            <Text 
              className="text-3xl font-bold text-graphite-100"
              style={{ color: '#C4C8D0', fontSize: 30, fontWeight: '700' }}
            >
              Foundry Lab
            </Text>
            <Text 
              className="text-xs font-lab-mono uppercase tracking-widest mt-1 text-graphite-400"
              style={{ color: '#6B7485', fontFamily: 'monospace', letterSpacing: 2, marginTop: 4 }}
            >
              PROGRESS, ENGINEERED
            </Text>
          </View>
          {/* Secondary Actions Menu could go here */}
        </View>

        {/* 1. Hero: Today's Target */}
        <View className="mb-6">
          <Text className="text-sm font-semibold mb-2 uppercase tracking-wider text-graphite-300" style={{ color: '#C4C8D0' }}>
            Today's Target
          </Text>
          
          {activeSession ? (
            <LabCard 
              className="border-signal-500/30"
              style={{ backgroundColor: 'rgba(47, 128, 237, 0.05)', borderColor: 'rgba(47, 128, 237, 0.3)' }}
            >
              <View className="flex-row justify-between items-start mb-4">
                <View className="flex-1 mr-2">
                  <Text className="text-xl font-bold text-graphite-100" style={{ color: '#E6E8EB' }}>
                    {activeSession.focus}
                  </Text>
                  <Text className="text-sm text-graphite-300" style={{ color: '#C4C8D0' }}>
                    {activeSession.workout_sets?.length || 0} Exercises · ~{activeSession.duration_minutes || 45} min
                  </Text>
                  {activeBlock && (
                    <Text className="text-xs mt-1 font-lab-mono text-graphite-400" style={{ color: '#6B7485' }}>
                      {activeBlock.name}
                    </Text>
                  )}
                </View>
                {activeSession.week_number && (
                  <View className="bg-signal-500/20 px-2 py-1 rounded">
                    <Text className="text-signal-500 text-xs font-bold font-lab-mono">
                      W{activeSession.week_number}:D{activeSession.day_number}
                    </Text>
                  </View>
                )}
              </View>
              
              <LabButton 
                label="Start Session" 
                icon={<Ionicons name="play" size={16} color="white" />}
                onPress={() => router.push(`/workout/${activeSession.id}`)}
              />
            </LabCard>
          ) : (
            <LabCard>
              <View className="items-center py-4">
                <Ionicons name="flask-outline" size={32} color={isDark ? '#6B7485' : '#A5ABB6'} />
                <Text className="text-lg font-semibold mt-2 text-graphite-200" style={{ color: '#D4D7DC' }}>
                  Calibration Mode
                </Text>
                <Text className="text-sm text-center mt-1 mb-4 text-graphite-400" style={{ color: '#6B7485' }}>
                  No scheduled session. Log a custom workout or rest.
                </Text>
                <LabButton 
                  label="Quick Log" 
                  variant="outline"
                  size="sm"
                  onPress={() => router.push('/workout/new')}
                />
              </View>
            </LabCard>
          )}
        </View>

        {/* 2. Secondary: Last Session Receipt */}
        {lastSession && (
          <View className="mb-6">
            <Text className="text-sm font-semibold mb-2 uppercase tracking-wider text-graphite-300" style={{ color: '#C4C8D0' }}>
              Last Session Receipt
            </Text>
            <LabCard 
              variant="subtle" 
              className="active:opacity-80"
            >
              <Pressable onPress={() => router.push(`/workout-summary/${lastSession.id}`)}>
                <View className="flex-row justify-between items-center mb-3">
                  <Text className="font-semibold text-graphite-200" style={{ color: '#D4D7DC' }}>
                    {lastSession.focus}
                  </Text>
                  <Text className="text-xs font-lab-mono text-graphite-400" style={{ color: '#6B7485' }}>
                    {new Date(lastSession.date_completed!).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                  </Text>
                </View>

                {/* Highlights */}
                <View className="gap-2">
                  {summarizeWorkoutExercises(lastSession.workout_sets || [])
                    .slice(0, 3)
                    .map((summary) => (
                      <View key={summary.exerciseId} className="flex-row justify-between items-center">
                        <Text className="text-sm flex-1 text-graphite-300" style={{ color: '#C4C8D0' }} numberOfLines={1}>
                          {summary.exerciseName}
                        </Text>
                        <View className="flex-row items-center gap-2">
                          <Text className="text-sm font-lab-mono text-graphite-200" style={{ color: '#D4D7DC' }}>
                            {formatExerciseForFeed(summary)}
                          </Text>
                          {/* We don't have delta in the summary util easily yet, but could add later */}
                        </View>
                      </View>
                    ))}
                </View>
              </Pressable>
            </LabCard>
          </View>
        )}

        {/* 3. Tertiary: Next Time Highlights */}
        {mainLifts.length > 0 && (
          <View className="mb-6">
            <Text className="text-sm font-semibold mb-2 uppercase tracking-wider text-graphite-300" style={{ color: '#C4C8D0' }}>
              Next Time Targets
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4 px-4">
              <View className="flex-row gap-3">
                {mainLifts.slice(0, 3).map((lift) => (
                  <NextTimeHighlight 
                    key={lift.exerciseId} 
                    exerciseId={lift.exerciseId} 
                    exerciseName={lift.exerciseName} 
                  />
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Bottom Actions (Footer) */}
        <View className="flex-row gap-3">
          <LabButton 
            label="Block Builder" 
            variant="outline" 
            className="flex-1"
            onPress={() => router.push('/block-builder')}
          />
          <LabButton 
            label="Templates" 
            variant="outline" 
            className="flex-1"
            // We need to verify if template picker route exists or use a modal
            // The previous code used a modal. For now, let's keep it simple or redirect.
            // Simplified: just go to new workout which handles templates
            onPress={() => router.push('/workout/new')}
          />
        </View>

      </ScrollView>

      {/* AI Coach FAB */}
      <View className="absolute bottom-6 right-4">
        <CoachButton onPress={() => router.push('/coach')} />
      </View>
    </SafeAreaView>
  );
}

// Helper component for async fetching of next time suggestions
function NextTimeHighlight({ exerciseId, exerciseName }: { exerciseId: string, exerciseName: string }) {
  const { data: suggestion } = useNextTimeSuggestion(exerciseId, exerciseName);
  
  if (!suggestion) return null;

  return (
    <View className="w-64">
      <MovementMemoryCard 
        memory={{
          lastWeight: suggestion.last_performance.weight,
          lastReps: suggestion.last_performance.reps,
          lastRPE: suggestion.last_performance.rpe,
          lastDate: suggestion.last_performance.date,
          // Minimal data for preview
          displayText: '',
          trend: suggestion.trend,
          confidence: suggestion.confidence,
          // defaults
          exposureCount: 0, totalLifetimeVolume: 0, prWeight: 0, prE1RM: 0,
          daysSinceLast: 0, lastSets: 0, lastDateRelative: '', lastContext: null, 
          avgRPE: 0, typicalRepRange: null, trendLabel: '', trendColor: ''
        }} 
        suggestion={suggestion}
        compact
      />
    </View>
  );
}
