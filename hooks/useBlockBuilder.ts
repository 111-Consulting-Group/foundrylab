/**
 * useBlockBuilder Hook
 *
 * Generates periodized training blocks based on user preferences,
 * training history, and goals.
 */

import { useState, useCallback, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/useAppStore';
import { useTrainingProfile } from '@/hooks/useTrainingProfile';
import { useMainLiftPRs } from '@/hooks/usePersonalRecords';
import { useExercises } from '@/hooks/useExercises';
import { workoutKeys } from '@/hooks/useWorkouts';
import {
  type BlockConfig,
  type GeneratedBlock,
  type GeneratedWeek,
  type GeneratedWorkout,
  type GeneratedExercise,
  type PeriodizationTemplate,
  type TrainingSplit,
  type PhaseConfig,
  PERIODIZATION_TEMPLATES,
  TRAINING_SPLITS,
  MOVEMENT_PATTERN_EXERCISES,
  selectTrainingSplit,
  selectPeriodizationTemplate,
  calculateProgressiveOverload,
  generateSetsForExercise,
  generateBlockName,
  generateWeekTheme,
  estimateWorkoutDuration,
} from '@/lib/blockBuilder';
import type {
  TrainingGoal,
  TrainingExperience,
  Exercise,
} from '@/types/database';

// ============================================================================
// Hook
// ============================================================================

export function useBlockBuilder() {
  const userId = useAppStore((state) => state.userId);
  const queryClient = useQueryClient();

  // Get user's training profile for personalization
  const { data: profile } = useTrainingProfile();
  const { data: mainLiftPRs = [] } = useMainLiftPRs();
  const { data: exercises = [] } = useExercises();

  // State for block configuration
  const [config, setConfig] = useState<BlockConfig | null>(null);
  const [generatedBlock, setGeneratedBlock] = useState<GeneratedBlock | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Available templates based on experience
  const availableTemplates = useMemo(() => {
    const experience = profile?.training_experience || 'intermediate';
    return PERIODIZATION_TEMPLATES.filter((t) =>
      t.suitableFor.includes(experience)
    );
  }, [profile?.training_experience]);

  // Available splits
  const availableSplits = useMemo(() => {
    if (!config?.goal) return TRAINING_SPLITS;
    return TRAINING_SPLITS.filter((s) => s.suitableFor.includes(config.goal));
  }, [config?.goal]);

  /**
   * Find exercise by name or pattern
   */
  const findExercise = useCallback(
    (names: string[], muscleGroups: string[]): Exercise | null => {
      // First try to find by exact name
      for (const name of names) {
        const found = exercises.find(
          (e) => e.name.toLowerCase() === name.toLowerCase()
        );
        if (found) return found;
      }

      // Then try partial match
      for (const name of names) {
        const found = exercises.find((e) =>
          e.name.toLowerCase().includes(name.toLowerCase())
        );
        if (found) return found;
      }

      // Finally, find any exercise in the muscle groups
      for (const group of muscleGroups) {
        const found = exercises.find((e) => e.muscle_group === group);
        if (found) return found;
      }

      return null;
    },
    [exercises]
  );

  /**
   * Generate exercises for a workout day
   */
  const generateExercisesForDay = useCallback(
    (
      splitDay: typeof TRAINING_SPLITS[0]['days'][0],
      phase: PhaseConfig,
      experience: TrainingExperience,
      weekInPhase: number
    ): GeneratedExercise[] => {
      const generatedExercises: GeneratedExercise[] = [];

      // Generate primary movements
      splitDay.primaryMovements.forEach((pattern) => {
        const patternConfig = MOVEMENT_PATTERN_EXERCISES[pattern];
        const exercise = findExercise(
          patternConfig.preferredExerciseNames,
          patternConfig.muscleGroups
        );

        if (exercise) {
          const sets = generateSetsForExercise(phase, true, experience, weekInPhase);
          generatedExercises.push({
            exerciseId: exercise.id,
            exerciseName: exercise.name,
            muscleGroup: exercise.muscle_group,
            sets,
            alternatives: patternConfig.preferredExerciseNames.slice(1, 4),
          });
        }
      });

      // Add accessory exercises
      const accessoryMuscles = splitDay.muscleGroups.filter(
        (g) => !generatedExercises.some((e) => e.muscleGroup === g)
      );

      for (let i = 0; i < Math.min(splitDay.accessorySlots, accessoryMuscles.length); i++) {
        const muscle = accessoryMuscles[i];
        const exercise = exercises.find(
          (e) => e.muscle_group === muscle && !generatedExercises.some((ge) => ge.exerciseId === e.id)
        );

        if (exercise) {
          const sets = generateSetsForExercise(phase, false, experience, weekInPhase);
          generatedExercises.push({
            exerciseId: exercise.id,
            exerciseName: exercise.name,
            muscleGroup: exercise.muscle_group,
            sets,
          });
        }
      }

      return generatedExercises;
    },
    [exercises, findExercise]
  );

  /**
   * Generate a complete training block
   */
  const generateBlock = useCallback(
    async (blockConfig: BlockConfig): Promise<GeneratedBlock> => {
      setIsGenerating(true);
      setConfig(blockConfig);

      try {
        // Select template and split
        const template = selectPeriodizationTemplate(blockConfig);
        const split = selectTrainingSplit(blockConfig);

        // Generate weeks
        const weeks: GeneratedWeek[] = [];
        let currentWeek = 1;
        let cumulativePhaseWeeks = 0;

        for (const phase of template.phases) {
          for (let weekInPhase = 1; weekInPhase <= phase.weeks; weekInPhase++) {
            // Calculate progressive overload adjustments
            const overload = calculateProgressiveOverload(
              weekInPhase,
              phase.weeks,
              phase,
              blockConfig.experience
            );

            // Generate workouts for this week
            const workouts: GeneratedWorkout[] = [];

            for (const day of split.days) {
              const exercises = generateExercisesForDay(
                day,
                phase,
                blockConfig.experience,
                weekInPhase
              );

              workouts.push({
                dayNumber: day.dayNumber,
                name: day.name,
                focus: day.focus,
                exercises,
                estimatedDuration: estimateWorkoutDuration(exercises),
              });
            }

            // Calculate week totals
            const totalSets = workouts.reduce(
              (sum, w) =>
                sum + w.exercises.reduce((eSum, e) => eSum + e.sets.filter((s) => !s.isWarmup).length, 0),
              0
            );

            weeks.push({
              weekNumber: currentWeek,
              theme: generateWeekTheme(phase.phase, weekInPhase, phase.weeks),
              workouts,
              totalVolume: totalSets,
              intensityRange: phase.rpeRange,
            });

            currentWeek++;
          }
          cumulativePhaseWeeks += phase.weeks;
        }

        // Generate progress projection
        const projectedProgress = {
          mainLifts: mainLiftPRs.map((pr) => {
            const weeklyGain =
              blockConfig.experience === 'beginner'
                ? 0.025
                : blockConfig.experience === 'intermediate'
                ? 0.01
                : 0.005;
            const projectedGain = 1 + weeklyGain * blockConfig.durationWeeks;

            return {
              exerciseName: pr.exerciseName,
              currentE1RM: pr.e1rm,
              projectedE1RM: pr.e1rm ? Math.round(pr.e1rm * projectedGain) : 0,
              percentIncrease: Math.round((projectedGain - 1) * 100),
            };
          }),
          volumeProgression: weeks.map((w) => w.totalVolume),
          intensityProgression: weeks.map((w) => (w.intensityRange.min + w.intensityRange.max) / 2),
        };

        const block: GeneratedBlock = {
          name: generateBlockName(blockConfig),
          description: template.description,
          goal: blockConfig.goal,
          durationWeeks: blockConfig.durationWeeks,
          phase: template.phases[0].phase,
          weeks,
          projectedProgress,
        };

        setGeneratedBlock(block);
        return block;
      } finally {
        setIsGenerating(false);
      }
    },
    [generateExercisesForDay, mainLiftPRs]
  );

  /**
   * Save the generated block to the database
   */
  const saveBlock = useMutation({
    mutationFn: async (block: GeneratedBlock): Promise<string> => {
      if (!userId) throw new Error('User not authenticated');

      // Create the training block
      const { data: blockData, error: blockError } = await supabase
        .from('training_blocks')
        .insert({
          user_id: userId,
          name: block.name,
          description: block.description,
          duration_weeks: block.durationWeeks,
          start_date: new Date().toISOString().split('T')[0],
          is_active: true,
        })
        .select()
        .single();

      if (blockError) throw blockError;

      // Deactivate any other active blocks
      await supabase
        .from('training_blocks')
        .update({ is_active: false })
        .eq('user_id', userId)
        .neq('id', blockData.id);

      // Create workouts for each week
      const workoutInserts = [];

      for (const week of block.weeks) {
        for (const workout of week.workouts) {
          // Calculate scheduled date (starting from today)
          const scheduledDate = new Date();
          scheduledDate.setDate(
            scheduledDate.getDate() + (week.weekNumber - 1) * 7 + (workout.dayNumber - 1)
          );

          workoutInserts.push({
            user_id: userId,
            block_id: blockData.id,
            week_number: week.weekNumber,
            day_number: workout.dayNumber,
            focus: workout.focus,
            scheduled_date: scheduledDate.toISOString().split('T')[0],
            duration_minutes: workout.estimatedDuration,
          });
        }
      }

      const { data: workouts, error: workoutError } = await supabase
        .from('workouts')
        .insert(workoutInserts)
        .select();

      if (workoutError) throw workoutError;

      // Create workout sets for each exercise
      for (let i = 0; i < workouts.length; i++) {
        const workoutData = workouts[i];
        const weekIndex = Math.floor(i / block.weeks[0].workouts.length);
        const dayIndex = i % block.weeks[0].workouts.length;
        const generatedWorkout = block.weeks[weekIndex].workouts[dayIndex];

        const setInserts = [];
        let setOrder = 1;

        for (const exercise of generatedWorkout.exercises) {
          for (const set of exercise.sets) {
            setInserts.push({
              workout_id: workoutData.id,
              exercise_id: exercise.exerciseId,
              set_order: setOrder++,
              target_reps: set.targetReps,
              target_rpe: set.targetRPE,
              is_warmup: set.isWarmup,
              rest_seconds: set.restSeconds,
            });
          }
        }

        if (setInserts.length > 0) {
          const { error: setError } = await supabase.from('workout_sets').insert(setInserts);
          if (setError) throw setError;
        }
      }

      return blockData.id;
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['trainingBlocks'] });
      queryClient.invalidateQueries({ queryKey: workoutKeys.all });
    },
  });

  /**
   * Reset the builder
   */
  const reset = useCallback(() => {
    setConfig(null);
    setGeneratedBlock(null);
  }, []);

  return {
    // State
    config,
    generatedBlock,
    isGenerating,
    isSaving: saveBlock.isPending,

    // Data
    availableTemplates,
    availableSplits,
    profile,
    mainLiftPRs,

    // Actions
    generateBlock,
    saveBlock: (block: GeneratedBlock) => saveBlock.mutateAsync(block),
    reset,
    setConfig,
  };
}

// ============================================================================
// Quick Block Generation (for simpler use cases)
// ============================================================================

export function useQuickBlockGenerator() {
  const { generateBlock, saveBlock, isGenerating, isSaving, profile } = useBlockBuilder();

  const generateQuickBlock = useCallback(
    async (
      goal: TrainingGoal,
      daysPerWeek: number = 4,
      durationWeeks: number = 6
    ): Promise<GeneratedBlock> => {
      const config: BlockConfig = {
        goal,
        durationWeeks,
        daysPerWeek,
        experience: profile?.training_experience || 'intermediate',
      };

      return generateBlock(config);
    },
    [generateBlock, profile]
  );

  return {
    generateQuickBlock,
    saveBlock,
    isGenerating,
    isSaving,
  };
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Get recommended config based on user profile
 */
export function getRecommendedConfig(
  profile: ReturnType<typeof useTrainingProfile>['data']
): Partial<BlockConfig> {
  if (!profile) {
    return {
      goal: 'general',
      durationWeeks: 4,
      daysPerWeek: 3,
      experience: 'beginner',
    };
  }

  // Map primary goal to training goal
  const goal = profile.primary_goal || 'general';

  // Determine duration based on experience
  const durationWeeks =
    profile.training_experience === 'beginner'
      ? 4
      : profile.training_experience === 'intermediate'
      ? 6
      : 8;

  return {
    goal: goal as TrainingGoal,
    durationWeeks,
    daysPerWeek: profile.typical_weekly_days || 4,
    experience: profile.training_experience || 'intermediate',
  };
}

/**
 * Get block difficulty rating
 */
export function getBlockDifficulty(block: GeneratedBlock): {
  rating: 1 | 2 | 3 | 4 | 5;
  label: string;
} {
  const avgIntensity = block.weeks.reduce(
    (sum, w) => sum + (w.intensityRange.min + w.intensityRange.max) / 2,
    0
  ) / block.weeks.length;

  const avgVolume = block.weeks.reduce((sum, w) => sum + w.totalVolume, 0) / block.weeks.length;

  // Calculate difficulty score
  const score = (avgIntensity - 6) * 2 + avgVolume / 30;

  if (score < 3) return { rating: 1, label: 'Easy' };
  if (score < 5) return { rating: 2, label: 'Moderate' };
  if (score < 7) return { rating: 3, label: 'Challenging' };
  if (score < 9) return { rating: 4, label: 'Hard' };
  return { rating: 5, label: 'Brutal' };
}
