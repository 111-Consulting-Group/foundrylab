import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import { useWorkoutHistory, useIncompleteWorkouts, useUncompleteWorkout } from '@/hooks/useWorkouts';
import { useRecentPRs } from '@/hooks/usePersonalRecords';
import { calculateSetVolume } from '@/lib/utils';
import type { WorkoutWithSets } from '@/types/database';

export default function HistoryScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const uncompleteMutation = useUncompleteWorkout();

  // Fetch real data
  const { data: completedWorkouts = [], isLoading: historyLoading } = useWorkoutHistory(50);
  const { data: incompleteWorkouts = [], isLoading: incompleteLoading } = useIncompleteWorkouts();
  const { data: recentPRs = [] } = useRecentPRs(100);

  // Calculate stats from real data
  const stats = useMemo(() => {
    const totalWorkouts = completedWorkouts.length;
    
    let totalVolume = 0;
    let exerciseSet = new Set<string>();
    
    completedWorkouts.forEach((workout) => {
      workout.workout_sets?.forEach((set) => {
        if (!set.is_warmup) {
          const volume = calculateSetVolume(set.actual_weight, set.actual_reps);
          if (volume > 0) {
            totalVolume += volume;
            exerciseSet.add(set.exercise_id);
          }
        }
      });
    });

    // Calculate PRs this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const prsThisMonth = recentPRs.filter((pr) => {
      const achievedAt = new Date(pr.achieved_at);
      return achievedAt >= startOfMonth;
    }).length;

    return {
      totalWorkouts,
      totalVolume,
      exerciseCount: exerciseSet.size,
      prsThisMonth,
    };
  }, [completedWorkouts, recentPRs]);

  // Process completed workouts for display
  const processedCompletedWorkouts = useMemo(() => {
    return completedWorkouts.map((workout) => {
      let totalVolume = 0;
      let exerciseSet = new Set<string>();
      let prCount = 0;

      workout.workout_sets?.forEach((set) => {
        if (!set.is_warmup) {
          const volume = calculateSetVolume(set.actual_weight, set.actual_reps);
          if (volume > 0) {
            totalVolume += volume;
            exerciseSet.add(set.exercise_id);
          }
        }
        if (set.is_pr) {
          prCount++;
        }
      });

      return {
        ...workout,
        totalVolume,
        exerciseCount: exerciseSet.size,
        prCount,
        date: workout.date_completed ? new Date(workout.date_completed) : new Date(),
      };
    });
  }, [completedWorkouts]);

  // Process incomplete workouts for display
  const processedIncompleteWorkouts = useMemo(() => {
    return incompleteWorkouts.map((workout) => {
      let totalVolume = 0;
      let exerciseSet = new Set<string>();
      let prCount = 0;

      workout.workout_sets?.forEach((set) => {
        if (!set.is_warmup) {
          const volume = calculateSetVolume(set.actual_weight, set.actual_reps);
          if (volume > 0) {
            totalVolume += volume;
            exerciseSet.add(set.exercise_id);
          }
        }
        if (set.is_pr) {
          prCount++;
        }
      });

      return {
        ...workout,
        totalVolume,
        exerciseCount: exerciseSet.size,
        prCount,
        date: workout.updated_at ? new Date(workout.updated_at) : new Date(workout.created_at),
      };
    });
  }, [incompleteWorkouts]);

  // Filter workouts
  const filteredCompleted = processedCompletedWorkouts.filter((workout) =>
    workout.focus.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const filteredIncomplete = processedIncompleteWorkouts.filter((workout) =>
    workout.focus.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isLoading = historyLoading || incompleteLoading;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.void[900] }}>
      {/* Ambient Background Glows */}
      <View style={{ position: 'absolute', top: -80, left: -100, width: 280, height: 280, backgroundColor: 'rgba(37, 99, 235, 0.06)', borderRadius: 140 }} />
      <View style={{ position: 'absolute', bottom: 100, right: -80, width: 250, height: 250, backgroundColor: 'rgba(37, 99, 235, 0.04)', borderRadius: 125 }} />

      <SafeAreaView style={{ flex: 1 }} edges={['left', 'right']}>
        {/* Search Bar */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.1)',
            }}
          >
            <Ionicons name="search" size={20} color={Colors.graphite[500]} style={{ marginRight: 10 }} />
            <TextInput
              style={{ flex: 1, fontSize: 16, color: Colors.graphite[50] }}
              placeholder="Search workouts or exercises..."
              placeholderTextColor={Colors.graphite[500]}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={Colors.graphite[500]} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Stats Summary */}
        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1, padding: 16, borderRadius: 12, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' }}>
              <Text style={{ fontSize: 24, fontWeight: '700', color: Colors.graphite[50] }}>
                {isLoading ? '...' : stats.totalWorkouts}
              </Text>
              <Text style={{ fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, color: Colors.graphite[500] }}>
                Workouts
              </Text>
            </View>
            <View style={{ flex: 1, padding: 16, borderRadius: 12, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' }}>
              <Text style={{ fontSize: 24, fontWeight: '700', color: Colors.signal[400] }}>
                {isLoading ? '...' : stats.totalVolume >= 1000 ? `${(stats.totalVolume / 1000).toFixed(1)}k` : Math.round(stats.totalVolume).toString()}
              </Text>
              <Text style={{ fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, color: Colors.graphite[500] }}>
                Volume
              </Text>
            </View>
            <View style={{ flex: 1, padding: 16, borderRadius: 12, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' }}>
              <Text style={{ fontSize: 24, fontWeight: '700', color: Colors.emerald[400] }}>
                {isLoading ? '...' : stats.prsThisMonth}
              </Text>
              <Text style={{ fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, color: Colors.graphite[500] }}>
                PRs
              </Text>
            </View>
          </View>
        </View>

        {/* Workout List */}
        <ScrollView style={{ flex: 1, paddingHorizontal: 16 }} contentContainerStyle={{ paddingBottom: 100 }}>
          {isLoading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
              <ActivityIndicator size="large" color={Colors.signal[500]} />
            </View>
          ) : (
          <>
            {/* Incomplete Workouts Section */}
            {filteredIncomplete.length > 0 && (
              <View style={{ marginBottom: 24 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 12, color: Colors.graphite[50] }}>
                  Continue Workout
                </Text>
                <View style={{ gap: 8 }}>
                  {filteredIncomplete.map((workout) => (
                    <Pressable
                      key={workout.id}
                      style={{
                        padding: 16,
                        borderRadius: 16,
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 2,
                        borderColor: 'rgba(96, 165, 250, 0.5)',
                        shadowColor: Colors.signal[500],
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.2,
                        shadowRadius: 12,
                      }}
                      onPress={() => router.push(`/workout/${workout.id}`)}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <View
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 20,
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginRight: 12,
                              backgroundColor: workout.totalVolume > 0 ? Colors.signal[500] : Colors.emerald[500],
                            }}
                          >
                            <Ionicons
                              name={workout.totalVolume > 0 ? 'barbell' : 'heart'}
                              size={20}
                              color="#ffffff"
                            />
                          </View>
                          <View>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Text style={{ fontWeight: '600', color: Colors.graphite[50] }}>
                                {workout.focus}
                              </Text>
                              <View style={{ marginLeft: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, backgroundColor: 'rgba(59, 130, 246, 0.2)' }}>
                                <Text style={{ color: Colors.signal[400], fontSize: 10, fontWeight: '600' }}>In Progress</Text>
                              </View>
                            </View>
                            <Text style={{ fontSize: 12, color: Colors.graphite[400] }}>
                              Last updated {format(workout.date, 'MMM d')}
                            </Text>
                          </View>
                        </View>
                        {workout.prCount > 0 && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(242, 153, 74, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                            <Ionicons name="trophy" size={12} color="#F2994A" />
                            <Text style={{ color: '#F2994A', fontSize: 10, fontWeight: '600', marginLeft: 4 }}>
                              {workout.prCount} PR{workout.prCount > 1 ? 's' : ''}
                            </Text>
                          </View>
                        )}
                      </View>

                      <View style={{ flexDirection: 'row', gap: 16 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="fitness-outline" size={14} color={Colors.graphite[400]} />
                          <Text style={{ fontSize: 12, marginLeft: 4, color: Colors.graphite[400] }}>
                            {workout.exerciseCount} exercises
                          </Text>
                        </View>
                        {workout.totalVolume > 0 && (
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="trending-up" size={14} color={Colors.graphite[400]} />
                            <Text style={{ fontSize: 12, marginLeft: 4, color: Colors.graphite[400] }}>
                              {workout.totalVolume >= 1000
                                ? `${(workout.totalVolume / 1000).toFixed(1)}k lbs`
                                : `${Math.round(workout.totalVolume)} lbs`}
                            </Text>
                          </View>
                        )}
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Completed Workouts Section */}
            <View>
              <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 12, color: Colors.graphite[50] }}>
                Recent Workouts
              </Text>

              {filteredCompleted.length === 0 ? (
                <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
                  <Ionicons name="barbell-outline" size={48} color={Colors.graphite[500]} />
                  <Text style={{ marginTop: 16, textAlign: 'center', color: Colors.graphite[400] }}>
                    No completed workouts yet.{'\n'}Start your first workout to see it here!
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 8 }}>
                  {filteredCompleted.map((workout) => (
                    <View
                      key={workout.id}
                      style={{
                        padding: 16,
                        borderRadius: 16,
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        borderWidth: 1,
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                      }}
                    >
                      <Pressable onPress={() => router.push(`/workout-summary/${workout.id}`)}>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginRight: 12,
                                backgroundColor: workout.totalVolume > 0 ? Colors.signal[500] : Colors.emerald[500],
                              }}
                            >
                              <Ionicons
                                name={workout.totalVolume > 0 ? 'barbell' : 'heart'}
                                size={20}
                                color="#ffffff"
                              />
                            </View>
                            <View>
                              <Text style={{ fontWeight: '600', color: Colors.graphite[50] }}>
                                {workout.focus}
                              </Text>
                              <Text style={{ fontSize: 12, color: Colors.graphite[400] }}>
                                {format(workout.date, 'EEEE, MMM d')}
                              </Text>
                            </View>
                          </View>
                          {workout.prCount > 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(242, 153, 74, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                              <Ionicons name="trophy" size={12} color="#F2994A" />
                              <Text style={{ color: '#F2994A', fontSize: 10, fontWeight: '600', marginLeft: 4 }}>
                                {workout.prCount} PR{workout.prCount > 1 ? 's' : ''}
                              </Text>
                            </View>
                          )}
                        </View>

                        <View style={{ flexDirection: 'row', gap: 16 }}>
                          {workout.duration_minutes && (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Ionicons name="time-outline" size={14} color={Colors.graphite[400]} />
                              <Text style={{ fontSize: 12, marginLeft: 4, color: Colors.graphite[400] }}>
                                {workout.duration_minutes} min
                              </Text>
                            </View>
                          )}
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="fitness-outline" size={14} color={Colors.graphite[400]} />
                            <Text style={{ fontSize: 12, marginLeft: 4, color: Colors.graphite[400] }}>
                              {workout.exerciseCount} exercises
                            </Text>
                          </View>
                          {workout.totalVolume > 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Ionicons name="trending-up" size={14} color={Colors.graphite[400]} />
                              <Text style={{ fontSize: 12, marginLeft: 4, color: Colors.graphite[400] }}>
                                {workout.totalVolume >= 1000
                                  ? `${(workout.totalVolume / 1000).toFixed(1)}k lbs`
                                  : `${Math.round(workout.totalVolume)} lbs`}
                              </Text>
                            </View>
                          )}
                        </View>
                      </Pressable>

                      {/* Action Buttons */}
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.1)' }}>
                        <Pressable
                          style={{
                            flex: 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            paddingVertical: 8,
                            borderRadius: 8,
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          }}
                          onPress={() => {
                            Alert.alert(
                              'Uncomplete Workout',
                              'This will mark the workout as incomplete so you can reschedule it. Continue?',
                              [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                  text: 'Uncomplete',
                                  style: 'destructive',
                                  onPress: () => {
                                    uncompleteMutation.mutate(
                                      { id: workout.id },
                                      {
                                        onSuccess: () => {
                                          Alert.alert('Success', 'Workout marked as incomplete. You can now reschedule it.');
                                        },
                                        onError: (error) => {
                                          console.error('Uncomplete error:', error);
                                          Alert.alert('Error', `Failed to uncomplete workout: ${error instanceof Error ? error.message : 'Unknown error'}`);
                                        },
                                      }
                                    );
                                  },
                                },
                              ]
                            );
                          }}
                        >
                          <Ionicons name="refresh-outline" size={16} color={Colors.signal[400]} />
                          <Text style={{ color: Colors.signal[400], fontWeight: '500', marginLeft: 4, fontSize: 12 }}>Uncomplete</Text>
                        </Pressable>
                        <Pressable
                          style={{
                            flex: 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            paddingVertical: 8,
                            borderRadius: 8,
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          }}
                          onPress={() => router.push(`/workout/${workout.id}`)}
                        >
                          <Ionicons name="create-outline" size={16} color={Colors.signal[400]} />
                          <Text style={{ color: Colors.signal[400], fontWeight: '500', marginLeft: 4, fontSize: 12 }}>Edit</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Bottom spacing */}
            <View style={{ height: 32 }} />
          </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
