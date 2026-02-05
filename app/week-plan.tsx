/**
 * Week Plan Screen
 *
 * Accessible from the home screen or coach tab.
 * Provides the Sunday night planning ritual flow.
 */

import React from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';

import { Colors } from '@/constants/Colors';
import { WeekPlanner } from '@/components/coach/WeekPlanner';
import type { WeeklyPlan } from '@/types/coach';

export default function WeekPlanScreen() {
  const handleComplete = (plan: WeeklyPlan) => {
    // Show success feedback
    const workoutCount = plan.days.filter(
      (d) => !d.isRestDay && d.exercises && d.exercises.length > 0
    ).length;

    Alert.alert(
      'Week Planned!',
      `Created ${workoutCount} workouts for the week. You'll see them on your home screen.`,
      [
        {
          text: 'View Home',
          onPress: () => router.replace('/(tabs)'),
        },
      ]
    );
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Plan Your Week',
          headerShown: false,
        }}
      />

      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <WeekPlanner onComplete={handleComplete} onCancel={handleCancel} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.void[900],
  },
  safeArea: {
    flex: 1,
  },
});
