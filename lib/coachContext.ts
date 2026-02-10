/**
 * Coach Context Utilities
 *
 * Gathers training data to provide context for AI coach conversations.
 * Builds comprehensive snapshots of the user's training state.
 */

import type {
  CoachContext,
  ContextSnapshot,
  DailyReadiness,
  Goal,
  GoalWithExercise,
  PersonalRecord,
  PersonalRecordWithExercise,
  TrainingBlock,
  TrainingProfile,
  Workout,
  WorkoutWithSets,
} from '@/types/database';

// ============================================================================
// Context Snapshot Builder
// ============================================================================

/**
 * Build a lightweight context snapshot for storing with messages
 */
export function buildContextSnapshot(context: CoachContext): ContextSnapshot {
  const snapshot: ContextSnapshot = {};

  // Add readiness if available
  if (context.todayReadiness) {
    snapshot.readiness = {
      score: context.todayReadiness.readiness_score,
      sleep: context.todayReadiness.sleep_quality,
      soreness: context.todayReadiness.muscle_soreness,
      stress: context.todayReadiness.stress_level,
    };
  }

  // Add current block info
  if (context.currentBlock) {
    snapshot.currentBlock = {
      name: context.currentBlock.name,
      week: calculateCurrentWeek(context.currentBlock),
      phase: context.profile?.current_training_phase || 'accumulation',
    };
  }

  // Add recent workouts (last 5)
  if (context.recentWorkouts.length > 0) {
    snapshot.recentWorkouts = context.recentWorkouts.slice(0, 5).map((w) => ({
      date: w.date_completed || w.scheduled_date || '',
      focus: w.focus,
      completed: !!w.date_completed,
    }));
  }

  // Add upcoming workout
  if (context.upcomingWorkout) {
    snapshot.upcomingWorkout = {
      focus: context.upcomingWorkout.focus,
      exercises: context.upcomingWorkout.workout_sets?.map((s) => s.exercise?.name || '') || [],
    };
  }

  // Add recent PRs (top 3)
  if (context.recentPRs.length > 0) {
    snapshot.prs = context.recentPRs.slice(0, 3).map((pr) => ({
      exercise: pr.exercise_name || '',
      weight: pr.weight || 0,
      reps: pr.reps || 1,
    }));
  }

  return snapshot;
}

// ============================================================================
// System Prompt Builder
// ============================================================================

/**
 * Build the system prompt with user context
 */
export function buildSystemPrompt(context: CoachContext): string {
  const sections: string[] = [
    `You are an expert strength and conditioning coach embedded in a fitness tracking app.
Your role is to provide personalized, actionable advice based on the user's training data.

Guidelines:
- Be concise but thorough - users want clear, actionable advice
- Reference specific data when making recommendations (e.g., "Your squat has improved 15 lbs this block")
- Consider fatigue, recovery, and progressive overload principles
- Suggest adjustments when readiness is low
- Celebrate PRs and progress
- Be honest about limitations - you can advise but the user should listen to their body
- When suggesting changes, explain the reasoning briefly
- Format responses for easy reading (use bullet points, short paragraphs)`,
  ];

  // Add profile context
  if (context.profile) {
    const profile = context.profile;
    const profileInfo: string[] = ['User Profile:'];

    if (profile.training_experience) {
      profileInfo.push(`- Experience Level: ${profile.training_experience}`);
    }
    if (profile.primary_goal) {
      profileInfo.push(`- Primary Goal: ${profile.primary_goal}`);
    }
    if (profile.typical_weekly_days) {
      profileInfo.push(`- Typical Training Days: ${profile.typical_weekly_days}/week`);
    }
    if (profile.current_training_phase) {
      profileInfo.push(`- Current Phase: ${profile.current_training_phase}`);
    }
    if (profile.recovery_speed) {
      profileInfo.push(`- Recovery Speed: ${profile.recovery_speed}`);
    }
    if (profile.total_workouts_logged) {
      profileInfo.push(`- Total Workouts Logged: ${profile.total_workouts_logged}`);
    }

    if (profileInfo.length > 1) {
      sections.push(profileInfo.join('\n'));
    }
  }

  // Add current block context
  if (context.currentBlock) {
    const block = context.currentBlock;
    const currentWeek = calculateCurrentWeek(block);
    sections.push(`Current Training Block:
- Name: ${block.name}
- Week ${currentWeek} of ${block.duration_weeks}
- Phase: ${context.profile?.current_training_phase || 'In progress'}${block.description ? `\n- Focus: ${block.description}` : ''}`);
  }

  // Add readiness context
  if (context.todayReadiness) {
    const r = context.todayReadiness;
    const readinessDesc = getReadinessDescription(r.readiness_score);
    sections.push(`Today's Readiness Check-in:
- Overall Score: ${r.readiness_score}/100 (${readinessDesc})
- Sleep Quality: ${r.sleep_quality}/5
- Muscle Soreness: ${r.muscle_soreness}/5 (${r.muscle_soreness <= 2 ? 'Fresh' : r.muscle_soreness <= 3 ? 'Moderate' : 'High'})
- Stress Level: ${r.stress_level}/5
- Suggested: ${r.suggested_adjustment || 'Full'} intensity workout`);
  }

  // Add upcoming workout context
  if (context.upcomingWorkout) {
    const workout = context.upcomingWorkout;
    const exercises = workout.workout_sets?.map((s) => s.exercise?.name).filter(Boolean) || [];
    sections.push(`Upcoming Workout:
- Focus: ${workout.focus}
- Exercises: ${exercises.slice(0, 5).join(', ')}${exercises.length > 5 ? ` (+${exercises.length - 5} more)` : ''}`);
  }

  // Add recent workout history with pattern analysis
  if (context.recentWorkouts.length > 0) {
    const recentList = context.recentWorkouts.slice(0, 5).map((w) => {
      const status = w.date_completed ? 'Completed' : 'Scheduled';
      const date = w.date_completed || w.scheduled_date || '';
      return `- ${w.focus} (${status}${date ? `, ${formatDate(date)}` : ''})`;
    });
    sections.push(`Recent Workouts:\n${recentList.join('\n')}`);

    // Analyze training pattern from recent workouts
    const trainingPattern = analyzeTrainingPattern(context.recentWorkouts);
    if (trainingPattern) {
      sections.push(`Training Pattern Analysis:
- Detected Split: ${trainingPattern.detectedSplit}
- Average workouts/week: ${trainingPattern.avgPerWeek.toFixed(1)}
- Next in rotation: ${trainingPattern.nextInRotation || 'Unknown'}
- Pattern confidence: ${trainingPattern.confidence}`);
    }
  }

  // Add PR context
  if (context.recentPRs.length > 0) {
    const prList = context.recentPRs.slice(0, 5).map((pr) => {
      const repsText = pr.reps === 1 ? '1RM' : `${pr.reps}RM`;
      return `- ${pr.exercise_name}: ${pr.weight} lbs (${repsText})`;
    });
    sections.push(`Recent Personal Records:\n${prList.join('\n')}`);
  }

  // Add goals context
  if (context.goals.length > 0) {
    const goalList = context.goals
      .filter((g) => g.status === 'active')
      .slice(0, 3)
      .map((g) => {
        const progress = g.current_value
          ? Math.round((g.current_value / g.target_value) * 100)
          : 0;
        return `- ${g.exercise_name}: ${g.current_value || 0} → ${g.target_value} lbs (${progress}%)`;
      });
    if (goalList.length > 0) {
      sections.push(`Active Goals:\n${goalList.join('\n')}`);
    }
  }

  return sections.join('\n\n');
}

// ============================================================================
// Quick Suggestions Generator
// ============================================================================

export interface QuickSuggestion {
  id: string;
  label: string;
  prompt: string;
  icon: string;
  contextRequired?: ('readiness' | 'workout' | 'block' | 'prs')[];
}

/**
 * Generate context-aware quick action suggestions
 */
export function getQuickSuggestions(context: CoachContext): QuickSuggestion[] {
  const suggestions: QuickSuggestion[] = [];

  // Always available
  suggestions.push({
    id: 'progress-check',
    label: 'How am I progressing?',
    prompt: "Give me a quick progress update. How am I doing with my training? Any trends you're noticing?",
    icon: 'trending-up',
  });

  // Readiness-based suggestions
  if (context.todayReadiness) {
    const score = context.todayReadiness.readiness_score;
    if (score < 60) {
      suggestions.push({
        id: 'low-readiness',
        label: 'Adjust today\'s workout',
        prompt: "Based on my readiness today, how should I adjust my workout? What modifications would you suggest?",
        icon: 'fitness-outline',
        contextRequired: ['readiness'],
      });
    }
    if (context.todayReadiness.muscle_soreness >= 4) {
      suggestions.push({
        id: 'recovery-advice',
        label: 'Recovery advice',
        prompt: "I'm pretty sore today. What should I focus on for recovery? Should I train or rest?",
        icon: 'bandage-outline',
        contextRequired: ['readiness'],
      });
    }
  }

  // Workout-based suggestions
  if (context.upcomingWorkout) {
    suggestions.push({
      id: 'workout-preview',
      label: 'Preview today\'s workout',
      prompt: "Walk me through today's workout. What should I focus on and what weights should I aim for?",
      icon: 'list-outline',
      contextRequired: ['workout'],
    });
  }

  // Block-based suggestions
  if (context.currentBlock) {
    const currentWeek = calculateCurrentWeek(context.currentBlock);
    const totalWeeks = context.currentBlock.duration_weeks || 4;

    if (currentWeek >= totalWeeks - 1) {
      suggestions.push({
        id: 'next-block',
        label: 'Plan next block',
        prompt: "My current block is ending soon. What should I focus on for my next training block based on my progress?",
        icon: 'calendar-outline',
        contextRequired: ['block'],
      });
    }

    if (currentWeek === Math.floor(totalWeeks / 2)) {
      suggestions.push({
        id: 'mid-block',
        label: 'Mid-block check',
        prompt: "I'm halfway through my block. How's it going? Any adjustments I should make for the second half?",
        icon: 'analytics-outline',
        contextRequired: ['block'],
      });
    }
  }

  // PR celebration
  if (context.recentPRs.length > 0) {
    const latestPR = context.recentPRs[0];
    const prDate = new Date(latestPR.achieved_at);
    const daysSincePR = Math.floor((Date.now() - prDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSincePR <= 7) {
      suggestions.push({
        id: 'pr-analysis',
        label: `Analyze my ${latestPR.exercise_name} PR`,
        prompt: `I just hit a PR on ${latestPR.exercise_name}! What does this tell us about my progress and what should I focus on next?`,
        icon: 'trophy-outline',
        contextRequired: ['prs'],
      });
    }
  }

  // Goal-based suggestions
  const activeGoals = context.goals.filter((g) => g.status === 'active');
  if (activeGoals.length > 0) {
    suggestions.push({
      id: 'goal-check',
      label: 'Check goal progress',
      prompt: "How am I tracking toward my goals? Am I on pace to hit them?",
      icon: 'flag-outline',
    });
  }

  // Limit to 4 most relevant
  return suggestions.slice(0, 4);
}

// ============================================================================
// Helper Functions
// ============================================================================

interface TrainingPatternAnalysis {
  detectedSplit: string;
  avgPerWeek: number;
  nextInRotation: string | null;
  confidence: string;
}

/**
 * Analyze recent workouts to detect training patterns
 */
function analyzeTrainingPattern(workouts: Workout[]): TrainingPatternAnalysis | null {
  const completed = workouts.filter((w) => w.date_completed);
  if (completed.length < 3) return null;

  // Extract focus types
  const focuses = completed.map((w) => w.focus?.toLowerCase() || '').filter(Boolean);

  // Detect common patterns
  const hasPush = focuses.some((f) => f.includes('push'));
  const hasPull = focuses.some((f) => f.includes('pull'));
  const hasLegs = focuses.some((f) => f.includes('leg') || f.includes('lower'));
  const hasUpper = focuses.some((f) => f.includes('upper'));
  const hasLower = focuses.some((f) => f.includes('lower'));

  let detectedSplit = 'Unknown';
  let confidence = 'Low';

  if (hasPush && hasPull && hasLegs) {
    detectedSplit = 'Push/Pull/Legs';
    confidence = 'High';
  } else if (hasUpper && hasLower) {
    detectedSplit = 'Upper/Lower';
    confidence = 'High';
  } else if (hasPush && hasPull) {
    detectedSplit = 'Push/Pull';
    confidence = 'Medium';
  } else {
    // Check for full body or other patterns
    const fullBody = focuses.filter((f) => f.includes('full')).length;
    if (fullBody >= 2) {
      detectedSplit = 'Full Body';
      confidence = 'Medium';
    }
  }

  // Calculate average workouts per week
  const dates = completed.map((w) => new Date(w.date_completed!));
  if (dates.length >= 2) {
    const earliest = Math.min(...dates.map((d) => d.getTime()));
    const latest = Math.max(...dates.map((d) => d.getTime()));
    const weeks = Math.max(1, (latest - earliest) / (1000 * 60 * 60 * 24 * 7));
    const avgPerWeek = completed.length / weeks;

    // Determine next in rotation based on pattern
    let nextInRotation: string | null = null;
    const lastFocus = focuses[0]?.toLowerCase() || '';

    if (detectedSplit === 'Push/Pull/Legs') {
      if (lastFocus.includes('push')) nextInRotation = 'Pull';
      else if (lastFocus.includes('pull')) nextInRotation = 'Legs';
      else nextInRotation = 'Push';
    } else if (detectedSplit === 'Upper/Lower') {
      nextInRotation = lastFocus.includes('upper') ? 'Lower Body' : 'Upper Body';
    }

    return {
      detectedSplit,
      avgPerWeek,
      nextInRotation,
      confidence,
    };
  }

  return null;
}

function calculateCurrentWeek(block: TrainingBlock): number {
  if (!block.start_date) return 1;
  const startDate = new Date(block.start_date);
  const now = new Date();
  const diffTime = now.getTime() - startDate.getTime();
  const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
  return Math.min(Math.max(diffWeeks + 1, 1), block.duration_weeks || 1);
}

function getReadinessDescription(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Moderate';
  return 'Low';
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ============================================================================
// Response Parser
// ============================================================================

export interface ParsedCoachResponse {
  message: string;
  suggestedAction?: {
    type: 'adjust_workout' | 'swap_exercise' | 'modify_block' | 'add_note' | 'set_goal' | 'schedule_deload' | 'replace_program' | 'log_readiness' | 'log_workout_sets' | 'adjust_week' | 'open_week_planner' | 'add_disruption';
    label: string;
    details: Record<string, unknown>;
  };
}

/**
 * Generate a human-readable label for action types
 */
function getActionLabel(type: string, details: Record<string, unknown>): string {
  switch (type) {
    case 'replace_program': {
      const weeks = details.weekCount || 1;
      const days = details.daysPerWeek || 4;
      return `Apply this ${weeks > 1 ? `${weeks}-week` : 'week\'s'} plan (${days} days/week)`;
    }
    case 'adjust_workout':
      return 'Adjust workout';
    case 'swap_exercise':
      return 'Swap exercise';
    case 'schedule_deload':
      return 'Schedule deload';
    case 'set_goal':
      return 'Set goal';
    case 'log_readiness':
      return 'Log readiness check-in';
    case 'log_workout_sets': {
      const exercises = details.exercises as Array<{ exerciseName: string }> | undefined;
      const count = exercises?.length || 0;
      return count > 0 ? `Log ${count} exercise(s)` : 'Log workout';
    }
    case 'adjust_week':
      return 'Adjust this week\'s plan';
    case 'open_week_planner':
      return 'Open weekly planner';
    case 'add_disruption':
      return 'Record disruption';
    default:
      return `Apply ${type.replace(/_/g, ' ')}`;
  }
}

/**
 * Parse coach response for actionable items
 */
export function parseCoachResponse(response: string): ParsedCoachResponse {
  let suggestedAction: ParsedCoachResponse['suggestedAction'] | undefined;
  let cleanedResponse = response;

  // First, check for new XML-style action blocks: <action type="...">...</action>
  const xmlActionPattern = /<action\s+type="([^"]+)">([\s\S]*?)<\/action>/i;
  const xmlMatch = response.match(xmlActionPattern);

  if (xmlMatch) {
    const [fullMatch, actionType, jsonContent] = xmlMatch;
    try {
      const details = JSON.parse(jsonContent.trim());
      suggestedAction = {
        type: actionType as ParsedCoachResponse['suggestedAction']['type'],
        label: getActionLabel(actionType, details),
        details,
      };
      // Remove action block from message
      cleanedResponse = response.replace(fullMatch, '').trim();
    } catch {
      // Invalid JSON in action block, try to extract key-value pairs
      console.warn('[parseCoachResponse] Failed to parse JSON in action block:', jsonContent);
    }
  }

  // Fallback: Look for legacy action markers if no XML action found
  if (!suggestedAction) {
    const legacyActionPatterns = [
      { pattern: /\[ACTION:ADJUST_WORKOUT\](.*?)\[\/ACTION\]/s, type: 'adjust_workout' as const },
      { pattern: /\[ACTION:SWAP_EXERCISE\](.*?)\[\/ACTION\]/s, type: 'swap_exercise' as const },
      { pattern: /\[ACTION:DELOAD\](.*?)\[\/ACTION\]/s, type: 'schedule_deload' as const },
      { pattern: /\[ACTION:REPLACE_PROGRAM\](.*?)\[\/ACTION\]/s, type: 'replace_program' as const },
    ];

    for (const { pattern, type } of legacyActionPatterns) {
      const match = cleanedResponse.match(pattern);
      if (match) {
        try {
          const details = JSON.parse(match[1].trim());
          suggestedAction = {
            type,
            label: details.label || getActionLabel(type, details),
            details,
          };
          // Remove action block from message
          cleanedResponse = cleanedResponse.replace(pattern, '').trim();
        } catch {
          // Invalid JSON, ignore action
        }
        break;
      }
    }
  }

  return {
    message: cleanedResponse,
    suggestedAction,
  };
}
