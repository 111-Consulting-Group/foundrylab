import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';

interface WorkoutHistoryItem {
  id: string;
  date: Date;
  focus: string;
  duration: number;
  totalVolume: number;
  exerciseCount: number;
  prCount: number;
}

// Mock data - will be replaced with real data from Supabase
const mockHistory: WorkoutHistoryItem[] = [
  {
    id: '1',
    date: new Date(2026, 0, 8),
    focus: 'Pull',
    duration: 62,
    totalVolume: 14500,
    exerciseCount: 5,
    prCount: 1,
  },
  {
    id: '2',
    date: new Date(2026, 0, 7),
    focus: 'Push',
    duration: 58,
    totalVolume: 12300,
    exerciseCount: 5,
    prCount: 0,
  },
  {
    id: '3',
    date: new Date(2026, 0, 6),
    focus: 'Legs',
    duration: 75,
    totalVolume: 22100,
    exerciseCount: 6,
    prCount: 2,
  },
  {
    id: '4',
    date: new Date(2026, 0, 5),
    focus: 'Zone 2 Cardio',
    duration: 45,
    totalVolume: 0,
    exerciseCount: 1,
    prCount: 0,
  },
  {
    id: '5',
    date: new Date(2026, 0, 4),
    focus: 'Upper',
    duration: 55,
    totalVolume: 11200,
    exerciseCount: 6,
    prCount: 0,
  },
];

export default function HistoryScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [searchQuery, setSearchQuery] = useState('');

  const filteredHistory = mockHistory.filter((workout) =>
    workout.focus.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView className={`flex-1 ${isDark ? 'bg-steel-950' : 'bg-steel-50'}`} edges={['left', 'right']}>
      {/* Search Bar */}
      <View className="px-4 py-3">
        <View
          className={`flex-row items-center px-4 py-3 rounded-xl ${
            isDark ? 'bg-steel-800' : 'bg-white'
          } border ${isDark ? 'border-steel-700' : 'border-steel-200'}`}
        >
          <Ionicons
            name="search"
            size={20}
            color={isDark ? '#808fb0' : '#607296'}
            style={{ marginRight: 10 }}
          />
          <TextInput
            className={`flex-1 text-base ${isDark ? 'text-steel-100' : 'text-steel-900'}`}
            placeholder="Search workouts or exercises..."
            placeholderTextColor={isDark ? '#808fb0' : '#607296'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={isDark ? '#808fb0' : '#607296'} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Stats Summary */}
      <View className="px-4 mb-4">
        <View className="flex-row gap-3">
          <View
            className={`flex-1 p-4 rounded-xl ${
              isDark ? 'bg-steel-800' : 'bg-white'
            } border ${isDark ? 'border-steel-700' : 'border-steel-200'}`}
          >
            <Text className={`text-2xl font-bold ${isDark ? 'text-steel-100' : 'text-steel-900'}`}>
              47
            </Text>
            <Text className={`text-xs ${isDark ? 'text-steel-400' : 'text-steel-500'}`}>
              Total Workouts
            </Text>
          </View>
          <View
            className={`flex-1 p-4 rounded-xl ${
              isDark ? 'bg-steel-800' : 'bg-white'
            } border ${isDark ? 'border-steel-700' : 'border-steel-200'}`}
          >
            <Text className={`text-2xl font-bold text-forge-500`}>295k</Text>
            <Text className={`text-xs ${isDark ? 'text-steel-400' : 'text-steel-500'}`}>
              Total Volume (lbs)
            </Text>
          </View>
          <View
            className={`flex-1 p-4 rounded-xl ${
              isDark ? 'bg-steel-800' : 'bg-white'
            } border ${isDark ? 'border-steel-700' : 'border-steel-200'}`}
          >
            <Text className={`text-2xl font-bold text-ember-500`}>12</Text>
            <Text className={`text-xs ${isDark ? 'text-steel-400' : 'text-steel-500'}`}>
              PRs This Month
            </Text>
          </View>
        </View>
      </View>

      {/* Workout List */}
      <ScrollView className="flex-1 px-4">
        <Text className={`text-lg font-bold mb-3 ${isDark ? 'text-steel-100' : 'text-steel-900'}`}>
          Recent Workouts
        </Text>

        <View className="gap-2">
          {filteredHistory.map((workout) => (
            <Pressable
              key={workout.id}
              className={`p-4 rounded-xl ${
                isDark ? 'bg-steel-800' : 'bg-white'
              } border ${isDark ? 'border-steel-700' : 'border-steel-200'}`}
            >
              <View className="flex-row items-start justify-between mb-2">
                <View className="flex-row items-center">
                  <View
                    className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
                      workout.totalVolume > 0 ? 'bg-forge-500' : 'bg-success-500'
                    }`}
                  >
                    <Ionicons
                      name={workout.totalVolume > 0 ? 'barbell' : 'heart'}
                      size={20}
                      color="#ffffff"
                    />
                  </View>
                  <View>
                    <Text className={`font-semibold ${isDark ? 'text-steel-100' : 'text-steel-900'}`}>
                      {workout.focus}
                    </Text>
                    <Text className={`text-sm ${isDark ? 'text-steel-400' : 'text-steel-500'}`}>
                      {format(workout.date, 'EEEE, MMM d')}
                    </Text>
                  </View>
                </View>
                {workout.prCount > 0 && (
                  <View className="flex-row items-center bg-ember-500/20 px-2 py-1 rounded-full">
                    <Ionicons name="trophy" size={12} color="#f43f5e" />
                    <Text className="text-ember-500 text-xs font-semibold ml-1">
                      {workout.prCount} PR{workout.prCount > 1 ? 's' : ''}
                    </Text>
                  </View>
                )}
              </View>

              <View className="flex-row gap-4">
                <View className="flex-row items-center">
                  <Ionicons
                    name="time-outline"
                    size={14}
                    color={isDark ? '#808fb0' : '#607296'}
                  />
                  <Text className={`text-sm ml-1 ${isDark ? 'text-steel-400' : 'text-steel-500'}`}>
                    {workout.duration} min
                  </Text>
                </View>
                <View className="flex-row items-center">
                  <Ionicons
                    name="fitness-outline"
                    size={14}
                    color={isDark ? '#808fb0' : '#607296'}
                  />
                  <Text className={`text-sm ml-1 ${isDark ? 'text-steel-400' : 'text-steel-500'}`}>
                    {workout.exerciseCount} exercises
                  </Text>
                </View>
                {workout.totalVolume > 0 && (
                  <View className="flex-row items-center">
                    <Ionicons
                      name="trending-up"
                      size={14}
                      color={isDark ? '#808fb0' : '#607296'}
                    />
                    <Text className={`text-sm ml-1 ${isDark ? 'text-steel-400' : 'text-steel-500'}`}>
                      {(workout.totalVolume / 1000).toFixed(1)}k lbs
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>
          ))}
        </View>

        {/* Bottom spacing */}
        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
