import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState, useMemo, memo } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StreakBadge, PRCountBadge, BlockContextBadge, AdherenceBadge } from '@/components/FeedBadges';
import { Colors } from '@/constants/Colors';
import { useFeed, useLikePost, useSearchUsers } from '@/hooks/useSocial';
import { detectWorkoutContext, getContextInfo } from '@/lib/workoutContext';
import { summarizeWorkoutExercises, formatExerciseForFeed, getModalityIcon, type ExerciseSummary } from '@/lib/feedUtils';
import { generateExerciseSummary } from '@/lib/workoutSummary';
import { formatDistanceToNow } from 'date-fns';
import type { WorkoutWithSets } from '@/types/database';
import { LabCard, LabButton } from '@/components/ui/LabPrimitives';
import { DeltaTag } from '@/components/ui/DeltaTag';

export default function FeedScreen() {
  // Reduce initial load in dev, can increase later
  const { data: feed = [], isLoading, refetch } = useFeed(10);
  const likePostMutation = useLikePost();
  const [showDiscover, setShowDiscover] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { data: searchResults = [], isLoading: isSearching } = useSearchUsers(searchQuery);

  const handleLike = async (postId: string, isLiked: boolean) => {
    await likePostMutation.mutateAsync({ postId, like: !isLiked });
  };

  const formatDate = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
    } catch {
      return dateStr;
    }
  };

  // Memoize processed posts to avoid recalculating on every render
  const processedPosts = useMemo(() => {
    return feed.map((post) => {
      const workout = post.workout as WorkoutWithSets | undefined;
      if (!workout) return null;

      // Pre-process exercise summaries once
      const exerciseSummaries = summarizeWorkoutExercises(workout.workout_sets || []);
      const prCount = exerciseSummaries.filter(e => e.isPR).length;

      // Pre-process exercise map for highlights
      const exerciseMap = new Map<string, any[]>();
      (workout.workout_sets || []).forEach((set: any) => {
        if (!set.exercise_id || set.is_warmup || set.segment_type === 'warmup') return;
        
        const isCardio = set.exercise?.modality === 'Cardio';
        if (isCardio && !set.distance_meters && !set.duration_seconds && !set.avg_pace) {
          return;
        }
        
        if (!isCardio && set.actual_weight === null && set.actual_reps === null) {
          return;
        }
        
        const key = set.exercise_id;
        if (!exerciseMap.has(key)) {
          exerciseMap.set(key, []);
        }
        const existing = exerciseMap.get(key)!;
        const isDuplicate = existing.some(s => 
          (set.id && s.id && set.id === s.id) ||
          (!set.id && !s.id && set.set_order === s.set_order && set.exercise_id === s.exercise_id)
        );
        if (!isDuplicate) {
          existing.push(set);
        }
      });

      const exerciseEntries = Array.from(exerciseMap.entries());
      const topExercises = exerciseEntries
        .map(([exerciseId, exerciseSets]) => {
          const exercise = exerciseSets[0]?.exercise;
          if (!exercise) return null;
          const summary = exerciseSummaries.find(s => s.exerciseId === exerciseId);
          return { exerciseId, exercise, exerciseSets, summary };
        })
        .filter(Boolean)
        .sort((a, b) => {
          if (a?.summary?.isPR && !b?.summary?.isPR) return -1;
          if (!a?.summary?.isPR && b?.summary?.isPR) return 1;
          return (b?.summary?.totalVolume || 0) - (a?.summary?.totalVolume || 0);
        })
        .slice(0, 3);

      return {
        post,
        workout,
        prCount,
        topExercises,
        exerciseEntriesLength: exerciseEntries.length,
      };
    }).filter(Boolean);
  }, [feed]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.void[900] }}>
      {/* Ambient Background Glows */}
      <View style={{ position: 'absolute', top: -80, left: -100, width: 280, height: 280, backgroundColor: 'rgba(37, 99, 235, 0.07)', borderRadius: 140 }} />
      <View style={{ position: 'absolute', bottom: 100, right: -80, width: 240, height: 240, backgroundColor: 'rgba(37, 99, 235, 0.04)', borderRadius: 120 }} />

      <SafeAreaView style={{ flex: 1 }} edges={['left', 'right']}>
        <ScrollView
          style={{ flex: 1, paddingHorizontal: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={() => refetch()}
              tintColor={Colors.signal[500]}
            />
          }
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          <View style={{ paddingTop: 16, paddingBottom: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ fontSize: 24, fontWeight: '700', color: Colors.graphite[50] }}>
                Feed
              </Text>
              <LabButton
                label="Discover"
                variant="primary"
                size="sm"
                icon={<Ionicons name="person-add-outline" size={16} color="white" />}
                onPress={() => setShowDiscover(true)}
              />
            </View>

            {isLoading && feed.length === 0 ? (
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
                <ActivityIndicator size="large" color={Colors.signal[500]} />
              </View>
            ) : feed.length === 0 ? (
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 48 }}>
                <Ionicons name="people-outline" size={48} color={Colors.graphite[500]} />
                <Text style={{ marginTop: 16, textAlign: 'center', color: Colors.graphite[400] }}>
                  Your feed is empty.{'\n'}Follow users to see their workouts here!
                </Text>
                <View style={{ marginTop: 24 }}>
                  <LabButton
                    label="Discover Users"
                    onPress={() => setShowDiscover(true)}
                  />
                </View>
              </View>
            ) : (
              <View style={{ gap: 16 }}>
              {processedPosts.map((processed) => {
                if (!processed) return null;
                const { post, workout, prCount, topExercises, exerciseEntriesLength } = processed;

                return (
                  <Pressable
                    key={post.id}
                    onPress={() => router.push(`/workout-summary/${workout.id}`)}
                  >
                    <LabCard noPadding>
                      <View style={{ padding: 16 }}>
                        {/* Header: User & Context */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.signal[500], alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>
                                {post.user?.display_name?.charAt(0).toUpperCase() || post.user?.email?.charAt(0).toUpperCase() || 'U'}
                              </Text>
                            </View>
                            <View>
                              <Text style={{ fontWeight: '700', fontSize: 14, color: Colors.graphite[50] }}>
                                {post.user?.display_name || post.user?.email || 'User'}
                              </Text>
                              <Text style={{ fontSize: 12, color: Colors.graphite[400] }}>
                                {formatDate(post.created_at)} · {workout.focus}
                              </Text>
                            </View>
                          </View>

                          {/* Badges */}
                          <View style={{ flexDirection: 'row', gap: 4 }}>
                            {post.user_streak && post.user_streak.currentStreak >= 2 && (
                              <StreakBadge streak={post.user_streak.currentStreak} />
                            )}
                            {prCount > 0 && <PRCountBadge count={prCount} />}
                          </View>
                        </View>

                        {/* Body: Key Lifts Highlights */}
                        <View style={{ gap: 8, marginBottom: 12 }}>
                          <>
                            {topExercises.map((item) => {
                              if (!item) return null;
                              const { exerciseId, exercise, exerciseSets, summary } = item;
                              return (
                                <FeedHighlight
                                  key={exerciseId}
                                  exercise={exercise}
                                  exerciseSets={exerciseSets}
                                  summary={summary}
                                />
                              );
                            })}
                            {exerciseEntriesLength > 3 && (
                              <Text style={{ fontSize: 12, marginTop: 4, color: Colors.graphite[400] }}>
                                + {exerciseEntriesLength - 3} more exercises
                              </Text>
                            )}
                          </>
                        </View>

                        {/* Caption */}
                        {post.caption && (
                          <Text style={{ fontSize: 14, marginBottom: 12, fontStyle: 'italic', color: Colors.graphite[300] }}>
                            "{post.caption}"
                          </Text>
                        )}

                        {/* Footer: Actions */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.1)' }}>
                          <Pressable
                            style={{ flexDirection: 'row', alignItems: 'center' }}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleLike(post.id, post.is_liked || false);
                            }}
                          >
                            <Ionicons
                              name={post.is_liked ? 'heart' : 'heart-outline'}
                              size={20}
                              color={post.is_liked ? '#ef4444' : Colors.graphite[500]}
                            />
                            <Text style={{ marginLeft: 4, fontSize: 12, fontWeight: '700', color: Colors.graphite[400] }}>
                              {post.like_count || 0}
                            </Text>
                          </Pressable>

                          {/* Adherence Score if available */}
                          {post.user_streak && post.user_streak.weeklyAdherence >= 50 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <AdherenceBadge percent={post.user_streak.weeklyAdherence} />
                            </View>
                          )}
                        </View>
                      </View>
                    </LabCard>
                  </Pressable>
                );
              })}
              </View>
            )}
          </View>
        </ScrollView>

        {/* User Discovery Modal */}
        <Modal
          visible={showDiscover}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDiscover(false)}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.8)' }}>
            <Pressable style={{ flex: 1 }} onPress={() => setShowDiscover(false)}>
              <Pressable
                style={{
                  flex: 1,
                  marginTop: 'auto',
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  backgroundColor: Colors.void[800],
                  padding: 24,
                  borderWidth: 1,
                  borderBottomWidth: 0,
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                }}
                onPress={(e) => e.stopPropagation()}
              >
                <View style={{ width: 40, height: 4, backgroundColor: Colors.graphite[600], borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <Text style={{ fontSize: 20, fontWeight: '700', color: Colors.graphite[50] }}>
                    Discover Users
                  </Text>
                  <Pressable onPress={() => setShowDiscover(false)}>
                    <Ionicons name="close" size={24} color={Colors.graphite[50]} />
                  </Pressable>
                </View>

                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderRadius: 12,
                    marginBottom: 16,
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <Ionicons name="search" size={20} color={Colors.graphite[500]} style={{ marginRight: 10 }} />
                  <TextInput
                    style={{ flex: 1, fontSize: 16, color: Colors.graphite[50] }}
                    placeholder="Search by name or email..."
                    placeholderTextColor={Colors.graphite[500]}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoFocus
                  />
                  {searchQuery.length > 0 && (
                    <Pressable onPress={() => setSearchQuery('')}>
                      <Ionicons name="close-circle" size={20} color={Colors.graphite[500]} />
                    </Pressable>
                  )}
                </View>

                <ScrollView style={{ flex: 1 }}>
                  <View style={{ gap: 8 }}>
                    {searchResults.map((user) => (
                      <Pressable
                        key={user.id}
                        style={{
                          padding: 16,
                          borderRadius: 12,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          borderWidth: 1,
                          borderColor: 'rgba(255, 255, 255, 0.1)',
                        }}
                        onPress={() => {
                          setShowDiscover(false);
                          router.push(`/profile/${user.id}`);
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.signal[500], alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>
                              {user.display_name?.charAt(0).toUpperCase() || 'U'}
                            </Text>
                          </View>
                          <Text style={{ fontWeight: '600', color: Colors.graphite[50] }}>
                            {user.display_name || user.email}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={Colors.graphite[500]} />
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </Pressable>
            </Pressable>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const FeedHighlight = memo(function FeedHighlight({
  exercise,
  exerciseSets,
  summary,
}: {
  exercise: any;
  exerciseSets: any[];
  summary: ExerciseSummary | undefined;
}) {
  const iconName = useMemo(() => getModalityIcon(exercise?.modality || 'Strength'), [exercise?.modality]);

  // Use generateExerciseSummary for proper formatting - memoize this expensive call
  const formattedSummary = useMemo(
    () => generateExerciseSummary(exercise, exerciseSets),
    [exercise, exerciseSets]
  );

  // Determine progression value for tag
  const showProgression = summary?.isPR || (summary?.progression && ['weight_increase', 'rep_increase', 'e1rm_increase'].includes(summary.progression.type));

  // Calculate delta on the fly
  const delta = useMemo(() => {
    let deltaValue = 0;
    let deltaUnit = '';

    if (summary?.previousBest && summary?.bestSet.weight) {
      if (summary.primaryMetric === 'Weight' && summary.previousBest.weight) {
        deltaValue = summary.bestSet.weight - summary.previousBest.weight;
        deltaUnit = 'lbs';
      }
    }
    return { deltaValue, deltaUnit };
  }, [summary]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
        <Ionicons
          name={iconName as any}
          size={14}
          color={Colors.graphite[500]}
          style={{ marginRight: 6 }}
        />
        <Text style={{ fontSize: 14, color: Colors.graphite[200] }} numberOfLines={1}>
          {exercise?.name || summary?.exerciseName || 'Exercise'}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 14, fontFamily: 'monospace', color: Colors.graphite[300] }}>
          {formattedSummary}
        </Text>
        {showProgression && delta.deltaValue > 0 && (
          <DeltaTag value={delta.deltaValue} unit={delta.deltaUnit} />
        )}
      </View>
    </View>
  );
});
