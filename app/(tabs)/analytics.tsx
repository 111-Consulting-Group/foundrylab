import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';
import { WeeklyInsights } from '@/components/WeeklyInsights';
import { useWorkoutHistory } from '@/hooks/useWorkouts';
import { useMainLiftPRs } from '@/hooks/usePersonalRecords';

type MetricType = 'strength' | 'conditioning';

export default function AnalyticsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('strength');

  // Fetch workout history for weekly insights
  const { data: recentWorkouts = [] } = useWorkoutHistory(50);

  // Fetch main lift PRs
  const { data: mainLiftPRs = [], isLoading: prsLoading } = useMainLiftPRs();

  // Filter to only lifts with recorded PRs
  const liftsWithPRs = mainLiftPRs.filter(lift => lift.e1rm !== null);

  return (
    <SafeAreaView className={`flex-1 ${isDark ? 'bg-carbon-950' : 'bg-graphite-50'}`} edges={['left', 'right']}>
      <ScrollView className="flex-1">
        {/* Metric Toggle */}
        <View className="px-4 pt-4">
          <View
            className={`flex-row p-1 rounded-xl ${
              isDark ? 'bg-graphite-800' : 'bg-graphite-200'
            }`}
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
                    : isDark
                    ? 'text-graphite-400'
                    : 'text-graphite-600'
                }`}
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
                    : isDark
                    ? 'text-graphite-400'
                    : 'text-graphite-600'
                }`}
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

            {/* Estimated 1RM Chart Placeholder */}
            <View className="px-4 mt-6">
              <Text className={`text-lg font-bold mb-3 ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
                Estimated 1RM Progress
              </Text>
              <View
                className={`h-48 rounded-xl items-center justify-center ${
                  isDark ? 'bg-graphite-800' : 'bg-white'
                } border ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}
              >
                <Ionicons
                  name="trending-up"
                  size={48}
                  color={isDark ? '#353D4B' : '#A5ABB6'}
                />
                <Text className={`mt-2 ${isDark ? 'text-graphite-500' : 'text-graphite-400'}`}>
                  Line chart visualization
                </Text>
                <Text className={`text-sm ${isDark ? 'text-graphite-600' : 'text-graphite-300'}`}>
                  Coming with chart library integration
                </Text>
              </View>
            </View>

            {/* Lift Progress Cards */}
            <View className="px-4 mt-6">
              <Text className={`text-lg font-bold mb-3 ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
                Main Lifts (E1RM)
              </Text>
              {prsLoading ? (
                <View
                  className={`p-6 rounded-xl items-center ${
                    isDark ? 'bg-graphite-800' : 'bg-white'
                  } border ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}
                >
                  <Text className={isDark ? 'text-graphite-400' : 'text-graphite-500'}>
                    Loading...
                  </Text>
                </View>
              ) : liftsWithPRs.length === 0 ? (
                <View
                  className={`p-6 rounded-xl items-center ${
                    isDark ? 'bg-graphite-800' : 'bg-white'
                  } border ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}
                >
                  <Ionicons
                    name="barbell-outline"
                    size={48}
                    color={isDark ? '#353D4B' : '#A5ABB6'}
                  />
                  <Text className={`mt-3 font-semibold ${isDark ? 'text-graphite-300' : 'text-graphite-600'}`}>
                    No PRs Recorded Yet
                  </Text>
                  <Text className={`mt-1 text-sm text-center ${isDark ? 'text-graphite-500' : 'text-graphite-400'}`}>
                    Complete workouts to start tracking your estimated 1RM progress
                  </Text>
                </View>
              ) : (
                <View className="gap-3">
                  {liftsWithPRs.map((lift) => (
                    <View
                      key={lift.exerciseId}
                      className={`p-4 rounded-xl ${
                        isDark ? 'bg-graphite-800' : 'bg-white'
                      } border ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}
                    >
                      <View className="flex-row items-center justify-between mb-2">
                        <Text className={`font-semibold ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
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
                          <Text className={`text-3xl font-bold ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
                            {lift.e1rm}
                          </Text>
                          <Text className={`text-sm ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                            lbs
                          </Text>
                        </View>
                        {lift.achievedAt && (
                          <Text className={`text-sm ${isDark ? 'text-graphite-500' : 'text-graphite-400'}`}>
                            {new Date(lift.achievedAt).toLocaleDateString()}
                          </Text>
                        )}
                      </View>

                      {/* Progress Bar */}
                      <View className={`h-1 rounded-full mt-3 ${isDark ? 'bg-graphite-700' : 'bg-graphite-200'}`}>
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
              <Text className={`text-lg font-bold mb-3 ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
                Aerobic Efficiency
              </Text>
              <View
                className={`h-48 rounded-xl items-center justify-center ${
                  isDark ? 'bg-graphite-800' : 'bg-white'
                } border ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}
              >
                <Ionicons
                  name="pulse"
                  size={48}
                  color={isDark ? '#353D4B' : '#A5ABB6'}
                />
                <Text className={`mt-2 ${isDark ? 'text-graphite-500' : 'text-graphite-400'}`}>
                  Watts vs Heart Rate scatter plot
                </Text>
                <Text className={`text-sm ${isDark ? 'text-graphite-600' : 'text-graphite-300'}`}>
                  Coming with chart library integration
                </Text>
              </View>
            </View>

            {/* Conditioning Metrics - Empty State */}
            <View className="px-4 mt-6">
              <Text className={`text-lg font-bold mb-3 ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
                Conditioning Metrics
              </Text>
              <View
                className={`p-6 rounded-xl items-center ${
                  isDark ? 'bg-graphite-800' : 'bg-white'
                } border ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}
              >
                <Ionicons
                  name="watch-outline"
                  size={48}
                  color={isDark ? '#353D4B' : '#A5ABB6'}
                />
                <Text className={`mt-3 font-semibold ${isDark ? 'text-graphite-300' : 'text-graphite-600'}`}>
                  No Conditioning Data Yet
                </Text>
                <Text className={`mt-1 text-sm text-center ${isDark ? 'text-graphite-500' : 'text-graphite-400'}`}>
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
