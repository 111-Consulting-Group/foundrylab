import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import React, { useRef, useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Share,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import { ExerciseBreakdown } from '@/components/ExerciseBreakdown';
import { SaveTemplateModal } from '@/components/TemplatePicker';
import { NewAchievementToast, AchievementRow } from '@/components/AchievementBadge';
import { Colors } from '@/constants/Colors';
import { useWorkout, useUncompleteWorkout } from '@/hooks/useWorkouts';
import { useCheckAchievements, useRecentAchievements } from '@/hooks/useAchievements';
import { useWorkoutSuggestions } from '@/hooks/useMovementMemory';
import { useShareWorkout } from '@/hooks/useSocial';
import { useIsBlockComplete, useBlockSummary } from '@/hooks/useBlockSummary';
import { useCreateWorkoutTemplate, workoutToTemplate } from '@/hooks/useWorkoutTemplates';
import { calculateSetVolume } from '@/lib/utils';
import { detectWorkoutContext } from '@/lib/workoutContext';
import { Alert } from 'react-native';
import type { WorkoutSet, WorkoutWithSets, Exercise } from '@/types/database';
import { SessionVerdict } from '@/components/SessionVerdict';
import { LabButton, LabCard, LabStat } from '@/components/ui/LabPrimitives';
import { MovementMemoryCard } from '@/components/MovementMemoryCard';

export default function WorkoutSummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const summaryRef = useRef<View>(null);
  const webDomRef = useRef<HTMLElement | null>(null);

  const { data: workout, isLoading } = useWorkout(id);
  const shareWorkoutMutation = useShareWorkout();
  const createTemplateMutation = useCreateWorkoutTemplate();
  const uncompleteMutation = useUncompleteWorkout();

  // Template modal state
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);

  // Check if this workout completes a block
  const { isBlockComplete, blockId } = useIsBlockComplete(id);
  const { data: blockSummary } = useBlockSummary(blockId || '');
  const [showBlockSummary, setShowBlockSummary] = useState(true);

  // Achievement checking
  const { checkAndAward } = useCheckAchievements();
  const { data: recentAchievements } = useRecentAchievements(3);
  const [newAchievement, setNewAchievement] = useState<any>(null);
  const [achievementsChecked, setAchievementsChecked] = useState(false);

  // Check for new achievements when workout summary loads
  useEffect(() => {
    if (workout && id && !achievementsChecked) {
      setAchievementsChecked(true);
      checkAndAward(id).then((newAchievements) => {
        if (newAchievements.length > 0) {
          setNewAchievement(newAchievements[0]);
        }
      });
    }
  }, [workout, id, achievementsChecked, checkAndAward]);

  // Get "Next Time" suggestions for all exercises in this workout
  const exerciseData = useMemo(() => {
    if (!workout?.workout_sets) return { ids: [], names: {} };

    const seen = new Set<string>();
    const ids: string[] = [];
    const names: Record<string, string> = {};

    workout.workout_sets.forEach((set: any) => {
      const exercise = set.exercise;
      if (exercise && !seen.has(set.exercise_id)) {
        seen.add(set.exercise_id);
        ids.push(set.exercise_id);
        names[set.exercise_id] = exercise.name;
      }
    });

    return { ids, names };
  }, [workout?.workout_sets]);

  const { data: nextTimeSuggestions, isLoading: suggestionsLoading } = useWorkoutSuggestions(
    exerciseData.ids,
    exerciseData.names,
    id || undefined
  );

  // Calculate workout stats - deduplicate sets first
  const stats = useMemo(() => {
    if (!workout?.workout_sets) return { 
      totalSets: 0, 
      totalReps: 0, 
      totalVolume: 0, 
      maxWeight: 0,
      prCount: 0,
      exerciseCount: 0,
      avgRPE: 0,
    };
    
    // Deduplicate sets
    const uniqueSets = workout.workout_sets.filter((set, index, self) => {
      if (set.id) {
        return index === self.findIndex(s => s.id === set.id);
      }
      return index === self.findIndex(s => 
        s.set_order === set.set_order && 
        s.exercise_id === set.exercise_id
      );
    });
    
    // Get unique exercises
    const exerciseIds = new Set<string>();
    let totalRPE = 0;
    let rpeCount = 0;
    
    return uniqueSets.reduce(
      (acc, set: WorkoutSet) => {
        // Only count sets that were actually performed (not warmup, have actual data)
        if (set.is_warmup) return acc;
        
        // Track exercises
        if (set.exercise_id) {
          exerciseIds.add(set.exercise_id);
        }
        
        // Track PRs
        if (set.is_pr) {
          acc.prCount++;
        }
        
        // Track RPE for average
        if (set.actual_rpe) {
          totalRPE += set.actual_rpe;
          rpeCount++;
        }
        
        const volume = calculateSetVolume(set.actual_weight, set.actual_reps);
        if (volume > 0 && set.actual_weight && set.actual_reps) {
          acc.totalSets++;
          acc.totalReps += set.actual_reps;
          acc.totalVolume += volume;
          
          // Track max weight only from sets with actual volume
          if (set.actual_weight > acc.maxWeight) {
            acc.maxWeight = set.actual_weight;
          }
        }
        return acc;
      },
      { 
        totalSets: 0, 
        totalReps: 0, 
        totalVolume: 0, 
        maxWeight: 0,
        prCount: 0,
        exerciseCount: exerciseIds.size,
        avgRPE: rpeCount > 0 ? Math.round((totalRPE / rpeCount) * 10) / 10 : 0,
      }
    );
  }, [workout?.workout_sets]) || { 
    totalSets: 0, 
    totalReps: 0, 
    totalVolume: 0, 
    maxWeight: 0,
    prCount: 0,
    exerciseCount: 0,
    avgRPE: 0,
  };

  // Parse focus into sections (same logic as workout screen)
  const parseFocusToSections = (focus: string): string[] => {
    const cleanFocus = focus.replace(/\s*\([^)]*\)\s*/g, '');
    const parts = cleanFocus.split(/\s*[+&]\s*/);
    return parts.map((p) => p.trim()).filter(Boolean);
  };

  // Group exercises with their sets and target data
  const exercisesBySection = useMemo(() => {
    if (!workout?.workout_sets) return new Map<string, Array<{ exercise: Exercise; sets: WorkoutSet[]; targetReps?: number | null; targetRPE?: number | null; targetLoad?: number | null }>>();

    const sections = parseFocusToSections(workout.focus || '');
    const exerciseMap = new Map<string, { exercise: Exercise; sets: WorkoutSet[]; targetReps?: number | null; targetRPE?: number | null; targetLoad?: number | null; section?: string }>();
    const sectionMap = new Map<string, string[]>();

    // Deduplicate sets first, then group by exercise
    const uniqueSets = workout.workout_sets.filter((set, index, self) => {
      if (set.id) {
        return index === self.findIndex(s => s.id === set.id);
      }
      return index === self.findIndex(s => 
        s.set_order === set.set_order && 
        s.exercise_id === set.exercise_id
      );
    });
    
    // Group sets by exercise
    uniqueSets.forEach((set: any) => {
      const exercise = set.exercise;
      if (!exercise) return;

      const key = set.exercise_id;
      if (!exerciseMap.has(key)) {
        // Assign section
        const muscleGroup = exercise.muscle_group?.toLowerCase() || '';
        let section = 'Exercises';
        
        if (exercise.modality === 'Cardio') {
          section = sections.find((s) => 
            s.toLowerCase().includes('speed') || 
            s.toLowerCase().includes('cardio') ||
            s.toLowerCase().includes('conditioning') ||
            s.toLowerCase().includes('run')
          ) || sections[0] || 'Conditioning';
        } else {
          for (const s of sections) {
            const sectionLower = s.toLowerCase();
            if (
              (sectionLower.includes('chest') && muscleGroup.includes('chest')) ||
              (sectionLower.includes('back') && muscleGroup.includes('back')) ||
              (sectionLower.includes('push') && (muscleGroup.includes('chest') || muscleGroup.includes('shoulder') || muscleGroup.includes('tricep'))) ||
              (sectionLower.includes('pull') && (muscleGroup.includes('back') || muscleGroup.includes('bicep'))) ||
              (sectionLower.includes('leg') && muscleGroup.includes('leg')) ||
              (sectionLower.includes('upper') && !muscleGroup.includes('leg')) ||
              (sectionLower.includes('lower') && muscleGroup.includes('leg'))
            ) {
              section = s;
              break;
            }
          }
        }

        exerciseMap.set(key, {
          exercise: exercise,
          sets: [],
          targetReps: set.target_reps,
          targetRPE: set.target_rpe,
          targetLoad: set.target_load,
          section,
        });

        if (!sectionMap.has(section)) {
          sectionMap.set(section, []);
        }
        if (!sectionMap.get(section)!.includes(key)) {
          sectionMap.get(section)!.push(key);
        }
      }
      exerciseMap.get(key)!.sets.push(set);
    });

    // Build final structure
    const result = new Map<string, Array<{ exercise: Exercise; sets: WorkoutSet[]; targetReps?: number | null; targetRPE?: number | null; targetLoad?: number | null }>>();
    
    // Add sections in order
    for (const section of sections) {
      if (sectionMap.has(section)) {
        const exerciseIds = sectionMap.get(section)!;
        result.set(section, exerciseIds.map(id => {
          const ex = exerciseMap.get(id);
          if (ex) {
            const { section: _, ...rest } = ex;
            return rest;
          }
          return null;
        }).filter((ex): ex is { exercise: Exercise; sets: WorkoutSet[]; targetReps?: number | null; targetRPE?: number | null; targetLoad?: number | null } => ex !== null));
      }
    }
    
    // Add any remaining exercises
    for (const [section, exerciseIds] of sectionMap) {
      if (!sections.includes(section)) {
        result.set(section, exerciseIds.map(id => {
          const ex = exerciseMap.get(id);
          if (ex) {
            const { section: _, ...rest } = ex;
            return rest;
          }
          return null;
        }).filter((ex): ex is { exercise: Exercise; sets: WorkoutSet[]; targetReps?: number | null; targetRPE?: number | null; targetLoad?: number | null } => ex !== null));
      }
    }

    return result;
  }, [workout]);

  // Format date
  const workoutDate = workout?.date_completed
    ? new Date(workout.date_completed).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Not completed';

  // Handle share - capture screenshot of the receipt
  const handleShare = async () => {
    if (!workout?.workout_sets) return;
    
    try {
      if (Platform.OS === 'web') {
        // For web, use html2canvas
        const html2canvas = (await import('html2canvas')).default;
        
        // Use the stored DOM node or try to get it from the ref
        let domNode = webDomRef.current;
        
        if (!domNode && summaryRef.current) {
          const element = summaryRef.current as any;
          domNode = element?._nativeNode || element;
        }
        
        if (!domNode || domNode.nodeType !== 1) {
          Alert.alert('Error', 'Unable to capture screenshot. Please try again.');
          return;
        }
        
        const canvas = await html2canvas(domNode, {
          backgroundColor: '#0E1116',
          scale: 2,
          logging: false,
          useCORS: true,
        });
        
        canvas.toBlob((blob) => {
          if (!blob) {
            Alert.alert('Error', 'Failed to generate image.');
            return;
          }
          
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${workout.focus || 'Workout'}_${new Date(workout.date_completed || Date.now()).toISOString().split('T')[0]}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          
          // Try Web Share API if available
          if (navigator.share) {
            try {
              const file = new File([blob], link.download, { type: 'image/png' });
              navigator.share({
                title: `${workout.focus || 'Workout'} Summary`,
                text: `Check out my workout from Foundry Labs!`,
                files: [file],
              }).catch(() => {
                // Share API failed, but download already happened
              });
            } catch (shareError) {
              // Share API not available, download already happened
            }
          }
        }, 'image/png');
      } else {
        // Native: Use react-native-view-shot
        if (!summaryRef.current) return;
        
        const uri = await captureRef(summaryRef, {
          format: 'png',
          quality: 1.0,
        });
        
        await Share.share({
          message: `Check out my workout from Foundry Labs!`,
          url: uri,
        });
      }
    } catch (error) {
      console.error('Failed to share:', error);
      Alert.alert('Error', 'Failed to capture screenshot. Please try again.');
    }
  };

  // Handle save as template
  const handleSaveAsTemplate = async (name: string, description?: string) => {
    if (!workout?.workout_sets) return;
    // ... logic ...
    // Stubbing for now to focus on UI
    Alert.alert('Template', 'Save template logic here');
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.void[900], alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={Colors.signal[500]} />
      </View>
    );
  }

  if (!workout) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.void[900], alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: Colors.graphite[400] }}>Workout not found</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flex: 1, backgroundColor: Colors.void[900] }}>
        {/* Ambient Background Glows */}
        <View style={{ position: 'absolute', top: -60, right: -100, width: 260, height: 260, backgroundColor: 'rgba(37, 99, 235, 0.06)', borderRadius: 130 }} />
        <View style={{ position: 'absolute', bottom: 100, left: -80, width: 220, height: 220, backgroundColor: 'rgba(37, 99, 235, 0.04)', borderRadius: 110 }} />

        <SafeAreaView style={{ flex: 1 }} edges={['left', 'right', 'bottom']}>
          {/* Header */}
          <View
            style={{
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(255, 255, 255, 0.1)',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'rgba(18, 18, 18, 0.9)',
            }}
          >
            <Pressable onPress={() => router.back()} style={{ padding: 8, marginLeft: -8 }}>
              <Ionicons name="close" size={24} color={Colors.graphite[50]} />
            </Pressable>
            <Text style={{ fontSize: 18, fontWeight: '600', color: Colors.graphite[50] }}>
              Session Receipt
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable onPress={handleShare} style={{ padding: 8 }}>
                <Ionicons name="share-outline" size={24} color={Colors.signal[400]} />
              </Pressable>
            </View>
          </View>

          <ScrollView style={{ flex: 1 }}>
            {/* Shareable Card Content */}
            <View
              ref={(node) => {
                summaryRef.current = node;
                if (Platform.OS === 'web' && node) {
                  const domNode = (node as any)?._nativeNode || (node as any);
                  if (domNode?.nodeType === 1) {
                    webDomRef.current = domNode;
                  }
                }
              }}
              style={{ backgroundColor: Colors.void[900] }}
            >

              {/* Header with Date */}
              <View style={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 16 }}>
                <Text style={{ fontSize: 24, fontWeight: '700', color: Colors.graphite[50], marginBottom: 4 }}>
                  {workout.focus || 'Workout'}
                </Text>
                <Text style={{ fontSize: 14, color: Colors.graphite[400] }}>
                  {workoutDate}
                </Text>
              </View>

              {/* Session Verdict - Shows "Building" status */}
              <View style={{ paddingHorizontal: 16 }}>
                <SessionVerdict workout={workout} />
              </View>

              {/* Exercise Summary - Simplified for screenshot */}
              <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, color: Colors.graphite[400] }}>
                  Performance Breakdown
                </Text>

                <View
                  style={{
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    overflow: 'hidden',
                  }}
                >
                  {Array.from(exercisesBySection.entries()).map(([section, exercises], sectionIdx) => (
                    <View key={section}>
                      {exercises.map((ex, exIdx) => {
                        const isCardio = ex.exercise.modality === 'Cardio';
                        
                        const uniqueSets = ex.sets.filter((set, index, self) => {
                          if (set.id) {
                            return index === self.findIndex(s => s.id === set.id);
                          }
                          return index === self.findIndex(s =>
                            s.set_order === set.set_order &&
                            s.exercise_id === set.exercise_id
                          );
                        });

                        // Filter work sets - include cardio sets that have data
                        const workSets = uniqueSets.filter(s => {
                          if (s.is_warmup) return false;
                          if (isCardio) {
                            return s.distance_meters || s.duration_seconds || s.avg_pace;
                          }
                          return s.actual_weight !== null || s.actual_reps !== null;
                        });

                        if (workSets.length === 0) return null;

                        // For cardio, use ExerciseBreakdown component which handles it properly
                        if (isCardio) {
                          return (
                            <View key={ex.exercise.id} style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                              <ExerciseBreakdown
                                exercise={ex.exercise}
                                sets={workSets}
                                targetReps={ex.targetReps}
                                targetRPE={ex.targetRPE}
                                targetLoad={ex.targetLoad}
                              />
                            </View>
                          );
                        }

                        // Strength exercise summary
                        const topSet = workSets.reduce((best, current) => {
                          const currentWeight = current.actual_weight || 0;
                          const bestWeight = best.actual_weight || 0;
                          if (currentWeight > bestWeight) return current;
                          if (currentWeight === bestWeight && (current.actual_reps || 0) > (best.actual_reps || 0)) return current;
                          return best;
                        }, workSets[0]);

                        const setCount = workSets.length;
                        const weight = topSet.actual_weight === 0 ? 'BW' : `${topSet.actual_weight} lbs`;
                        const reps = topSet.actual_reps || 0;
                        const summary = `${setCount}x${reps} @ ${weight}`;

                        const isNotFirst = sectionIdx > 0 || exIdx > 0;

                        return (
                          <View
                            key={ex.exercise.id}
                            style={{
                              paddingHorizontal: 16,
                              paddingVertical: 12,
                              ...(isNotFirst && { borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.1)' }),
                            }}
                          >
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.graphite[50], flex: 1 }}>
                                {ex.exercise.name}
                              </Text>
                              <Text style={{ fontSize: 16, fontFamily: 'monospace', fontWeight: '700', color: Colors.signal[400] }}>
                                {summary}
                              </Text>
                            </View>
                            {topSet.actual_rpe && (
                              <Text style={{ fontSize: 12, color: Colors.graphite[400], marginTop: 4 }}>
                                Top Set RPE: {topSet.actual_rpe}
                              </Text>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </View>

              {/* Foundry Labs Branding Footer */}
              <View style={{ paddingHorizontal: 16, paddingBottom: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.05)' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.signal[500] }} />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.signal[400], textTransform: 'uppercase', letterSpacing: 1 }}>
                    Foundry Labs
                  </Text>
                  <Text style={{ fontSize: 12, color: Colors.graphite[500] }}>
                    Training Intelligence
                  </Text>
                </View>
              </View>

            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={{ paddingHorizontal: 16, paddingVertical: 16, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.1)' }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <LabButton
                label="Save Template"
                variant="outline"
                style={{ flex: 1 }}
                onPress={() => setShowSaveTemplate(true)}
              />
              <LabButton
                label="Done"
                variant="primary"
                style={{ flex: 1 }}
                onPress={() => router.push('/(tabs)')}
              />
            </View>
          </View>

          {/* Save Template Modal */}
          <SaveTemplateModal
            visible={showSaveTemplate}
            onClose={() => setShowSaveTemplate(false)}
            onSave={handleSaveAsTemplate}
            defaultName=""
            defaultFocus={workout?.focus || ''}
            isSaving={createTemplateMutation.isPending}
          />

          {/* Achievement Toast */}
          {newAchievement && (
            <NewAchievementToast
              achievement={newAchievement}
              visible={!!newAchievement}
              onDismiss={() => setNewAchievement(null)}
            />
          )}
        </SafeAreaView>
      </View>
    </>
  );
}
