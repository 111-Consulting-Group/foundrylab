import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';
import { WeeklyInsights } from '@/components/WeeklyInsights';
import { PatternInsightsList } from '@/components/PatternInsights';
import { useWorkoutHistory } from '@/hooks/useWorkouts';
import { useMainLiftPRs } from '@/hooks/usePersonalRecords';
import { usePatternInsights } from '@/hooks/usePatternDetection';

type MetricType = 'strength' | 'conditioning';

export default function AnalyticsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
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
    <SafeAreaView 
      className="flex-1 bg-carbon-950" 
      style={{ backgroundColor: '#0E1116' }}
      edges={['left', 'right']}
    >
      <ScrollView className="flex-1">
        {/* Metric Toggle */}
        <View className="px-4 pt-4">
          <View
            className="flex-row p-1 rounded-xl bg-graphite-800"
            style={{ backgroundColor: '#1A1F2E' }}
          >
            <Pressable
              onPress={() => setSelectedMetric('strength')}
              className={`flex-1 py-3 rounded-lg items-center ${
                selectedMetric === 'strength'
                  ? 'bg-signal-500'
                  : 'bg-transparent'
              }`}
            >
              <Text
                className={`font-semibold ${
                  selectedMetric === 'strength'
                    ? 'text-white'
                    : 'text-graphite-300'
                }`}
                style={selectedMetric !== 'strength' ? { color: '#C4C8D0' } : undefined}
              >
                Strength
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSelectedMetric('conditioning')}
              className={`flex-1 py-3 rounded-lg items-center ${
                selectedMetric === 'conditioning'
                  ? 'bg-signal-500'
                  : 'bg-transparent'
              }`}
            >
              <Text
                className={`font-semibold ${
                  selectedMetric === 'conditioning'
                    ? 'text-white'
                    : 'text-graphite-300'
                }`}
                style={selectedMetric !== 'conditioning' ? { color: '#C4C8D0' } : undefined}
              >
                Conditioning
              </Text>
            </Pressable>
          </View>
        </View>

        {selectedMetric === 'strength' ? (
          <>
            {/* Weekly Insights */}
            <View className="px-4 mt-4">
              <WeeklyInsights workouts={recentWorkouts} />
            </View>

            {/* Pattern Detection */}
            {patterns.length > 0 && (
              <View className="px-4 mt-6">
                <PatternInsightsList 
                  patterns={patterns} 
                  title="Training Patterns"
                  maxItems={3}
                  compact
                />
              </View>
            )}

            {/* Estimated 1RM Chart Placeholder */}
            <View className="px-4 mt-6">
              <Text className="text-lg font-bold mb-3 text-graphite-100" style={{ color: '#E6E8EB' }}>
                Estimated 1RM Progress
              </Text>
              <View
                className="h-48 rounded-xl items-center justify-center bg-graphite-800 border border-graphite-700"
                style={{ backgroundColor: '#1A1F2E', borderColor: '#353D4B' }}
              >
                <Ionicons
                  name="trending-up"
                  size={48}
                  color={isDark ? '#353D4B' : '#A5ABB6'}
                />
                <Text className="mt-2 text-graphite-400" style={{ color: '#6B7485' }}>
                  Line chart visualization
                </Text>
                <Text className="text-sm text-graphite-400" style={{ color: '#6B7485' }}>
                  Coming with chart library integration
                </Text>
              </View>
            </View>

            {/* Lift Progress Cards */}
            <View className="px-4 mt-6">
              <Text className="text-lg font-bold mb-3 text-graphite-100" style={{ color: '#E6E8EB' }}>
                Main Lifts (E1RM)
              </Text>
              {prsLoading ? (
                <View
                  className="p-6 rounded-xl items-center bg-graphite-800 border border-graphite-700"
                  style={{ backgroundColor: '#1A1F2E', borderColor: '#353D4B' }}
                >
                  <Text className="text-graphite-400" style={{ color: '#6B7485' }}>
                    Loading...
                  </Text>
                </View>
              ) : liftsWithPRs.length === 0 ? (
                <View
                  className="p-6 rounded-xl items-center bg-graphite-800 border border-graphite-700"
                  style={{ backgroundColor: '#1A1F2E', borderColor: '#353D4B' }}
                >
                  <Ionicons
                    name="barbell-outline"
                    size={48}
                    color="#353D4B"
                  />
                  <Text className="mt-3 font-semibold text-graphite-300" style={{ color: '#C4C8D0' }}>
                    No PRs Recorded Yet
                  </Text>
                  <Text className="mt-1 text-sm text-center text-graphite-500" style={{ color: '#808FB0' }}>
                    Complete workouts to start tracking your estimated 1RM progress
                  </Text>
                </View>
              ) : (
                <View className="gap-3">
                  {liftsWithPRs.map((lift) => (
                    <View
                      key={lift.exerciseId}
                      className="p-4 rounded-xl bg-graphite-800 border border-graphite-700"
                      style={{ backgroundColor: '#1A1F2E', borderColor: '#353D4B' }}
                    >
                      <View className="flex-row items-center justify-between mb-2">
                        <Text className="font-semibold text-graphite-100" style={{ color: '#E6E8EB' }}>
                          {lift.exerciseName}
                        </Text>
                        <View className="flex-row items-center px-2 py-1 rounded-full bg-signal-500/20">
                          <Ionicons name="trophy" size={12} color="#2F80ED" />
                          <Text className="text-xs font-semibold ml-1 text-signal-500">
                            PR
                          </Text>
                        </View>
                      </View>
                      <View className="flex-row items-end justify-between">
                        <View>
                          <Text className="text-3xl font-bold text-graphite-100" style={{ color: '#E6E8EB' }}>
                            {lift.e1rm}
                          </Text>
                          <Text className="text-sm text-graphite-400" style={{ color: '#6B7485' }}>
                            lbs
                          </Text>
                        </View>
                        {lift.achievedAt && (
                          <Text className="text-sm text-graphite-400" style={{ color: '#6B7485' }}>
                            {new Date(lift.achievedAt).toLocaleDateString()}
                          </Text>
                        )}
                      </View>

                      {/* Progress Bar */}
                      <View className="h-1 rounded-full mt-3 bg-graphite-700" style={{ backgroundColor: '#353D4B' }}>
                        <View
                          className="h-full rounded-full bg-signal-500"
                          style={{ width: `${Math.min(((lift.e1rm || 0) / 500) * 100, 100)}%` }}
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
            <View className="px-4 mt-6">
              <Text className="text-lg font-bold mb-3 text-graphite-100" style={{ color: '#E6E8EB' }}>
                Aerobic Efficiency
              </Text>
              <View
                className="h-48 rounded-xl items-center justify-center bg-graphite-800 border border-graphite-700"
                style={{ backgroundColor: '#1A1F2E', borderColor: '#353D4B' }}
              >
                <Ionicons
                  name="pulse"
                  size={48}
                  color={isDark ? '#353D4B' : '#A5ABB6'}
                />
                <Text className="mt-2 text-graphite-400" style={{ color: '#6B7485' }}>
                  Watts vs Heart Rate scatter plot
                </Text>
                <Text className="text-sm text-graphite-400" style={{ color: '#6B7485' }}>
                  Coming with chart library integration
                </Text>
              </View>
            </View>

            {/* Conditioning Metrics - Empty State */}
            <View className="px-4 mt-6">
              <Text className="text-lg font-bold mb-3 text-graphite-100" style={{ color: '#E6E8EB' }}>
                Conditioning Metrics
              </Text>
              <View
                className="p-6 rounded-xl items-center bg-graphite-800 border border-graphite-700"
                style={{ backgroundColor: '#1A1F2E', borderColor: '#353D4B' }}
              >
                <Ionicons
                  name="watch-outline"
                  size={48}
                  color="#353D4B"
                />
                <Text className="mt-3 font-semibold text-graphite-300" style={{ color: '#C4C8D0' }}>
                  No Conditioning Data Yet
                </Text>
                <Text className="mt-1 text-sm text-center text-graphite-500" style={{ color: '#808FB0' }}>
                  Wearable integration coming soon to track watts, heart rate, and zone compliance
                </Text>
              </View>
            </View>
          </>
        )}

        {/* Bottom spacing */}
        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
