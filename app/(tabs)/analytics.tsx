import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WeeklyInsights } from '@/components/WeeklyInsights';
import { PatternInsightsList } from '@/components/PatternInsights';
import { Colors } from '@/constants/Colors';
import { useWorkoutHistory } from '@/hooks/useWorkouts';
import { useMainLiftPRs } from '@/hooks/usePersonalRecords';
import { usePatternInsights } from '@/hooks/usePatternDetection';

type MetricType = 'strength' | 'conditioning';

export default function AnalyticsScreen() {
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('strength');

  // Fetch workout history for weekly insights
  const { data: recentWorkouts = [] } = useWorkoutHistory(50);

  // Fetch main lift PRs
  const { data: mainLiftPRs = [], isLoading: prsLoading } = useMainLiftPRs();

  // Fetch pattern insights
  const { patterns, insights, isLoading: patternsLoading } = usePatternInsights();

  // Filter to only lifts with recorded PRs
  const liftsWithPRs = mainLiftPRs.filter(lift => lift.e1rm !== null);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.void[900] }}>
      {/* Ambient Background Glows */}
      <View style={{ position: 'absolute', top: -60, right: -100, width: 260, height: 260, backgroundColor: 'rgba(37, 99, 235, 0.07)', borderRadius: 130 }} />
      <View style={{ position: 'absolute', bottom: 80, left: -80, width: 220, height: 220, backgroundColor: 'rgba(37, 99, 235, 0.04)', borderRadius: 110 }} />

      <SafeAreaView style={{ flex: 1 }} edges={['left', 'right']}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>
          {/* Metric Toggle */}
          <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
            <View
              style={{
                flexDirection: 'row',
                padding: 4,
                borderRadius: 16,
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.1)',
              }}
            >
              <Pressable
                onPress={() => setSelectedMetric('strength')}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                  backgroundColor: selectedMetric === 'strength' ? Colors.signal[600] : 'transparent',
                }}
              >
                <Text
                  style={{
                    fontWeight: '600',
                    color: selectedMetric === 'strength' ? '#fff' : Colors.graphite[300],
                  }}
                >
                  Strength
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setSelectedMetric('conditioning')}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                  backgroundColor: selectedMetric === 'conditioning' ? Colors.signal[600] : 'transparent',
                }}
              >
                <Text
                  style={{
                    fontWeight: '600',
                    color: selectedMetric === 'conditioning' ? '#fff' : Colors.graphite[300],
                  }}
                >
                  Conditioning
                </Text>
              </Pressable>
            </View>
          </View>

          {selectedMetric === 'strength' ? (
            <>
              {/* Weekly Insights */}
              <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
                <WeeklyInsights workouts={recentWorkouts} />
              </View>

              {/* Pattern Detection */}
              {patterns.length > 0 && (
                <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
                  <PatternInsightsList
                    patterns={patterns}
                    title="Training Patterns"
                    maxItems={3}
                    compact
                  />
                </View>
              )}

              {/* Estimated 1RM Chart Placeholder */}
              <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 12, color: Colors.graphite[50] }}>
                  Estimated 1RM Progress
                </Text>
                <View
                  style={{
                    height: 192,
                    borderRadius: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <Ionicons name="trending-up" size={48} color={Colors.graphite[600]} />
                  <Text style={{ marginTop: 8, color: Colors.graphite[400] }}>
                    Line chart visualization
                  </Text>
                  <Text style={{ fontSize: 12, color: Colors.graphite[400] }}>
                    Coming with chart library integration
                  </Text>
                </View>
              </View>

              {/* Lift Progress Cards */}
              <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 12, color: Colors.graphite[50] }}>
                  Main Lifts (E1RM)
                </Text>
                {prsLoading ? (
                  <View
                    style={{
                      padding: 24,
                      borderRadius: 16,
                      alignItems: 'center',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    <Text style={{ color: Colors.graphite[400] }}>Loading...</Text>
                  </View>
                ) : liftsWithPRs.length === 0 ? (
                  <View
                    style={{
                      padding: 24,
                      borderRadius: 16,
                      alignItems: 'center',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    <Ionicons name="barbell-outline" size={48} color={Colors.graphite[600]} />
                    <Text style={{ marginTop: 12, fontWeight: '600', color: Colors.graphite[300] }}>
                      No PRs Recorded Yet
                    </Text>
                    <Text style={{ marginTop: 4, fontSize: 12, textAlign: 'center', color: Colors.graphite[500] }}>
                      Complete workouts to start tracking your estimated 1RM progress
                    </Text>
                  </View>
                ) : (
                  <View style={{ gap: 12 }}>
                    {liftsWithPRs.map((lift) => (
                      <View
                        key={lift.exerciseId}
                        style={{
                          padding: 16,
                          borderRadius: 16,
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          borderWidth: 1,
                          borderColor: 'rgba(255, 255, 255, 0.1)',
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <Text style={{ fontWeight: '600', color: Colors.graphite[50] }}>
                            {lift.exerciseName}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(59, 130, 246, 0.2)' }}>
                            <Ionicons name="trophy" size={12} color={Colors.signal[400]} />
                            <Text style={{ fontSize: 10, fontWeight: '600', marginLeft: 4, color: Colors.signal[400] }}>
                              PR
                            </Text>
                          </View>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                          <View>
                            <Text style={{ fontSize: 30, fontWeight: '700', color: Colors.graphite[50] }}>
                              {lift.e1rm}
                            </Text>
                            <Text style={{ fontSize: 12, color: Colors.graphite[400] }}>lbs</Text>
                          </View>
                          {lift.achievedAt && (
                            <Text style={{ fontSize: 12, color: Colors.graphite[400] }}>
                              {new Date(lift.achievedAt).toLocaleDateString()}
                            </Text>
                          )}
                        </View>

                        {/* Progress Bar */}
                        <View style={{ height: 4, borderRadius: 2, marginTop: 12, backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
                          <View
                            style={{
                              height: '100%',
                              borderRadius: 2,
                              backgroundColor: Colors.signal[500],
                              width: `${Math.min(((lift.e1rm || 0) / 500) * 100, 100)}%`,
                            }}
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </>
          ) : (
            <>
              {/* Aerobic Efficiency Chart Placeholder */}
              <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 12, color: Colors.graphite[50] }}>
                  Aerobic Efficiency
                </Text>
                <View
                  style={{
                    height: 192,
                    borderRadius: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <Ionicons name="pulse" size={48} color={Colors.graphite[600]} />
                  <Text style={{ marginTop: 8, color: Colors.graphite[400] }}>
                    Watts vs Heart Rate scatter plot
                  </Text>
                  <Text style={{ fontSize: 12, color: Colors.graphite[400] }}>
                    Coming with chart library integration
                  </Text>
                </View>
              </View>

              {/* Conditioning Metrics - Empty State */}
              <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 12, color: Colors.graphite[50] }}>
                  Conditioning Metrics
                </Text>
                <View
                  style={{
                    padding: 24,
                    borderRadius: 16,
                    alignItems: 'center',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <Ionicons name="watch-outline" size={48} color={Colors.graphite[600]} />
                  <Text style={{ marginTop: 12, fontWeight: '600', color: Colors.graphite[300] }}>
                    No Conditioning Data Yet
                  </Text>
                  <Text style={{ marginTop: 4, fontSize: 12, textAlign: 'center', color: Colors.graphite[500] }}>
                    Wearable integration coming soon to track watts, heart rate, and zone compliance
                  </Text>
                </View>
              </View>
            </>
          )}

          {/* Bottom spacing */}
          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
