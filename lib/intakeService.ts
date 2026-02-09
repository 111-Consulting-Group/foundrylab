/**
 * Intake Service
 * Handles persisting intake responses to the database
 */

import { supabase } from './supabase';
import type { IntakeResponses, IntakeState } from '@/types/coach';
import type { TrainingProfile, TrainingGoal, TrainingExperience } from '@/types/database';

// ============================================================================
// INTAKE PERSISTENCE
// ============================================================================

/**
 * Save intake responses to training_profiles
 */
export async function saveIntakeToProfile(
  userId: string,
  intakeState: IntakeState
): Promise<{ success: boolean; error?: string }> {
  if (!intakeState.isComplete) {
    return { success: false, error: 'Intake not complete' };
  }

  const responses = intakeState.responses;

  // Map intake responses to training profile fields
  const profileUpdate: Partial<TrainingProfile> = {
    // Goals
    primary_goal: mapGoalToTrainingGoal(responses.primary_goal),

    // Schedule
    typical_weekly_days: responses.days_per_week,
    average_session_minutes: responses.session_length_minutes,

    // Concurrent training
    concurrent_activities: responses.concurrent_activities || [],
    concurrent_hours_per_week: responses.concurrent_hours_per_week,

    // Running schedule for hybrid athletes
    running_schedule: responses.running_schedule || null,

    // Constraints
    injuries: responses.injuries,
    exercise_aversions: responses.exercise_aversions ? [responses.exercise_aversions] : [],

    // Coaching style
    autonomy_preference: responses.autonomy_preference,

    // Context (avg stress/sleep)
    avg_sleep_quality: responses.sleep_quality,
    avg_stress_level: responses.stress_level,

    // Intake tracking
    intake_completed_at: new Date().toISOString(),
    intake_version: 'v1',
  };

  // Try to update existing profile or create new one
  const { data: existingProfile } = await supabase
    .from('training_profiles')
    .select('id')
    .eq('user_id', userId)
    .single();

  let result;
  if (existingProfile) {
    result = await supabase
      .from('training_profiles')
      .update(profileUpdate)
      .eq('user_id', userId);
  } else {
    result = await supabase.from('training_profiles').insert({
      user_id: userId,
      ...profileUpdate,
      preferred_exercises: [],
      avoided_exercises: [],
      preferred_rep_ranges: {},
      available_equipment: [],
      weeks_in_current_phase: 0,
      annual_goals: [],
      competition_dates: [],
      total_workouts_logged: 0,
      total_volume_logged: 0,
      check_ins_completed: 0,
    });
  }

  if (result.error) {
    return { success: false, error: result.error.message };
  }

  return { success: true };
}

/**
 * Map intake goal to database TrainingGoal type
 */
function mapGoalToTrainingGoal(
  goal: IntakeResponses['primary_goal']
): TrainingGoal | null {
  if (!goal) return null;

  const goalMap: Record<NonNullable<IntakeResponses['primary_goal']>, TrainingGoal> = {
    strength: 'strength',
    hypertrophy: 'hypertrophy',
    fat_loss: 'general', // Map to general since fat_loss isn't in TrainingGoal
    athletic: 'athletic',
    health: 'general',
    maintain: 'general',
  };

  return goalMap[goal] || 'general';
}

/**
 * Check if intake is needed for a user
 */
export async function checkIntakeNeeded(
  userId: string
): Promise<{ needed: boolean; partialState?: Partial<IntakeState> }> {
  const { data: profile } = await supabase
    .from('training_profiles')
    .select('intake_completed_at, primary_goal, typical_weekly_days')
    .eq('user_id', userId)
    .single();

  if (!profile) {
    return { needed: true };
  }

  if (!profile.intake_completed_at) {
    // Check if they have partial data
    const hasGoal = !!profile.primary_goal;
    const hasSchedule = !!profile.typical_weekly_days;

    if (hasGoal || hasSchedule) {
      // They have some data, return partial state
      return {
        needed: true,
        partialState: {
          completedSections: hasGoal && hasSchedule ? ['goals', 'schedule'] : hasGoal ? ['goals'] : [],
          responses: {
            primary_goal: mapTrainingGoalToIntake(profile.primary_goal as TrainingGoal),
            days_per_week: profile.typical_weekly_days || undefined,
          },
        },
      };
    }

    return { needed: true };
  }

  return { needed: false };
}

/**
 * Map database TrainingGoal back to intake goal
 */
function mapTrainingGoalToIntake(
  goal: TrainingGoal | null
): IntakeResponses['primary_goal'] | undefined {
  if (!goal) return undefined;

  const inverseMap: Partial<Record<TrainingGoal, IntakeResponses['primary_goal']>> = {
    strength: 'strength',
    hypertrophy: 'hypertrophy',
    athletic: 'athletic',
    general: 'health',
    powerlifting: 'strength',
    bodybuilding: 'hypertrophy',
  };

  return inverseMap[goal];
}

/**
 * Create a user disruption record
 */
export async function createDisruption(
  userId: string,
  disruption: {
    type: 'illness' | 'travel' | 'injury' | 'life_stress' | 'schedule';
    startDate: string;
    endDate?: string;
    severity?: 'minor' | 'moderate' | 'major';
    notes?: string;
  }
): Promise<{ success: boolean; id?: string; error?: string }> {
  const { data, error } = await supabase
    .from('user_disruptions')
    .insert({
      user_id: userId,
      disruption_type: disruption.type,
      start_date: disruption.startDate,
      end_date: disruption.endDate,
      severity: disruption.severity || 'moderate',
      notes: disruption.notes,
    })
    .select('id')
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, id: data.id };
}

/**
 * End an active disruption
 */
export async function endDisruption(
  disruptionId: string,
  endDate?: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('user_disruptions')
    .update({
      end_date: endDate || new Date().toISOString().split('T')[0],
    })
    .eq('id', disruptionId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Fetch active disruptions for a user
 */
export async function getActiveDisruptions(
  userId: string
): Promise<{
  disruptions: Array<{
    id: string;
    type: string;
    startDate: string;
    severity: string;
    notes: string | null;
  }>;
  error?: string;
}> {
  // Use view that computes is_active at query time
  const { data, error } = await supabase
    .from('active_user_disruptions')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('start_date', { ascending: false });

  if (error) {
    return { disruptions: [], error: error.message };
  }

  return {
    disruptions: (data || []).map((d) => ({
      id: d.id,
      type: d.disruption_type,
      startDate: d.start_date,
      severity: d.severity,
      notes: d.notes,
    })),
  };
}
