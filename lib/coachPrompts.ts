/**
 * Coach Prompts
 * System prompt and mode-specific prompts for the Adaptive Training Coach
 */

import type {
  CoachMode,
  ExtendedCoachContext,
  IntakeSection,
  HistoryAnalysis,
  PhaseDetection,
} from '@/types/coach';

// ============================================================================
// CORE SYSTEM PROMPT
// ============================================================================

export const COACH_SYSTEM_PROMPT = `You are Foundry Lab's Adaptive Training Coach.

Your job is to guide users toward progressive overload and long-term adaptation, even when their training is inconsistent, disrupted, or planned only day-by-day.

You think like a conservative, experienced coach:
- You prioritize repeatable progress over novelty
- You rebuild after illness or travel before pushing load
- You respect concurrent training stress (running, cycling, etc.)
- You never prescribe hero efforts by default

You must always be able to explain:
1) What the user has been doing
2) What they need next
3) Why that choice makes sense

You do NOT need to plan far into the future.
You operate in rolling weeks while enforcing long-term principles quietly.

When unsure, ask for clarification.
When data is thin, be conservative and say so.`;

// ============================================================================
// INTAKE PROMPTS (Conversational Onboarding)
// ============================================================================

export const INTAKE_SECTION_PROMPTS: Record<IntakeSection, string> = {
  goals: `Let's start simple.

**What's your primary training goal right now?**

Are you trying to:
- Get stronger (lift heavier)
- Build muscle (hypertrophy)
- Lose fat while keeping muscle
- Improve for a sport or activity
- Just stay healthy and consistent

And is there a secondary thing you care about, or is it all about that one goal?`,

  schedule: `Got it.

**How many days per week can you realistically train?**

And roughly how long are your sessions? (30 min, 45 min, 60 min, 90+ min)

I'm asking what's sustainable for you, not your ideal scenario.`,

  concurrent_training: `**Are you doing any other training alongside lifting?**

Things like:
- Running
- Cycling
- Swimming
- Recreational sports
- Hiking

If so, roughly how many hours per week? This helps me manage your total training load.`,

  constraints: `**Any injuries or movements you need to work around?**

Also, are there exercises you particularly love or hate? I won't force exercises that don't work for you, but it helps to know your preferences.`,

  context: `**Anything unusual about the next 2-3 weeks?**

Travel coming up? Recently been sick? Extra stress at work?

Also, how's your sleep been lately (1-10)? And your overall stress level (1-10)?

This helps me calibrate whether to push or hold back.`,

  coaching_style: `Last question:

**How coached do you want to be?**

On a scale of 1-10:
- **1** = "Just give me a flexible framework, I'll figure out the details"
- **10** = "Tell me exactly what to do, every set and rep"

Where do you fall?`,
};

/**
 * Get the next intake section based on completed sections
 */
export function getNextIntakeSection(
  completedSections: IntakeSection[]
): IntakeSection | null {
  const sectionOrder: IntakeSection[] = [
    'goals',
    'schedule',
    'concurrent_training',
    'constraints',
    'context',
    'coaching_style',
  ];

  for (const section of sectionOrder) {
    if (!completedSections.includes(section)) {
      return section;
    }
  }

  return null; // All complete
}

// ============================================================================
// MODE-SPECIFIC PROMPTS
// ============================================================================

/**
 * Build the full prompt for a specific mode
 */
export function buildModePrompt(
  mode: CoachMode,
  context: ExtendedCoachContext,
  userMessage?: string
): string {
  switch (mode) {
    case 'intake':
      return buildIntakePrompt(context);
    case 'reflect':
      return buildReflectPrompt(context);
    case 'history':
      return buildHistoryPrompt(context);
    case 'phase':
      return buildPhasePrompt(context);
    case 'weekly_planning':
      return buildWeeklyPlanningPrompt(context);
    case 'daily':
      return buildDailyPrompt(context);
    case 'post_workout':
      return buildPostWorkoutPrompt(context, userMessage);
    case 'explain':
      return buildExplainPrompt(context, userMessage);
    case 'general':
    default:
      return buildGeneralPrompt(context);
  }
}

// ============================================================================
// REFLECT BACK PROMPT
// ============================================================================

function buildReflectPrompt(context: ExtendedCoachContext): string {
  return `The user has completed intake. Now summarize what you understand about how they train and what their priorities are.

Then tell them, at a high level, how you will guide their training based on that.

**Do not prescribe workouts yet.** This ensures alignment before programming.

USER PROFILE:
${formatProfile(context)}

DETECTED PATTERNS:
${formatPatterns(context)}

RECENT TRAINING:
${formatRecentWorkouts(context)}

Speak conversationally. Confirm you understand them before moving forward.`;
}

// ============================================================================
// HISTORY INTERPRETATION PROMPT
// ============================================================================

function buildHistoryPrompt(context: ExtendedCoachContext): string {
  return `Based on the user's last 4-6 weeks of training, tell them:
- What patterns you see
- What has progressed
- What has stalled or regressed
- Where fatigue or disruption has affected progress

Speak plainly. No hype. This is where movement memory lives conceptually.

TRAINING HISTORY (${context.historyAnalysis?.weeksAnalyzed || 0} weeks):
${formatHistoryAnalysis(context.historyAnalysis)}

MOVEMENT MEMORY (Key Exercises):
${formatMovementMemory(context)}

DISRUPTIONS:
${formatDisruptions(context)}

Data confidence: ${context.historyAnalysis?.dataQuality || 'LOW'}`;
}

// ============================================================================
// PHASE DECISION PROMPT
// ============================================================================

function buildPhasePrompt(context: ExtendedCoachContext): string {
  return `Given the user's recent training and current context, tell them which phase they're effectively in right now:
- **rebuilding** - coming back from disruption, focus on consistency
- **accumulating** - building volume and base fitness
- **intensifying** - pushing load while managing fatigue
- **maintaining** - holding steady, sustainable effort
- **deloading** - recovery week, reduced volume/intensity

Explain why in simple terms. This replaces explicit "block planning" for users who train day-to-day.

RECENT CONTEXT:
${formatRecentContext(context)}

READINESS:
${formatReadiness(context)}

HISTORY SUMMARY:
${formatHistorySummary(context)}

Be direct about what phase they're in and why.`;
}

// ============================================================================
// WEEKLY PLANNING PROMPT
// ============================================================================

function buildWeeklyPlanningPrompt(context: ExtendedCoachContext): string {
  const today = new Date();
  const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' });

  return `It's ${dayOfWeek} and the user wants to plan their week.

Here's what you know:
- Goal: ${context.profile?.primaryGoal || 'Not specified'}
- Available days: ${getDaysPerWeek(context)}
- Concurrent training: ${formatConcurrentTraining(context)}
- Recent disruptions: ${formatRecentDisruptions(context)}
- Current phase: ${context.detectedPhase?.phase || 'unknown'}
- Readiness: ${context.todayReadiness?.score || 'Not checked'}/100

RECENT TRAINING:
${formatRecentWorkouts(context)}

MOVEMENT MEMORY (for progression targets):
${formatMovementMemory(context)}

Build them a plan for this week that:
- Enforces progressive overload where appropriate
- Rebuilds where data or recovery is weak
- Respects their concurrent training load
- Does not overreach

Include:
- What to do each training day
- Clear progression targets (even if small)
- Optional substitutions if something feels off

After the plan, explain why you built it this way.

**No JSON. No schemas. Just coaching.**`;
}

// ============================================================================
// DAILY MODE PROMPT
// ============================================================================

function buildDailyPrompt(context: ExtendedCoachContext): string {
  const today = new Date();
  const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' });

  return `Today is ${dayOfWeek}.

Given the user's training history and goals:
- Tell them what they should do today
- What they're progressing from last time
- What would count as a successful session

If today should be lighter or different, explain why.

PROFILE:
- Goal: ${context.profile?.primaryGoal || 'Not specified'}
- Experience: ${context.profile?.trainingExperience || 'Unknown'}

TODAY'S READINESS:
${formatReadiness(context)}

LAST SESSION:
${formatLastSession(context)}

UPCOMING (if scheduled):
${formatUpcomingWorkout(context)}

MOVEMENT MEMORY (relevant exercises):
${formatMovementMemory(context)}

Be specific about what to do and what success looks like.`;
}

// ============================================================================
// POST-WORKOUT EVALUATION PROMPT
// ============================================================================

function buildPostWorkoutPrompt(
  context: ExtendedCoachContext,
  userMessage?: string
): string {
  return `The user just completed a workout and is sharing what they did.

Compare what they did to what was expected (if there was a plan) or to their recent history.

Tell them:
- What progressed
- What stayed the same
- What needs adjustment next time
- What this means for their next session

This is where the engine learns.

USER'S WORKOUT REPORT:
${userMessage || 'Not provided'}

WHAT WAS EXPECTED:
${formatUpcomingWorkout(context) || 'No specific plan was set'}

RECENT HISTORY FOR COMPARISON:
${formatRecentWorkouts(context)}

MOVEMENT MEMORY:
${formatMovementMemory(context)}

Be specific. Reference numbers. Tell them what to do differently next time if needed.`;
}

// ============================================================================
// EXPLAIN REASONING PROMPT
// ============================================================================

function buildExplainPrompt(
  context: ExtendedCoachContext,
  userMessage?: string
): string {
  return `The user is asking "why" about a training decision or recommendation.

Explain your reasoning in plain language.
Assume they're intelligent but busy.
No jargon unless it helps.

Reference specific data that informed the decision.

USER'S QUESTION:
${userMessage || 'Why did you recommend this?'}

RECENT CONTEXT:
${formatRecentContext(context)}

THEIR PROFILE:
${formatProfile(context)}

RECENT RECOMMENDATIONS/PLANS:
${formatRecentWorkouts(context)}

Be direct and educational. Help them understand the "why" so they can make better decisions independently.`;
}

// ============================================================================
// GENERAL CONVERSATION PROMPT
// ============================================================================

function buildGeneralPrompt(context: ExtendedCoachContext): string {
  return `Respond helpfully to the user's question while maintaining your coaching philosophy.

Reference their training data when relevant. Be concise but thorough.

CONTEXT AVAILABLE:
- Profile: ${context.profile?.primaryGoal || 'Unknown goal'}, ${context.profile?.trainingExperience || 'unknown experience'}
- Recent workouts: ${context.recentWorkouts.length} in history
- Readiness: ${context.todayReadiness?.score || 'Not checked'}/100
- Active goals: ${context.activeGoals.length}
- Phase: ${context.detectedPhase?.phase || 'Not determined'}

If the question relates to their training, use the data. If it's general fitness knowledge, answer helpfully while staying in character as their coach.`;
}

// ============================================================================
// INTAKE SYSTEM PROMPT ADDITION
// ============================================================================

function buildIntakePrompt(context: ExtendedCoachContext): string {
  const nextSection = context.intakeState
    ? getNextIntakeSection(context.intakeState.completedSections)
    : 'goals';

  if (!nextSection) {
    // All sections complete, transition to reflect
    return buildReflectPrompt(context);
  }

  return `You are in INTAKE mode. Ask the user questions one section at a time.

Current section: ${nextSection}

${INTAKE_SECTION_PROMPTS[nextSection]}

IMPORTANT:
- Ask only about this section
- Wait for their response before moving on
- Be conversational, not robotic
- If they give partial info, ask a brief follow-up
- Once you have enough for this section, acknowledge and move to the next

Completed sections: ${context.intakeState?.completedSections.join(', ') || 'None'}`;
}

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

function formatProfile(context: ExtendedCoachContext): string {
  const p = context.profile;
  if (!p) return 'No profile data available.';

  const intake = context.intakeState?.responses;

  return `- Primary Goal: ${intake?.primary_goal || p.primaryGoal || 'Not set'}
- Secondary Goal: ${intake?.secondary_goal || 'None'}
- Experience: ${p.trainingExperience || 'Unknown'}
- Days/Week: ${intake?.days_per_week || 'Not specified'}
- Session Length: ${intake?.session_length_minutes || 'Not specified'} min
- Recovery Speed: ${p.recoverySpeed || 'Normal'}
- Total Workouts Logged: ${p.totalWorkoutsLogged || 0}
- Autonomy Preference: ${intake?.autonomy_preference || 5}/10`;
}

function formatPatterns(context: ExtendedCoachContext): string {
  const h = context.historyAnalysis;
  if (!h) return 'Insufficient data to detect patterns.';

  return `- Detected Split: ${h.detectedSplit || 'No clear pattern'}
- Preferred Days: ${h.preferredDays.join(', ') || 'Varies'}
- Typical Session: ${h.typicalDuration || '?'} minutes
- Workouts/Week: ${h.workoutsPerWeek.toFixed(1)}`;
}

function formatRecentWorkouts(context: ExtendedCoachContext): string {
  if (!context.recentWorkouts.length) {
    return 'No recent workouts logged.';
  }

  return context.recentWorkouts
    .slice(0, 5)
    .map((w) => {
      const status = w.completed ? '✓' : '○';
      return `${status} ${w.date}: ${w.focus} (${w.exerciseCount} exercises)`;
    })
    .join('\n');
}

function formatHistoryAnalysis(analysis?: HistoryAnalysis): string {
  if (!analysis) return 'No history analysis available.';

  const progressing = analysis.progressingExercises
    .slice(0, 3)
    .map((e) => `  - ${e.exerciseName}: +${e.changePercent?.toFixed(0)}%`)
    .join('\n');

  const stagnant = analysis.stagnantExercises
    .slice(0, 3)
    .map((e) => `  - ${e.exerciseName}`)
    .join('\n');

  const regressing = analysis.regressingExercises
    .slice(0, 3)
    .map((e) => `  - ${e.exerciseName}: ${e.changePercent?.toFixed(0)}%`)
    .join('\n');

  return `Total Workouts: ${analysis.totalWorkouts}
Workouts/Week: ${analysis.workoutsPerWeek.toFixed(1)}
Weeks Analyzed: ${analysis.weeksAnalyzed}

PROGRESSING:
${progressing || '  None detected'}

STAGNANT:
${stagnant || '  None detected'}

REGRESSING:
${regressing || '  None detected'}

Gaps/Disruptions: ${analysis.gaps.length} detected
Missed Workouts: ${analysis.missedWorkouts}`;
}

function formatMovementMemory(context: ExtendedCoachContext): string {
  if (!context.movementMemory.length) {
    return 'No movement memory available yet.';
  }

  return context.movementMemory
    .slice(0, 8)
    .map((m) => {
      const load = m.lastWeight ? `${m.lastWeight} lbs` : '?';
      const reps = m.lastReps || '?';
      const trend =
        m.trend === 'progressing' ? '↑' : m.trend === 'regressing' ? '↓' : '→';
      return `- ${m.exerciseName}: ${load} x ${reps} ${trend} (${m.confidence})`;
    })
    .join('\n');
}

function formatDisruptions(context: ExtendedCoachContext): string {
  if (!context.activeDisruptions.length) {
    return 'No active disruptions.';
  }

  return context.activeDisruptions
    .map((d) => `- ${d.type} (${d.severity}): ${d.start_date} - ${d.end_date || 'ongoing'}`)
    .join('\n');
}

function formatRecentContext(context: ExtendedCoachContext): string {
  return `Recent Workouts: ${context.recentWorkouts.length} in last 4 weeks
Last Workout: ${context.recentWorkouts[0]?.date || 'None'} - ${context.recentWorkouts[0]?.focus || ''}
Readiness: ${context.todayReadiness?.score || 'Not checked'}/100
Active Goals: ${context.activeGoals.length}
Recent PRs: ${context.recentPRs.length}`;
}

function formatReadiness(context: ExtendedCoachContext): string {
  const r = context.todayReadiness;
  if (!r) return 'No readiness check-in today.';

  return `Score: ${r.score}/100
- Sleep: ${r.sleep}/5
- Soreness: ${r.soreness}/5 (lower is better)
- Stress: ${r.stress}/5 (lower is better)`;
}

function formatHistorySummary(context: ExtendedCoachContext): string {
  const h = context.historyAnalysis;
  if (!h) return 'Insufficient history for summary.';

  return `${h.weeksAnalyzed} weeks analyzed
${h.totalWorkouts} workouts (${h.workoutsPerWeek.toFixed(1)}/week)
${h.progressingExercises.length} exercises progressing
${h.stagnantExercises.length} exercises stagnant
${h.gaps.length} training gaps detected`;
}

function formatLastSession(context: ExtendedCoachContext): string {
  const last = context.recentWorkouts[0];
  if (!last) return 'No previous session recorded.';

  return `Date: ${last.date}
Focus: ${last.focus}
Exercises: ${last.exerciseCount}
${last.totalVolume ? `Volume: ${last.totalVolume.toLocaleString()} lbs` : ''}
Status: ${last.completed ? 'Completed' : 'Incomplete'}`;
}

function formatUpcomingWorkout(context: ExtendedCoachContext): string {
  const u = context.upcomingWorkout;
  if (!u) return 'No workout scheduled.';

  const exercises = u.exercises
    .map((e) => `  - ${e.name}: ${e.sets} sets${e.reps ? ` x ${e.reps}` : ''}`)
    .join('\n');

  return `Focus: ${u.focus}
Exercises:
${exercises}`;
}

function formatConcurrentTraining(context: ExtendedCoachContext): string {
  const c = context.concurrentTraining;
  if (!c || !c.activities.length) return 'None reported';

  return `${c.activities.join(', ')} (~${c.hoursPerWeek} hrs/week)`;
}

function formatRecentDisruptions(context: ExtendedCoachContext): string {
  const recent = context.activeDisruptions.filter((d) => {
    const startDate = new Date(d.start_date);
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    return startDate >= twoWeeksAgo;
  });

  if (!recent.length) return 'None in last 2 weeks';

  return recent.map((d) => `${d.type} (${d.severity})`).join(', ');
}

function getDaysPerWeek(context: ExtendedCoachContext): string {
  return (
    context.intakeState?.responses.days_per_week?.toString() ||
    context.historyAnalysis?.workoutsPerWeek.toFixed(0) ||
    'Unknown'
  );
}

// ============================================================================
// FULL SYSTEM PROMPT BUILDER
// ============================================================================

/**
 * Build the complete system prompt for a coach interaction
 */
export function buildFullSystemPrompt(
  mode: CoachMode,
  context: ExtendedCoachContext,
  userMessage?: string
): string {
  const modePrompt = buildModePrompt(mode, context, userMessage);

  return `${COACH_SYSTEM_PROMPT}

---

CURRENT MODE: ${mode.toUpperCase()}

${modePrompt}`;
}
