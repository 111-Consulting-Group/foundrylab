import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { useColorScheme } from '@/components/useColorScheme';
import { GoalCard } from '@/components/GoalCard';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/useAppStore';
import { useFollow } from '@/hooks/useSocial';
import { calculateGoalProgress, type FitnessGoal } from '@/hooks/useGoals';
import { useState } from 'react';
import { Alert } from 'react-native';

export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const currentUserId = useAppStore((state) => state.userId);
  const followMutation = useFollow();

  // Fetch user profile
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Check if current user follows this user
  const { data: followStatus } = useQuery({
    queryKey: ['followStatus', currentUserId, id],
    queryFn: async () => {
      if (!currentUserId || !id || currentUserId === id) return false;

      const { data, error } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', currentUserId)
        .eq('following_id', id)
        .maybeSingle();

      if (error) throw error;
      return !!data;
    },
    enabled: !!currentUserId && !!id && currentUserId !== id,
  });

  // Fetch user's goals (visible if following or own profile)
  const { data: userGoals = [] } = useQuery({
    queryKey: ['userGoals', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fitness_goals')
        .select(`
          *,
          exercise:exercises(id, name, modality, primary_metric)
        `)
        .eq('user_id', id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as FitnessGoal[];
    },
    enabled: !!id,
  });

  // Fetch stats (simplified - would need more queries for real stats)
  const stats = {
    consistencyStreak: 0, // Would calculate from workout history
    completedBlocks: 0, // Would count from blocks
    testedPRs: 0, // Would count PRs this year
    adherenceRate: 0, // Would calculate from workout completion
  };

  const handleFollow = async () => {
    if (!id) return;
    try {
      await followMutation.mutateAsync({ followingId: id, follow: !followStatus });
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to update follow status');
    }
  };

  if (profileLoading) {
    return (
      <SafeAreaView
        className={`flex-1 items-center justify-center ${isDark ? 'bg-carbon-950' : 'bg-graphite-50'}`}
      >
        <ActivityIndicator size="large" color="#2F80ED" />
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView
        className={`flex-1 items-center justify-center ${isDark ? 'bg-carbon-950' : 'bg-graphite-50'}`}
      >
        <Text className={isDark ? 'text-graphite-400' : 'text-graphite-500'}>User not found</Text>
      </SafeAreaView>
    );
  }

  const isOwnProfile = currentUserId === id;

  return (
    <SafeAreaView className={`flex-1 ${isDark ? 'bg-carbon-950' : 'bg-graphite-50'}`} edges={['left', 'right']}>
      {/* Header */}
      <View
        className={`px-4 py-3 border-b ${
          isDark ? 'border-graphite-700 bg-graphite-900' : 'border-graphite-200 bg-white'
        }`}
      >
        <View className="flex-row items-center justify-between">
          <Pressable onPress={() => router.back()} className="p-2 -ml-2">
            <Ionicons name="arrow-back" size={24} color={isDark ? '#E6E8EB' : '#0E1116'} />
          </Pressable>
          <Text className={`font-semibold ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
            Profile
          </Text>
          <View className="w-10" />
        </View>
      </View>

      <ScrollView className="flex-1 px-4">
        {/* Profile Header */}
        <View className="items-center py-6 mb-6">
          <View className="w-20 h-20 rounded-full bg-signal-500 items-center justify-center mb-4">
            <Text className="text-white font-bold text-2xl">
              {profile.display_name?.charAt(0).toUpperCase() || profile.email?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
          <Text className={`text-2xl font-bold mb-1 ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
            {profile.display_name || profile.email || 'User'}
          </Text>
          {!isOwnProfile && (
            <Pressable
              className={`mt-4 px-6 py-2 rounded-full ${
                followStatus ? 'bg-graphite-700' : 'bg-signal-500'
              }`}
              onPress={handleFollow}
            >
              <Text className="text-white font-semibold">
                {followStatus ? 'Following' : 'Follow'}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Goals Section */}
        {userGoals.length > 0 && (
          <View className="mb-6">
            <Text className={`text-lg font-bold mb-3 ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
              Training Goals
            </Text>
            <View className="gap-3">
              {userGoals.map((goal) => (
                <GoalCard key={goal.id} goal={goal} compact />
              ))}
            </View>
          </View>
        )}

        {/* Progress Metrics */}
        <View className="mb-6">
          <Text className={`text-lg font-bold mb-3 ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}>
            Progress Metrics
          </Text>
          <View className="flex-row flex-wrap gap-3">
            <View
              className={`flex-1 min-w-[48%] p-4 rounded-xl ${
                isDark ? 'bg-graphite-800 border-graphite-700' : 'bg-white border-graphite-200'
              } border`}
            >
              <Text className={`text-2xl font-bold mb-1 text-signal-500`}>
                {stats.consistencyStreak}
              </Text>
              <Text className={`text-xs ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                Day Streak
              </Text>
            </View>
            <View
              className={`flex-1 min-w-[48%] p-4 rounded-xl ${
                isDark ? 'bg-graphite-800 border-graphite-700' : 'bg-white border-graphite-200'
              } border`}
            >
              <Text className={`text-2xl font-bold mb-1 text-oxide-500`}>
                {stats.completedBlocks}
              </Text>
              <Text className={`text-xs ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                Blocks Completed
              </Text>
            </View>
            <View
              className={`flex-1 min-w-[48%] p-4 rounded-xl ${
                isDark ? 'bg-graphite-800 border-graphite-700' : 'bg-white border-graphite-200'
              } border`}
            >
              <Text className={`text-2xl font-bold mb-1 text-oxide-500`}>
                {stats.testedPRs}
              </Text>
              <Text className={`text-xs ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                PRs This Year
              </Text>
            </View>
            <View
              className={`flex-1 min-w-[48%] p-4 rounded-xl ${
                isDark ? 'bg-graphite-800 border-graphite-700' : 'bg-white border-graphite-200'
              } border`}
            >
              <Text className={`text-2xl font-bold mb-1 text-progress-500`}>
                {stats.adherenceRate}%
              </Text>
              <Text className={`text-xs ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
                Adherence Rate
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
