import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';

export default function ExerciseHistoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <SafeAreaView
      className={`flex-1 ${isDark ? 'bg-carbon-950' : 'bg-graphite-50'}`}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-graphite-700">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2">
          <Ionicons
            name="chevron-back"
            size={24}
            color={isDark ? '#E6E8EB' : '#0E1116'}
          />
        </Pressable>
        <Text
          className={`text-lg font-semibold ${isDark ? 'text-graphite-50' : 'text-carbon-950'}`}
        >
          Exercise History
        </Text>
        <View className="w-10" />
      </View>

      {/* Placeholder Content */}
      <View className="flex-1 items-center justify-center px-6">
        <Ionicons
          name="bar-chart-outline"
          size={64}
          color={isDark ? '#6B7485' : '#878E9C'}
        />
        <Text
          className={`text-xl font-semibold mt-4 ${isDark ? 'text-graphite-50' : 'text-carbon-950'}`}
        >
          Coming Soon
        </Text>
        <Text
          className={`text-center mt-2 ${isDark ? 'text-graphite-400' : 'text-graphite-600'}`}
        >
          View your performance history, PRs, and trends for this exercise.
        </Text>
      </View>
    </SafeAreaView>
  );
}
