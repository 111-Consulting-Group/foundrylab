/**
 * useCoachWorkoutGenerator Hook
 *
 * Orchestrates the replace_program action:
 * 1. Gets or creates active training block
 * 2. Deletes future (incomplete) workouts
 * 3. Generates new workouts based on intake responses and context
 * 4. Saves workouts and sets to database
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/useAppStore';
import { workoutKeys, useDeleteFutureWorkouts } from './useWorkouts';
import { trainingBlockKeys } from './useTrainingBlocks';
import {
  selectTrainingSplit,
  selectPeriodizationTemplate,
  generateSetsForExercise,
  estimateWorkoutDuration,
  MOVEMENT_PATTERN_EXERCISES,
  type BlockConfig,
  type GeneratedExercise,
  type PhaseConfig,
} from '@/lib/blockBuilder';
import type {
  Exercise,
  TrainingGoal,
  TrainingExperience,
  WorkoutInsert,
  WorkoutSetInsert,
} from '@/types/database';
import type { ReplaceProgramAction, IntakeResponses } from '@/types/coach';

// ============================================================================
// Types
// ============================================================================

export interface WorkoutGeneratorConfig {
  weekCount: number;
  daysPerWeek: number;
  goal: string;
  phase?: string;
  focusAreas?: string[];
  intakeResponses?: IntakeResponses;
  injuries?: string;
  exerciseAversions?: string[];
}

export interface WorkoutGeneratorResult {
  success: boolean;
  blockId: string;
  workoutCount: number;
  deletedCount: number;
  message: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map goal string to TrainingGoal type
 */
function mapGoalToTrainingGoal(goal: string): TrainingGoal {
  const goalMap: Record<string, TrainingGoal> = {
    strength: 'strength',
    hypertrophy: 'hypertrophy',
    fat_loss: 'general',
    athletic: 'athletic',
    health: 'general',
    maintain: 'general',
    general: 'general',
    powerlifting: 'powerlifting',
    bodybuilding: 'bodybuilding',
  };
  return goalMap[goal.toLowerCase()] || 'general';
}

/**
 * Map experience level or default to intermediate
 */
function determineExperience(profile: { training_experience?: string } | null): TrainingExperience {
  if (!profile?.training_experience) return 'intermediate';
  const exp = profile.training_experience.toLowerCase();
  if (exp === 'beginner') return 'beginner';
  if (exp === 'advanced') return 'advanced';
  return 'intermediate';
}

/**
 * Select exercises for a movement pattern, respecting aversions
 */
async function selectExerciseForPattern(
  pattern: string,
  aversions: string[] = []
): Promise<Exercise | null> {
  const patternConfig = MOVEMENT_PATTERN_EXERCISES[pattern as keyof typeof MOVEMENT_PATTERN_EXERCISES];
  if (!patternConfig) return null;

  // Try to find a preferred exercise that isn't in aversions
  const lowerAversions = aversions.map((a) => a.toLowerCase());

  for (const exerciseName of patternConfig.preferredExerciseNames) {
    // Skip if in aversions list
    if (lowerAversions.some((a) => exerciseName.toLowerCase().includes(a))) {
      continue;
    }

    const { data } = await supabase
      .from('exercises')
      .select('*')
      .ilike('name', `%${exerciseName}%`)
      .eq('status', 'approved')
      .limit(1)
      .single();

    if (data) return data as Exercise;
  }

  // Fallback: search by muscle group
  const { data: fallbackExercise } = await supabase
    .from('exercises')
    .select('*')
    .in('muscle_group', patternConfig.muscleGroups)
    .eq('modality', 'Strength')
    .eq('status', 'approved')
    .limit(1)
    .single();

  return fallbackExercise as Exercise | null;
}

// ============================================================================
// Main Hook
// ============================================================================

export function useCoachWorkoutGenerator() {
  const queryClient = useQueryClient();
  const userId = useAppStore((state) => state.userId);
  const deleteFutureWorkouts = useDeleteFutureWorkouts();

  return useMutation({
    mutationFn: async (config: WorkoutGeneratorConfig): Promise<WorkoutGeneratorResult> => {
      if (!userId) throw new Error('User not authenticated');

      // 1. Get or create active training block
      let blockId: string;
      let deletedCount = 0;

      // Check for existing active block
      const { data: existingBlock } = await supabase
        .from('training_blocks')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (existingBlock) {
        blockId = existingBlock.id;

        // 2. Delete future workouts from existing block
        const deleteResult = await deleteFutureWorkouts.mutateAsync({ blockId });
        deletedCount = deleteResult.deleted;
      } else {
        // Create new active block
        const trainingGoal = mapGoalToTrainingGoal(config.goal);
        const blockName = `${config.weekCount}-Week ${config.goal.charAt(0).toUpperCase() + config.goal.slice(1)} Program`;

        // Deactivate any existing blocks
        await supabase
          .from('training_blocks')
          .update({ is_active: false })
          .eq('user_id', userId);

        const { data: newBlock, error: blockError } = await supabase
          .from('training_blocks')
          .insert({
            user_id: userId,
            name: blockName,
            goal_prompt: config.goal,
            description: `Generated by Coach based on ${config.goal} goal`,
            start_date: new Date().toISOString().split('T')[0],
            duration_weeks: config.weekCount,
            is_active: true,
            phase: config.phase || 'accumulation',
          })
          .select()
          .single();

        if (blockError || !newBlock) {
          throw new Error('Failed to create training block');
        }

        blockId = newBlock.id;
      }

      // 3. Build block configuration
      const trainingGoal = mapGoalToTrainingGoal(config.goal);

      // Get user's training profile for experience level
      const { data: profile } = await supabase
        .from('training_profiles')
        .select('training_experience')
        .eq('user_id', userId)
        .single();

      const experience = determineExperience(profile);

      const blockConfig: BlockConfig = {
        goal: trainingGoal,
        durationWeeks: config.weekCount,
        daysPerWeek: config.daysPerWeek,
        experience,
        phase: config.phase as any,
      };

      // Select appropriate split and periodization
      const split = selectTrainingSplit(blockConfig);
      const periodization = selectPeriodizationTemplate(blockConfig);

      // 4. Generate workouts
      const workoutsToCreate: Array<{
        workout: Omit<WorkoutInsert, 'user_id'>;
        exercises: Array<{ exerciseId: string; sets: WorkoutSetInsert[] }>;
      }> = [];

      // Determine aversions
      const aversions: string[] = [];
      if (config.exerciseAversions) {
        aversions.push(...config.exerciseAversions);
      }
      if (config.intakeResponses?.exercise_aversions) {
        aversions.push(config.intakeResponses.exercise_aversions);
      }

      // Generate workouts for each week
      const startDate = new Date();

      for (let week = 1; week <= config.weekCount; week++) {
        // Determine which phase this week belongs to
        let currentPhase: PhaseConfig = periodization.phases[0];
        let weeksElapsed = 0;

        for (const phase of periodization.phases) {
          if (week <= weeksElapsed + phase.weeks) {
            currentPhase = phase;
            break;
          }
          weeksElapsed += phase.weeks;
        }

        const weekInPhase = week - weeksElapsed;

        // Generate workouts for this week
        const daysToUse = split.days.slice(0, config.daysPerWeek);

        for (let dayIdx = 0; dayIdx < daysToUse.length; dayIdx++) {
          const splitDay = daysToUse[dayIdx];
          const dayNumber = dayIdx + 1;

          // Calculate scheduled date
          const daysOffset = (week - 1) * 7 + dayIdx;
          const scheduledDate = new Date(startDate);
          scheduledDate.setDate(startDate.getDate() + daysOffset);

          // Generate exercises for this day
          const exercises: Array<{ exerciseId: string; sets: WorkoutSetInsert[] }> = [];

          // Select exercises for primary movement patterns
          for (const pattern of splitDay.primaryMovements) {
            const exercise = await selectExerciseForPattern(pattern, aversions);

            if (exercise) {
              const isCompound = ['squat', 'hinge', 'horizontal_push', 'vertical_push'].includes(pattern);
              const generatedSets = generateSetsForExercise(
                currentPhase,
                isCompound,
                experience,
                weekInPhase
              );

              // Convert to WorkoutSetInsert format
              const sets: WorkoutSetInsert[] = generatedSets.map((s) => ({
                workout_id: '', // Will be filled after workout creation
                exercise_id: exercise.id,
                set_order: s.setNumber,
                target_reps: s.targetReps,
                target_rpe: s.targetRPE,
                is_warmup: s.isWarmup,
                tempo: s.tempo, // Include tempo prescription
              }));

              exercises.push({ exerciseId: exercise.id, sets });
            }
          }

          // Add accessory exercises if slots available
          if (splitDay.accessorySlots > 0) {
            // Add core work
            const coreExercise = await selectExerciseForPattern('core', aversions);
            if (coreExercise) {
              const coreSets = generateSetsForExercise(currentPhase, false, experience, weekInPhase);
              exercises.push({
                exerciseId: coreExercise.id,
                sets: coreSets.slice(0, 3).map((s, idx) => ({
                  workout_id: '',
                  exercise_id: coreExercise.id,
                  set_order: s.setNumber,
                  target_reps: s.targetReps,
                  target_rpe: s.targetRPE,
                  is_warmup: false,
                })),
              });
            }
          }

          workoutsToCreate.push({
            workout: {
              block_id: blockId,
              week_number: week,
              day_number: dayNumber,
              focus: splitDay.focus,
              scheduled_date: scheduledDate.toISOString().split('T')[0],
              context: 'building',
            },
            exercises,
          });
        }
      }

      // 5. Save workouts and sets to database
      let workoutCount = 0;

      for (const { workout, exercises } of workoutsToCreate) {
        // Create workout
        const { data: createdWorkout, error: workoutError } = await supabase
          .from('workouts')
          .insert({ ...workout, user_id: userId } as WorkoutInsert)
          .select()
          .single();

        if (workoutError || !createdWorkout) {
          console.error('Failed to create workout:', workoutError);
          continue;
        }

        workoutCount++;

        // Create sets for this workout
        const setsToInsert: WorkoutSetInsert[] = [];
        let setOrder = 1;

        for (const { exerciseId, sets } of exercises) {
          for (const set of sets) {
            setsToInsert.push({
              ...set,
              workout_id: createdWorkout.id,
              exercise_id: exerciseId,
              set_order: setOrder++,
            });
          }
        }

        if (setsToInsert.length > 0) {
          const { error: setsError } = await supabase
            .from('workout_sets')
            .insert(setsToInsert);

          if (setsError) {
            console.error('Failed to create sets:', setsError);
          }
        }
      }

      return {
        success: true,
        blockId,
        workoutCount,
        deletedCount,
        message: `Created ${workoutCount} workouts${deletedCount > 0 ? ` (replaced ${deletedCount} planned workouts)` : ''}`,
      };
    },
    onSuccess: (result) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: workoutKeys.next() });
      queryClient.invalidateQueries({ queryKey: workoutKeys.upcoming() });
      queryClient.invalidateQueries({ queryKey: trainingBlockKeys.all });
      queryClient.invalidateQueries({ queryKey: trainingBlockKeys.active() });
      if (result.blockId) {
        queryClient.invalidateQueries({ queryKey: workoutKeys.list({ blockId: result.blockId }) });
        queryClient.invalidateQueries({ queryKey: trainingBlockKeys.detail(result.blockId) });
        queryClient.invalidateQueries({ queryKey: ['blockProgress', result.blockId] });
      }
    },
    onError: (error) => {
      console.error('[WorkoutGenerator] Failed to generate workouts:', error);
    },
  });
}
