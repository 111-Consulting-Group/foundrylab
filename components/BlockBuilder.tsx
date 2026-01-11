/**
 * BlockBuilder Component
 *
 * Multi-step wizard for creating AI-generated training blocks.
 * Guides users through goal selection, configuration, and preview.
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import {
  useBlockBuilder,
  getRecommendedConfig,
  getBlockDifficulty,
} from '@/hooks/useBlockBuilder';
import {
  type BlockConfig,
  type GeneratedBlock,
  PERIODIZATION_TEMPLATES,
  TRAINING_SPLITS,
} from '@/lib/blockBuilder';
import type { TrainingGoal, TrainingExperience } from '@/types/database';

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
  isDark,
}: {
  selectedGoal: TrainingGoal | null;
  onSelect: (goal: TrainingGoal) => void;
  isDark: boolean;
}) {
  return (
    <View>
      <Text
        className={`text-2xl font-bold mb-2 ${
          isDark ? 'text-graphite-100' : 'text-graphite-900'
        }`}
      >
        What's your focus?
      </Text>
      <Text
        className={`text-base mb-6 ${
          isDark ? 'text-graphite-400' : 'text-graphite-500'
        }`}
      >
        Choose what you want to prioritize for this training block.
      </Text>

      <View className="gap-3">
        {GOAL_OPTIONS.map((option) => (
          <Pressable
            key={option.goal}
            onPress={() => onSelect(option.goal)}
            className={`p-4 rounded-xl border-2 ${
              selectedGoal === option.goal
                ? 'border-signal-500'
                : isDark
                ? 'border-graphite-700 bg-graphite-800'
                : 'border-graphite-200 bg-white'
            }`}
          >
            <View className="flex-row items-center">
              <View
                className="w-12 h-12 rounded-full items-center justify-center mr-4"
                style={{ backgroundColor: `${option.color}20` }}
              >
                <Ionicons name={option.icon} size={24} color={option.color} />
              </View>
              <View className="flex-1">
                <Text
                  className={`text-lg font-semibold ${
                    isDark ? 'text-graphite-100' : 'text-graphite-900'
                  }`}
                >
                  {option.label}
                </Text>
                <Text
                  className={`text-sm ${
                    isDark ? 'text-graphite-400' : 'text-graphite-500'
                  }`}
                >
                  {option.description}
                </Text>
              </View>
              {selectedGoal === option.goal && (
                <Ionicons name="checkmark-circle" size={24} color="#2F80ED" />
              )}
            </View>
          </Pressable>
        ))}
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
  isDark,
  availableSplits,
}: {
  config: Partial<BlockConfig>;
  onUpdateConfig: (updates: Partial<BlockConfig>) => void;
  isDark: boolean;
  availableSplits: typeof TRAINING_SPLITS;
}) {
  return (
    <View>
      <Text
        className={`text-2xl font-bold mb-2 ${
          isDark ? 'text-graphite-100' : 'text-graphite-900'
        }`}
      >
        Configure your block
      </Text>
      <Text
        className={`text-base mb-6 ${
          isDark ? 'text-graphite-400' : 'text-graphite-500'
        }`}
      >
        Customize the duration and training frequency.
      </Text>

      {/* Duration */}
      <View className="mb-6">
        <Text
          className={`font-semibold mb-3 ${
            isDark ? 'text-graphite-200' : 'text-graphite-800'
          }`}
        >
          Block Duration
        </Text>
        <View className="flex-row gap-2">
          {DURATION_OPTIONS.map((weeks) => (
            <Pressable
              key={weeks}
              onPress={() => onUpdateConfig({ durationWeeks: weeks })}
              className={`flex-1 py-3 rounded-xl items-center ${
                config.durationWeeks === weeks
                  ? 'bg-signal-500'
                  : isDark
                  ? 'bg-graphite-700'
                  : 'bg-graphite-100'
              }`}
            >
              <Text
                className={`text-lg font-semibold ${
                  config.durationWeeks === weeks
                    ? 'text-white'
                    : isDark
                    ? 'text-graphite-200'
                    : 'text-graphite-800'
                }`}
              >
                {weeks}
              </Text>
              <Text
                className={`text-xs ${
                  config.durationWeeks === weeks
                    ? 'text-white/80'
                    : isDark
                    ? 'text-graphite-400'
                    : 'text-graphite-500'
                }`}
              >
                weeks
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Days per week */}
      <View className="mb-6">
        <Text
          className={`font-semibold mb-3 ${
            isDark ? 'text-graphite-200' : 'text-graphite-800'
          }`}
        >
          Training Days per Week
        </Text>
        <View className="flex-row gap-2">
          {DAYS_OPTIONS.map((days) => (
            <Pressable
              key={days}
              onPress={() => onUpdateConfig({ daysPerWeek: days })}
              className={`flex-1 py-3 rounded-xl items-center ${
                config.daysPerWeek === days
                  ? 'bg-signal-500'
                  : isDark
                  ? 'bg-graphite-700'
                  : 'bg-graphite-100'
              }`}
            >
              <Text
                className={`text-lg font-semibold ${
                  config.daysPerWeek === days
                    ? 'text-white'
                    : isDark
                    ? 'text-graphite-200'
                    : 'text-graphite-800'
                }`}
              >
                {days}
              </Text>
              <Text
                className={`text-xs ${
                  config.daysPerWeek === days
                    ? 'text-white/80'
                    : isDark
                    ? 'text-graphite-400'
                    : 'text-graphite-500'
                }`}
              >
                days
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Training split preview */}
      {config.daysPerWeek && (
        <View
          className={`p-4 rounded-xl ${
            isDark ? 'bg-graphite-800' : 'bg-graphite-50'
          }`}
        >
          <Text
            className={`font-semibold mb-2 ${
              isDark ? 'text-graphite-200' : 'text-graphite-800'
            }`}
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
                  className={`text-sm mb-2 ${
                    isDark ? 'text-graphite-400' : 'text-graphite-500'
                  }`}
                >
                  {split.name}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {split.days.map((day) => (
                    <View
                      key={day.dayNumber}
                      className={`px-3 py-1 rounded-full ${
                        isDark ? 'bg-graphite-700' : 'bg-graphite-200'
                      }`}
                    >
                      <Text
                        className={`text-xs ${
                          isDark ? 'text-graphite-300' : 'text-graphite-600'
                        }`}
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
  isDark,
}: {
  block: GeneratedBlock;
  isDark: boolean;
}) {
  const [expandedWeek, setExpandedWeek] = useState<number | null>(1);
  const difficulty = getBlockDifficulty(block);

  return (
    <View>
      <Text
        className={`text-2xl font-bold mb-2 ${
          isDark ? 'text-graphite-100' : 'text-graphite-900'
        }`}
      >
        {block.name}
      </Text>
      <Text
        className={`text-base mb-4 ${
          isDark ? 'text-graphite-400' : 'text-graphite-500'
        }`}
      >
        {block.description}
      </Text>

      {/* Quick stats */}
      <View className="flex-row gap-3 mb-6">
        <View
          className={`flex-1 p-3 rounded-xl ${
            isDark ? 'bg-graphite-800' : 'bg-graphite-100'
          }`}
        >
          <Text className={`text-xs ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
            Duration
          </Text>
          <Text
            className={`text-lg font-bold ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}
          >
            {block.durationWeeks} weeks
          </Text>
        </View>
        <View
          className={`flex-1 p-3 rounded-xl ${
            isDark ? 'bg-graphite-800' : 'bg-graphite-100'
          }`}
        >
          <Text className={`text-xs ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
            Workouts
          </Text>
          <Text
            className={`text-lg font-bold ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}
          >
            {block.weeks.reduce((sum, w) => sum + w.workouts.length, 0)}
          </Text>
        </View>
        <View
          className={`flex-1 p-3 rounded-xl ${
            isDark ? 'bg-graphite-800' : 'bg-graphite-100'
          }`}
        >
          <Text className={`text-xs ${isDark ? 'text-graphite-400' : 'text-graphite-500'}`}>
            Difficulty
          </Text>
          <Text
            className={`text-lg font-bold ${isDark ? 'text-graphite-100' : 'text-graphite-900'}`}
          >
            {difficulty.label}
          </Text>
        </View>
      </View>

      {/* Projected progress */}
      {block.projectedProgress.mainLifts.length > 0 && (
        <View
          className={`p-4 rounded-xl mb-6 ${
            isDark ? 'bg-progress-500/10' : 'bg-progress-50'
          }`}
        >
          <View className="flex-row items-center mb-2">
            <Ionicons name="trending-up" size={18} color="#22c55e" />
            <Text
              className={`ml-2 font-semibold ${
                isDark ? 'text-progress-400' : 'text-progress-600'
              }`}
            >
              Projected Progress
            </Text>
          </View>
          {block.projectedProgress.mainLifts
            .filter((lift) => lift.currentE1RM)
            .slice(0, 3)
            .map((lift) => (
              <View key={lift.exerciseName} className="flex-row justify-between mt-2">
                <Text
                  className={`text-sm ${isDark ? 'text-graphite-300' : 'text-graphite-700'}`}
                >
                  {lift.exerciseName}
                </Text>
                <Text className="text-sm text-progress-500 font-semibold">
                  {lift.currentE1RM} → {lift.projectedE1RM} lbs (+{lift.percentIncrease}%)
                </Text>
              </View>
            ))}
        </View>
      )}

      {/* Week breakdown */}
      <Text
        className={`font-semibold mb-3 ${
          isDark ? 'text-graphite-200' : 'text-graphite-800'
        }`}
      >
        Week Breakdown
      </Text>
      <View className="gap-2">
        {block.weeks.map((week) => (
          <Pressable
            key={week.weekNumber}
            onPress={() =>
              setExpandedWeek(expandedWeek === week.weekNumber ? null : week.weekNumber)
            }
            className={`rounded-xl overflow-hidden ${
              isDark ? 'bg-graphite-800' : 'bg-white'
            } border ${isDark ? 'border-graphite-700' : 'border-graphite-200'}`}
          >
            <View className="flex-row items-center justify-between p-4">
              <View className="flex-row items-center">
                <View
                  className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${
                    isDark ? 'bg-graphite-700' : 'bg-graphite-100'
                  }`}
                >
                  <Text
                    className={`font-bold ${
                      isDark ? 'text-graphite-200' : 'text-graphite-800'
                    }`}
                  >
                    {week.weekNumber}
                  </Text>
                </View>
                <View>
                  <Text
                    className={`font-semibold ${
                      isDark ? 'text-graphite-100' : 'text-graphite-900'
                    }`}
                  >
                    {week.theme}
                  </Text>
                  <Text
                    className={`text-xs ${
                      isDark ? 'text-graphite-400' : 'text-graphite-500'
                    }`}
                  >
                    {week.workouts.length} workouts · {week.totalVolume} sets · RPE {week.intensityRange.min}-{week.intensityRange.max}
                  </Text>
                </View>
              </View>
              <Ionicons
                name={expandedWeek === week.weekNumber ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={isDark ? '#808fb0' : '#607296'}
              />
            </View>

            {expandedWeek === week.weekNumber && (
              <View
                className={`px-4 pb-4 pt-2 border-t ${
                  isDark ? 'border-graphite-700' : 'border-graphite-100'
                }`}
              >
                {week.workouts.map((workout) => (
                  <View key={workout.dayNumber} className="mt-2">
                    <Text
                      className={`font-medium ${
                        isDark ? 'text-graphite-200' : 'text-graphite-800'
                      }`}
                    >
                      Day {workout.dayNumber}: {workout.name}
                    </Text>
                    <Text
                      className={`text-xs ${
                        isDark ? 'text-graphite-400' : 'text-graphite-500'
                      }`}
                    >
                      {workout.exercises.map((e) => e.exerciseName).join(' · ')}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Pressable>
        ))}
      </View>
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
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const {
    generateBlock,
    saveBlock,
    isGenerating,
    isSaving,
    availableSplits,
    profile,
    generatedBlock,
  } = useBlockBuilder();

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
    if (step === 'goal') {
      setStep('config');
    } else if (step === 'config') {
      // Generate the block
      await generateBlock(config as BlockConfig);
      setStep('preview');
    } else if (step === 'preview' && generatedBlock) {
      setStep('saving');
      try {
        const blockId = await saveBlock(generatedBlock);
        onComplete(blockId);
      } catch (error) {
        console.error('Failed to save block:', error);
        setStep('preview');
      }
    }
  }, [step, config, generatedBlock, generateBlock, saveBlock, onComplete]);

  const handleBack = useCallback(() => {
    if (step === 'config') setStep('goal');
    else if (step === 'preview') setStep('config');
  }, [step]);

  return (
    <View className="flex-1">
      {/* Header */}
      <View
        className={`flex-row items-center justify-between p-4 border-b ${
          isDark ? 'border-graphite-800' : 'border-graphite-200'
        }`}
      >
        <Pressable onPress={step === 'goal' ? onCancel : handleBack} className="p-2">
          <Ionicons
            name={step === 'goal' ? 'close' : 'arrow-back'}
            size={24}
            color={isDark ? '#d3d8e4' : '#374151'}
          />
        </Pressable>
        <View className="flex-row">
          {['goal', 'config', 'preview'].map((s, i) => (
            <View
              key={s}
              className={`w-8 h-1 rounded-full mx-1 ${
                step === s
                  ? 'bg-signal-500'
                  : i < ['goal', 'config', 'preview'].indexOf(step)
                  ? 'bg-progress-500'
                  : isDark
                  ? 'bg-graphite-700'
                  : 'bg-graphite-300'
              }`}
            />
          ))}
        </View>
        <View className="w-10" />
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingVertical: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {step === 'goal' && (
          <GoalSelectionStep
            selectedGoal={config.goal || null}
            onSelect={(goal) => updateConfig({ goal })}
            isDark={isDark}
          />
        )}

        {step === 'config' && (
          <ConfigurationStep
            config={config}
            onUpdateConfig={updateConfig}
            isDark={isDark}
            availableSplits={availableSplits}
          />
        )}

        {step === 'preview' && generatedBlock && (
          <PreviewStep block={generatedBlock} isDark={isDark} />
        )}

        {step === 'saving' && (
          <View className="items-center justify-center py-20">
            <ActivityIndicator size="large" color="#2F80ED" />
            <Text
              className={`mt-4 ${isDark ? 'text-graphite-300' : 'text-graphite-600'}`}
            >
              Creating your training block...
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      {step !== 'saving' && (
        <View
          className={`p-4 border-t ${
            isDark ? 'border-graphite-800' : 'border-graphite-200'
          }`}
        >
          <Pressable
            onPress={handleNext}
            disabled={!canProceed || isGenerating}
            className={`py-4 rounded-xl items-center ${
              canProceed && !isGenerating ? 'bg-signal-500' : 'bg-graphite-500'
            }`}
          >
            {isGenerating ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-white font-semibold text-lg">
                {step === 'goal'
                  ? 'Continue'
                  : step === 'config'
                  ? 'Generate Block'
                  : 'Start Training'}
              </Text>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
});
