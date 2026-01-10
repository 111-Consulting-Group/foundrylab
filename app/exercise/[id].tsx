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
      className={`flex-1 ${isDark ? 'bg-[#1e232f]' : 'bg-[#f6f7f9]'}`}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-700">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2">
          <Ionicons
            name="chevron-back"
            size={24}
            color={isDark ? '#f6f7f9' : '#1e232f'}
          />
        </Pressable>
        <Text
          className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}
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
          color={isDark ? '#6b7280' : '#9ca3af'}
        />
        <Text
          className={`text-xl font-semibold mt-4 ${isDark ? 'text-white' : 'text-gray-900'}`}
        >
          Coming Soon
        </Text>
        <Text
          className={`text-center mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
        >
          View your performance history, PRs, and trends for this exercise.
        </Text>
      </View>
    </SafeAreaView>
  );
}
