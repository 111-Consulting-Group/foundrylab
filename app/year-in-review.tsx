import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import { useWorkoutHistory } from '@/hooks/useWorkouts';
import { useRecentPRs } from '@/hooks/usePersonalRecords';
import { useTrainingBlocks } from '@/hooks/useTrainingBlocks';

export default function YearInReviewScreen() {

  // Calculate date range for the current year
  const thisYear = new Date().getFullYear();
  const yearDateRange = useMemo(() => ({
    start: `${thisYear}-01-01T00:00:00`,
    end: `${thisYear}-12-31T23:59:59`,
  }), [thisYear]);

  // Fetch data with server-side year filtering (more efficient than fetching everything)
  const { data: yearWorkouts = [], isLoading: workoutsLoading } = useWorkoutHistory(0, yearDateRange);
  const { data: yearPRs = [] } = useRecentPRs(0, yearDateRange);
  const { data: allBlocks = [] } = useTrainingBlocks();

  // Filter blocks client-side (smaller dataset)
  const completedBlocks = useMemo(() => {
    const yearStart = new Date(thisYear, 0, 1);
    const yearEnd = new Date(thisYear, 11, 31, 23, 59, 59);
    return allBlocks.filter((block) => {
      const startDate = new Date(block.start_date);
      return startDate >= yearStart && startDate <= yearEnd;
    });
  }, [allBlocks, thisYear]);

  // Calculate stats
  const stats = useMemo(() => {
    let totalVolume = 0;
    const exerciseSet = new Set<string>();

    yearWorkouts.forEach((workout) => {
      workout.workout_sets?.forEach((set) => {
        if (set.actual_weight && set.actual_reps && !set.is_warmup) {
          totalVolume += set.actual_weight * set.actual_reps;
          exerciseSet.add(set.exercise_id);
        }
      });
    });

    return {
      totalWorkouts: yearWorkouts.length,
      totalVolume,
      uniqueExercises: exerciseSet.size,
      totalPRs: yearPRs.length,
      completedBlocks: completedBlocks.length,
    };
  }, [yearWorkouts, yearPRs, completedBlocks]);

  // Group PRs by exercise to find lifts that moved
  const prsByExercise = useMemo(() => {
    const map = new Map<string, typeof allPRs>();
    yearPRs.forEach((pr) => {
      if (!map.has(pr.exercise_id)) {
        map.set(pr.exercise_id, []);
      }
      map.get(pr.exercise_id)!.push(pr);
    });
    return map;
  }, [yearPRs]);

  const liftsThatMoved = useMemo(() => {
    return Array.from(prsByExercise.entries()).slice(0, 5);
  }, [prsByExercise]);

  if (workoutsLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.void[900], alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={Colors.signal[500]} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.void[900] }}>
      {/* Ambient Background Glows */}
      <View style={{ position: 'absolute', top: -80, right: -100, width: 280, height: 280, backgroundColor: 'rgba(37, 99, 235, 0.06)', borderRadius: 140 }} />
      <View style={{ position: 'absolute', bottom: 100, left: -80, width: 240, height: 240, backgroundColor: 'rgba(37, 99, 235, 0.04)', borderRadius: 120 }} />

      <SafeAreaView style={{ flex: 1 }} edges={['left', 'right']}>
        {/* Header */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(255, 255, 255, 0.1)',
            backgroundColor: 'rgba(18, 18, 18, 0.9)',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable onPress={() => router.back()} style={{ padding: 8, marginLeft: -8 }}>
              <Ionicons name="arrow-back" size={24} color={Colors.graphite[50]} />
            </Pressable>
            <Text style={{ fontWeight: '600', color: Colors.graphite[50] }}>
              {thisYear} Year in Review
            </Text>
            <View style={{ width: 40 }} />
          </View>
        </View>

        <ScrollView style={{ flex: 1, paddingHorizontal: 16 }}>
          {/* Summary Stats */}
          <View style={{ paddingVertical: 24, marginBottom: 16 }}>
            <Text style={{ fontSize: 24, fontWeight: '700', marginBottom: 16, color: Colors.graphite[50] }}>
              Your {thisYear}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              <View
                style={{
                  flex: 1,
                  minWidth: '45%',
                  padding: 16,
                  borderRadius: 16,
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                }}
              >
                <Text style={{ fontSize: 28, fontWeight: '700', marginBottom: 4, color: Colors.signal[400] }}>
                  {stats.totalWorkouts}
                </Text>
                <Text style={{ fontSize: 12, color: Colors.graphite[400] }}>
                  Workouts
                </Text>
              </View>
              <View
                style={{
                  flex: 1,
                  minWidth: '45%',
                  padding: 16,
                  borderRadius: 16,
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                }}
              >
                <Text style={{ fontSize: 28, fontWeight: '700', marginBottom: 4, color: Colors.emerald[400] }}>
                  {stats.totalPRs}
                </Text>
                <Text style={{ fontSize: 12, color: Colors.graphite[400] }}>
                  Personal Records
                </Text>
              </View>
              <View
                style={{
                  flex: 1,
                  minWidth: '45%',
                  padding: 16,
                  borderRadius: 16,
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                }}
              >
                <Text style={{ fontSize: 28, fontWeight: '700', marginBottom: 4, color: '#F2994A' }}>
                  {stats.completedBlocks}
                </Text>
                <Text style={{ fontSize: 12, color: Colors.graphite[400] }}>
                  Blocks Completed
                </Text>
              </View>
              <View
                style={{
                  flex: 1,
                  minWidth: '45%',
                  padding: 16,
                  borderRadius: 16,
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                }}
              >
                <Text style={{ fontSize: 28, fontWeight: '700', marginBottom: 4, color: Colors.signal[400] }}>
                  {Math.round(stats.totalVolume / 1000)}k
                </Text>
                <Text style={{ fontSize: 12, color: Colors.graphite[400] }}>
                  lbs Moved
                </Text>
              </View>
            </View>
          </View>

          {/* Lifts That Moved */}
          {liftsThatMoved.length > 0 && (
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 12, color: Colors.graphite[50] }}>
                Lifts That Moved
              </Text>
              <View style={{ gap: 8 }}>
                {liftsThatMoved.map(([exerciseId, prs]) => {
                  const topPR = prs[0];
                  const exerciseName = (topPR as any).exercise?.name || 'Exercise';
                  return (
                    <View
                      key={exerciseId}
                      style={{
                        padding: 16,
                        borderRadius: 16,
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        borderWidth: 1,
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{ fontWeight: '600', color: Colors.graphite[50] }}>
                          {exerciseName}
                        </Text>
                        <Text style={{ fontWeight: '700', color: '#F2994A' }}>
                          {topPR.value} {topPR.unit}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 12, marginTop: 4, color: Colors.graphite[400] }}>
                        {prs.length} PR{prs.length !== 1 ? 's' : ''} this year
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Volume Trend (simplified) */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 12, color: Colors.graphite[50] }}>
              Total Volume Trend
            </Text>
            <View
              style={{
                padding: 16,
                borderRadius: 16,
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.1)',
              }}
            >
              <Text style={{ fontSize: 24, fontWeight: '700', marginBottom: 4, color: Colors.signal[400] }}>
                {Math.round(stats.totalVolume / 1000)}k lbs
              </Text>
              <Text style={{ fontSize: 12, color: Colors.graphite[400] }}>
                Total volume for {thisYear}
              </Text>
            </View>
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
