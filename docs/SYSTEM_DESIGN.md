# Foundry Lab — System Design Document

> **Mission**: Turn workouts into evidence and make progressive overload inevitable—whether users plan a year ahead or just show up today.

---

## Table of Contents

1. [Core Philosophy](#core-philosophy)
2. [Current State Analysis](#current-state-analysis)
3. [Gap Analysis](#gap-analysis)
4. [System Architecture](#system-architecture)
5. [Training Intelligence Model](#training-intelligence-model)
6. [Movement Memory System](#movement-memory-system)
7. [Confidence-Based Suggestions](#confidence-based-suggestions)
8. [Social Feed Architecture](#social-feed-architecture)
9. [Database Schema Enhancements](#database-schema-enhancements)
10. [Implementation Roadmap](#implementation-roadmap)

---

## Core Philosophy

### Non-Negotiable Principles

| # | Principle | System Implication |
|---|-----------|-------------------|
| 1 | **Progressive overload is the North Star** | Every feature must answer: "Does this help the user get stronger over time?" |
| 2 | **Logging first; planning emerges later** | Default UX is "Log Today". Programs are earned, not required. |
| 3 | **Every movement has memory** | System always surfaces last exposure (load, reps, sets, effort, date) before any set. |
| 4 | **No workout without context** | Every session is classified: `building`, `maintaining`, `deloading`, or `unstructured`. |
| 5 | **Honest feedback beats hype** | Clear labeling of progress, stagnation, regression. No motivational fluff. |

### Decision Framework

When facing trade-offs, choose:
- **Clarity** over cleverness
- **Progress** over participation
- **Truth** over hype

---

## Current State Analysis

### What's Already Built

| Feature | Status | Location |
|---------|--------|----------|
| Exercise library (strength + cardio) | ✅ Complete | `exercises` table, `/lib/exercises.ts` |
| Workout logging with sets/reps/RPE | ✅ Complete | `workout_sets` table, `/components/StrengthEntry.tsx` |
| Training blocks (6-week cycles) | ✅ Complete | `training_blocks` table |
| Workout context field | ✅ Complete | `workouts.context` enum |
| Auto-progression suggestions | ✅ Partial | `/lib/autoProgress.ts` |
| Progression detection | ✅ Complete | `/lib/progression.ts` |
| Personal records | ✅ Complete | `personal_records` table |
| Daily readiness | ✅ Complete | `daily_readiness` table |
| AI Coach conversations | ✅ Complete | `coach_*` tables |
| Social feed (posts, likes, follows) | ✅ Basic | `workout_posts`, `post_likes`, `follows` |
| Annual periodization | ✅ Complete | `annual_plans`, `planned_blocks` |

### Current Progression Logic

From `/lib/autoProgress.ts`:
```typescript
// Current: Binary decision based on RPE threshold
if (lastRPE < 7) → add 1 rep
if (lastRPE 7-8.5) → add 5 lb (or 2.5%)
if (lastRPE >= 9) → maintain
```

**Limitation**: No confidence scoring. No exposure counting. No pattern recognition.

---

## Gap Analysis

### Missing for Phase 1 (Log)

| Gap | Priority | Description |
|-----|----------|-------------|
| Ultra-fast logging UX | P0 | Default path should be "Log Today" with minimal friction |
| Whiteboard/photo OCR | P1 | Vision-based workout input for gym whiteboards |
| Low-confidence labels | P0 | Suggestions before 3 exposures must show "Low Confidence" |

### Missing for Phase 2 (Learn)

| Gap | Priority | Description |
|-----|----------|-------------|
| Exposure counting | P0 | Track per-exercise exposure count per user |
| Pattern detection | P1 | Detect training splits, common pairings, rep range preferences |
| Confidence upgrades | P0 | Promote Low → Medium → High based on data density |
| Day recognition | P2 | "This appears to be your Push A day" |

### Missing for Phase 3 (Suggest)

| Gap | Priority | Description |
|-----|----------|-------------|
| "Next Time" cards | P0 | Per-movement summary: last performance + recommendation + explanation |
| Regression handling | P1 | Detect and adapt when performance drops |
| Missed session detection | P1 | Adjust suggestions after gaps |
| Effort trend analysis | P1 | Detect RPE creep without load increase |

### Missing for Phase 4 (Structure)

| Gap | Priority | Description |
|-----|----------|-------------|
| Pattern lock-in | P2 | "Lock this in as a repeating split?" prompt |
| Block conversion | P2 | Convert organic patterns into formal training blocks |

### Missing for Social Feed

| Gap | Priority | Description |
|-----|----------|-------------|
| Key lift highlighting | P1 | Show main lifts, not "Weight Training — 1 hour" |
| Progression deltas | P1 | "+10 lbs vs last time" badges |
| Goal context | P1 | Display stated goal (Strength/Hypertrophy/Conditioning) |
| Consistency rewards | P2 | Badge system for streaks, adherence, block completion |

---

## System Architecture

### High-Level Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ Log Today│  │ History  │  │ Next Time│  │ Social Feed      │ │
│  │ (Default)│  │          │  │ Cards    │  │                  │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘ │
└───────┼─────────────┼─────────────┼─────────────────┼───────────┘
        │             │             │                 │
        ▼             ▼             ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TRAINING INTELLIGENCE LAYER                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ Movement     │  │ Confidence   │  │ Pattern              │   │
│  │ Memory       │  │ Engine       │  │ Recognition          │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘   │
│         │                 │                      │               │
│         ▼                 ▼                      ▼               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              PROGRESSION ENGINE                          │    │
│  │  • Suggestion Generation                                 │    │
│  │  • Regression Detection                                  │    │
│  │  • Context-Aware Adjustments                            │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ Workouts │  │ Exercise │  │ Movement │  │ User Training    │ │
│  │ + Sets   │  │ Library  │  │ History  │  │ Profile          │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Training Intelligence Model

### Phase 1: Log (Days 1–14)

**Goal**: Capture data with zero friction.

#### UX Flow

```
App Launch
    │
    ▼
┌─────────────────────┐
│   "Log Today"       │  ← Default action, always visible
│   [+ Start Workout] │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ Quick Add Exercise  │
│ • Search library    │
│ • Recent exercises  │  ← Show last 5-10 used
│ • Photo import (P1) │
└─────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ Movement Memory Card                │
│ ┌─────────────────────────────────┐ │
│ │ Bench Press                     │ │
│ │ Last: 185 lbs × 8 @ RPE 8       │ │
│ │ 3 days ago                      │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ SUGGESTED (Low Confidence)     │ │  ← Explicit label
│ │ 185 lbs × 9 reps               │ │
│ │ "Try +1 rep at same weight"    │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

#### Suggestion Logic (Phase 1)

```typescript
interface Phase1Suggestion {
  exercise_id: string;
  last_exposure: {
    weight: number;
    reps: number;
    rpe: number;
    date: Date;
  };
  suggestion: {
    weight: number;
    reps: number;
    target_rpe: number;
  };
  confidence: 'low';  // Always low in Phase 1
  reasoning: string;  // Human-readable explanation
}

function generatePhase1Suggestion(history: ExerciseHistory[]): Phase1Suggestion {
  const last = history[0];
  const exposureCount = history.length;

  // Always low confidence with < 3 exposures
  if (exposureCount < 3) {
    return {
      exercise_id: last.exercise_id,
      last_exposure: { ... },
      suggestion: calculateSafeOverload(last),
      confidence: 'low',
      reasoning: `Based on ${exposureCount} session${exposureCount > 1 ? 's' : ''}. ` +
                 `More data will improve suggestions.`
    };
  }
}

function calculateSafeOverload(last: ExerciseHistory): Suggestion {
  // Conservative defaults for new exercises
  if (last.rpe < 7) {
    return { ...last, reps: last.reps + 1 };  // +1 rep
  } else if (last.rpe <= 8.5) {
    return { ...last, weight: last.weight + 5 };  // +5 lbs
  } else {
    return { ...last };  // Maintain
  }
}
```

---

### Phase 2: Learn (After ~3 Exposures)

**Goal**: Build confidence through pattern recognition.

#### Confidence Scoring Algorithm

```typescript
type ConfidenceLevel = 'low' | 'medium' | 'high';

interface ConfidenceFactors {
  exposureCount: number;        // How many times logged
  recency: number;              // Days since last exposure
  consistency: number;          // Variance in rep ranges/weights
  rpeReporting: number;         // % of sets with RPE logged
}

function calculateConfidence(factors: ConfidenceFactors): ConfidenceLevel {
  let score = 0;

  // Exposure weight (max 40 points)
  if (factors.exposureCount >= 5) score += 40;
  else if (factors.exposureCount >= 3) score += 25;
  else score += factors.exposureCount * 5;

  // Recency weight (max 25 points)
  if (factors.recency <= 7) score += 25;
  else if (factors.recency <= 14) score += 15;
  else if (factors.recency <= 28) score += 5;
  // > 28 days = 0 points (stale data)

  // Consistency weight (max 20 points)
  // Low variance in rep ranges = more predictable = higher confidence
  score += Math.max(0, 20 - (factors.consistency * 2));

  // RPE reporting weight (max 15 points)
  score += factors.rpeReporting * 15;

  // Thresholds
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}
```

#### Pattern Detection

```typescript
interface DetectedPattern {
  type: 'training_split' | 'exercise_pairing' | 'rep_range_preference' | 'training_day';
  confidence: number;  // 0-1
  description: string;
  data: Record<string, any>;
}

// Example patterns to detect:
const patterns = [
  {
    type: 'training_split',
    detect: (workouts) => {
      // Look for Upper/Lower, Push/Pull/Legs, etc.
      const focuses = workouts.map(w => w.focus).filter(Boolean);
      return detectSplitPattern(focuses);
    }
  },
  {
    type: 'exercise_pairing',
    detect: (workouts) => {
      // "Bench and Incline DB usually done together"
      return detectCoOccurrence(workouts);
    }
  },
  {
    type: 'training_day',
    detect: (workouts) => {
      // "You usually train legs on Monday"
      return detectDayPreferences(workouts);
    }
  }
];
```

#### Day Recognition

After detecting patterns, surface insights:

```
┌─────────────────────────────────────────┐
│ 📊 Pattern Detected                     │
│                                         │
│ This looks like your "Push A" day.      │
│ You've done this 4 times in the last    │
│ 3 weeks.                                │
│                                         │
│ Exercises you usually include:          │
│ • Bench Press (100%)                    │
│ • Incline DB Press (75%)                │
│ • Tricep Pushdowns (75%)                │
│                                         │
│ [Use This Template] [Just Log Today]    │
└─────────────────────────────────────────┘
```

---

### Phase 3: Suggest (Rolling Plan)

**Goal**: Generate actionable "Next Time" guidance for every movement.

#### Next Time Card Schema

```typescript
interface NextTimeCard {
  exercise_id: string;
  exercise_name: string;

  // Last Performance
  last_performance: {
    weight: number;
    reps: number;
    sets: number;
    rpe: number;
    date: Date;
    workout_context: WorkoutContext;
  };

  // Recommendation
  recommendation: {
    weight: number;
    reps: number;
    sets: number;
    target_rpe: number;
  };

  // Meta
  confidence: ConfidenceLevel;
  reasoning: string;
  trend: 'progressing' | 'stagnant' | 'regressing';
  exposure_count: number;

  // Alerts (optional)
  alerts?: {
    type: 'missed_session' | 'rpe_creep' | 'regression' | 'plateau';
    message: string;
    suggested_action: string;
  }[];
}
```

#### Adaptive Suggestion Engine

```typescript
function generateNextTimeCard(
  exerciseId: string,
  history: ExerciseHistory[],
  userProfile: TrainingProfile,
  currentReadiness?: DailyReadiness
): NextTimeCard {

  const trend = detectTrend(history);
  const confidence = calculateConfidence(getConfidenceFactors(history));

  let suggestion: Recommendation;
  let reasoning: string;
  let alerts: Alert[] = [];

  // Handle different scenarios
  switch (trend) {
    case 'progressing':
      suggestion = calculateProgressiveOverload(history, userProfile);
      reasoning = generateProgressReasoning(history);
      break;

    case 'stagnant':
      // Plateau detection
      if (isPlateaued(history)) {
        alerts.push({
          type: 'plateau',
          message: `No progress in ${countStagnantSessions(history)} sessions`,
          suggested_action: 'Consider a deload week or rep range change'
        });
      }
      suggestion = suggestPlateauBreaker(history, userProfile);
      reasoning = 'Matched previous best. Time for a strategic change.';
      break;

    case 'regressing':
      alerts.push({
        type: 'regression',
        message: `Performance dropped from ${history[1].weight}×${history[1].reps} to ${history[0].weight}×${history[0].reps}`,
        suggested_action: 'Check recovery, sleep, and stress levels'
      });
      suggestion = suggestRecoveryLoad(history);
      reasoning = 'Recent regression detected. Suggesting recovery load.';
      break;
  }

  // Adjust for readiness if available
  if (currentReadiness && currentReadiness.readiness_score < 60) {
    suggestion = applyReadinessModifier(suggestion, currentReadiness);
    reasoning += ` Adjusted for ${currentReadiness.suggested_adjustment} readiness.`;
  }

  // Detect RPE creep (same load but higher RPE over time)
  if (detectRPECreep(history)) {
    alerts.push({
      type: 'rpe_creep',
      message: 'Effort increasing without load changes',
      suggested_action: 'May indicate fatigue accumulation. Consider deload.'
    });
  }

  // Detect missed sessions
  const daysSinceLast = daysBetween(history[0].date, new Date());
  if (daysSinceLast > 14) {
    alerts.push({
      type: 'missed_session',
      message: `${daysSinceLast} days since last ${exerciseName}`,
      suggested_action: 'Consider starting lighter to rebuild'
    });
    suggestion = suggestReturnLoad(history);
    reasoning = 'Extended break. Suggesting conservative return load.';
  }

  return { ... };
}
```

#### Trend Detection

```typescript
function detectTrend(history: ExerciseHistory[]): 'progressing' | 'stagnant' | 'regressing' {
  if (history.length < 2) return 'stagnant';

  // Compare estimated 1RMs over last 3-5 sessions
  const e1rms = history.slice(0, 5).map(h => calculateE1RM(h.weight, h.reps));

  const recent = e1rms.slice(0, 2).reduce((a, b) => a + b, 0) / 2;
  const older = e1rms.slice(2).reduce((a, b) => a + b, 0) / Math.max(1, e1rms.length - 2);

  const delta = (recent - older) / older;

  if (delta > 0.02) return 'progressing';  // > 2% improvement
  if (delta < -0.02) return 'regressing';   // > 2% decline
  return 'stagnant';
}
```

---

### Phase 4: Structure (Optional, Earned)

**Goal**: Offer formalization only after patterns stabilize.

#### Trigger Conditions

```typescript
interface StructurePromptTrigger {
  patternStability: number;     // Sessions with consistent pattern
  minimumExposures: number;     // Per exercise in pattern
  userEngagement: number;       // Completion rate
}

const STRUCTURE_THRESHOLDS: StructurePromptTrigger = {
  patternStability: 4,    // Same split pattern for 4+ sessions
  minimumExposures: 3,    // Each exercise logged 3+ times
  userEngagement: 0.8     // 80%+ workout completion rate
};

function shouldOfferStructure(
  patterns: DetectedPattern[],
  workouts: Workout[]
): { offer: boolean; type: 'split' | 'block'; pattern: DetectedPattern } | null {

  const splitPattern = patterns.find(p => p.type === 'training_split');

  if (!splitPattern || splitPattern.confidence < 0.7) {
    return null;
  }

  // Check stability
  const recentWorkouts = workouts.slice(0, 12);  // Last ~3-4 weeks
  const matchingCount = recentWorkouts.filter(w =>
    matchesPattern(w, splitPattern)
  ).length;

  if (matchingCount >= STRUCTURE_THRESHOLDS.patternStability) {
    return {
      offer: true,
      type: 'split',
      pattern: splitPattern
    };
  }

  return null;
}
```

#### Structure Prompt UX

```
┌─────────────────────────────────────────┐
│ 🔒 Ready to Lock This In?               │
│                                         │
│ You've been training consistently with  │
│ a Push/Pull/Legs split for 4 weeks.     │
│                                         │
│ Would you like to:                      │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ [Save as Repeating Split]           │ │
│ │ Quick-start future workouts         │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ [Convert to Training Block]         │ │
│ │ 6-week periodized program           │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [Keep Logging Day-by-Day]               │
│ (You can always do this later)          │
└─────────────────────────────────────────┘
```

---

## Movement Memory System

### Design Principle

> "Every movement has memory. The system must always remember the last exposure."

### Data Model

```typescript
interface MovementMemory {
  user_id: string;
  exercise_id: string;

  // Last exposure (always populated after first log)
  last_exposure: {
    workout_id: string;
    date: Date;
    sets: number;
    best_set: {
      weight: number;
      reps: number;
      rpe: number;
    };
    total_volume: number;  // sum of weight × reps across sets
    context: WorkoutContext;
  };

  // Aggregated stats
  exposure_count: number;
  first_logged: Date;
  personal_records: {
    weight: { value: number; date: Date };
    reps: { value: number; date: Date };  // at meaningful weight
    volume: { value: number; date: Date };  // single session
    e1rm: { value: number; date: Date };
  };

  // Progression meta
  confidence_level: ConfidenceLevel;
  trend: 'progressing' | 'stagnant' | 'regressing';
  avg_rpe: number;
  typical_rep_range: { min: number; max: number };
}
```

### Implementation: Materialized View or Computed

**Option A: Materialized View (Recommended)**

```sql
CREATE MATERIALIZED VIEW movement_memory AS
SELECT
  ws.exercise_id,
  w.user_id,

  -- Last exposure
  (
    SELECT jsonb_build_object(
      'workout_id', sub.workout_id,
      'date', sub.date_completed,
      'weight', sub.actual_weight,
      'reps', sub.actual_reps,
      'rpe', sub.actual_rpe
    )
    FROM workout_sets sub
    JOIN workouts sub_w ON sub.workout_id = sub_w.id
    WHERE sub.exercise_id = ws.exercise_id
      AND sub_w.user_id = w.user_id
      AND sub.actual_weight IS NOT NULL
    ORDER BY sub_w.date_completed DESC
    LIMIT 1
  ) AS last_exposure,

  -- Exposure count
  COUNT(DISTINCT w.id) AS exposure_count,

  -- First logged
  MIN(w.date_completed) AS first_logged,

  -- PRs
  MAX(ws.actual_weight) AS pr_weight,
  MAX(calculate_estimated_1rm(ws.actual_weight, ws.actual_reps)) AS pr_e1rm,

  -- Averages
  AVG(ws.actual_rpe) AS avg_rpe

FROM workout_sets ws
JOIN workouts w ON ws.workout_id = w.id
WHERE w.date_completed IS NOT NULL
  AND ws.is_warmup = false
GROUP BY ws.exercise_id, w.user_id;

-- Refresh strategy: after each workout completion
CREATE OR REPLACE FUNCTION refresh_movement_memory()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY movement_memory;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER refresh_memory_on_workout_complete
  AFTER UPDATE OF date_completed ON workouts
  FOR EACH ROW
  WHEN (NEW.date_completed IS NOT NULL AND OLD.date_completed IS NULL)
  EXECUTE FUNCTION refresh_movement_memory();
```

**Option B: Computed in Application Layer**

```typescript
// hooks/useMovementMemory.ts
export function useMovementMemory(exerciseId: string) {
  const { data: user } = useUser();

  return useQuery({
    queryKey: ['movement-memory', exerciseId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_sets')
        .select(`
          *,
          workout:workouts!inner(
            id,
            date_completed,
            user_id,
            context
          )
        `)
        .eq('exercise_id', exerciseId)
        .eq('workout.user_id', user.id)
        .not('workout.date_completed', 'is', null)
        .eq('is_warmup', false)
        .order('workout(date_completed)', { ascending: false })
        .limit(20);  // Last 20 exposures is enough for calculations

      if (error) throw error;
      return computeMovementMemory(data);
    },
    staleTime: 5 * 60 * 1000,  // 5 minutes
  });
}
```

### Movement Memory UI Component

```
┌─────────────────────────────────────────┐
│ 🏋️ SQUAT                                │
│                                         │
│ Last: 275 lbs × 5 @ RPE 8              │
│ 4 days ago • Building context           │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Trend: Progressing ↑                │ │
│ │ +15 lbs over last 4 weeks           │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ PRs: 315×1 (Weight) • 225×12 (Reps)    │
│ E1RM: 321 lbs                           │
│                                         │
│ ────────────────────────────────────── │
│                                         │
│ NEXT TIME (High Confidence)             │
│ 280 lbs × 5 @ RPE 8                    │
│ "+5 lbs. Last set felt controlled."    │
│                                         │
└─────────────────────────────────────────┘
```

---

## Confidence-Based Suggestions

### Confidence Level Definitions

| Level | Criteria | UI Treatment |
|-------|----------|--------------|
| **Low** | < 3 exposures OR > 28 days stale OR inconsistent data | Gray badge, "Based on limited data" |
| **Medium** | 3-5 exposures, < 14 days stale, moderate consistency | Yellow badge, no qualifier |
| **High** | > 5 exposures, < 7 days stale, consistent patterns, RPE logged | Green badge, "Based on your history" |

### Confidence Display Component

```tsx
// components/ConfidenceBadge.tsx
interface ConfidenceBadgeProps {
  level: 'low' | 'medium' | 'high';
  exposureCount: number;
}

export function ConfidenceBadge({ level, exposureCount }: ConfidenceBadgeProps) {
  const config = {
    low: {
      bg: 'bg-gray-100',
      text: 'text-gray-600',
      label: 'Low Confidence',
      tooltip: `Based on ${exposureCount} session${exposureCount !== 1 ? 's' : ''}. More data will improve suggestions.`
    },
    medium: {
      bg: 'bg-yellow-100',
      text: 'text-yellow-700',
      label: 'Suggested',
      tooltip: 'Based on recent training history.'
    },
    high: {
      bg: 'bg-green-100',
      text: 'text-green-700',
      label: 'Recommended',
      tooltip: 'Based on consistent training data.'
    }
  };

  const c = config[level];

  return (
    <View className={`${c.bg} px-2 py-1 rounded`}>
      <Text className={`${c.text} text-xs font-medium`}>
        {c.label}
      </Text>
    </View>
  );
}
```

---

## Social Feed Architecture

### Current State

The feed shows workout posts with:
- User info
- Caption
- Like count
- Post timestamp

### Enhanced Feed Requirements

| Requirement | Implementation |
|-------------|----------------|
| Key lifts highlighted | Extract top 2-3 lifts by volume or PR status |
| Progression deltas | Compare to previous exposure, show +/- |
| Stated goal | Pull from active training block or user profile |
| Consistency rewards | Calculate streak, adherence, block completion |

### Enhanced Post Schema

```typescript
interface EnhancedWorkoutPost {
  // Existing
  id: string;
  workout_id: string;
  user_id: string;
  caption: string;
  is_public: boolean;
  created_at: Date;

  // Enhanced (computed)
  workout_summary: {
    focus: string;  // "Push", "Legs", etc.
    duration_minutes: number;
    context: WorkoutContext;
    exercise_count: number;
  };

  key_lifts: Array<{
    exercise_name: string;
    best_set: {
      weight: number;
      reps: number;
    };
    progression?: {
      type: 'weight_increase' | 'rep_increase' | 'pr' | 'matched' | 'regressed';
      delta?: number;  // +10 lbs, +2 reps, etc.
      delta_label: string;  // "+10 lbs", "+2 reps"
    };
    is_pr: boolean;
  }>;

  goal_context?: {
    type: 'strength' | 'hypertrophy' | 'conditioning' | 'athletic';
    block_name?: string;
    phase?: string;
  };

  achievements?: Array<{
    type: 'pr' | 'streak' | 'block_complete' | 'consistency';
    label: string;
    icon: string;
  }>;
}
```

### Feed Item Component

```
┌─────────────────────────────────────────┐
│ 👤 Alex Chen                            │
│ Strength • Week 4 of "Summer Strength"  │
│                                         │
│ Push Day                                │
│ ─────────────────────────────────────── │
│                                         │
│ 🏆 Bench Press     225 × 5   +10 lbs ↑  │
│    Incline DB      80 × 8    PR! 🔥     │
│    Tricep Pushdown 60 × 12   matched    │
│                                         │
│ 45 min • Building context               │
│                                         │
│ "Felt strong today. Sleep is dialed."   │
│                                         │
│ ❤️ 12    💬 3    🔁 Share               │
│                                         │
│ 🔥 5-day streak • 92% adherence         │
└─────────────────────────────────────────┘
```

### Progression Badge Logic

```typescript
function getProgressionBadge(
  currentSet: WorkoutSet,
  previousSet: WorkoutSet | null
): ProgressionBadge | null {
  if (!previousSet) return null;

  const currentE1RM = calculateE1RM(currentSet.actual_weight, currentSet.actual_reps);
  const previousE1RM = calculateE1RM(previousSet.actual_weight, previousSet.actual_reps);

  // Check for PR
  if (currentSet.is_pr) {
    return {
      type: 'pr',
      label: 'PR! 🔥',
      color: 'text-orange-500'
    };
  }

  // Weight increase
  if (currentSet.actual_weight > previousSet.actual_weight) {
    const delta = currentSet.actual_weight - previousSet.actual_weight;
    return {
      type: 'weight_increase',
      label: `+${delta} lbs ↑`,
      delta,
      color: 'text-green-500'
    };
  }

  // Rep increase (same weight)
  if (
    currentSet.actual_weight === previousSet.actual_weight &&
    currentSet.actual_reps > previousSet.actual_reps
  ) {
    const delta = currentSet.actual_reps - previousSet.actual_reps;
    return {
      type: 'rep_increase',
      label: `+${delta} reps ↑`,
      delta,
      color: 'text-green-500'
    };
  }

  // E1RM increase (different weight/rep combo but higher estimated max)
  if (currentE1RM > previousE1RM * 1.02) {  // > 2% improvement
    return {
      type: 'e1rm_increase',
      label: 'Stronger ↑',
      color: 'text-green-500'
    };
  }

  // Matched
  if (Math.abs(currentE1RM - previousE1RM) / previousE1RM < 0.02) {
    return {
      type: 'matched',
      label: 'matched',
      color: 'text-gray-400'
    };
  }

  // Regressed
  return {
    type: 'regressed',
    label: `${Math.round((1 - currentE1RM / previousE1RM) * 100)}% ↓`,
    color: 'text-red-400'
  };
}
```

### Achievement System

```typescript
interface Achievement {
  id: string;
  type: 'pr' | 'streak' | 'block_complete' | 'consistency' | 'volume_milestone';
  label: string;
  description: string;
  icon: string;
  earned_at: Date;
}

const ACHIEVEMENT_DEFINITIONS = [
  {
    type: 'streak',
    thresholds: [3, 5, 7, 14, 30, 60, 90],
    labelFn: (days: number) => `${days}-Day Streak`,
    icon: '🔥'
  },
  {
    type: 'consistency',
    thresholds: [0.8, 0.9, 0.95, 1.0],
    labelFn: (rate: number) => `${Math.round(rate * 100)}% Adherence`,
    icon: '✅'
  },
  {
    type: 'block_complete',
    labelFn: (blockName: string) => `Completed: ${blockName}`,
    icon: '🏁'
  },
  {
    type: 'volume_milestone',
    thresholds: [100000, 250000, 500000, 1000000],  // lbs
    labelFn: (lbs: number) => `${(lbs / 1000).toFixed(0)}K lbs Moved`,
    icon: '💪'
  }
];
```

---

## Database Schema Enhancements

### New Tables

```sql
-- Movement Memory Cache (alternative to materialized view)
CREATE TABLE movement_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  exercise_id UUID REFERENCES exercises(id) ON DELETE CASCADE NOT NULL,

  -- Last exposure
  last_workout_id UUID REFERENCES workouts(id),
  last_date TIMESTAMPTZ,
  last_weight DECIMAL,
  last_reps INTEGER,
  last_rpe DECIMAL,
  last_context TEXT,

  -- Aggregates
  exposure_count INTEGER DEFAULT 0,
  first_logged TIMESTAMPTZ,
  avg_rpe DECIMAL,
  typical_rep_min INTEGER,
  typical_rep_max INTEGER,

  -- PRs
  pr_weight DECIMAL,
  pr_weight_date TIMESTAMPTZ,
  pr_e1rm DECIMAL,
  pr_e1rm_date TIMESTAMPTZ,

  -- Meta
  confidence_level TEXT CHECK (confidence_level IN ('low', 'medium', 'high')),
  trend TEXT CHECK (trend IN ('progressing', 'stagnant', 'regressing')),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, exercise_id)
);

-- Index for fast lookups
CREATE INDEX idx_movement_memory_user ON movement_memory(user_id);
CREATE INDEX idx_movement_memory_exercise ON movement_memory(exercise_id);

-- RLS
ALTER TABLE movement_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own movement memory"
  ON movement_memory FOR SELECT
  USING (auth.uid() = user_id);


-- Detected Patterns
CREATE TABLE detected_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  pattern_type TEXT NOT NULL CHECK (pattern_type IN (
    'training_split',
    'exercise_pairing',
    'rep_range_preference',
    'training_day'
  )),

  pattern_data JSONB NOT NULL,  -- Flexible storage for pattern details
  confidence DECIMAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),

  first_detected TIMESTAMPTZ DEFAULT NOW(),
  last_confirmed TIMESTAMPTZ DEFAULT NOW(),
  confirmation_count INTEGER DEFAULT 1,

  -- For prompting user to lock in
  offered_structure BOOLEAN DEFAULT FALSE,
  structure_accepted BOOLEAN,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_detected_patterns_user ON detected_patterns(user_id);

-- RLS
ALTER TABLE detected_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own patterns"
  ON detected_patterns FOR SELECT
  USING (auth.uid() = user_id);


-- User Achievements
CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  achievement_type TEXT NOT NULL CHECK (achievement_type IN (
    'pr', 'streak', 'block_complete', 'consistency', 'volume_milestone'
  )),

  achievement_data JSONB,  -- Flexible: { days: 7 } or { block_name: "..." }
  label TEXT NOT NULL,
  icon TEXT,

  earned_at TIMESTAMPTZ DEFAULT NOW(),

  -- For streak-type achievements, track if still active
  is_active BOOLEAN DEFAULT TRUE,

  -- Link to source (optional)
  workout_id UUID REFERENCES workouts(id),
  exercise_id UUID REFERENCES exercises(id),

  UNIQUE(user_id, achievement_type, achievement_data)
);

CREATE INDEX idx_user_achievements_user ON user_achievements(user_id);
CREATE INDEX idx_user_achievements_type ON user_achievements(achievement_type);

-- RLS
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own achievements"
  ON user_achievements FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Achievements visible on public posts"
  ON user_achievements FOR SELECT
  USING (
    user_id IN (
      SELECT user_id FROM workout_posts WHERE is_public = true
    )
  );
```

### Schema Modifications

```sql
-- Add confidence tracking to workout_sets suggestions
ALTER TABLE workout_sets ADD COLUMN IF NOT EXISTS
  suggestion_confidence TEXT CHECK (suggestion_confidence IN ('low', 'medium', 'high'));

ALTER TABLE workout_sets ADD COLUMN IF NOT EXISTS
  suggestion_reasoning TEXT;

-- Add pattern reference to workouts
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS
  matched_pattern_id UUID REFERENCES detected_patterns(id);

-- Enhance workout_posts for feed
ALTER TABLE workout_posts ADD COLUMN IF NOT EXISTS
  key_lifts JSONB;  -- Computed summary of top exercises

ALTER TABLE workout_posts ADD COLUMN IF NOT EXISTS
  achievements JSONB;  -- Achievements earned in this workout
```

---

## Implementation Roadmap

### Phase 1: Foundation (Movement Memory + Confidence)

**Scope**: Core data infrastructure for intelligent suggestions.

| Task | Type | Priority |
|------|------|----------|
| Create `movement_memory` table | DB | P0 |
| Build `useMovementMemory` hook | FE | P0 |
| Implement confidence calculation | Lib | P0 |
| Add `ConfidenceBadge` component | FE | P0 |
| Update progression suggestions with confidence | Lib | P0 |
| Surface Movement Memory in workout logging | FE | P0 |

**Success Metric**: Every exercise shows last exposure + confidence-labeled suggestion.

---

### Phase 2: Pattern Recognition

**Scope**: Learn user behavior and surface insights.

| Task | Type | Priority |
|------|------|----------|
| Create `detected_patterns` table | DB | P1 |
| Build pattern detection algorithms | Lib | P1 |
| Build `usePatternDetection` hook | FE | P1 |
| Create pattern insight UI components | FE | P1 |
| Add training split detection | Lib | P1 |
| Add exercise pairing detection | Lib | P2 |
| Add training day preferences | Lib | P2 |

**Success Metric**: System correctly identifies user's training split after 2 weeks.

---

### Phase 3: Next Time Cards

**Scope**: Actionable per-movement recommendations with explanations.

| Task | Type | Priority |
|------|------|----------|
| Design Next Time Card schema | Design | P0 |
| Build `NextTimeCard` component | FE | P0 |
| Implement trend detection | Lib | P1 |
| Add regression handling | Lib | P1 |
| Add missed session detection | Lib | P1 |
| Add RPE creep detection | Lib | P1 |
| Create Next Time summary view | FE | P1 |

**Success Metric**: Users see actionable, explained suggestions after every workout.

---

### Phase 4: Social Feed Enhancement

**Scope**: Meaningful social sharing focused on progress.

| Task | Type | Priority |
|------|------|----------|
| Compute key lifts from workout | Lib | P1 |
| Add progression badges to posts | FE | P1 |
| Add goal context to posts | FE | P1 |
| Create `user_achievements` table | DB | P2 |
| Implement achievement system | Lib | P2 |
| Display achievements in feed | FE | P2 |
| Add streak tracking | Lib | P2 |
| Add consistency badges | FE | P2 |

**Success Metric**: Feed posts show lifts with progression, not "Weight Training — 1 hour".

---

### Phase 5: Structure Offers

**Scope**: Optional formalization of organic patterns.

| Task | Type | Priority |
|------|------|----------|
| Detect pattern stability | Lib | P2 |
| Build structure offer prompt | FE | P2 |
| Implement "Lock as Split" flow | FE | P2 |
| Implement "Convert to Block" flow | FE | P2 |
| Track structure acceptance | DB | P2 |

**Success Metric**: Users with stable patterns are offered (not forced) structure.

---

### Phase 6: Advanced Input

**Scope**: Reduce friction for logging.

| Task | Type | Priority |
|------|------|----------|
| Integrate vision API for whiteboard OCR | BE | P1 |
| Build photo capture flow | FE | P1 |
| Parse OCR results to exercises | Lib | P1 |
| Voice input exploration | Research | P3 |

**Success Metric**: User can photograph gym whiteboard and log workout in < 60 seconds.

---

## Appendix: Key Files Reference

| File | Purpose |
|------|---------|
| `/lib/autoProgress.ts` | Current progression logic (to be enhanced) |
| `/lib/progression.ts` | Progression type detection |
| `/lib/adjustmentEngine.ts` | Readiness-based adjustments |
| `/hooks/useProgressionTargets.ts` | Fetch progression suggestions |
| `/components/StrengthEntry.tsx` | Set logging UI |
| `/app/(tabs)/index.tsx` | Dashboard (default entry point) |
| `/types/database.ts` | TypeScript types for schema |

---

## Conclusion

This system design transforms Foundry Lab from a workout logger into a **training intelligence system** that:

1. **Remembers everything** about every movement
2. **Learns** from user behavior without requiring upfront planning
3. **Suggests** progressively with appropriate confidence
4. **Surfaces truth** about progress, stagnation, and regression
5. **Offers structure** only when earned and wanted

The key insight: **Progressive overload becomes inevitable** when every session builds on the memory of the last, and every suggestion is grounded in real data.
