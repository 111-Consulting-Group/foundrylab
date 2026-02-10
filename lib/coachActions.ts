/**
 * Coach Actions
 * Executes coach-suggested actions that modify the database
 */

import { supabase } from './supabase';
import type {
  CoachAction,
  AdjustWorkoutAction,
  SwapExerciseAction,
  ScheduleDeloadAction,
  UpdateTargetsAction,
  AddDisruptionAction,
  SetGoalAction,
  UpdateProfileAction,
  ReplaceProgramAction,
  LogReadinessAction,
  LogWorkoutSetsAction,
  AdjustWeekAction,
} from '@/types/coach';

// ============================================================================
// ACTION RESULT TYPE
// ============================================================================

export interface ActionResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

// ============================================================================
// MAIN ACTION EXECUTOR
// ============================================================================

/**
 * Execute a coach action against the database
 */
export async function executeCoachAction(
  action: CoachAction,
  userId: string
): Promise<ActionResult> {
  switch (action.type) {
    case 'adjust_workout':
      return executeAdjustWorkout(action, userId);

    case 'swap_exercise':
      return executeSwapExercise(action, userId);

    case 'schedule_deload':
      return executeScheduleDeload(action, userId);

    case 'update_targets':
      return executeUpdateTargets(action, userId);

    case 'add_disruption':
      return executeAddDisruption(action, userId);

    case 'set_goal':
      return executeSetGoal(action, userId);

    case 'update_profile':
      return executeUpdateProfile(action, userId);

    case 'replace_program':
      return executeReplaceProgram(action, userId);

    case 'log_readiness':
      return executeLogReadiness(action, userId);

    case 'log_workout_sets':
      return executeLogWorkoutSets(action, userId);

    case 'adjust_week':
      return executeAdjustWeek(action, userId);

    default:
      return {
        success: false,
        message: `Unknown action type: ${(action as CoachAction).type}`,
      };
  }
}

// ============================================================================
// ADJUST WORKOUT
// ============================================================================

/**
 * Apply adjustments to workout sets (reps, load, RPE, sets)
 */
async function executeAdjustWorkout(
  action: AdjustWorkoutAction,
  userId: string
): Promise<ActionResult> {
  const { workoutId, adjustments, reason } = action;

  // Verify workout belongs to user
  const { data: workout, error: workoutError } = await supabase
    .from('workouts')
    .select('id, user_id')
    .eq('id', workoutId)
    .single();

  if (workoutError || !workout) {
    return { success: false, message: 'Workout not found' };
  }

  if (workout.user_id !== userId) {
    return { success: false, message: 'Unauthorized: workout belongs to another user' };
  }

  // Apply each adjustment
  const results: { exerciseId: string; success: boolean }[] = [];

  for (const adj of adjustments) {
    const updates: Record<string, number | null> = {};

    if (adj.newReps !== undefined) updates.target_reps = adj.newReps;
    if (adj.newLoad !== undefined) updates.target_load = adj.newLoad;
    if (adj.newRPE !== undefined) updates.target_rpe = adj.newRPE;

    // If changing number of sets, we need to add/remove set rows
    if (adj.newSets !== undefined) {
      const setsResult = await adjustSetCount(workoutId, adj.exerciseId, adj.newSets);
      if (!setsResult.success) {
        results.push({ exerciseId: adj.exerciseId, success: false });
        continue;
      }
    }

    // Apply target updates to all sets for this exercise
    if (Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from('workout_sets')
        .update(updates)
        .eq('workout_id', workoutId)
        .eq('exercise_id', adj.exerciseId);

      results.push({ exerciseId: adj.exerciseId, success: !error });
    } else {
      results.push({ exerciseId: adj.exerciseId, success: true });
    }
  }

  const allSuccess = results.every((r) => r.success);
  const successCount = results.filter((r) => r.success).length;

  // Log the adjustment for audit trail
  await logCoachAction(userId, 'adjust_workout', {
    workoutId,
    adjustments,
    reason,
    results,
  });

  return {
    success: allSuccess,
    message: allSuccess
      ? `Adjusted ${successCount} exercise(s) successfully`
      : `Adjusted ${successCount}/${results.length} exercises`,
    data: { results },
  };
}

/**
 * Adjust the number of sets for an exercise in a workout
 */
async function adjustSetCount(
  workoutId: string,
  exerciseId: string,
  targetSets: number
): Promise<ActionResult> {
  // Get current sets
  const { data: currentSets, error: fetchError } = await supabase
    .from('workout_sets')
    .select('*')
    .eq('workout_id', workoutId)
    .eq('exercise_id', exerciseId)
    .order('set_order', { ascending: true });

  if (fetchError) {
    return { success: false, message: 'Failed to fetch current sets' };
  }

  const currentCount = currentSets?.length || 0;

  if (targetSets === currentCount) {
    return { success: true, message: 'Set count unchanged' };
  }

  if (targetSets > currentCount) {
    // Add sets - copy from last set
    const lastSet = currentSets?.[currentSets.length - 1];
    const setsToAdd = targetSets - currentCount;

    const newSets = Array.from({ length: setsToAdd }, (_, i) => ({
      workout_id: workoutId,
      exercise_id: exerciseId,
      set_order: currentCount + i + 1,
      target_reps: lastSet?.target_reps || null,
      target_rpe: lastSet?.target_rpe || null,
      target_load: lastSet?.target_load || null,
    }));

    const { error: insertError } = await supabase
      .from('workout_sets')
      .insert(newSets);

    if (insertError) {
      return { success: false, message: 'Failed to add sets' };
    }
  } else {
    // Remove sets from the end
    const setsToRemove = currentCount - targetSets;
    const idsToRemove = currentSets!
      .slice(-setsToRemove)
      .map((s) => s.id);

    const { error: deleteError } = await supabase
      .from('workout_sets')
      .delete()
      .in('id', idsToRemove);

    if (deleteError) {
      return { success: false, message: 'Failed to remove sets' };
    }
  }

  return { success: true, message: `Set count adjusted to ${targetSets}` };
}

// ============================================================================
// SWAP EXERCISE
// ============================================================================

/**
 * Swap one exercise for another in a workout
 */
async function executeSwapExercise(
  action: SwapExerciseAction,
  userId: string
): Promise<ActionResult> {
  const { workoutId, oldExerciseId, newExerciseId, reason } = action;

  // Verify workout belongs to user
  const { data: workout, error: workoutError } = await supabase
    .from('workouts')
    .select('id, user_id')
    .eq('id', workoutId)
    .single();

  if (workoutError || !workout) {
    return { success: false, message: 'Workout not found' };
  }

  if (workout.user_id !== userId) {
    return { success: false, message: 'Unauthorized: workout belongs to another user' };
  }

  // Verify new exercise exists
  const { data: newExercise, error: exerciseError } = await supabase
    .from('exercises')
    .select('id, name')
    .eq('id', newExerciseId)
    .single();

  if (exerciseError || !newExercise) {
    return { success: false, message: 'New exercise not found' };
  }

  // Swap the exercise in all sets
  const { error: updateError, count } = await supabase
    .from('workout_sets')
    .update({ exercise_id: newExerciseId })
    .eq('workout_id', workoutId)
    .eq('exercise_id', oldExerciseId);

  if (updateError) {
    return { success: false, message: 'Failed to swap exercise' };
  }

  // Log the action
  await logCoachAction(userId, 'swap_exercise', {
    workoutId,
    oldExerciseId,
    newExerciseId,
    newExerciseName: newExercise.name,
    reason,
    setsUpdated: count,
  });

  return {
    success: true,
    message: `Swapped to ${newExercise.name}`,
    data: { newExerciseName: newExercise.name, setsUpdated: count },
  };
}

// ============================================================================
// SCHEDULE DELOAD
// ============================================================================

/**
 * Schedule a deload week by reducing targets
 */
async function executeScheduleDeload(
  action: ScheduleDeloadAction,
  userId: string
): Promise<ActionResult> {
  const { blockId, weekNumber, reductionPercent, reason } = action;

  // If no blockId, find active block
  let targetBlockId = blockId;
  if (!targetBlockId) {
    const { data: activeBlock } = await supabase
      .from('training_blocks')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (!activeBlock) {
      return { success: false, message: 'No active training block found' };
    }
    targetBlockId = activeBlock.id;
  }

  // Verify block belongs to user
  const { data: block, error: blockError } = await supabase
    .from('training_blocks')
    .select('id, user_id, name')
    .eq('id', targetBlockId)
    .single();

  if (blockError || !block) {
    return { success: false, message: 'Training block not found' };
  }

  if (block.user_id !== userId) {
    return { success: false, message: 'Unauthorized: block belongs to another user' };
  }

  // Get all workouts in the specified week
  const { data: workouts, error: workoutsError } = await supabase
    .from('workouts')
    .select('id')
    .eq('block_id', targetBlockId)
    .eq('week_number', weekNumber);

  if (workoutsError) {
    return { success: false, message: 'Failed to fetch workouts' };
  }

  if (!workouts || workouts.length === 0) {
    return { success: false, message: `No workouts found for week ${weekNumber}` };
  }

  const workoutIds = workouts.map((w) => w.id);
  const multiplier = 1 - reductionPercent / 100;

  // Reduce load targets by the specified percentage
  // Note: We can't do computed updates in Supabase directly, so we need to fetch and update
  const { data: sets, error: setsError } = await supabase
    .from('workout_sets')
    .select('id, target_load, target_reps')
    .in('workout_id', workoutIds)
    .not('target_load', 'is', null);

  if (setsError) {
    return { success: false, message: 'Failed to fetch sets' };
  }

  // Update each set with reduced load
  let updatedCount = 0;
  for (const set of sets || []) {
    if (set.target_load) {
      const newLoad = Math.round(set.target_load * multiplier);
      const { error } = await supabase
        .from('workout_sets')
        .update({ target_load: newLoad })
        .eq('id', set.id);

      if (!error) updatedCount++;
    }
  }

  // Update block to mark deload week
  await supabase
    .from('training_blocks')
    .update({
      notes: `Week ${weekNumber} is a deload week (${reductionPercent}% reduction). Reason: ${reason}`,
    })
    .eq('id', targetBlockId);

  // Log the action
  await logCoachAction(userId, 'schedule_deload', {
    blockId: targetBlockId,
    blockName: block.name,
    weekNumber,
    reductionPercent,
    reason,
    setsUpdated: updatedCount,
  });

  return {
    success: true,
    message: `Scheduled deload for week ${weekNumber} (${reductionPercent}% reduction)`,
    data: { blockId: targetBlockId, weekNumber, setsUpdated: updatedCount },
  };
}

// ============================================================================
// UPDATE TARGETS
// ============================================================================

/**
 * Update target values for an exercise (across workouts or movement memory)
 */
async function executeUpdateTargets(
  action: UpdateTargetsAction,
  userId: string
): Promise<ActionResult> {
  const { exerciseId, newTargets, reason } = action;

  // Update movement memory with new targets as reference
  const updates: Record<string, number | null> = {};

  if (newTargets.load !== undefined) {
    updates.last_weight_used = newTargets.load;
  }
  if (newTargets.reps !== undefined) {
    updates.typical_rep_max = newTargets.reps;
  }

  if (Object.keys(updates).length > 0) {
    const { error: mmError } = await supabase
      .from('movement_memory')
      .update(updates)
      .eq('user_id', userId)
      .eq('exercise_id', exerciseId);

    if (mmError) {
      console.warn('Failed to update movement memory:', mmError);
      // Continue - this is not critical
    }
  }

  // Log the action
  await logCoachAction(userId, 'update_targets', {
    exerciseId,
    newTargets,
    reason,
  });

  return {
    success: true,
    message: 'Targets updated',
    data: { exerciseId, newTargets },
  };
}

// ============================================================================
// ADD DISRUPTION
// ============================================================================

/**
 * Add a disruption record (illness, travel, etc.)
 */
async function executeAddDisruption(
  action: AddDisruptionAction,
  userId: string
): Promise<ActionResult> {
  const { disruption } = action;

  const { data, error } = await supabase
    .from('user_disruptions')
    .insert({
      user_id: userId,
      disruption_type: disruption.type,
      start_date: disruption.start_date,
      end_date: disruption.end_date || null,
      severity: disruption.severity,
      notes: disruption.notes || null,
    })
    .select('id')
    .single();

  if (error) {
    return { success: false, message: `Failed to add disruption: ${error.message}` };
  }

  // Log the action
  await logCoachAction(userId, 'add_disruption', {
    disruptionId: data.id,
    disruption,
  });

  return {
    success: true,
    message: `Recorded ${disruption.type} disruption`,
    data: { disruptionId: data.id },
  };
}

// ============================================================================
// SET GOAL
// ============================================================================

/**
 * Create a new training goal
 */
async function executeSetGoal(
  action: SetGoalAction,
  userId: string
): Promise<ActionResult> {
  const { goal } = action;

  // Map goal_type to database goal_type
  const goalTypeMap: Record<string, string> = {
    e1rm: 'strength',
    weight: 'strength',
    reps: 'endurance',
    volume: 'hypertrophy',
    custom: 'custom',
  };

  const { data, error } = await supabase
    .from('goals')
    .insert({
      user_id: userId,
      exercise_id: goal.exercise_id || null,
      goal_type: goalTypeMap[goal.goal_type] || 'custom',
      target_value: goal.target_value,
      target_date: goal.target_date || null,
      description: goal.description || `${goal.goal_type} goal`,
      status: 'active',
    })
    .select('id')
    .single();

  if (error) {
    return { success: false, message: `Failed to create goal: ${error.message}` };
  }

  // Log the action
  await logCoachAction(userId, 'set_goal', {
    goalId: data.id,
    goal,
  });

  return {
    success: true,
    message: 'Goal created',
    data: { goalId: data.id },
  };
}

// ============================================================================
// UPDATE PROFILE
// ============================================================================

/**
 * Update training profile based on intake responses
 */
async function executeUpdateProfile(
  action: UpdateProfileAction,
  userId: string
): Promise<ActionResult> {
  const { updates } = action;

  // Map intake responses to training profile fields
  const profileUpdates: Record<string, unknown> = {};

  if (updates.primary_goal) {
    const goalMap: Record<string, string> = {
      strength: 'strength',
      hypertrophy: 'hypertrophy',
      fat_loss: 'general',
      athletic: 'athletic',
      health: 'general',
      maintain: 'general',
    };
    profileUpdates.primary_goal = goalMap[updates.primary_goal] || 'general';
  }

  if (updates.days_per_week !== undefined) {
    profileUpdates.typical_weekly_days = updates.days_per_week;
  }

  if (updates.session_length_minutes !== undefined) {
    profileUpdates.average_session_minutes = updates.session_length_minutes;
  }

  if (updates.concurrent_activities) {
    profileUpdates.concurrent_activities = updates.concurrent_activities;
  }

  if (updates.concurrent_hours_per_week !== undefined) {
    profileUpdates.concurrent_hours_per_week = updates.concurrent_hours_per_week;
  }

  if (updates.injuries !== undefined) {
    profileUpdates.injuries = updates.injuries;
  }

  if (updates.exercise_aversions !== undefined) {
    profileUpdates.exercise_aversions = updates.exercise_aversions ? [updates.exercise_aversions] : [];
  }

  if (updates.autonomy_preference !== undefined) {
    profileUpdates.autonomy_preference = updates.autonomy_preference;
  }

  if (updates.sleep_quality !== undefined) {
    profileUpdates.avg_sleep_quality = updates.sleep_quality;
  }

  if (updates.stress_level !== undefined) {
    profileUpdates.avg_stress_level = updates.stress_level;
  }

  if (Object.keys(profileUpdates).length === 0) {
    return { success: true, message: 'No updates to apply' };
  }

  // Try update first, then insert if no rows affected
  const { data: existingProfile } = await supabase
    .from('training_profiles')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (existingProfile) {
    const { error } = await supabase
      .from('training_profiles')
      .update(profileUpdates)
      .eq('user_id', userId);

    if (error) {
      return { success: false, message: `Failed to update profile: ${error.message}` };
    }
  } else {
    const { error } = await supabase
      .from('training_profiles')
      .insert({
        user_id: userId,
        ...profileUpdates,
      });

    if (error) {
      return { success: false, message: `Failed to create profile: ${error.message}` };
    }
  }

  // Log the action
  await logCoachAction(userId, 'update_profile', {
    updates: profileUpdates,
  });

  return {
    success: true,
    message: 'Profile updated',
    data: { updates: profileUpdates },
  };
}

// ============================================================================
// REPLACE PROGRAM
// ============================================================================

/**
 * Prepare for program replacement (validates/creates block)
 * Note: Actual workout generation happens via useCoachWorkoutGenerator hook
 */
async function executeReplaceProgram(
  action: ReplaceProgramAction,
  userId: string
): Promise<ActionResult> {
  const { blockId, weekCount, daysPerWeek, config, reason } = action;

  // If blockId provided, verify it belongs to user
  let targetBlockId = blockId;

  if (targetBlockId) {
    const { data: block, error: blockError } = await supabase
      .from('training_blocks')
      .select('id, user_id')
      .eq('id', targetBlockId)
      .single();

    if (blockError || !block) {
      return { success: false, message: 'Training block not found' };
    }

    if (block.user_id !== userId) {
      return { success: false, message: 'Unauthorized: block belongs to another user' };
    }
  } else {
    // Check for existing active block or signal to create new one
    const { data: activeBlock } = await supabase
      .from('training_blocks')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    targetBlockId = activeBlock?.id;
  }

  // Log the action
  await logCoachAction(userId, 'replace_program', {
    blockId: targetBlockId,
    weekCount,
    daysPerWeek,
    config,
    reason,
  });

  return {
    success: true,
    message: 'Ready to generate program',
    data: {
      blockId: targetBlockId,
      weekCount,
      daysPerWeek,
      goal: config.goal,
      phase: config.phase,
      focusAreas: config.focusAreas,
      reason,
      // Signal to UI that workout generation is needed
      requiresWorkoutGeneration: true,
    },
  };
}

// ============================================================================
// LOG READINESS (from natural language chat)
// ============================================================================

/**
 * Log a readiness check-in parsed from natural language
 * e.g. "Slept great, not sore at all, stress is low"
 */
async function executeLogReadiness(
  action: LogReadinessAction,
  userId: string
): Promise<ActionResult> {
  const { sleep_quality, muscle_soreness, stress_level, notes } = action;

  // Calculate readiness score (same formula as useReadiness hook)
  const sleepScore = sleep_quality * 20;
  const sorenessScore = (6 - muscle_soreness) * 20; // Invert: low soreness = high readiness
  const stressScore = (6 - stress_level) * 20; // Invert: low stress = high readiness
  const readinessScore = Math.round((sleepScore + sorenessScore + stressScore) / 3);

  // Determine suggested adjustment
  let suggestedAdjustment: 'full' | 'moderate' | 'light' | 'rest' = 'full';
  if (readinessScore < 40) suggestedAdjustment = 'rest';
  else if (readinessScore < 60) suggestedAdjustment = 'light';
  else if (readinessScore < 80) suggestedAdjustment = 'moderate';

  const today = new Date().toISOString().split('T')[0];

  // Upsert: update if today's entry exists, insert if not
  const { data: existing } = await supabase
    .from('daily_readiness')
    .select('id')
    .eq('user_id', userId)
    .eq('check_in_date', today)
    .single();

  if (existing) {
    const { error } = await supabase
      .from('daily_readiness')
      .update({
        sleep_quality,
        muscle_soreness,
        stress_level,
        readiness_score: readinessScore,
        suggested_adjustment: suggestedAdjustment,
        notes: notes || null,
      })
      .eq('id', existing.id);

    if (error) {
      return { success: false, message: `Failed to update readiness: ${error.message}` };
    }
  } else {
    const { error } = await supabase
      .from('daily_readiness')
      .insert({
        user_id: userId,
        check_in_date: today,
        sleep_quality,
        muscle_soreness,
        stress_level,
        readiness_score: readinessScore,
        suggested_adjustment: suggestedAdjustment,
        notes: notes || null,
      });

    if (error) {
      return { success: false, message: `Failed to log readiness: ${error.message}` };
    }
  }

  await logCoachAction(userId, 'log_readiness', {
    sleep_quality,
    muscle_soreness,
    stress_level,
    readinessScore,
    suggestedAdjustment,
  });

  return {
    success: true,
    message: `Readiness logged: ${readinessScore}/100 (${suggestedAdjustment})`,
    data: { readinessScore, suggestedAdjustment, sleep_quality, muscle_soreness, stress_level },
  };
}

// ============================================================================
// LOG WORKOUT SETS (from natural language chat)
// ============================================================================

/**
 * Log workout sets from natural language
 * e.g. "Back squats 185x10 for 4 sets"
 */
async function executeLogWorkoutSets(
  action: LogWorkoutSetsAction,
  userId: string
): Promise<ActionResult> {
  const { exercises, sessionNotes } = action;

  // Find or create today's workout
  const today = new Date().toISOString().split('T')[0];

  // Check for active block
  const { data: activeBlock } = await supabase
    .from('training_blocks')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  // Find today's workout or create one
  let workoutId: string;
  const { data: existingWorkout } = await supabase
    .from('workouts')
    .select('id')
    .eq('user_id', userId)
    .gte('scheduled_date', today)
    .lte('scheduled_date', today)
    .single();

  if (existingWorkout) {
    workoutId = existingWorkout.id;
  } else {
    // Determine focus from exercise names
    const focus = exercises.map((e) => e.exerciseName).join(', ').slice(0, 50) || 'General';

    const { data: newWorkout, error: createError } = await supabase
      .from('workouts')
      .insert({
        user_id: userId,
        block_id: activeBlock?.id || null,
        scheduled_date: today,
        date_completed: new Date().toISOString(),
        focus,
        notes: sessionNotes || null,
      })
      .select('id')
      .single();

    if (createError || !newWorkout) {
      return { success: false, message: `Failed to create workout: ${createError?.message}` };
    }
    workoutId = newWorkout.id;
  }

  // For each exercise, find or create exercise record, then insert sets
  let totalSetsLogged = 0;

  for (const exerciseData of exercises) {
    // Find exercise by name (case-insensitive)
    const { data: exercise } = await supabase
      .from('exercises')
      .select('id')
      .ilike('name', exerciseData.exerciseName)
      .single();

    let exerciseId: string;
    if (exercise) {
      exerciseId = exercise.id;
    } else {
      // Create a custom exercise
      const { data: newExercise, error: exerciseError } = await supabase
        .from('exercises')
        .insert({
          name: exerciseData.exerciseName,
          category: 'custom',
          is_custom: true,
          created_by: userId,
        })
        .select('id')
        .single();

      if (exerciseError || !newExercise) {
        continue; // Skip this exercise if we can't create it
      }
      exerciseId = newExercise.id;
    }

    // Insert sets
    const setsToInsert = exerciseData.sets.map((set, index) => ({
      workout_id: workoutId,
      exercise_id: exerciseId,
      set_order: index + 1,
      actual_reps: set.reps,
      actual_load: set.weight || null,
      actual_rpe: set.rpe || null,
      notes: exerciseData.notes || null,
    }));

    const { error: setsError } = await supabase
      .from('workout_sets')
      .insert(setsToInsert);

    if (!setsError) {
      totalSetsLogged += setsToInsert.length;
    }
  }

  // Mark workout as completed if not already
  await supabase
    .from('workouts')
    .update({ date_completed: new Date().toISOString() })
    .eq('id', workoutId)
    .is('date_completed', null);

  await logCoachAction(userId, 'log_workout_sets', {
    workoutId,
    exerciseCount: exercises.length,
    totalSetsLogged,
  });

  return {
    success: true,
    message: `Logged ${totalSetsLogged} sets across ${exercises.length} exercise(s)`,
    data: { workoutId, totalSetsLogged, exerciseCount: exercises.length },
  };
}

// ============================================================================
// ADJUST REMAINING WEEK
// ============================================================================

/**
 * Signal to adjust the remaining week's plan based on a disruption or change
 * This records the disruption and returns guidance for the coach to replan
 */
async function executeAdjustWeek(
  action: AdjustWeekAction,
  userId: string
): Promise<ActionResult> {
  const { reason, constraints } = action;

  // If reducing intensity, add a minor disruption record
  if (constraints?.reduceIntensity || constraints?.skipDays?.length) {
    await supabase
      .from('user_disruptions')
      .insert({
        user_id: userId,
        disruption_type: 'schedule',
        start_date: new Date().toISOString().split('T')[0],
        severity: constraints?.reduceIntensity ? 'moderate' : 'minor',
        notes: reason,
      });
  }

  await logCoachAction(userId, 'adjust_week', {
    reason,
    constraints,
  });

  return {
    success: true,
    message: `Week adjustment recorded. The coach will replan your remaining sessions.`,
    data: { reason, constraints },
  };
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

/**
 * Log coach actions for audit trail
 */
async function logCoachAction(
  userId: string,
  actionType: string,
  details: Record<string, unknown>
): Promise<void> {
  try {
    // Log to console for now - could be expanded to a dedicated audit table
    console.log('[Coach Action]', {
      userId,
      actionType,
      details,
      timestamp: new Date().toISOString(),
    });

    // Future: Insert into coach_action_logs table
    // await supabase.from('coach_action_logs').insert({
    //   user_id: userId,
    //   action_type: actionType,
    //   details,
    //   created_at: new Date().toISOString(),
    // });
  } catch (error) {
    console.error('[Coach Action] Failed to log action:', error);
  }
}

// ============================================================================
// HELPER: PARSE ACTION FROM SUGGESTED ACTION
// ============================================================================

/**
 * Convert a SuggestedAction (from ChatMessage) to a typed CoachAction
 */
export function parseCoachAction(
  suggestedAction: {
    type: string;
    label: string;
    details: Record<string, unknown>;
  }
): CoachAction | null {
  const { type, details } = suggestedAction;

  switch (type) {
    case 'adjust_workout':
      return {
        type: 'adjust_workout',
        workoutId: details.workoutId as string,
        adjustments: (details.adjustments as AdjustWorkoutAction['adjustments']) || [],
        reason: (details.reason as string) || suggestedAction.label,
      };

    case 'swap_exercise':
      return {
        type: 'swap_exercise',
        workoutId: details.workoutId as string,
        oldExerciseId: details.oldExerciseId as string,
        newExerciseId: details.newExerciseId as string,
        reason: (details.reason as string) || suggestedAction.label,
      };

    case 'schedule_deload':
      return {
        type: 'schedule_deload',
        blockId: details.blockId as string | undefined,
        weekNumber: (details.weekNumber as number) || 1,
        reductionPercent: (details.reductionPercent as number) || 40,
        reason: (details.reason as string) || suggestedAction.label,
      };

    case 'update_targets':
      return {
        type: 'update_targets',
        exerciseId: details.exerciseId as string,
        newTargets: (details.newTargets as UpdateTargetsAction['newTargets']) || {},
        reason: (details.reason as string) || suggestedAction.label,
      };

    case 'add_disruption':
      return {
        type: 'add_disruption',
        disruption: details.disruption as AddDisruptionAction['disruption'],
      };

    case 'set_goal':
      return {
        type: 'set_goal',
        goal: details.goal as SetGoalAction['goal'],
      };

    case 'update_profile':
      return {
        type: 'update_profile',
        updates: (details.updates as UpdateProfileAction['updates']) || {},
      };

    case 'replace_program':
      return {
        type: 'replace_program',
        blockId: details.blockId as string | undefined,
        weekCount: (details.weekCount as number) || 1,
        daysPerWeek: (details.daysPerWeek as number) || 4,
        config: {
          goal: (details.goal as string) || (details.config as any)?.goal || 'strength',
          phase: (details.phase as string) || (details.config as any)?.phase,
          focusAreas: (details.focusAreas as string[]) || (details.config as any)?.focusAreas,
        },
        reason: (details.reason as string) || suggestedAction.label,
      };

    case 'log_readiness':
      return {
        type: 'log_readiness',
        sleep_quality: (details.sleep_quality as 1 | 2 | 3 | 4 | 5) || 3,
        muscle_soreness: (details.muscle_soreness as 1 | 2 | 3 | 4 | 5) || 3,
        stress_level: (details.stress_level as 1 | 2 | 3 | 4 | 5) || 3,
        notes: details.notes as string | undefined,
      };

    case 'log_workout_sets':
      return {
        type: 'log_workout_sets',
        exercises: (details.exercises as LogWorkoutSetsAction['exercises']) || [],
        sessionNotes: details.sessionNotes as string | undefined,
      };

    case 'adjust_week':
      return {
        type: 'adjust_week',
        reason: (details.reason as string) || suggestedAction.label,
        constraints: details.constraints as AdjustWeekAction['constraints'],
      };

    default:
      console.warn('[Coach Action] Unknown action type:', type);
      return null;
  }
}
