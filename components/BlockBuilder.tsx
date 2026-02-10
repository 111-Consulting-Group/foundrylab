/**
 * BlockBuilder Component
 *
 * Multi-step wizard for creating AI-generated training blocks.
 * Guides users through goal selection, configuration, and preview.
 * Uses glass-morphic styling consistent with the rest of the app.
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native';

import { Colors } from '@/constants/Colors';
import {
  useBlockBuilder,
  getRecommendedConfig,
} from '@/hooks/useBlockBuilder';
import {
  type BlockConfig,
  type GeneratedBlock,
  TRAINING_SPLITS,
} from '@/lib/blockBuilder';
import type { TrainingGoal } from '@/types/database';

// ============================================================================
// Types
// ============================================================================

type BuilderStep = 'goal' | 'config' | 'preview' | 'saving';

interface BlockBuilderProps {
  onComplete: (blockId: string) => void;
  onCancel: () => void;
  initialConfig?: {
    goal?: TrainingGoal;
    durationWeeks?: number;
    daysPerWeek?: number;
  };
}

// ============================================================================
// Goal Selection Step
// ============================================================================

const GOAL_OPTIONS: {
  goal: TrainingGoal;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}[] = [
  {
    goal: 'strength',
    label: 'Build Strength',
    description: 'Increase your 1RM on compound lifts',
    icon: 'barbell-outline',
    color: '#EF4444',
  },
  {
    goal: 'hypertrophy',
    label: 'Build Muscle',
    description: 'Maximize muscle growth with volume',
    icon: 'body-outline',
    color: '#8B5CF6',
  },
  {
    goal: 'powerlifting',
    label: 'Powerlifting Prep',
    description: 'Peak for squat, bench, deadlift',
    icon: 'trophy-outline',
    color: '#F59E0B',
  },
  {
    goal: 'athletic',
    label: 'Athletic Performance',
    description: 'Power, speed, and conditioning',
    icon: 'flash-outline',
    color: '#10B981',
  },
  {
    goal: 'general',
    label: 'General Fitness',
    description: 'Balanced strength and health',
    icon: 'fitness-outline',
    color: '#2F80ED',
  },
];

function GoalSelectionStep({
  selectedGoal,
  onSelect,
}: {
  selectedGoal: TrainingGoal | null;
  onSelect: (goal: TrainingGoal) => void;
}) {
  return (
    <View>
      <Text
        style={{
          fontSize: 24,
          fontWeight: '700',
          marginBottom: 8,
          color: Colors.graphite[50],
        }}
      >
        What's your focus?
      </Text>
      <Text
        style={{
          fontSize: 16,
          marginBottom: 24,
          color: Colors.graphite[400],
        }}
      >
        Choose what you want to prioritize for this training block.
      </Text>

      <View style={{ gap: 12 }}>
        {GOAL_OPTIONS.map((option) => {
          const isSelected = selectedGoal === option.goal;
          return (
            <Pressable
              key={option.goal}
              onPress={() => onSelect(option.goal)}
              style={({ pressed }) => ({
                padding: 16,
                borderRadius: 16,
                borderWidth: isSelected ? 2 : 1,
                borderColor: isSelected
                  ? Colors.signal[500]
                  : Colors.glass.white[10],
                backgroundColor: isSelected
                  ? Colors.glass.blue[10]
                  : Colors.glass.white[5],
                opacity: pressed ? 0.8 : 1,
                ...(isSelected && {
                  shadowColor: Colors.signal[500],
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.3,
                  shadowRadius: 12,
                }),
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 16,
                    backgroundColor: `${option.color}20`,
                  }}
                >
                  <Ionicons name={option.icon} size={24} color={option.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: '600',
                      color: Colors.graphite[50],
                    }}
                  >
                    {option.label}
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      color: Colors.graphite[400],
                    }}
                  >
                    {option.description}
                  </Text>
                </View>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={24} color={Colors.signal[500]} />
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ============================================================================
// Configuration Step
// ============================================================================

const DURATION_OPTIONS = [4, 6, 8, 12];
const DAYS_OPTIONS = [3, 4, 5, 6];

function ConfigurationStep({
  config,
  onUpdateConfig,
  availableSplits,
}: {
  config: Partial<BlockConfig>;
  onUpdateConfig: (updates: Partial<BlockConfig>) => void;
  availableSplits: typeof TRAINING_SPLITS;
}) {
  return (
    <View>
      <Text
        style={{
          fontSize: 24,
          fontWeight: '700',
          marginBottom: 8,
          color: Colors.graphite[50],
        }}
      >
        Configure your block
      </Text>
      <Text
        style={{
          fontSize: 16,
          marginBottom: 24,
          color: Colors.graphite[400],
        }}
      >
        Customize the duration and training frequency.
      </Text>

      {/* Duration */}
      <View style={{ marginBottom: 24 }}>
        <Text
          style={{
            fontWeight: '600',
            marginBottom: 12,
            color: Colors.graphite[200],
          }}
        >
          Block Duration
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {DURATION_OPTIONS.map((weeks) => {
            const isSelected = config.durationWeeks === weeks;
            return (
              <Pressable
                key={weeks}
                onPress={() => onUpdateConfig({ durationWeeks: weeks })}
                style={({ pressed }) => ({
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                  backgroundColor: isSelected
                    ? Colors.signal[600]
                    : Colors.glass.white[5],
                  borderWidth: 1,
                  borderColor: isSelected
                    ? Colors.signal[500]
                    : Colors.glass.white[10],
                  opacity: pressed ? 0.8 : 1,
                  ...(isSelected && {
                    shadowColor: Colors.signal[500],
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                  }),
                })}
              >
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: '600',
                    color: isSelected ? '#fff' : Colors.graphite[200],
                  }}
                >
                  {weeks}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: isSelected ? 'rgba(255,255,255,0.8)' : Colors.graphite[400],
                  }}
                >
                  weeks
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Days per week */}
      <View style={{ marginBottom: 24 }}>
        <Text
          style={{
            fontWeight: '600',
            marginBottom: 12,
            color: Colors.graphite[200],
          }}
        >
          Training Days per Week
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {DAYS_OPTIONS.map((days) => {
            const isSelected = config.daysPerWeek === days;
            return (
              <Pressable
                key={days}
                onPress={() => onUpdateConfig({ daysPerWeek: days })}
                style={({ pressed }) => ({
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                  backgroundColor: isSelected
                    ? Colors.signal[600]
                    : Colors.glass.white[5],
                  borderWidth: 1,
                  borderColor: isSelected
                    ? Colors.signal[500]
                    : Colors.glass.white[10],
                  opacity: pressed ? 0.8 : 1,
                  ...(isSelected && {
                    shadowColor: Colors.signal[500],
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                  }),
                })}
              >
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: '600',
                    color: isSelected ? '#fff' : Colors.graphite[200],
                  }}
                >
                  {days}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: isSelected ? 'rgba(255,255,255,0.8)' : Colors.graphite[400],
                  }}
                >
                  days
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Training split preview */}
      {config.daysPerWeek && (
        <View
          style={{
            padding: 16,
            borderRadius: 16,
            backgroundColor: Colors.glass.white[5],
            borderWidth: 1,
            borderColor: Colors.glass.white[10],
          }}
        >
          <Text
            style={{
              fontWeight: '600',
              marginBottom: 8,
              color: Colors.graphite[200],
            }}
          >
            Recommended Split
          </Text>
          {(() => {
            const split = availableSplits.find(
              (s) => s.daysPerWeek === config.daysPerWeek
            );
            if (!split) return null;

            return (
              <View>
                <Text
                  style={{
                    fontSize: 14,
                    marginBottom: 8,
                    color: Colors.graphite[400],
                  }}
                >
                  {split.name}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {split.days.map((day) => (
                    <View
                      key={day.dayNumber}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 4,
                        borderRadius: 100,
                        backgroundColor: Colors.glass.white[10],
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          color: Colors.graphite[300],
                        }}
                      >
                        {day.name}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })()}
        </View>
      )}
    </View>
  );
}

// ============================================================================
// Preview Step
// ============================================================================

function PreviewStep({
  block,
}: {
  block: GeneratedBlock;
}) {
  const [selectedDay, setSelectedDay] = useState<{
    week: number;
    day: number;
    workout: any;
  } | null>(null);

  // Grid constants
  const days = Array.from({ length: 7 }, (_, i) => i + 1);
  const weeks = block.weeks;

  return (
    <View>
      <Text
        style={{
          fontSize: 24,
          fontWeight: '700',
          marginBottom: 8,
          color: Colors.graphite[50],
        }}
      >
        {block.name}
      </Text>
      <Text
        style={{
          fontSize: 16,
          marginBottom: 24,
          color: Colors.graphite[400],
        }}
      >
        {block.description}
      </Text>

      {/* Spreadsheet Grid View */}
      <View
        style={{
          borderWidth: 1,
          borderRadius: 12,
          overflow: 'hidden',
          borderColor: Colors.glass.white[10],
          backgroundColor: Colors.glass.white[2],
        }}
      >
        {/* Header Row */}
        <View
          style={{
            flexDirection: 'row',
            borderBottomWidth: 1,
            borderBottomColor: Colors.glass.white[10],
            backgroundColor: Colors.glass.white[5],
          }}
        >
          <View
            style={{
              width: 40,
              padding: 8,
              alignItems: 'center',
              justifyContent: 'center',
              borderRightWidth: 1,
              borderRightColor: Colors.glass.white[10],
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: '700', color: Colors.graphite[400] }}>Wk</Text>
          </View>
          {days.map(d => (
            <View key={d} style={{ flex: 1, padding: 8, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: Colors.graphite[400] }}>D{d}</Text>
            </View>
          ))}
        </View>

        {/* Weeks Rows */}
        {weeks.map((week, weekIdx) => (
          <View
            key={week.weekNumber}
            style={{
              flexDirection: 'row',
              borderBottomWidth: weekIdx < weeks.length - 1 ? 1 : 0,
              borderBottomColor: Colors.glass.white[10],
            }}
          >
            {/* Week Number Column */}
            <View
              style={{
                width: 40,
                padding: 8,
                alignItems: 'center',
                justifyContent: 'center',
                borderRightWidth: 1,
                borderRightColor: Colors.glass.white[10],
                backgroundColor: Colors.glass.white[5],
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: 'monospace',
                  fontWeight: '700',
                  color: Colors.graphite[300],
                }}
              >
                {week.weekNumber}
              </Text>
            </View>

            {/* Days Cells */}
            {days.map((dayNum, dayIdx) => {
              const workout = week.workouts.find(w => w.dayNumber === dayNum);
              const isRest = !workout;

              return (
                <Pressable
                  key={dayNum}
                  onPress={() => workout && setSelectedDay({ week: week.weekNumber, day: dayNum, workout })}
                  style={({ pressed }) => ({
                    flex: 1,
                    height: 48,
                    padding: 4,
                    borderRightWidth: dayIdx < 6 ? 1 : 0,
                    borderRightColor: Colors.glass.white[10],
                    backgroundColor: !isRest ? Colors.glass.blue[5] : 'transparent',
                    opacity: pressed && workout ? 0.7 : 1,
                  })}
                >
                  {workout ? (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '500',
                          textAlign: 'center',
                          lineHeight: 12,
                          color: Colors.signal[400],
                        }}
                        numberOfLines={2}
                      >
                        {workout.name.split(' ')[0]}
                      </Text>
                    </View>
                  ) : (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ fontSize: 10, color: Colors.graphite[600] }}>-</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      {/* Detail Modal */}
      <Modal
        visible={!!selectedDay}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedDay(null)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: Colors.glass.black[60],
            justifyContent: 'center',
            paddingHorizontal: 24,
          }}
          onPress={() => setSelectedDay(null)}
        >
          <Pressable
            style={{
              padding: 24,
              borderRadius: 16,
              backgroundColor: Colors.void[800],
              borderWidth: 1,
              borderColor: Colors.glass.white[10],
            }}
            onPress={e => e.stopPropagation()}
          >
            {selectedDay && (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Text style={{ fontSize: 20, fontWeight: '700', color: Colors.graphite[50] }}>
                    Week {selectedDay.week} · Day {selectedDay.day}
                  </Text>
                  <Pressable onPress={() => setSelectedDay(null)}>
                    <Ionicons name="close" size={24} color={Colors.graphite[50]} />
                  </Pressable>
                </View>

                <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8, color: Colors.signal[400] }}>
                  {selectedDay.workout.name}
                </Text>

                <View style={{ height: 1, backgroundColor: Colors.glass.white[10], marginVertical: 12 }} />

                <Text style={{ fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8, color: Colors.graphite[400] }}>
                  Exercises
                </Text>

                <View style={{ gap: 8 }}>
                  {selectedDay.workout.exercises.length === 0 ? (
                    <Text style={{ fontSize: 14, fontStyle: 'italic', color: Colors.graphite[500] }}>
                      No exercises found. Try regenerating the block.
                    </Text>
                  ) : (
                    selectedDay.workout.exercises.map((ex: any, idx: number) => (
                      <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ flex: 1, color: Colors.graphite[200] }}>
                          {ex.exerciseName}
                        </Text>
                        <Text style={{ fontFamily: 'monospace', color: Colors.graphite[400] }}>
                          {Array.isArray(ex.sets) ? ex.sets.filter((s: any) => !s.isWarmup).length : ex.sets} sets
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export const BlockBuilder = React.memo(function BlockBuilder({
  onComplete,
  onCancel,
  initialConfig,
}: BlockBuilderProps) {
  const {
    generateBlock,
    saveBlock,
    isGenerating,
    isSaving,
    availableSplits,
    profile,
    generatedBlock,
    exercisesLoading,
    exercisesError,
    exercisesReady,
    exerciseCount,
  } = useBlockBuilder();

  const [saveError, setSaveError] = useState<string | null>(null);

  // Determine initial step based on initialConfig
  const [step, setStep] = useState<BuilderStep>(() => {
    if (initialConfig?.goal && initialConfig?.durationWeeks) {
      return 'config'; // Skip goal if pre-filled
    }
    return 'goal';
  });

  const [config, setConfig] = useState<Partial<BlockConfig>>(() => ({
    ...getRecommendedConfig(profile),
    ...initialConfig,
  }));

  const updateConfig = useCallback((updates: Partial<BlockConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const canProceed = useMemo(() => {
    switch (step) {
      case 'goal':
        return !!config.goal;
      case 'config':
        return !!config.durationWeeks && !!config.daysPerWeek;
      case 'preview':
        return !!generatedBlock;
      default:
        return false;
    }
  }, [step, config, generatedBlock]);

  const handleNext = useCallback(async () => {
    setSaveError(null);

    if (step === 'goal') {
      setStep('config');
    } else if (step === 'config') {
      // Check if exercises are ready before generating
      if (!exercisesReady) {
        setSaveError('Exercise library is still loading. Please wait a moment and try again.');
        return;
      }
      // Generate the block
      await generateBlock(config as BlockConfig);
      setStep('preview');
    } else if (step === 'preview' && generatedBlock) {
      // Check if the generated block has any exercises
      const totalExercises = generatedBlock.weeks.reduce(
        (sum, week) => sum + week.workouts.reduce(
          (wSum, workout) => wSum + workout.exercises.length, 0
        ), 0
      );

      if (totalExercises === 0) {
        setSaveError('No exercises could be generated. Please try a different configuration or check your exercise library.');
        return;
      }

      setStep('saving');
      try {
        const blockId = await saveBlock(generatedBlock);
        onComplete(blockId);
      } catch (error: any) {
        console.error('Failed to save block:', error);
        setSaveError(error?.message || 'Failed to save training block. Please try again.');
        setStep('preview');
      }
    }
  }, [step, config, generatedBlock, generateBlock, saveBlock, onComplete, exercisesReady]);

  const handleBack = useCallback(() => {
    if (step === 'config') setStep('goal');
    else if (step === 'preview') setStep('config');
  }, [step]);

  const steps = ['goal', 'config', 'preview'];
  const currentStepIndex = steps.indexOf(step);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.void[900] }}>
      {/* Ambient Background Glows */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -100,
          right: -100,
          width: 300,
          height: 300,
          backgroundColor: 'rgba(37, 99, 235, 0.04)',
          borderRadius: 150,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: 100,
          left: -80,
          width: 200,
          height: 200,
          backgroundColor: 'rgba(37, 99, 235, 0.03)',
          borderRadius: 100,
        }}
      />

      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 16,
          borderBottomWidth: 1,
          borderBottomColor: Colors.glass.white[10],
        }}
      >
        <Pressable
          onPress={step === 'goal' ? onCancel : handleBack}
          style={({ pressed }) => ({
            padding: 8,
            borderRadius: 20,
            backgroundColor: pressed ? Colors.glass.white[10] : 'transparent',
          })}
        >
          <Ionicons
            name={step === 'goal' ? 'close' : 'arrow-back'}
            size={24}
            color={Colors.graphite[200]}
          />
        </Pressable>
        <View style={{ flexDirection: 'row' }}>
          {steps.map((s, i) => (
            <View
              key={s}
              style={{
                width: 32,
                height: 4,
                borderRadius: 2,
                marginHorizontal: 4,
                backgroundColor:
                  step === s
                    ? Colors.signal[500]
                    : i < currentStepIndex
                    ? Colors.emerald[500]
                    : Colors.graphite[700],
              }}
            />
          ))}
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Content */}
      <ScrollView
        style={{ flex: 1, paddingHorizontal: 16 }}
        contentContainerStyle={{ paddingVertical: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {step === 'goal' && (
          <GoalSelectionStep
            selectedGoal={config.goal || null}
            onSelect={(goal) => updateConfig({ goal })}
          />
        )}

        {step === 'config' && (
          <>
            <ConfigurationStep
              config={config}
              onUpdateConfig={updateConfig}
              availableSplits={availableSplits}
            />

            {/* Exercise library status */}
            {exercisesLoading && (
              <View
                style={{
                  marginTop: 16,
                  padding: 16,
                  borderRadius: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: Colors.glass.white[5],
                  borderWidth: 1,
                  borderColor: Colors.glass.white[10],
                }}
              >
                <ActivityIndicator size="small" color={Colors.signal[500]} />
                <Text style={{ marginLeft: 12, color: Colors.graphite[300] }}>
                  Loading exercise library...
                </Text>
              </View>
            )}

            {exercisesError && (
              <View
                style={{
                  marginTop: 16,
                  padding: 16,
                  borderRadius: 16,
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  borderWidth: 1,
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="warning" size={20} color={Colors.regression[400]} />
                  <Text style={{ marginLeft: 8, fontWeight: '600', color: Colors.regression[400] }}>
                    Exercise Library Error
                  </Text>
                </View>
                <Text style={{ marginTop: 8, fontSize: 14, color: 'rgba(248, 113, 113, 0.9)' }}>
                  Failed to load exercises. Please check your connection and try again.
                </Text>
              </View>
            )}

            {!exercisesLoading && !exercisesError && exercisesReady && (
              <View
                style={{
                  marginTop: 16,
                  padding: 12,
                  borderRadius: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  borderWidth: 1,
                  borderColor: 'rgba(16, 185, 129, 0.2)',
                }}
              >
                <Ionicons name="checkmark-circle" size={18} color={Colors.emerald[400]} />
                <Text style={{ marginLeft: 8, fontSize: 14, color: Colors.emerald[400] }}>
                  {exerciseCount} exercises available
                </Text>
              </View>
            )}
          </>
        )}

        {step === 'preview' && generatedBlock && (
          <>
            <PreviewStep block={generatedBlock} />

            {/* Error banner */}
            {saveError && (
              <View
                style={{
                  marginTop: 16,
                  padding: 16,
                  borderRadius: 16,
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  borderWidth: 1,
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="alert-circle" size={20} color={Colors.regression[400]} />
                  <Text style={{ marginLeft: 8, fontWeight: '600', color: Colors.regression[400] }}>
                    Unable to Create Block
                  </Text>
                </View>
                <Text style={{ marginTop: 8, fontSize: 14, color: 'rgba(248, 113, 113, 0.9)' }}>
                  {saveError}
                </Text>
              </View>
            )}

            {/* Block summary */}
            {(() => {
              const totalWorkouts = generatedBlock.weeks.reduce((sum, w) => sum + w.workouts.length, 0);
              const totalExercises = generatedBlock.weeks.reduce(
                (sum, week) => sum + week.workouts.reduce(
                  (wSum, workout) => wSum + workout.exercises.length, 0
                ), 0
              );

              if (totalExercises === 0) {
                return (
                  <View
                    style={{
                      marginTop: 16,
                      padding: 16,
                      borderRadius: 16,
                      backgroundColor: 'rgba(245, 158, 11, 0.1)',
                      borderWidth: 1,
                      borderColor: 'rgba(245, 158, 11, 0.3)',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="warning" size={20} color={Colors.oxide[400]} />
                      <Text style={{ marginLeft: 8, fontWeight: '600', color: Colors.oxide[400] }}>
                        Empty Block
                      </Text>
                    </View>
                    <Text style={{ marginTop: 8, fontSize: 14, color: 'rgba(251, 191, 36, 0.9)' }}>
                      This block has no exercises. Try going back and selecting different options.
                    </Text>
                  </View>
                );
              }

              return (
                <View
                  style={{
                    marginTop: 16,
                    padding: 16,
                    borderRadius: 16,
                    backgroundColor: Colors.glass.white[5],
                    borderWidth: 1,
                    borderColor: Colors.glass.white[10],
                  }}
                >
                  <Text style={{ fontWeight: '600', marginBottom: 12, color: Colors.graphite[200] }}>
                    Block Summary
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 24 }}>
                    <View>
                      <Text style={{ fontSize: 28, fontWeight: '700', color: Colors.signal[400] }}>
                        {generatedBlock.durationWeeks}
                      </Text>
                      <Text style={{ fontSize: 12, color: Colors.graphite[400] }}>weeks</Text>
                    </View>
                    <View>
                      <Text style={{ fontSize: 28, fontWeight: '700', color: Colors.signal[400] }}>
                        {totalWorkouts}
                      </Text>
                      <Text style={{ fontSize: 12, color: Colors.graphite[400] }}>workouts</Text>
                    </View>
                    <View>
                      <Text style={{ fontSize: 28, fontWeight: '700', color: Colors.signal[400] }}>
                        {totalExercises}
                      </Text>
                      <Text style={{ fontSize: 12, color: Colors.graphite[400] }}>exercises</Text>
                    </View>
                  </View>
                </View>
              );
            })()}
          </>
        )}

        {step === 'saving' && (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 80 }}>
            <ActivityIndicator size="large" color={Colors.signal[500]} />
            <Text style={{ marginTop: 16, color: Colors.graphite[300] }}>
              Creating your training block...
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      {step !== 'saving' && (
        <View
          style={{
            padding: 16,
            borderTopWidth: 1,
            borderTopColor: Colors.glass.white[10],
            backgroundColor: 'rgba(10, 10, 10, 0.9)',
          }}
        >
          <Pressable
            onPress={handleNext}
            disabled={!canProceed || isGenerating}
            style={({ pressed }) => ({
              paddingVertical: 16,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              backgroundColor: canProceed && !isGenerating
                ? Colors.signal[600]
                : Colors.glass.white[5],
              borderWidth: 1,
              borderColor: canProceed && !isGenerating
                ? Colors.signal[500]
                : Colors.glass.white[10],
              opacity: pressed ? 0.8 : (!canProceed && !isGenerating) ? 0.5 : 1,
              ...(canProceed && !isGenerating && {
                shadowColor: Colors.signal[500],
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.3,
                shadowRadius: 16,
              }),
            })}
          >
            {isGenerating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text
                  style={{
                    color: canProceed ? '#fff' : Colors.graphite[400],
                    fontWeight: '700',
                    fontSize: 16,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}
                >
                  {step === 'goal'
                    ? 'Continue'
                    : step === 'config'
                    ? 'Generate Block'
                    : 'Start Training'}
                </Text>
                {canProceed && (
                  <Ionicons
                    name="arrow-forward"
                    size={20}
                    color="#fff"
                    style={{ marginLeft: 8 }}
                  />
                )}
              </>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
});
