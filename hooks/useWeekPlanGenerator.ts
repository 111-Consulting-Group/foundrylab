/**
 * useWeekPlanGenerator Hook
 *
 * Purpose-built hook for single-week planning with explicit targets.
 * Generates a complete week of workouts with exercises and suggested weights
 * from Movement Memory.
 *
 * Different from useCoachWorkoutGenerator which handles multi-week blocks.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { startOfWeek, addDays, format } from 'date-fns';

import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/useAppStore';
import { workoutKeys } from './useWorkouts';
import { trainingBlockKeys } from './useTrainingBlocks';
import { allocateWeekSessions, DAY_NAMES } from '@/lib/weekAllocation';
import {
  selectTrainingSplit,
  MOVEMENT_PATTERN_EXERCISES,
  generateSetsForExercise,
  type PhaseConfig,
} from '@/lib/blockBuilder';

import type {
  WeeklyTargets,
  WeeklyPlan,
  PlannedDay,
  PlannedExercise,
  DayOfWeek,
  RunningSchedule,
  SessionType,
} from '@/types/coach';
import type {
  Exercise,
  WorkoutInsert,
  WorkoutSetInsert,
  TrainingExperience,
} from '@/types/database';

// ============================================================================
// Types
// ============================================================================

export interface WeekPlanGeneratorInput {
  targets: WeeklyTargets;
  runningSchedule?: RunningSchedule;
  weekStartDate?: Date; // Defaults to upcoming Monday
}

export interface WeekPlanGeneratorResult {
  plan: WeeklyPlan;
  warnings: string[];
}

export interface SaveWeekPlanInput {
  plan: WeeklyPlan;
  createWorkouts: boolean; // Whether to create actual workout records
}

export interface SaveWeekPlanResult {
  success: boolean;
  workoutIds: string[];
  message: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the Monday of the current or next week
 */
function getUpcomingMonday(): Date {
  const today = new Date();
  const monday = startOfWeek(today, { weekStartsOn: 1 });

  // If today is past Monday, get next Monday
  if (today > monday) {
    return addDays(monday, 7);
  }
  return monday;
}

/**
 * Select exercises for a movement pattern from the database
 */
async function selectExerciseForPattern(
  pattern: string,
  aversions: string[] = []
): Promise<Exercise | null> {
  const patternConfig = MOVEMENT_PATTERN_EXERCISES[pattern as keyof typeof MOVEMENT_PATTERN_EXERCISES];
  if (!patternConfig) return null;

  const lowerAversions = aversions.map((a) => a.toLowerCase());

  for (const exerciseName of patternConfig.preferredExerciseNames) {
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

/**
 * Fetch movement memory for an exercise to get weight suggestions
 */
async function fetchMovementMemory(
  userId: string,
  exerciseId: string
): Promise<{ weight: number | null; reps: number | null; confidence: string } | null> {
  // Try movement_memory table first
  const { data: memory } = await supabase
    .from('movement_memory')
    .select('last_weight, last_reps, confidence_level')
    .eq('user_id', userId)
    .eq('exercise_id', exerciseId)
    .maybeSingle();

  if (memory) {
    return {
      weight: memory.last_weight,
      reps: memory.last_reps,
      confidence: memory.confidence_level || 'low',
    };
  }

  // Fallback: get from most recent workout_sets
  const { data: recentSet } = await supabase
    .from('workout_sets')
    .select(`
      actual_weight,
      actual_reps,
      workout:workouts!inner(user_id, date_completed)
    `)
    .eq('exercise_id', exerciseId)
    .eq('workout.user_id', userId)
    .not('workout.date_completed', 'is', null)
    .not('actual_weight', 'is', null)
    .eq('is_warmup', false)
    .order('workout(date_completed)', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentSet) {
    return {
      weight: recentSet.actual_weight,
      reps: recentSet.actual_reps,
      confidence: 'low',
    };
  }

  return null;
}

/**
 * Generate load guidance string based on movement memory
 */
function generateLoadGuidance(
  memory: { weight: number | null; reps: number | null; confidence: string } | null,
  targetReps: number
): string {
  if (!memory || memory.weight === null) {
    return 'Start with comfortable weight';
  }

  const { weight, reps, confidence } = memory;

  // If same rep range, suggest same or slightly higher weight
  if (reps && Math.abs(reps - targetReps) <= 2) {
    if (confidence === 'high') {
      return `${weight} lbs (+5 if easy last time)`;
    }
    return `~${weight} lbs`;
  }

  // If targeting fewer reps (more weight), adjust up
  if (reps && targetReps < reps) {
    const suggestedWeight = Math.round(weight * 1.05);
    return `${suggestedWeight} lbs (heavier, fewer reps)`;
  }

  // If targeting more reps (lighter), adjust down
  if (reps && targetReps > reps) {
    const suggestedWeight = Math.round(weight * 0.92);
    return `${suggestedWeight} lbs (lighter, more reps)`;
  }

  return `~${weight} lbs`;
}

/**
 * Get the primary movement patterns for a focus
 */
function getMovementPatternsForFocus(focus: string): string[] {
  const focusLower = focus.toLowerCase();

  if (focusLower.includes('push')) {
    return ['horizontal_push', 'vertical_push'];
  }
  if (focusLower.includes('pull')) {
    return ['horizontal_pull', 'vertical_pull'];
  }
  if (focusLower.includes('leg') || focusLower.includes('lower')) {
    return ['squat', 'hinge'];
  }
  if (focusLower.includes('upper')) {
    return ['horizontal_push', 'horizontal_pull', 'vertical_push'];
  }
  if (focusLower.includes('full')) {
    return ['squat', 'horizontal_push', 'horizontal_pull'];
  }

  // Default to compound movements
  return ['squat', 'horizontal_push', 'horizontal_pull'];
}

// ============================================================================
// Main Hooks
// ============================================================================

/**
 * Hook to generate a week plan based on targets
 */
export function useGenerateWeekPlan() {
  const userId = useAppStore((state) => state.userId);

  return useMutation({
    mutationFn: async (input: WeekPlanGeneratorInput): Promise<WeekPlanGeneratorResult> => {
      if (!userId) throw new Error('User not authenticated');

      const { targets, runningSchedule, weekStartDate } = input;
      const monday = weekStartDate || getUpcomingMonday();

      // Step 1: Allocate sessions to days
      const allocation = allocateWeekSessions(targets, runningSchedule);

      // Step 2: For each lifting day, generate exercises with weight suggestions
      const enrichedDays: PlannedDay[] = await Promise.all(
        allocation.days.map(async (day) => {
          // Skip rest days and cardio-only days
          if (day.isRestDay || !day.sessionType || day.sessionType === 'rest') {
            return day;
          }

          // Only generate exercises for lifting sessions
          if (day.sessionType !== 'hypertrophy' && day.sessionType !== 'strength') {
            return day;
          }

          // Get movement patterns for this day's focus
          const patterns = getMovementPatternsForFocus(day.focus || 'Full Body');

          // Generate exercises with weight suggestions
          const exercises: PlannedExercise[] = [];

          // Default phase config for hypertrophy
          const phaseConfig: PhaseConfig = {
            phase: 'accumulation',
            weeks: 4,
            volumeMultiplier: 1.0,
            intensityMultiplier: 0.75,
            repRangeMin: 8,
            repRangeMax: 12,
            rpeRange: { min: 7, max: 8 },
          };

          for (const pattern of patterns) {
            const exercise = await selectExerciseForPattern(pattern);

            if (exercise) {
              // Fetch movement memory for weight suggestion
              const memory = await fetchMovementMemory(userId, exercise.id);

              // Generate set prescription
              const isCompound = ['squat', 'hinge', 'horizontal_push', 'vertical_push'].includes(pattern);
              const sets = generateSetsForExercise(
                phaseConfig,
                isCompound,
                'intermediate', // Default experience
                1 // Week 1
              );

              const workingSets = sets.filter((s) => !s.isWarmup);
              const targetReps = workingSets[0]?.targetReps || 10;

              exercises.push({
                exerciseId: exercise.id,
                exerciseName: exercise.name,
                sets: workingSets.length,
                reps: `${targetReps}`,
                loadGuidance: generateLoadGuidance(memory, targetReps),
                progressionNote: memory?.confidence === 'high'
                  ? 'Add 5 lbs if you hit all reps last week'
                  : undefined,
                substituteOptions: [],
              });
            }
          }

          // Add 1-2 accessory exercises
          const coreExercise = await selectExerciseForPattern('core');
          if (coreExercise) {
            const memory = await fetchMovementMemory(userId, coreExercise.id);
            exercises.push({
              exerciseId: coreExercise.id,
              exerciseName: coreExercise.name,
              sets: 3,
              reps: '12-15',
              loadGuidance: generateLoadGuidance(memory, 12),
            });
          }

          return {
            ...day,
            exercises,
          };
        })
      );

      // Build the final plan
      const plan: WeeklyPlan = {
        weekOf: format(monday, 'yyyy-MM-dd'),
        phase: 'accumulating',
        days: enrichedDays,
        rationale: allocation.rationale,
        adjustmentsApplied: [],
        targets,
      };

      return {
        plan,
        warnings: allocation.warnings,
      };
    },
  });
}

/**
 * Hook to save a week plan (create workouts in database)
 */
export function useSaveWeekPlan() {
  const userId = useAppStore((state) => state.userId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveWeekPlanInput): Promise<SaveWeekPlanResult> => {
      if (!userId) throw new Error('User not authenticated');

      const { plan, createWorkouts } = input;
      const workoutIds: string[] = [];

      if (!createWorkouts) {
        return {
          success: true,
          workoutIds: [],
          message: 'Plan saved (no workouts created)',
        };
      }

      // Get or create active training block
      let blockId: string | null = null;

      const { data: existingBlock } = await supabase
        .from('training_blocks')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (existingBlock) {
        blockId = existingBlock.id;
      }

      // Create workouts for each non-rest day
      const weekStart = new Date(plan.weekOf);

      for (const day of plan.days) {
        if (day.isRestDay || !day.exercises || day.exercises.length === 0) {
          continue;
        }

        // Calculate the actual date
        const workoutDate = addDays(weekStart, day.dayNumber - 1);

        // Create workout
        const workoutData: WorkoutInsert = {
          user_id: userId,
          block_id: blockId,
          week_number: 1,
          day_number: day.dayNumber,
          focus: day.focus || 'Training',
          scheduled_date: format(workoutDate, 'yyyy-MM-dd'),
          context: 'building',
        };

        const { data: workout, error: workoutError } = await supabase
          .from('workouts')
          .insert(workoutData)
          .select()
          .single();

        if (workoutError || !workout) {
          console.error('Failed to create workout:', workoutError);
          continue;
        }

        workoutIds.push(workout.id);

        // Create sets for each exercise
        const setsToInsert: WorkoutSetInsert[] = [];
        let setOrder = 1;

        for (const exercise of day.exercises) {
          const numSets = exercise.sets;
          const [minReps, maxReps] = exercise.reps.split('-').map(Number);
          const targetReps = maxReps || minReps || 10;

          for (let i = 0; i < numSets; i++) {
            setsToInsert.push({
              workout_id: workout.id,
              exercise_id: exercise.exerciseId,
              set_order: setOrder++,
              target_reps: targetReps,
              target_rpe: 8, // Default RPE
              is_warmup: false,
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
        workoutIds,
        message: `Created ${workoutIds.length} workouts for the week`,
      };
    },
    onSuccess: (result) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: workoutKeys.next() });
      queryClient.invalidateQueries({ queryKey: workoutKeys.upcoming() });
      queryClient.invalidateQueries({ queryKey: trainingBlockKeys.active() });
    },
  });
}

/**
 * Hook to fetch running schedule from intake responses
 */
export function useRunningSchedule() {
  const userId = useAppStore((state) => state.userId);

  return useQuery({
    queryKey: ['runningSchedule', userId],
    queryFn: async (): Promise<RunningSchedule | null> => {
      if (!userId) return null;

      // Try to get from coach_intake_responses
      const { data } = await supabase
        .from('coach_intake_responses')
        .select('running_schedule')
        .eq('user_id', userId)
        .maybeSingle();

      if (data?.running_schedule) {
        return data.running_schedule as RunningSchedule;
      }

      return null;
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook to swap two days in a plan
 */
export function useSwapDays() {
  return useMutation({
    mutationFn: async ({
      plan,
      dayIndex1,
      dayIndex2,
    }: {
      plan: WeeklyPlan;
      dayIndex1: number;
      dayIndex2: number;
    }): Promise<WeeklyPlan> => {
      const newDays = [...plan.days];

      // Swap everything except dayNumber and dayName
      const day1 = newDays[dayIndex1];
      const day2 = newDays[dayIndex2];

      newDays[dayIndex1] = {
        ...day2,
        dayNumber: day1.dayNumber,
        dayName: day1.dayName,
        isLocked: true,
      };

      newDays[dayIndex2] = {
        ...day1,
        dayNumber: day2.dayNumber,
        dayName: day2.dayName,
        isLocked: true,
      };

      return {
        ...plan,
        days: newDays,
        adjustmentsApplied: [
          ...(plan.adjustmentsApplied || []),
          `Swapped ${day1.dayName} and ${day2.dayName}`,
        ],
      };
    },
  });
}
