# LLM Coach Implementation Plan
## Foundry Lab Adaptive Training Coach

### Overview

Transform the existing coach infrastructure into a sophisticated adaptive training coach that operates through 8 distinct interaction modes, enforcing progressive overload while respecting recovery constraints.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                            │
├─────────────────────────────────────────────────────────────────┤
│  CoachChat.tsx          │  IntakeWizard.tsx    │  WeeklyPlan.tsx │
│  (Conversation UI)      │  (Onboarding flow)   │  (Plan display) │
└─────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────┐
│                      COACH ORCHESTRATOR                          │
│                      /hooks/useCoach.ts                          │
├─────────────────────────────────────────────────────────────────┤
│  Mode Detection  │  Context Assembly  │  Action Handlers        │
│  (intent → mode) │  (mode → context)  │  (suggestions → DB)     │
└─────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────┐
│                      PROMPT ENGINE                               │
│                      /lib/coachPrompts.ts                        │
├─────────────────────────────────────────────────────────────────┤
│  System Prompt Builder  │  Mode-Specific Prompts  │  Formatters │
└─────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────┐
│                      CONTEXT PROVIDERS                           │
│                      /lib/coachContext.ts                        │
├─────────────────────────────────────────────────────────────────┤
│  TrainingProfile  │  MovementMemory  │  WorkoutHistory          │
│  Readiness        │  DetectedPatterns │  Goals & PRs            │
└─────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────┐
│                      SUPABASE EDGE FUNCTION                      │
│                      /supabase/functions/ai-coach                │
├─────────────────────────────────────────────────────────────────┤
│  Auth Verification  │  OpenAI API Call  │  Response Parsing     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Core System Prompt (Week 1)
**Goal**: Replace generic coach with Adaptive Training Coach personality

#### 1.1 New System Prompt
**File**: `/lib/coachPrompts.ts` (new file)

```typescript
export const COACH_SYSTEM_PROMPT = `
You are Foundry Lab's Adaptive Training Coach.

Your job is to guide users toward progressive overload and long-term adaptation,
even when their training is inconsistent, disrupted, or planned only day-by-day.

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
When data is thin, be conservative and say so.
`;
```

#### 1.2 Mode Type Definition
**File**: `/types/coach.ts` (new file)

```typescript
export type CoachMode =
  | 'intake'              // Onboarding questions
  | 'reflect'             // Summarize understanding
  | 'history'             // Analyze recent training
  | 'phase'               // Determine current phase
  | 'weekly_planning'     // Sunday planning
  | 'daily'               // What should I do today?
  | 'post_workout'        // Evaluate completed session
  | 'explain'             // Why did you recommend this?
  | 'general';            // Free conversation

export type TrainingPhase =
  | 'rebuilding'          // Coming back from disruption
  | 'accumulating'        // Building volume/base
  | 'intensifying'        // Pushing load/intensity
  | 'maintaining'         // Holding steady
  | 'deloading';          // Recovery week

export interface CoachModeConfig {
  mode: CoachMode;
  systemPromptAddition: string;
  requiredContext: string[];
  suggestedFollowUp?: CoachMode;
}
```

#### Files to Modify:
- [ ] `/lib/coachContext.ts` - Replace `buildSystemPrompt()`
- [ ] `/hooks/useCoach.ts` - Add mode state and detection
- [ ] `/types/coach.ts` - New file with coach types

---

### Phase 2: Intake System (Week 1-2)
**Goal**: Conversational onboarding that asks questions one section at a time

#### 2.1 Intake Flow Design

```
Section 1: Goals
  → "What's your primary training goal right now?"
  → Wait for response
  → "Any secondary priorities?"

Section 2: Schedule
  → "How many days can you realistically train per week?"
  → "How long are your typical sessions?"

Section 3: Concurrent Training
  → "Are you doing any other training? Running, cycling, sports?"
  → If yes: "Roughly how many hours per week?"

Section 4: Constraints
  → "Any injuries or movements you need to avoid?"
  → "Any exercises you particularly love or hate?"

Section 5: Context
  → "Anything unusual coming up in the next 2-3 weeks? Travel, busy period?"
  → "How's your sleep and stress been lately?"

Section 6: Coaching Style
  → "How coached do you want to be? (flexible framework vs. precise prescriptions)"

→ REFLECT BACK understanding before programming
```

#### 2.2 Intake State Management
**File**: `/hooks/useCoachIntake.ts` (new file)

```typescript
interface IntakeState {
  currentSection: number;
  completedSections: string[];
  responses: {
    primary_goal?: string;
    secondary_goal?: string;
    days_per_week?: number;
    session_length?: number;
    concurrent_training?: string[];
    concurrent_hours?: number;
    injuries?: string;
    exercise_preferences?: string;
    exercise_aversions?: string;
    upcoming_disruptions?: string;
    sleep_quality?: number;
    stress_level?: number;
    autonomy_preference?: number;
  };
  isComplete: boolean;
}
```

#### 2.3 Intake Prompt Template
```typescript
export const INTAKE_PROMPTS = {
  section1_goals: `
I want to learn how you train and what you want right now.

Let's start simple: **What's your primary training goal right now?**

Are you trying to:
- Get stronger (lift heavier)
- Build muscle (hypertrophy)
- Lose fat while keeping muscle
- Improve for a sport or activity
- Just stay healthy and consistent

And is there a secondary thing you care about, or is it all about that one goal?
`,
  // ... more sections
};
```

#### Files to Create:
- [ ] `/hooks/useCoachIntake.ts` - Intake state management
- [ ] `/components/IntakeWizard.tsx` - Visual intake flow (optional, can use chat)
- [ ] `/lib/coachPrompts.ts` - Intake prompt templates

#### Files to Modify:
- [ ] `/types/database.ts` - Add intake fields to training_profiles
- [ ] `/hooks/useCoach.ts` - Integrate intake mode

---

### Phase 3: Context Enhancement (Week 2)
**Goal**: Build richer context for each interaction mode

#### 3.1 Extended History Context
**File**: `/lib/coachContext.ts`

```typescript
export async function buildHistoryContext(
  userId: string,
  weeks: number = 6
): Promise<HistoryContext> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - (weeks * 7));

  const { data: workouts } = await supabase
    .from('workouts')
    .select(`
      *,
      workout_sets(*, exercise:exercises(*))
    `)
    .eq('user_id', userId)
    .gte('date_completed', cutoffDate.toISOString())
    .order('date_completed', { ascending: false });

  return {
    totalWorkouts: workouts.length,
    workoutsPerWeek: calculateWorkoutsPerWeek(workouts),
    volumeByMuscleGroup: calculateVolumeByMuscle(workouts),
    progressionByExercise: analyzeProgression(workouts),
    missedWorkouts: detectMissedWorkouts(workouts),
    disruptions: detectDisruptions(workouts), // gaps, deloads
    patterns: {
      preferredDays: detectPreferredDays(workouts),
      typicalDuration: calculateTypicalDuration(workouts),
      splitPattern: detectSplitPattern(workouts),
    }
  };
}
```

#### 3.2 Phase Detection Logic
```typescript
export function detectCurrentPhase(
  history: HistoryContext,
  readiness: DailyReadiness | null,
  profile: TrainingProfile
): { phase: TrainingPhase; confidence: 'LOW' | 'MED' | 'HIGH'; reasoning: string } {

  // Rebuilding: Recent disruption (illness, travel, >7 day gap)
  if (history.disruptions.recentGap > 7) {
    return {
      phase: 'rebuilding',
      confidence: 'HIGH',
      reasoning: `You had a ${history.disruptions.recentGap}-day gap. We'll rebuild consistency before pushing.`
    };
  }

  // Deloading: Fatigue signals or scheduled deload
  if (readiness && readiness.readiness_score < 50) {
    return {
      phase: 'deloading',
      confidence: 'MED',
      reasoning: 'Your readiness is low. This week should be lighter.'
    };
  }

  // Accumulating: Steady volume, moderate intensity
  // Intensifying: Ramping load, reducing volume
  // Maintaining: Stable metrics

  // ... detection logic
}
```

#### 3.3 Disruption Tracking
Add to training_profiles or separate table:
```typescript
interface Disruption {
  type: 'illness' | 'travel' | 'injury' | 'life_stress' | 'schedule';
  start_date: string;
  end_date?: string;
  severity: 'minor' | 'moderate' | 'major';
  notes?: string;
}
```

#### Files to Modify:
- [ ] `/lib/coachContext.ts` - Add history analysis functions
- [ ] `/hooks/useCoachContext.ts` - Fetch extended history
- [ ] `/types/database.ts` - Add disruption tracking

---

### Phase 4: Mode-Specific Prompts (Week 2-3)
**Goal**: Implement all 8 interaction modes

#### 4.1 Mode Prompt Templates
**File**: `/lib/coachPrompts.ts`

```typescript
export const MODE_PROMPTS: Record<CoachMode, (context: CoachContext) => string> = {

  history: (ctx) => `
Based on the user's last 4-6 weeks of training, analyze:
- What patterns you see
- What has progressed
- What has stalled or regressed
- Where fatigue or disruption has affected progress

Speak plainly. No hype. This is where movement memory lives conceptually.

TRAINING HISTORY:
${formatHistoryForPrompt(ctx.history)}

MOVEMENT MEMORY (Key Exercises):
${formatMovementMemoryForPrompt(ctx.movementMemory)}
`,

  phase: (ctx) => `
Given the user's recent training and current context, determine which phase they're effectively in:
- rebuilding (coming back from disruption)
- accumulating (building volume/base)
- intensifying (pushing load)
- maintaining (holding steady)
- deloading (recovery)

Explain why in simple terms.

RECENT CONTEXT:
${formatRecentContext(ctx)}
`,

  weekly_planning: (ctx) => `
It's Sunday and the user wants to plan their week.

What you know:
- Goal: ${ctx.profile.primary_goal}
- Available days: ${ctx.profile.typical_weekly_days}
- Concurrent training: ${formatConcurrentTraining(ctx)}
- Recent disruptions: ${ctx.disruptions || 'None reported'}
- Current phase: ${ctx.detectedPhase}

Build a plan that:
- Enforces progressive overload where appropriate
- Rebuilds where data or recovery is weak
- Respects concurrent training load
- Does not overreach

Include:
- What to do each training day
- Clear progression targets (even if small)
- Optional substitutions if something feels off

After the plan, explain why you built it this way.
`,

  daily: (ctx) => `
Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long' })}.

Given the user's training history and goals:
- Tell them what they should do today
- What they're progressing from last time
- What would count as a successful session

If today should be lighter or different, explain why.

TODAY'S READINESS:
${formatReadiness(ctx.todayReadiness)}

LAST SESSION:
${formatLastSession(ctx.recentWorkouts[0])}
`,

  post_workout: (ctx) => `
The user just completed a workout. Compare what they did to what was expected.

Tell them:
- What progressed
- What stayed the same
- What needs adjustment next time
- What this means for their next session

This is where the engine learns.

EXPECTED:
${formatExpectedWorkout(ctx.expectedWorkout)}

ACTUAL:
${formatActualWorkout(ctx.completedWorkout)}
`,

  explain: (ctx) => `
The user asked "why" about a recent training decision.

Explain your reasoning in plain language.
Assume they're intelligent but busy.
No jargon unless it helps.

Reference specific data that informed the decision.
`,

  reflect: (ctx) => `
Summarize what you understand about how the user trains and what their priorities are.
Then explain, at a high level, how you will guide their training based on that.

Do not prescribe workouts yet. This ensures alignment before programming.

USER PROFILE:
${formatProfile(ctx.profile)}

DETECTED PATTERNS:
${formatPatterns(ctx.patterns)}

RECENT HISTORY:
${formatRecentHistory(ctx.history)}
`,

  general: (ctx) => `
Respond helpfully to the user's question while maintaining your coaching philosophy.
Reference their training data when relevant.
`
};
```

#### 4.2 Mode Detection from User Intent
```typescript
export function detectModeFromMessage(
  message: string,
  conversationHistory: CoachMessage[],
  context: CoachContext
): CoachMode {
  const lowerMessage = message.toLowerCase();

  // Explicit triggers
  if (lowerMessage.includes('plan my week') || lowerMessage.includes('sunday')) {
    return 'weekly_planning';
  }
  if (lowerMessage.includes('what should i do today')) {
    return 'daily';
  }
  if (lowerMessage.includes('just finished') || lowerMessage.includes('here\'s what i did')) {
    return 'post_workout';
  }
  if (lowerMessage.includes('why did you') || lowerMessage.includes('explain')) {
    return 'explain';
  }
  if (lowerMessage.includes('how have i been doing') || lowerMessage.includes('my progress')) {
    return 'history';
  }
  if (lowerMessage.includes('what phase') || lowerMessage.includes('where am i')) {
    return 'phase';
  }

  // Check if intake is needed
  if (!context.profile?.primary_goal || !context.intakeComplete) {
    return 'intake';
  }

  return 'general';
}
```

#### Files to Create/Modify:
- [ ] `/lib/coachPrompts.ts` - All mode prompts
- [ ] `/lib/modeDetection.ts` - Intent → mode mapping
- [ ] `/hooks/useCoach.ts` - Integrate mode detection

---

### Phase 5: Action Handlers (Week 3)
**Goal**: Make coach suggestions actionable

#### 5.1 Action Types
```typescript
export type CoachAction =
  | { type: 'adjust_workout'; workoutId: string; adjustments: WorkoutAdjustment[] }
  | { type: 'swap_exercise'; workoutId: string; oldExerciseId: string; newExerciseId: string }
  | { type: 'schedule_deload'; weekNumber: number }
  | { type: 'update_targets'; exerciseId: string; newTargets: Partial<SetTargets> }
  | { type: 'add_disruption'; disruption: Disruption }
  | { type: 'set_goal'; goal: GoalInsert }
  | { type: 'update_profile'; updates: Partial<TrainingProfile> };
```

#### 5.2 Action Handler Implementation
```typescript
export async function executeCoachAction(
  action: CoachAction,
  userId: string
): Promise<{ success: boolean; message: string }> {

  switch (action.type) {
    case 'adjust_workout': {
      const { workoutId, adjustments } = action;
      for (const adj of adjustments) {
        await supabase
          .from('workout_sets')
          .update({
            target_reps: adj.newReps,
            target_load: adj.newLoad,
            target_rpe: adj.newRPE,
          })
          .eq('workout_id', workoutId)
          .eq('exercise_id', adj.exerciseId);
      }
      return { success: true, message: 'Workout adjusted' };
    }

    case 'swap_exercise': {
      const { workoutId, oldExerciseId, newExerciseId } = action;
      await supabase
        .from('workout_sets')
        .update({ exercise_id: newExerciseId })
        .eq('workout_id', workoutId)
        .eq('exercise_id', oldExerciseId);
      return { success: true, message: 'Exercise swapped' };
    }

    case 'schedule_deload': {
      // Mark week as deload in training block
      // Reduce targets by 40-50%
    }

    // ... other actions
  }
}
```

#### Files to Modify:
- [ ] `/hooks/useCoach.ts` - Replace placeholder handlers (lines 559-594)
- [ ] `/lib/coachActions.ts` - New file with action execution

---

### Phase 6: UI Enhancements (Week 3-4)
**Goal**: Polish the coach interface

#### 6.1 Quick Action Buttons
When coach suggests an action, show actionable buttons:
```tsx
{message.suggestedAction && (
  <View style={styles.actionButtons}>
    <Pressable
      onPress={() => executeAction(message.suggestedAction)}
      style={styles.acceptButton}
    >
      <Text>Apply Changes</Text>
    </Pressable>
    <Pressable
      onPress={() => dismissAction()}
      style={styles.dismissButton}
    >
      <Text>Not Now</Text>
    </Pressable>
  </View>
)}
```

#### 6.2 Weekly Plan Display
New component for structured plan output:
```tsx
// /components/WeeklyPlanCard.tsx
export function WeeklyPlanCard({ plan }: { plan: WeeklyPlan }) {
  return (
    <LabCard>
      <Text style={styles.title}>This Week's Plan</Text>
      {plan.days.map(day => (
        <DayRow
          key={day.dayNumber}
          day={day}
          onPress={() => openDayDetail(day)}
        />
      ))}
      <Text style={styles.rationale}>{plan.rationale}</Text>
    </LabCard>
  );
}
```

#### 6.3 Mode Indicator
Show current coaching mode in header:
```tsx
<View style={styles.modeIndicator}>
  <Ionicons name={getModeIcon(currentMode)} size={16} />
  <Text>{getModeLabel(currentMode)}</Text>
</View>
```

#### Files to Create:
- [ ] `/components/WeeklyPlanCard.tsx`
- [ ] `/components/CoachActionButtons.tsx`
- [ ] `/components/ModeIndicator.tsx`

#### Files to Modify:
- [ ] `/components/CoachChat.tsx` - Add mode indicator, action buttons

---

## Database Changes

### New Tables

```sql
-- Track disruptions (illness, travel, etc.)
CREATE TABLE user_disruptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  disruption_type TEXT NOT NULL, -- 'illness', 'travel', 'injury', 'life_stress'
  start_date DATE NOT NULL,
  end_date DATE,
  severity TEXT DEFAULT 'moderate', -- 'minor', 'moderate', 'major'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track intake completion
ALTER TABLE training_profiles ADD COLUMN IF NOT EXISTS
  intake_completed_at TIMESTAMPTZ,
  intake_version TEXT,
  autonomy_preference INTEGER; -- 1-10 scale
```

### Migration File
**File**: `/supabase/migrations/018_coach_enhancements.sql`

---

## Testing Strategy

### Unit Tests
- [ ] Mode detection from user messages
- [ ] Phase detection from history
- [ ] Context building completeness
- [ ] Action handler correctness

### Integration Tests
- [ ] Full intake flow
- [ ] Weekly planning generation
- [ ] Post-workout comparison
- [ ] Action execution

### Manual Testing Scenarios
1. **New user intake**: Complete onboarding, verify reflect back
2. **Returning after illness**: Coach should detect and rebuild
3. **Sunday planning**: Generate week plan with progressive overload
4. **Daily mode**: Get appropriate workout for today
5. **Post-workout**: Log session, get analysis
6. **Explain reasoning**: Ask why, get clear answer

---

## File Summary

### New Files
```
/lib/coachPrompts.ts        - System prompt + mode prompts
/lib/modeDetection.ts       - Intent → mode mapping
/lib/coachActions.ts        - Action execution
/hooks/useCoachIntake.ts    - Intake state management
/types/coach.ts             - Coach-specific types
/components/WeeklyPlanCard.tsx
/components/CoachActionButtons.tsx
/supabase/migrations/018_coach_enhancements.sql
```

### Modified Files
```
/lib/coachContext.ts        - Enhanced context building
/hooks/useCoach.ts          - Mode integration, action handlers
/components/CoachChat.tsx   - UI enhancements
/types/database.ts          - New types
```

---

## Timeline

| Week | Phase | Deliverables |
|------|-------|--------------|
| 1 | Core System | New system prompt, mode types, basic mode detection |
| 1-2 | Intake | Conversational intake flow, profile updates |
| 2 | Context | Extended history analysis, phase detection |
| 2-3 | Modes | All 8 mode prompts implemented |
| 3 | Actions | Action handlers working |
| 3-4 | UI | Polish, quick actions, plan display |
| 4 | Testing | Full integration testing |

---

## Success Metrics

1. **Intake Completion Rate**: >80% of new users complete intake
2. **Weekly Planning Usage**: >50% of active users plan on Sunday
3. **Action Acceptance Rate**: >60% of suggested actions applied
4. **Retention**: Users with coach interaction retain 2x better
5. **Trust**: "Reflect back" step gets >90% alignment confirmation
