import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { GoalCard } from '@/components/GoalCard';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/useAppStore';
import { useFollow } from '@/hooks/useSocial';
import { calculateGoalProgress, type FitnessGoal } from '@/hooks/useGoals';

export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
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
      <View style={{ flex: 1, backgroundColor: Colors.void[900], alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={Colors.signal[500]} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.void[900], alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: Colors.graphite[400] }}>User not found</Text>
      </View>
    );
  }

  const isOwnProfile = currentUserId === id;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.void[900] }}>
      {/* Ambient Background Glows */}
      <View style={{ position: 'absolute', top: -80, right: -100, width: 280, height: 280, backgroundColor: 'rgba(37, 99, 235, 0.06)', borderRadius: 140 }} />
      <View style={{ position: 'absolute', bottom: 100, left: -80, width: 240, height: 240, backgroundColor: 'rgba(37, 99, 235, 0.04)', borderRadius: 120 }} />

      <SafeAreaView style={{ flex: 1 }} edges={['left', 'right']}>
        {/* Header */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(255, 255, 255, 0.1)',
            backgroundColor: 'rgba(18, 18, 18, 0.9)',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable onPress={() => router.back()} style={{ padding: 8, marginLeft: -8 }}>
              <Ionicons name="arrow-back" size={24} color={Colors.graphite[50]} />
            </Pressable>
            <Text style={{ fontWeight: '600', color: Colors.graphite[50] }}>Profile</Text>
            <View style={{ width: 40 }} />
          </View>
        </View>

        <ScrollView style={{ flex: 1, paddingHorizontal: 16 }}>
          {/* Profile Header */}
          <View style={{ alignItems: 'center', paddingVertical: 24, marginBottom: 24 }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.signal[500], alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 24 }}>
                {profile.display_name?.charAt(0).toUpperCase() || profile.email?.charAt(0).toUpperCase() || 'U'}
              </Text>
            </View>
            <Text style={{ fontSize: 24, fontWeight: '700', marginBottom: 4, color: Colors.graphite[50] }}>
              {profile.display_name || profile.email || 'User'}
            </Text>
            {!isOwnProfile && (
              <Pressable
                style={{
                  marginTop: 16,
                  paddingHorizontal: 24,
                  paddingVertical: 8,
                  borderRadius: 24,
                  backgroundColor: followStatus ? 'rgba(255, 255, 255, 0.1)' : Colors.signal[500],
                }}
                onPress={handleFollow}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>
                  {followStatus ? 'Following' : 'Follow'}
                </Text>
              </Pressable>
            )}
          </View>

          {/* Goals Section */}
          {userGoals.length > 0 && (
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 12, color: Colors.graphite[50] }}>
                Training Goals
              </Text>
              <View style={{ gap: 12 }}>
                {userGoals.map((goal) => (
                  <GoalCard key={goal.id} goal={goal} compact />
                ))}
              </View>
            </View>
          )}

          {/* Progress Metrics */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 12, color: Colors.graphite[50] }}>
              Progress Metrics
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              <View
                style={{
                  flex: 1,
                  minWidth: '45%',
                  padding: 16,
                  borderRadius: 16,
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                }}
              >
                <Text style={{ fontSize: 24, fontWeight: '700', marginBottom: 4, color: Colors.signal[400] }}>
                  {stats.consistencyStreak}
                </Text>
                <Text style={{ fontSize: 10, color: Colors.graphite[400] }}>Day Streak</Text>
              </View>
              <View
                style={{
                  flex: 1,
                  minWidth: '45%',
                  padding: 16,
                  borderRadius: 16,
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                }}
              >
                <Text style={{ fontSize: 24, fontWeight: '700', marginBottom: 4, color: '#F2994A' }}>
                  {stats.completedBlocks}
                </Text>
                <Text style={{ fontSize: 10, color: Colors.graphite[400] }}>Blocks Completed</Text>
              </View>
              <View
                style={{
                  flex: 1,
                  minWidth: '45%',
                  padding: 16,
                  borderRadius: 16,
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                }}
              >
                <Text style={{ fontSize: 24, fontWeight: '700', marginBottom: 4, color: '#F2994A' }}>
                  {stats.testedPRs}
                </Text>
                <Text style={{ fontSize: 10, color: Colors.graphite[400] }}>PRs This Year</Text>
              </View>
              <View
                style={{
                  flex: 1,
                  minWidth: '45%',
                  padding: 16,
                  borderRadius: 16,
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                }}
              >
                <Text style={{ fontSize: 24, fontWeight: '700', marginBottom: 4, color: Colors.emerald[400] }}>
                  {stats.adherenceRate}%
                </Text>
                <Text style={{ fontSize: 10, color: Colors.graphite[400] }}>Adherence Rate</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
