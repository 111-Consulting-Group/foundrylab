import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { View, Text, ScrollView, Pressable, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';

type MetricType = 'strength' | 'conditioning';

interface ExerciseProgress {
  name: string;
  current1RM: number;
  previous1RM: number;
  percentChange: number;
}

// Mock data - will be replaced with real data from Supabase
const strengthProgress: ExerciseProgress[] = [
  { name: 'Back Squat', current1RM: 315, previous1RM: 295, percentChange: 6.8 },
  { name: 'Bench Press', current1RM: 245, previous1RM: 235, percentChange: 4.3 },
  { name: 'Deadlift', current1RM: 405, previous1RM: 385, percentChange: 5.2 },
  { name: 'Overhead Press', current1RM: 155, previous1RM: 150, percentChange: 3.3 },
  { name: 'Barbell Row', current1RM: 225, previous1RM: 215, percentChange: 4.7 },
];

const conditioningMetrics = {
  avgWattsPerKg: 3.2,
  avgHeartRate: 142,
  zone2Compliance: 85,
  weeklyMinutes: 180,
};

export default function AnalyticsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('strength');
  const screenWidth = Dimensions.get('window').width;

  return (
    <SafeAreaView className={`flex-1 ${isDark ? 'bg-steel-950' : 'bg-steel-50'}`} edges={['left', 'right']}>
      <ScrollView className="flex-1">
        {/* Metric Toggle */}
        <View className="px-4 pt-4">
          <View
            className={`flex-row p-1 rounded-xl ${
              isDark ? 'bg-steel-800' : 'bg-steel-200'
            }`}
          >
            <Pressable
              onPress={() => setSelectedMetric('strength')}
              className={`flex-1 py-3 rounded-lg items-center ${
                selectedMetric === 'strength'
                  ? 'bg-forge-500'
                  : 'bg-transparent'
              }`}
            >
              <Text
                className={`font-semibold ${
                  selectedMetric === 'strength'
                    ? 'text-white'
                    : isDark
                    ? 'text-steel-400'
                    : 'text-steel-600'
                }`}
              >
                Strength
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSelectedMetric('conditioning')}
              className={`flex-1 py-3 rounded-lg items-center ${
                selectedMetric === 'conditioning'
                  ? 'bg-forge-500'
                  : 'bg-transparent'
              }`}
            >
              <Text
                className={`font-semibold ${
                  selectedMetric === 'conditioning'
                    ? 'text-white'
                    : isDark
                    ? 'text-steel-400'
                    : 'text-steel-600'
                }`}
              >
                Conditioning
              </Text>
            </Pressable>
          </View>
        </View>

        {selectedMetric === 'strength' ? (
          <>
            {/* Estimated 1RM Chart Placeholder */}
            <View className="px-4 mt-6">
              <Text className={`text-lg font-bold mb-3 ${isDark ? 'text-steel-100' : 'text-steel-900'}`}>
                Estimated 1RM Progress
              </Text>
              <View
                className={`h-48 rounded-xl items-center justify-center ${
                  isDark ? 'bg-steel-800' : 'bg-white'
                } border ${isDark ? 'border-steel-700' : 'border-steel-200'}`}
              >
                <Ionicons
                  name="trending-up"
                  size={48}
                  color={isDark ? '#3e4965' : '#d3d8e4'}
                />
                <Text className={`mt-2 ${isDark ? 'text-steel-500' : 'text-steel-400'}`}>
                  Line chart visualization
                </Text>
                <Text className={`text-sm ${isDark ? 'text-steel-600' : 'text-steel-300'}`}>
                  Coming with chart library integration
                </Text>
              </View>
            </View>

            {/* Lift Progress Cards */}
            <View className="px-4 mt-6">
              <Text className={`text-lg font-bold mb-3 ${isDark ? 'text-steel-100' : 'text-steel-900'}`}>
                Main Lifts (E1RM)
              </Text>
              <View className="gap-3">
                {strengthProgress.map((lift) => (
                  <View
                    key={lift.name}
                    className={`p-4 rounded-xl ${
                      isDark ? 'bg-steel-800' : 'bg-white'
                    } border ${isDark ? 'border-steel-700' : 'border-steel-200'}`}
                  >
                    <View className="flex-row items-center justify-between mb-2">
                      <Text className={`font-semibold ${isDark ? 'text-steel-100' : 'text-steel-900'}`}>
                        {lift.name}
                      </Text>
                      <View
                        className={`flex-row items-center px-2 py-1 rounded-full ${
                          lift.percentChange > 0 ? 'bg-success-500/20' : 'bg-ember-500/20'
                        }`}
                      >
                        <Ionicons
                          name={lift.percentChange > 0 ? 'arrow-up' : 'arrow-down'}
                          size={12}
                          color={lift.percentChange > 0 ? '#22c55e' : '#f43f5e'}
                        />
                        <Text
                          className={`text-xs font-semibold ml-1 ${
                            lift.percentChange > 0 ? 'text-success-500' : 'text-ember-500'
                          }`}
                        >
                          {lift.percentChange.toFixed(1)}%
                        </Text>
                      </View>
                    </View>
                    <View className="flex-row items-end justify-between">
                      <View>
                        <Text className={`text-3xl font-bold ${isDark ? 'text-steel-100' : 'text-steel-900'}`}>
                          {lift.current1RM}
                        </Text>
                        <Text className={`text-sm ${isDark ? 'text-steel-400' : 'text-steel-500'}`}>
                          lbs
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className={`text-sm ${isDark ? 'text-steel-400' : 'text-steel-500'}`}>
                          Previous: {lift.previous1RM} lbs
                        </Text>
                        <Text className={`text-xs ${isDark ? 'text-steel-500' : 'text-steel-400'}`}>
                          +{lift.current1RM - lift.previous1RM} lbs
                        </Text>
                      </View>
                    </View>

                    {/* Progress Bar */}
                    <View className={`h-1 rounded-full mt-3 ${isDark ? 'bg-steel-700' : 'bg-steel-200'}`}>
                      <View
                        className="h-full rounded-full bg-forge-500"
                        style={{ width: `${Math.min((lift.current1RM / 500) * 100, 100)}%` }}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </>
        ) : (
          <>
            {/* Aerobic Efficiency Chart Placeholder */}
            <View className="px-4 mt-6">
              <Text className={`text-lg font-bold mb-3 ${isDark ? 'text-steel-100' : 'text-steel-900'}`}>
                Aerobic Efficiency
              </Text>
              <View
                className={`h-48 rounded-xl items-center justify-center ${
                  isDark ? 'bg-steel-800' : 'bg-white'
                } border ${isDark ? 'border-steel-700' : 'border-steel-200'}`}
              >
                <Ionicons
                  name="pulse"
                  size={48}
                  color={isDark ? '#3e4965' : '#d3d8e4'}
                />
                <Text className={`mt-2 ${isDark ? 'text-steel-500' : 'text-steel-400'}`}>
                  Watts vs Heart Rate scatter plot
                </Text>
                <Text className={`text-sm ${isDark ? 'text-steel-600' : 'text-steel-300'}`}>
                  Coming with chart library integration
                </Text>
              </View>
            </View>

            {/* Conditioning Metrics */}
            <View className="px-4 mt-6">
              <Text className={`text-lg font-bold mb-3 ${isDark ? 'text-steel-100' : 'text-steel-900'}`}>
                Conditioning Metrics
              </Text>
              <View className="gap-3">
                <View className="flex-row gap-3">
                  <View
                    className={`flex-1 p-4 rounded-xl ${
                      isDark ? 'bg-steel-800' : 'bg-white'
                    } border ${isDark ? 'border-steel-700' : 'border-steel-200'}`}
                  >
                    <View className="flex-row items-center mb-2">
                      <Ionicons name="flash" size={20} color="#ed7411" />
                      <Text className={`ml-2 text-sm ${isDark ? 'text-steel-400' : 'text-steel-500'}`}>
                        Avg W/kg
                      </Text>
                    </View>
                    <Text className={`text-2xl font-bold ${isDark ? 'text-steel-100' : 'text-steel-900'}`}>
                      {conditioningMetrics.avgWattsPerKg}
                    </Text>
                  </View>
                  <View
                    className={`flex-1 p-4 rounded-xl ${
                      isDark ? 'bg-steel-800' : 'bg-white'
                    } border ${isDark ? 'border-steel-700' : 'border-steel-200'}`}
                  >
                    <View className="flex-row items-center mb-2">
                      <Ionicons name="heart" size={20} color="#f43f5e" />
                      <Text className={`ml-2 text-sm ${isDark ? 'text-steel-400' : 'text-steel-500'}`}>
                        Avg HR
                      </Text>
                    </View>
                    <Text className={`text-2xl font-bold ${isDark ? 'text-steel-100' : 'text-steel-900'}`}>
                      {conditioningMetrics.avgHeartRate}
                    </Text>
                  </View>
                </View>

                <View className="flex-row gap-3">
                  <View
                    className={`flex-1 p-4 rounded-xl ${
                      isDark ? 'bg-steel-800' : 'bg-white'
                    } border ${isDark ? 'border-steel-700' : 'border-steel-200'}`}
                  >
                    <View className="flex-row items-center mb-2">
                      <Ionicons name="analytics" size={20} color="#22c55e" />
                      <Text className={`ml-2 text-sm ${isDark ? 'text-steel-400' : 'text-steel-500'}`}>
                        Zone 2 Compliance
                      </Text>
                    </View>
                    <Text className={`text-2xl font-bold ${isDark ? 'text-steel-100' : 'text-steel-900'}`}>
                      {conditioningMetrics.zone2Compliance}%
                    </Text>
                  </View>
                  <View
                    className={`flex-1 p-4 rounded-xl ${
                      isDark ? 'bg-steel-800' : 'bg-white'
                    } border ${isDark ? 'border-steel-700' : 'border-steel-200'}`}
                  >
                    <View className="flex-row items-center mb-2">
                      <Ionicons name="time" size={20} color="#808fb0" />
                      <Text className={`ml-2 text-sm ${isDark ? 'text-steel-400' : 'text-steel-500'}`}>
                        Weekly Minutes
                      </Text>
                    </View>
                    <Text className={`text-2xl font-bold ${isDark ? 'text-steel-100' : 'text-steel-900'}`}>
                      {conditioningMetrics.weeklyMinutes}
                    </Text>
                  </View>
                </View>
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
