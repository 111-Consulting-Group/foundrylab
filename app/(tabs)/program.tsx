import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import {
  useActiveTrainingBlock,
  useTrainingBlock,
  useBlockProgress,
} from '@/hooks/useTrainingBlocks';
import type { Workout } from '@/types/database';

export default function ProgramScreen() {

  // Fetch active training block
  const { data: activeBlock, isLoading: blockLoading } = useActiveTrainingBlock();

  // Fetch block details with workouts
  const { data: blockWithWorkouts, isLoading: workoutsLoading } = useTrainingBlock(
    activeBlock?.id || ''
  );

  // Get block progress
  const { data: progress } = useBlockProgress(activeBlock?.id || '');

  // Calculate current phase (simplified - would need phase tracking per week)
  const currentPhase = activeBlock?.phase || 'accumulation';

  // Group workouts by week
  const workoutsByWeek = blockWithWorkouts?.workouts?.reduce((acc, workout) => {
    const week = workout.week_number || 1;
    if (!acc[week]) {
      acc[week] = [];
    }
    acc[week].push(workout);
    return acc;
  }, {} as Record<number, Workout[]>) || {};

  // Find the next incomplete workout (queue-based, not date-based)
  const nextWorkout = blockWithWorkouts?.workouts
    ?.filter((w) => !w.date_completed)
    ?.sort((a, b) => {
      const weekDiff = (a.week_number || 0) - (b.week_number || 0);
      if (weekDiff !== 0) return weekDiff;
      return (a.day_number || 0) - (b.day_number || 0);
    })?.[0];

  // Current week is based on next workout, not calendar
  const currentWeek = nextWorkout?.week_number || 1;

  // Check if loading
  const isLoading = blockLoading || workoutsLoading;

  // No active block state
  if (!isLoading && !activeBlock) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.void[900] }}>
        {/* Ambient Background Glows */}
        <View style={{ position: 'absolute', top: -100, left: -80, width: 300, height: 300, backgroundColor: 'rgba(37, 99, 235, 0.08)', borderRadius: 150 }} />
        <View style={{ position: 'absolute', bottom: 0, right: -100, width: 350, height: 350, backgroundColor: 'rgba(37, 99, 235, 0.05)', borderRadius: 175 }} />

        <SafeAreaView style={{ flex: 1 }} edges={['left', 'right']}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16, backgroundColor: 'rgba(59, 130, 246, 0.15)', borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.3)' }}>
              <Ionicons name="calendar-outline" size={40} color={Colors.signal[400]} />
            </View>
            <Text style={{ fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 8, color: Colors.graphite[50] }}>
              No Active Program
            </Text>
            <Text style={{ textAlign: 'center', marginBottom: 24, color: Colors.graphite[400] }}>
              Generate a training block with AI or create one manually to get started
            </Text>
            <Link href="/block-builder" asChild>
              <Pressable style={{ paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12, backgroundColor: Colors.signal[600], marginBottom: 12, shadowColor: Colors.signal[500], shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="sparkles" size={20} color="#ffffff" />
                  <Text style={{ color: 'white', fontWeight: '600', marginLeft: 8 }}>Build with AI</Text>
                </View>
              </Pressable>
            </Link>
            <Link href="/annual-plan" asChild>
              <Pressable style={{ paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12, backgroundColor: 'rgba(255, 255, 255, 0.1)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="calendar" size={20} color={Colors.graphite[300]} />
                  <Text style={{ fontWeight: '500', marginLeft: 8, color: Colors.graphite[200] }}>Plan Your Year</Text>
                </View>
              </Pressable>
            </Link>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.void[900] }}>
      {/* Ambient Background Glows */}
      <View style={{ position: 'absolute', top: -80, right: -100, width: 280, height: 280, backgroundColor: 'rgba(37, 99, 235, 0.06)', borderRadius: 140 }} />
      <View style={{ position: 'absolute', bottom: 50, left: -80, width: 250, height: 250, backgroundColor: 'rgba(37, 99, 235, 0.04)', borderRadius: 125 }} />

      <SafeAreaView style={{ flex: 1 }} edges={['left', 'right']}>
        {isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={Colors.signal[500]} />
          </View>
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>
          {/* Current Block Header */}
          <View className="px-4 pt-4 pb-2">
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-1">
                <Text
                  className="text-xl font-bold text-graphite-100"
                  style={{ color: '#E6E8EB' }}
                >
                  {activeBlock?.name || 'Training Block'}
                </Text>
                <Text
                  className="text-sm text-graphite-400"
                  style={{ color: '#6B7485' }}
                >
                  Week {currentWeek} of {activeBlock?.duration_weeks || 0}
                  {activeBlock?.description ? ` • ${activeBlock.description.slice(0, 30)}...` : ''}
                </Text>
              </View>
              <View className="flex-row items-center">
                <Link href="/annual-plan" asChild>
                  <Pressable className="p-2 mr-1">
                    <Ionicons
                      name="calendar"
                      size={24}
                      color={Colors.graphite[400]}
                    />
                  </Pressable>
                </Link>
                <Link href="/block-builder" asChild>
                  <Pressable className="p-2">
                    <Ionicons
                      name="add-circle"
                      size={28}
                      color={Colors.signal[500]}
                    />
                  </Pressable>
                </Link>
              </View>
            </View>

            {/* Progress Bar */}
            {progress && (
              <View
                style={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: Colors.graphite[800],
                  marginTop: 8,
                }}
              >
                <View
                  className="h-full rounded-full bg-signal-500"
                  style={{ width: `${progress.percentage}%` }}
                />
              </View>
            )}
            {progress && (
              <Text
                className="text-xs mt-1 text-graphite-400"
                style={{ color: '#6B7485' }}
              >
                {progress.completed} of {progress.total} workouts completed
              </Text>
            )}
          </View>

          {/* Week Sections */}
          {Object.entries(workoutsByWeek)
            .sort(([a], [b]) => parseInt(a) - parseInt(b))
            .map(([weekNum, workouts]) => {
              const week = parseInt(weekNum);
              const isCurrentWeek = week === currentWeek;

              return (
                <View key={week} className="mb-4">
                  <View className="px-4 py-3 flex-row items-center">
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 12,
                        backgroundColor: isCurrentWeek ? Colors.signal[500] : Colors.graphite[700],
                      }}
                    >
                      <Text
                        className={`font-bold text-sm ${
                          isCurrentWeek
                            ? 'text-white'
                            : 'text-graphite-300'
                        }`}
                        style={!isCurrentWeek ? { color: '#C4C8D0' } : undefined}
                      >
                        W{week}
                      </Text>
                    </View>
                    <Text
                      className="font-semibold text-graphite-200"
                      style={{ color: '#D4D7DC' }}
                    >
                      Week {week}
                    </Text>
                    {isCurrentWeek && (
                      <View className="ml-2 px-2 py-0.5 rounded-full bg-signal-500/20">
                        <Text className="text-signal-500 text-xs font-semibold">
                          Current
                        </Text>
                      </View>
                    )}
                  </View>

                  <View className="px-4 gap-2">
                    {workouts
                      .sort((a, b) => (a.day_number || 0) - (b.day_number || 0))
                      .map((workout) => {
                        const isCompleted = !!workout.date_completed;
                        const isNext = workout.id === nextWorkout?.id;

                        return (
                          <Pressable
                            key={workout.id}
                            className="p-4 rounded-xl flex-row items-center"
                            style={{
                              backgroundColor: isNext ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                              borderWidth: 1,
                              borderColor: isNext ? 'rgba(96, 165, 250, 0.5)' : 'rgba(255, 255, 255, 0.1)',
                              ...(isNext && {
                                shadowColor: Colors.signal[500],
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.2,
                                shadowRadius: 12,
                              }),
                            }}
                            onPress={() => router.push(`/workout/${workout.id}`)}
                          >
                            <View
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginRight: 12,
                                backgroundColor: isCompleted
                                  ? Colors.emerald[500]
                                  : isNext
                                  ? Colors.signal[500]
                                  : Colors.graphite[700],
                              }}
                            >
                              {isCompleted ? (
                                <Ionicons name="checkmark" size={20} color="#ffffff" />
                              ) : (
                                <Text
                                  className={`font-bold ${
                                    isNext
                                      ? 'text-white'
                                      : 'text-graphite-400'
                                  }`}
                                  style={!isNext ? { color: '#6B7485' } : undefined}
                                >
                                  {workout.day_number || 1}
                                </Text>
                              )}
                            </View>
                            <View className="flex-1">
                              <Text
                                className="font-semibold text-graphite-100"
                                style={{ color: '#E6E8EB' }}
                              >
                                Day {workout.day_number}: {workout.focus}
                              </Text>
                              <Text
                                className="text-sm text-graphite-400"
                                style={{ color: '#6B7485' }}
                              >
                                {isCompleted
                                  ? `Completed ${new Date(workout.date_completed!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                                  : isNext
                                  ? 'Up next in your queue'
                                  : 'Pending'}
                              </Text>
                            </View>
                            {isNext && (
                              <View className="px-3 py-1 rounded-full bg-signal-500 mr-2">
                                <Text className="text-white text-xs font-semibold">
                                  Up Next
                                </Text>
                              </View>
                            )}
                            <Ionicons
                              name="chevron-forward"
                              size={20}
                              color={Colors.graphite[400]}
                            />
                          </Pressable>
                        );
                      })}
                  </View>
                </View>
              );
            })}

          {/* Empty state for no workouts */}
          {Object.keys(workoutsByWeek).length === 0 && (
            <View className="px-4 py-8 items-center">
              <Text className="text-graphite-400" style={{ color: '#6B7485' }}>
                No workouts scheduled for this block
              </Text>
            </View>
          )}

          {/* Bottom spacing */}
          <View style={{ height: 32 }} />
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
