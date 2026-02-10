import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';

export default function ExerciseHistoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View style={{ flex: 1, backgroundColor: Colors.void[900] }}>
      {/* Ambient Background Glows */}
      <View pointerEvents="none" style={{ position: 'absolute', top: -60, right: -100, width: 260, height: 260, backgroundColor: 'rgba(37, 99, 235, 0.06)', borderRadius: 130 }} />
      <View pointerEvents="none" style={{ position: 'absolute', bottom: 100, left: -80, width: 220, height: 220, backgroundColor: 'rgba(37, 99, 235, 0.04)', borderRadius: 110 }} />

      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(255, 255, 255, 0.1)',
          }}
        >
          <Pressable onPress={() => router.back()} style={{ padding: 8, marginLeft: -8 }}>
            <Ionicons name="chevron-back" size={24} color={Colors.graphite[50]} />
          </Pressable>
          <Text style={{ fontSize: 18, fontWeight: '600', color: Colors.graphite[50] }}>
            Exercise History
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Placeholder Content */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <Ionicons name="bar-chart-outline" size={64} color={Colors.graphite[500]} />
          <Text style={{ fontSize: 20, fontWeight: '600', marginTop: 16, color: Colors.graphite[50] }}>
            Coming Soon
          </Text>
          <Text style={{ textAlign: 'center', marginTop: 8, color: Colors.graphite[400] }}>
            View your performance history, PRs, and trends for this exercise.
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}
