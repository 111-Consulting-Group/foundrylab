import { create } from 'zustand';
import type {
  Exercise,
  WorkoutSet,
  DailyReadiness,
  MovementMemory,
  WorkoutContext,
} from '@/types/database';

// ============================================================================
// FLUID SESSION TYPES
// ============================================================================

export type SetUIStatus = 'pending' | 'active' | 'completed';

export interface FluidSet extends Omit<WorkoutSet, 'id' | 'workout_id' | 'created_at' | 'updated_at'> {
  id: string;
  uiStatus: SetUIStatus;
  agentReasoning?: string;
  agentAdjusted?: boolean;
  missedReps?: boolean;
}

export interface FluidExercise {
  base: Exercise;
  sets: FluidSet[];
  context: {
    lastPerformance?: MovementMemory;
    suggestedWeight?: number;
    suggestedReps?: number;
  };
}

export type ModificationIntent =
  | 'pain'
  | 'too_hard'
  | 'too_easy'
  | 'fatigue'
  | 'skip_exercise'
  | 'add_set'
  | 'remove_set'
  | 'swap_exercise'
  | 'time_crunch'
  | 'travel'
  | 'sick';

export interface AgentDecision {
  type: 'weight_increase' | 'weight_decrease' | 'volume_adjustment' | 'exercise_swap' | 'rest_suggestion';
  reasoning: string;
  appliedAt: Date;
}

// ============================================================================
// TIMELINE-AWARE DISRUPTION HANDLING TYPES
// ============================================================================

export type LifeEventType = 'travel' | 'sickness' | 'injury' | 'stress';
export type BlockPhase = 'hypertrophy' | 'strength' | 'peaking' | 'deload' | 'transition';

export interface FutureAdjustment {
  id: string;
  week: number;
  day: number;
  action: 'add_volume' | 'reduce_intensity' | 'extend_block' | 'add_deload' | 'swap_exercise';
  targetExerciseId?: string;
  targetExerciseName?: string;
  volumeModifier?: number; // e.g., 1.1 for +10%
  reason: string;
  createdAt: Date;
  appliedAt?: Date;
}

export interface CurrentBlockStatus {
  blockId?: string;
  blockName?: string;
  phase: BlockPhase;
  weeksRemaining: number;
  weekNumber: number;
  totalWeeks: number;
  adherenceRate: number; // 0-100%
  volumeDebt: number; // Accumulated "lost" volume that needs makeup
}

// ============================================================================
// MORNING CONTEXT INJECTION TYPES
// ============================================================================

export type ReadinessSignal = 'green' | 'amber' | 'red' | 'neutral';

export interface MorningContextInjection {
  signal: ReadinessSignal;
  readinessScore: number;
  sleepQuality: number;
  soreness: number;
  appliedAdjustments: {
    type: 'joker_set_added' | 'accessory_volume_reduced' | 'full_volume_reduced' | 'none';
    affectedExercises: string[];
    reasoning: string;
  };
  timestamp: Date;
}

// ============================================================================
// STORE STATE INTERFACE
// ============================================================================

// Callback type for set completion - allows external persistence
export type OnSetCompletedCallback = (data: {
  exerciseId: string;
  setId: string;
  setOrder: number;
  targetReps: number | null;
  targetRpe: number | null;
  targetLoad: number | null;
  actualWeight: number;
  actualReps: number;
  actualRpe: number;
}) => void;

interface FluidSessionState {
  // Session state
  isActive: boolean;
  sessionStartTime: Date | null;
  sessionQueue: FluidExercise[];
  activeExerciseIndex: number;
  activeSetIndex: number;

  // Agent state
  agentMessage: string | null;
  agentDecisions: AgentDecision[];
  readinessContext: DailyReadiness | null;

  // Workout context
  workoutContext: WorkoutContext;
  workoutId: string | null;

  // Persistence callback
  onSetCompleted: OnSetCompletedCallback | null;

  // Macro context (Periodization Copilot)
  currentBlockStatus: CurrentBlockStatus | null;
  futureAdjustments: FutureAdjustment[];

  // Morning Context Injection (why the workout was modified)
  morningContext: MorningContextInjection | null;

  // Actions
  initializeSession: (
    templateQueue: FluidExercise[],
    readiness: DailyReadiness | null,
    history: MovementMemory[],
    workoutContext?: WorkoutContext,
    workoutId?: string | null
  ) => void;

  setWorkoutId: (id: string) => void;
  setOnSetCompleted: (callback: OnSetCompletedCallback | null) => void;
  setCurrentBlockStatus: (status: CurrentBlockStatus | null) => void;

  logSet: (
    exerciseId: string,
    setId: string,
    result: { rpe: number; weight: number; reps: number }
  ) => void;

  requestModification: (intent: ModificationIntent, context?: string) => void;
  handleLifeEvent: (eventType: LifeEventType, durationDays: number) => void;

  advanceToNextSet: () => void;
  advanceToNextExercise: () => void;

  addExerciseToSession: (exercise: Exercise, memory?: MovementMemory) => void;
  removeExerciseFromSession: (exerciseId: string) => void;

  dismissAgentMessage: () => void;
  clearFutureAdjustment: (adjustmentId: string) => void;
  endSession: () => void;
  resetSession: () => void;

  // Selectors
  getCurrentExercise: () => FluidExercise | null;
  getCurrentSet: () => FluidSet | null;
  getSessionProgress: () => { completed: number; total: number; percentage: number };
  getCompletedSets: () => { exerciseId: string; sets: FluidSet[] }[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateSetId(): string {
  return `fluid-set-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function calculateSuggestedWeight(
  memory: MovementMemory | undefined,
  readiness: DailyReadiness | null
): number | undefined {
  if (!memory?.last_weight) return undefined;

  let baseWeight = memory.last_weight;

  // Adjust based on readiness
  if (readiness) {
    const readinessScore = readiness.readiness_score;
    if (readinessScore < 50) {
      // Low readiness: suggest 90% of last weight
      baseWeight = Math.round(baseWeight * 0.9);
    } else if (readinessScore > 80) {
      // High readiness: suggest slight increase
      baseWeight = Math.round(baseWeight * 1.025);
    }
  }

  // Round to nearest 2.5 (for plates)
  return Math.round(baseWeight / 2.5) * 2.5;
}

function buildInitialSets(
  exercise: Exercise,
  memory: MovementMemory | undefined,
  readiness: DailyReadiness | null
): FluidSet[] {
  const suggestedWeight = calculateSuggestedWeight(memory, readiness);
  const defaultSets = memory?.last_sets || 3;
  const defaultReps = memory?.typical_rep_max || 8;
  const defaultRpe = memory?.avg_rpe || 7;

  const sets: FluidSet[] = [];

  for (let i = 0; i < defaultSets; i++) {
    sets.push({
      id: generateSetId(),
      exercise_id: exercise.id,
      set_order: i + 1,
      target_reps: defaultReps,
      target_rpe: defaultRpe,
      target_load: suggestedWeight || null,
      tempo: null,
      actual_weight: null,
      actual_reps: null,
      actual_rpe: null,
      avg_watts: null,
      avg_hr: null,
      duration_seconds: null,
      distance_meters: null,
      avg_pace: null,
      notes: null,
      is_warmup: false,
      is_pr: false,
      progression_type: null,
      previous_set_id: null,
      segment_type: 'work',
      uiStatus: i === 0 ? 'active' : 'pending',
    });
  }

  return sets;
}

/**
 * Builds a FluidExercise queue from raw exercises and movement memory.
 * This is used by callers to prepare the templateQueue before calling initializeSession.
 */
export function buildFluidQueue(
  exercises: Exercise[],
  history: MovementMemory[],
  readiness: DailyReadiness | null
): FluidExercise[] {
  // Build memory lookup by exercise_id
  const memoryByExercise = new Map<string, MovementMemory>();
  history.forEach((mem) => {
    memoryByExercise.set(mem.exercise_id, mem);
  });

  return exercises.map((exercise) => {
    const memory = memoryByExercise.get(exercise.id);
    const suggestedWeight = calculateSuggestedWeight(memory, readiness);

    return {
      base: exercise,
      sets: buildInitialSets(exercise, memory, readiness),
      context: {
        lastPerformance: memory,
        suggestedWeight,
        suggestedReps: memory?.typical_rep_max || 8,
      },
    };
  });
}

/**
 * Identifies if an exercise is a compound lift based on common movement patterns.
 * Compound lifts involve multiple joints and major muscle groups.
 */
function isCompoundLift(exercise: Exercise): boolean {
  const compoundPatterns = [
    /squat/i,
    /deadlift/i,
    /bench\s*press/i,
    /overhead\s*press/i,
    /military\s*press/i,
    /row/i,
    /pull[\s-]?up/i,
    /chin[\s-]?up/i,
    /clean/i,
    /snatch/i,
    /lunge/i,
    /dip/i,
    /press/i, // General press movements
  ];

  const exerciseName = exercise.name.toLowerCase();
  return compoundPatterns.some((pattern) => pattern.test(exerciseName));
}

/**
 * Identifies if an exercise is an accessory/isolation movement.
 * Accessory exercises are single-joint movements that target specific muscles.
 */
function isAccessoryExercise(exercise: Exercise): boolean {
  // Accessory exercises are generally NOT compound lifts
  // But we can also explicitly identify common accessories
  const accessoryPatterns = [
    /curl/i,
    /extension/i,
    /fly/i,
    /flye/i,
    /raise/i, // lateral raise, front raise
    /kickback/i,
    /pushdown/i,
    /pullover/i,
    /shrug/i,
    /calf/i,
    /ab\s/i,
    /crunch/i,
    /plank/i,
    /face\s*pull/i,
    /reverse\s*fly/i,
    /cable/i,
    /machine/i,
    /isolation/i,
  ];

  const exerciseName = exercise.name.toLowerCase();

  // If explicitly matches accessory patterns, it's an accessory
  if (accessoryPatterns.some((pattern) => pattern.test(exerciseName))) {
    return true;
  }

  // Otherwise, it's an accessory if it's NOT a compound
  return !isCompoundLift(exercise);
}

// ============================================================================
// AGENT LOGIC
// ============================================================================

interface AgentAnalysis {
  shouldAdjustWeight: boolean;
  weightMultiplier: number;
  reasoning: string;
  message: string;
  suggestRest: boolean;
  missedReps: boolean;
}

function analyzeSetPerformance(
  result: { rpe: number; weight: number; reps: number },
  targetRpe: number | null,
  targetReps: number | null,
  isLastSet: boolean
): AgentAnalysis {
  const { rpe, reps } = result;
  const effectiveTargetRpe = targetRpe ?? 8;
  const effectiveTargetReps = targetReps ?? 8;

  // -------------------------------------------------------------------------
  // SCENARIO C (Failure): Missed Reps - Check FIRST as it takes priority
  // If actual_reps < target_reps: Suggest rest, don't auto-change weight, flag set
  // -------------------------------------------------------------------------
  if (reps < effectiveTargetReps) {
    return {
      shouldAdjustWeight: false,
      weightMultiplier: 1,
      reasoning: '',
      message: "You missed reps. Take an extra 90s rest before the next set.",
      suggestRest: true,
      missedReps: true,
    };
  }

  // -------------------------------------------------------------------------
  // SCENARIO A (Too Easy): RPE significantly under target
  // If actual_rpe <= 6 AND target_rpe >= 8: Increase next set weight by 5%
  // -------------------------------------------------------------------------
  if (rpe <= 6 && effectiveTargetRpe >= 8) {
    return {
      shouldAdjustWeight: true,
      weightMultiplier: 1.05, // +5%
      reasoning: `Previous set RPE ${rpe} (Target ${effectiveTargetRpe}). +5% load.`,
      message: "That looked easy! I've bumped up the weight for your next set.",
      suggestRest: false,
      missedReps: false,
    };
  }

  // -------------------------------------------------------------------------
  // SCENARIO B (Overshoot): Near failure - need to back off
  // If actual_rpe >= 9.5 AND not the last set: Decrease by 5-10%
  // -------------------------------------------------------------------------
  if (rpe >= 9.5 && !isLastSet) {
    // Use 7.5% backoff (middle of 5-10% range)
    return {
      shouldAdjustWeight: true,
      weightMultiplier: 0.925, // -7.5%
      reasoning: 'Near failure detected. Dropping load to maintain volume.',
      message: "That was a grinder. I'm backing off the weight to keep quality high.",
      suggestRest: false,
      missedReps: false,
    };
  }

  // -------------------------------------------------------------------------
  // Additional case: Moderately easy (RPE 6-7 with target >= 8)
  // Slight bump to dial in intensity
  // -------------------------------------------------------------------------
  if (rpe <= 7 && rpe > 6 && effectiveTargetRpe >= 8) {
    return {
      shouldAdjustWeight: true,
      weightMultiplier: 1.025, // +2.5%
      reasoning: `RPE ${rpe} slightly under target ${effectiveTargetRpe}. +2.5% load.`,
      message: "Solid set. Let's add a little weight.",
      suggestRest: false,
      missedReps: false,
    };
  }

  // -------------------------------------------------------------------------
  // Goldilocks zone - no adjustment needed
  // -------------------------------------------------------------------------
  return {
    shouldAdjustWeight: false,
    weightMultiplier: 1,
    reasoning: '',
    message: '',
    suggestRest: false,
    missedReps: false,
  };
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useFluidSessionStore = create<FluidSessionState>((set, get) => ({
  // Initial state
  isActive: false,
  sessionStartTime: null,
  sessionQueue: [],
  activeExerciseIndex: 0,
  activeSetIndex: 0,
  agentMessage: null,
  agentDecisions: [],
  readinessContext: null,
  workoutContext: 'building',
  workoutId: null,
  onSetCompleted: null,

  // Macro context (Periodization Copilot)
  currentBlockStatus: null,
  futureAdjustments: [],

  // Morning Context Injection
  morningContext: null,

  // -------------------------------------------------------------------------
  // PERSISTENCE HELPERS
  // -------------------------------------------------------------------------
  setWorkoutId: (id) => set({ workoutId: id }),
  setOnSetCompleted: (callback) => set({ onSetCompleted: callback }),
  setCurrentBlockStatus: (status) => set({ currentBlockStatus: status }),

  // -------------------------------------------------------------------------
  // INITIALIZE SESSION (with Morning Context Injection)
  // -------------------------------------------------------------------------
  initializeSession: (templateQueue, readiness, history, workoutContext = 'building', workoutId = null) => {
    // Build memory lookup by exercise_id (for context enrichment if needed)
    const memoryByExercise = new Map<string, MovementMemory>();
    history.forEach((mem) => {
      memoryByExercise.set(mem.exercise_id, mem);
    });

    // Clone the template queue to avoid mutating the original
    let sessionQueue: FluidExercise[] = templateQueue.map((fluidEx) => ({
      ...fluidEx,
      sets: fluidEx.sets.map((s) => ({ ...s })),
      context: { ...fluidEx.context },
    }));

    // Determine agent message and apply readiness-based adjustments
    let agentMessage = 'Session initialized. Let\'s get to work.';
    let morningContext: MorningContextInjection | null = null;

    if (readiness) {
      const score = readiness.readiness_score;
      const sleepQuality = readiness.sleep_quality;
      const soreness = readiness.muscle_soreness;

      // =====================================================================
      // GREEN LIGHT: readiness_score >= 80 AND sleep_quality >= 4
      // Add a "Joker Set" at 105% intensity to the primary compound lift
      // =====================================================================
      if (score >= 80 && sleepQuality >= 4) {
        const firstCompoundIndex = sessionQueue.findIndex((fluidEx) =>
          isCompoundLift(fluidEx.base)
        );

        if (firstCompoundIndex !== -1) {
          const compoundExercise = sessionQueue[firstCompoundIndex];
          const lastSet = compoundExercise.sets[compoundExercise.sets.length - 1];

          // Calculate 105% intensity for the Joker Set
          const jokerLoad = lastSet.target_load
            ? Math.round((lastSet.target_load * 1.05) / 2.5) * 2.5
            : null;

          // Create a Joker Set at 105% intensity
          const jokerSet: FluidSet = {
            ...lastSet,
            id: `fluid-set-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            set_order: compoundExercise.sets.length + 1,
            target_load: jokerLoad,
            target_reps: lastSet.target_reps ? Math.max(lastSet.target_reps - 2, 1) : 3, // Slightly fewer reps for heavier load
            target_rpe: 9, // Push it
            actual_weight: null,
            actual_reps: null,
            actual_rpe: null,
            uiStatus: 'pending',
            agentReasoning: 'Joker Set @ 105% - you earned this',
            agentAdjusted: true,
          };

          sessionQueue[firstCompoundIndex] = {
            ...compoundExercise,
            sets: [...compoundExercise.sets, jokerSet],
          };

          agentMessage = "Green light today. I've unlocked a Joker Set for your main lift. Go for it if you feel good.";

          morningContext = {
            signal: 'green',
            readinessScore: score,
            sleepQuality,
            soreness,
            appliedAdjustments: {
              type: 'joker_set_added',
              affectedExercises: [compoundExercise.base.name],
              reasoning: `Sleep quality (${sleepQuality}/5) and readiness (${score}) indicate peak performance potential. Added 105% intensity Joker Set to ${compoundExercise.base.name}.`,
            },
            timestamp: new Date(),
          };
        } else {
          // No compound lift found, neutral context
          morningContext = {
            signal: 'green',
            readinessScore: score,
            sleepQuality,
            soreness,
            appliedAdjustments: {
              type: 'none',
              affectedExercises: [],
              reasoning: 'Green light conditions met but no compound lift in session to add Joker Set.',
            },
            timestamp: new Date(),
          };
        }
      }
      // =====================================================================
      // AMBER LIGHT: readiness_score < 50 OR soreness > 4
      // Reduce volume: Remove the last set from ACCESSORY exercises only
      // =====================================================================
      else if (score < 50 || soreness > 4) {
        const affectedExercises: string[] = [];

        sessionQueue = sessionQueue.map((fluidEx) => {
          // Only reduce accessory exercises, preserve compound volume
          if (isAccessoryExercise(fluidEx.base) && fluidEx.sets.length > 1) {
            affectedExercises.push(fluidEx.base.name);

            // Remove the last set
            const reducedSets = fluidEx.sets.slice(0, -1);
            // Re-number set_order and reset UI status
            return {
              ...fluidEx,
              sets: reducedSets.map((s, idx) => ({
                ...s,
                set_order: idx + 1,
                uiStatus: idx === 0 ? ('active' as SetUIStatus) : ('pending' as SetUIStatus),
              })),
            };
          }
          return fluidEx;
        });

        const amberReason = score < 50
          ? `Low readiness score (${score})`
          : `High soreness (${soreness}/5)`;

        agentMessage = "Recovery metrics are down. I've trimmed the accessory volume to preserve your CNS for the main work.";

        morningContext = {
          signal: 'amber',
          readinessScore: score,
          sleepQuality,
          soreness,
          appliedAdjustments: {
            type: 'accessory_volume_reduced',
            affectedExercises,
            reasoning: `${amberReason}. Removed last set from ${affectedExercises.length} accessory exercise(s) to protect recovery while maintaining compound stimulus.`,
          },
          timestamp: new Date(),
        };
      }
      // =====================================================================
      // RED LIGHT: readiness_score < 40 (severe fatigue override)
      // This takes precedence - reduce ALL volume, not just accessories
      // =====================================================================
      else if (score < 40) {
        const affectedExercises: string[] = [];

        sessionQueue = sessionQueue.map((fluidEx) => {
          if (fluidEx.sets.length > 1) {
            affectedExercises.push(fluidEx.base.name);

            // Remove the last set from ALL exercises
            const reducedSets = fluidEx.sets.slice(0, -1);
            return {
              ...fluidEx,
              sets: reducedSets.map((s, idx) => ({
                ...s,
                set_order: idx + 1,
                uiStatus: idx === 0 ? ('active' as SetUIStatus) : ('pending' as SetUIStatus),
              })),
            };
          }
          return fluidEx;
        });

        agentMessage = "Recovery is critical today. I've stripped back the volume to keep you moving without digging a deeper hole.";

        morningContext = {
          signal: 'red',
          readinessScore: score,
          sleepQuality,
          soreness,
          appliedAdjustments: {
            type: 'full_volume_reduced',
            affectedExercises,
            reasoning: `Critically low readiness (${score}). Reduced volume across all ${affectedExercises.length} exercises to prevent overreaching.`,
          },
          timestamp: new Date(),
        };
      }
      // =====================================================================
      // NEUTRAL: No significant adjustments needed
      // =====================================================================
      else {
        morningContext = {
          signal: 'neutral',
          readinessScore: score,
          sleepQuality,
          soreness,
          appliedAdjustments: {
            type: 'none',
            affectedExercises: [],
            reasoning: 'Readiness metrics within normal range. Standard session volume applied.',
          },
          timestamp: new Date(),
        };
      }
    }

    // Ensure proper UI status on first exercise's first set
    if (sessionQueue.length > 0 && sessionQueue[0].sets.length > 0) {
      sessionQueue[0].sets[0].uiStatus = 'active';
    }

    set({
      isActive: true,
      sessionStartTime: new Date(),
      sessionQueue,
      activeExerciseIndex: 0,
      activeSetIndex: 0,
      agentMessage,
      agentDecisions: [],
      readinessContext: readiness,
      workoutContext,
      workoutId,
      morningContext,
    });
  },

  // -------------------------------------------------------------------------
  // LOG SET - Core agent logic lives here
  // -------------------------------------------------------------------------
  logSet: (exerciseId, setId, result) => {
    const state = get();
    const { sessionQueue, activeExerciseIndex } = state;

    // Find the exercise and set
    const exerciseIdx = sessionQueue.findIndex((ex) => ex.base.id === exerciseId);
    if (exerciseIdx === -1) return;

    const exercise = sessionQueue[exerciseIdx];
    const setIdx = exercise.sets.findIndex((s) => s.id === setId);
    if (setIdx === -1) return;

    const currentSet = exercise.sets[setIdx];
    const nextSet = exercise.sets[setIdx + 1];
    const isLastSet = !nextSet;

    // Analyze performance with isLastSet context
    const analysis = analyzeSetPerformance(
      result,
      currentSet.target_rpe,
      currentSet.target_reps,
      isLastSet
    );

    // Build updated sets array
    const updatedSets = [...exercise.sets];

    // Update current set with actual values and flag missed reps if applicable
    updatedSets[setIdx] = {
      ...currentSet,
      actual_weight: result.weight,
      actual_reps: result.reps,
      actual_rpe: result.rpe,
      uiStatus: 'completed' as SetUIStatus,
      missedReps: analysis.missedReps || undefined,
    };

    // Call persistence callback if registered
    const { onSetCompleted } = state;
    if (onSetCompleted) {
      onSetCompleted({
        exerciseId,
        setId,
        setOrder: currentSet.set_order,
        targetReps: currentSet.target_reps,
        targetRpe: currentSet.target_rpe,
        targetLoad: currentSet.target_load,
        actualWeight: result.weight,
        actualReps: result.reps,
        actualRpe: result.rpe,
      });
    }

    // Track if we need to record an agent decision
    let newDecision: AgentDecision | null = null;

    // Handle the three scenarios for next set adjustments
    if (nextSet) {
      if (analysis.shouldAdjustWeight) {
        // SCENARIO A or B: Weight adjustment needed
        const newTargetLoad = Math.round(
          (result.weight * analysis.weightMultiplier) / 2.5
        ) * 2.5; // Round to nearest 2.5

        updatedSets[setIdx + 1] = {
          ...nextSet,
          target_load: newTargetLoad,
          agentReasoning: analysis.reasoning,
          agentAdjusted: true,
          uiStatus: 'active' as SetUIStatus,
        };

        // Record the decision
        newDecision = {
          type: analysis.weightMultiplier > 1 ? 'weight_increase' : 'weight_decrease',
          reasoning: analysis.reasoning,
          appliedAt: new Date(),
        };
      } else if (analysis.suggestRest) {
        // SCENARIO C: Missed reps - suggest rest but don't change weight
        // Just activate next set without weight adjustment
        updatedSets[setIdx + 1] = {
          ...nextSet,
          uiStatus: 'active' as SetUIStatus,
        };

        // Record rest suggestion decision
        newDecision = {
          type: 'rest_suggestion',
          reasoning: 'Missed target reps - extended rest recommended',
          appliedAt: new Date(),
        };
      } else {
        // Goldilocks zone - just activate the next set
        updatedSets[setIdx + 1] = {
          ...nextSet,
          uiStatus: 'active' as SetUIStatus,
        };
      }
    }

    // Build updated queue
    const updatedQueue = [...sessionQueue];
    updatedQueue[exerciseIdx] = {
      ...exercise,
      sets: updatedSets,
    };

    // Determine new active set index
    const newActiveSetIndex = nextSet ? setIdx + 1 : setIdx;

    // Check if we need to advance to next exercise
    const isLastSetOfExercise = !nextSet;
    const hasNextExercise = exerciseIdx < sessionQueue.length - 1;

    if (isLastSetOfExercise && hasNextExercise) {
      // Advance to next exercise
      const nextExerciseIdx = exerciseIdx + 1;
      const nextExercise = sessionQueue[nextExerciseIdx];

      // Activate first set of next exercise
      const nextExerciseSets = nextExercise.sets.map((s, idx) => ({
        ...s,
        uiStatus: (idx === 0 ? 'active' : 'pending') as SetUIStatus,
      }));

      updatedQueue[nextExerciseIdx] = {
        ...nextExercise,
        sets: nextExerciseSets,
      };

      const nextExerciseMessage = `Moving to ${nextExercise.base.name}. ${
        nextExercise.context.lastPerformance
          ? `Last time: ${nextExercise.context.lastPerformance.last_weight}lbs × ${nextExercise.context.lastPerformance.last_reps}`
          : 'First time logging this movement.'
      }`;

      set((state) => ({
        sessionQueue: updatedQueue,
        activeExerciseIndex: nextExerciseIdx,
        activeSetIndex: 0,
        agentMessage: nextExerciseMessage,
        agentDecisions: newDecision
          ? [...state.agentDecisions, newDecision]
          : state.agentDecisions,
      }));
    } else if (isLastSetOfExercise && !hasNextExercise) {
      // Session complete
      set((state) => ({
        sessionQueue: updatedQueue,
        activeSetIndex: newActiveSetIndex,
        agentMessage: 'Session complete! Great work today.',
        agentDecisions: newDecision
          ? [...state.agentDecisions, newDecision]
          : state.agentDecisions,
      }));
    } else {
      // Normal case - advance to next set
      set((state) => ({
        sessionQueue: updatedQueue,
        activeSetIndex: newActiveSetIndex,
        agentMessage: analysis.message || null,
        agentDecisions: newDecision
          ? [...state.agentDecisions, newDecision]
          : state.agentDecisions,
      }));
    }
  },

  // -------------------------------------------------------------------------
  // REQUEST MODIFICATION - User-initiated adjustments
  // -------------------------------------------------------------------------
  requestModification: (intent, context) => {
    const state = get();
    const { sessionQueue, activeExerciseIndex, activeSetIndex } = state;

    if (sessionQueue.length === 0) return;

    const exercise = sessionQueue[activeExerciseIndex];
    if (!exercise) return;

    const updatedQueue = [...sessionQueue];
    let agentMessage = '';
    let decision: AgentDecision | null = null;

    switch (intent) {
      case 'pain': {
        // Swap to a safer variation or skip
        agentMessage = 'Pain reported. Consider reducing load or swapping to a pain-free variation. Let me know if you need to skip this movement.';
        decision = {
          type: 'rest_suggestion',
          reasoning: `Pain reported during ${exercise.base.name}`,
          appliedAt: new Date(),
        };
        break;
      }

      case 'too_hard': {
        // Reduce remaining set loads by 10%
        const updatedSets = exercise.sets.map((s, idx) => {
          if (idx > activeSetIndex && s.target_load) {
            return {
              ...s,
              target_load: Math.round((s.target_load * 0.9) / 2.5) * 2.5,
              agentReasoning: 'Adjusted for difficulty',
              agentAdjusted: true,
            };
          }
          return s;
        });
        updatedQueue[activeExerciseIndex] = { ...exercise, sets: updatedSets };
        agentMessage = 'Got it. I\'ve reduced the load for your remaining sets.';
        decision = {
          type: 'weight_decrease',
          reasoning: 'User reported exercise too difficult',
          appliedAt: new Date(),
        };
        break;
      }

      case 'too_easy': {
        // Increase remaining set loads by 5%
        const updatedSets = exercise.sets.map((s, idx) => {
          if (idx >= activeSetIndex && s.target_load) {
            return {
              ...s,
              target_load: Math.round((s.target_load * 1.05) / 2.5) * 2.5,
              agentReasoning: 'Bumped for challenge',
              agentAdjusted: true,
            };
          }
          return s;
        });
        updatedQueue[activeExerciseIndex] = { ...exercise, sets: updatedSets };
        agentMessage = 'Let\'s add some weight. Updated your remaining sets.';
        decision = {
          type: 'weight_increase',
          reasoning: 'User requested more challenge',
          appliedAt: new Date(),
        };
        break;
      }

      case 'fatigue': {
        // Remove the last pending set
        const pendingSets = exercise.sets.filter((s) => s.uiStatus === 'pending');
        if (pendingSets.length > 0) {
          const updatedSets = exercise.sets.slice(0, -1);
          updatedQueue[activeExerciseIndex] = { ...exercise, sets: updatedSets };
          agentMessage = 'Fatigue noted. I\'ve removed one set to manage recovery.';
          decision = {
            type: 'volume_adjustment',
            reasoning: 'Fatigue-based volume reduction',
            appliedAt: new Date(),
          };
        } else {
          agentMessage = 'No more sets to remove. Let\'s finish this one strong.';
        }
        break;
      }

      case 'add_set': {
        // Add another set
        const lastSet = exercise.sets[exercise.sets.length - 1];
        const newSet: FluidSet = {
          ...lastSet,
          id: generateSetId(),
          set_order: exercise.sets.length + 1,
          actual_weight: null,
          actual_reps: null,
          actual_rpe: null,
          uiStatus: 'pending',
          agentReasoning: undefined,
          agentAdjusted: undefined,
        };
        updatedQueue[activeExerciseIndex] = {
          ...exercise,
          sets: [...exercise.sets, newSet],
        };
        agentMessage = 'Added another set. Let\'s go.';
        break;
      }

      case 'skip_exercise': {
        // Mark all remaining sets as completed and move on
        const updatedSets = exercise.sets.map((s) => ({
          ...s,
          uiStatus: 'completed' as SetUIStatus,
          notes: s.uiStatus !== 'completed' ? 'Skipped' : s.notes,
        }));
        updatedQueue[activeExerciseIndex] = { ...exercise, sets: updatedSets };
        agentMessage = 'Exercise skipped. Moving to the next one.';
        break;
      }

      case 'time_crunch': {
        // Time pressure: Strip one set from each remaining exercise
        let setsRemoved = 0;
        for (let i = activeExerciseIndex; i < sessionQueue.length; i++) {
          const ex = updatedQueue[i];
          const pendingSets = ex.sets.filter((s) => s.uiStatus === 'pending');
          if (pendingSets.length > 0) {
            // Remove the last pending set
            const newSets = ex.sets.slice(0, -1);
            updatedQueue[i] = { ...ex, sets: newSets };
            setsRemoved++;
          }
        }
        if (setsRemoved > 0) {
          agentMessage = `Got it, short on time. I've trimmed ${setsRemoved} set${setsRemoved > 1 ? 's' : ''} to keep you moving.`;
          decision = {
            type: 'volume_adjustment',
            reasoning: 'Time crunch - reduced volume across remaining exercises',
            appliedAt: new Date(),
          };
        } else {
          agentMessage = "You're already lean on sets. Let's finish strong.";
        }
        break;
      }

      case 'travel': {
        // Delegate to handleLifeEvent for timeline-aware handling
        get().handleLifeEvent('travel', 3); // Default 3 days for travel
        return; // handleLifeEvent handles the state update
      }

      case 'sick': {
        // Delegate to handleLifeEvent for timeline-aware handling
        get().handleLifeEvent('sickness', 3); // Default 3 days for sickness
        return; // handleLifeEvent handles the state update
      }

      default:
        agentMessage = 'Noted. Continue when ready.';
    }

    const updates: Partial<FluidSessionState> = {
      sessionQueue: updatedQueue,
      agentMessage,
    };

    if (decision) {
      set((state) => ({
        ...updates,
        agentDecisions: [...state.agentDecisions, decision!],
      }));
    } else {
      set(updates);
    }
  },

  // -------------------------------------------------------------------------
  // TIMELINE-AWARE LIFE EVENT HANDLING
  // -------------------------------------------------------------------------
  handleLifeEvent: (eventType, durationDays) => {
    const state = get();
    const { sessionQueue, currentBlockStatus, futureAdjustments } = state;

    const newAdjustments: FutureAdjustment[] = [...futureAdjustments];
    let agentMessage = '';
    let updatedQueue = [...sessionQueue];
    let updatedBlockStatus = currentBlockStatus ? { ...currentBlockStatus } : null;

    switch (eventType) {
      case 'travel': {
        // =====================================================================
        // TRAVEL MODE (Maintenance)
        // - Present: Swap heavy compounds for hotel-friendly alternatives
        // - Future: Schedule volume makeup for return
        // =====================================================================

        // Calculate lost volume from heavy compounds
        let lostVolumeLoad = 0;
        const compoundExerciseNames: string[] = [];

        // Transform session queue: swap compounds for high-rep isolation/bodyweight
        updatedQueue = sessionQueue.map((fluidEx) => {
          const isCompound = isCompoundLift(fluidEx.base);

          if (isCompound) {
            // Track the lost volume (sets × target_load approximation)
            const volumeFromExercise = fluidEx.sets.reduce((acc, s) => {
              return acc + (s.target_load || 0) * (s.target_reps || 8);
            }, 0);
            lostVolumeLoad += volumeFromExercise;
            compoundExerciseNames.push(fluidEx.base.name);

            // Transform to high-rep, lighter version
            const modifiedSets = fluidEx.sets.map((s) => ({
              ...s,
              target_load: s.target_load ? Math.round((s.target_load * 0.5) / 2.5) * 2.5 : null,
              target_reps: 15, // High rep for pump/blood flow
              target_rpe: 6, // Keep it light
              agentReasoning: 'Travel mode: maintenance stimulus',
              agentAdjusted: true,
            }));

            return {
              ...fluidEx,
              sets: modifiedSets,
            };
          }

          return fluidEx;
        });

        // Schedule future volume makeup: +10% on first heavy session back
        if (lostVolumeLoad > 0 && compoundExerciseNames.length > 0) {
          // Mock calculation: assume return is after durationDays, next heavy day
          const returnWeek = Math.ceil(durationDays / 7);
          const returnDay = (durationDays % 7) + 1;

          newAdjustments.push({
            id: `adj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            week: (currentBlockStatus?.weekNumber || 1) + returnWeek,
            day: Math.min(returnDay + 1, 7), // Next day after return
            action: 'add_volume',
            targetExerciseName: compoundExerciseNames[0], // Primary compound
            volumeModifier: 1.1, // +10% volume
            reason: `Makeup for ${durationDays}-day travel. Lost ${Math.round(lostVolumeLoad)} volume-load units.`,
            createdAt: new Date(),
          });

          // Update volume debt tracking
          if (updatedBlockStatus) {
            updatedBlockStatus.volumeDebt += lostVolumeLoad;
          }
        }

        const primaryLift = compoundExerciseNames[0] || 'your main lift';
        agentMessage = `I've switched to a hotel-friendly circuit. I've also added a volume booster to next week's ${primaryLift} session to make up for the missed heavy stimulus.`;
        break;
      }

      case 'sickness': {
        // =====================================================================
        // SICKNESS MODE (Recovery)
        // - Present: Clear queue or reduce to light mobility
        // - Future: Extend block if duration > 3 days
        // =====================================================================

        // Clear the session or reduce to minimal
        if (durationDays > 1) {
          // Clear the queue entirely - rest is the priority
          updatedQueue = [];
        } else {
          // Just reduce intensity dramatically for light movement
          updatedQueue = sessionQueue.slice(0, 1).map((fluidEx) => ({
            ...fluidEx,
            sets: fluidEx.sets.slice(0, 1).map((s) => ({
              ...s,
              target_load: null, // Bodyweight only
              target_reps: 10,
              target_rpe: 4, // Very light
              agentReasoning: 'Recovery mode: light mobility only',
              agentAdjusted: true,
            })),
          }));
        }

        // If sick for >3 days, extend the block by 1 week
        if (durationDays > 3 && updatedBlockStatus) {
          const extendWeeks = 1;
          updatedBlockStatus.totalWeeks += extendWeeks;
          updatedBlockStatus.weeksRemaining += extendWeeks;

          newAdjustments.push({
            id: `adj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            week: updatedBlockStatus.weekNumber,
            day: 0, // Applies to whole week
            action: 'extend_block',
            reason: `Extended ${updatedBlockStatus.phase} block by ${extendWeeks} week due to ${durationDays}-day illness.`,
            createdAt: new Date(),
          });

          agentMessage = `Health comes first. I've scrapped today. Since you're out for ${durationDays} days, I'm extending this ${updatedBlockStatus.phase} block by a week so we don't rush the progression.`;
        } else {
          agentMessage = durationDays > 1
            ? "Health comes first. I've cleared today's session. Focus on rest and recovery."
            : "Taking it easy today. I've set up some light mobility work - skip it if you need to.";
        }
        break;
      }

      case 'injury': {
        // =====================================================================
        // INJURY MODE
        // - Present: Remove affected exercises, suggest alternatives
        // - Future: Schedule gradual reintroduction
        // =====================================================================
        agentMessage = "I've noted the injury. Let's work around it today. Please consult a professional before resuming that movement pattern.";
        break;
      }

      case 'stress': {
        // =====================================================================
        // HIGH STRESS MODE
        // - Present: Reduce intensity by 20%, keep volume moderate
        // - Future: Add extra deload consideration
        // =====================================================================
        updatedQueue = sessionQueue.map((fluidEx) => ({
          ...fluidEx,
          sets: fluidEx.sets.map((s) => ({
            ...s,
            target_load: s.target_load ? Math.round((s.target_load * 0.8) / 2.5) * 2.5 : null,
            target_rpe: Math.max((s.target_rpe || 8) - 1, 5),
            agentReasoning: 'Stress management: reduced intensity',
            agentAdjusted: true,
          })),
        }));

        agentMessage = "I can tell you're under stress. I've dialed back the intensity today - you'll still get a good session without adding to the load.";
        break;
      }

      default:
        agentMessage = 'Life event noted. Adjusting your plan accordingly.';
    }

    // Persist all changes
    set({
      sessionQueue: updatedQueue,
      agentMessage,
      currentBlockStatus: updatedBlockStatus,
      futureAdjustments: newAdjustments,
      agentDecisions: [
        ...state.agentDecisions,
        {
          type: 'volume_adjustment',
          reasoning: `Life event: ${eventType} (${durationDays} days)`,
          appliedAt: new Date(),
        },
      ],
    });
  },

  // -------------------------------------------------------------------------
  // NAVIGATION
  // -------------------------------------------------------------------------
  advanceToNextSet: () => {
    const state = get();
    const { sessionQueue, activeExerciseIndex, activeSetIndex } = state;

    const exercise = sessionQueue[activeExerciseIndex];
    if (!exercise) return;

    if (activeSetIndex < exercise.sets.length - 1) {
      // Update current set to completed if not already
      const updatedSets = [...exercise.sets];
      if (updatedSets[activeSetIndex].uiStatus !== 'completed') {
        updatedSets[activeSetIndex] = {
          ...updatedSets[activeSetIndex],
          uiStatus: 'completed',
        };
      }
      // Activate next set
      updatedSets[activeSetIndex + 1] = {
        ...updatedSets[activeSetIndex + 1],
        uiStatus: 'active',
      };

      const updatedQueue = [...sessionQueue];
      updatedQueue[activeExerciseIndex] = { ...exercise, sets: updatedSets };

      set({
        sessionQueue: updatedQueue,
        activeSetIndex: activeSetIndex + 1,
      });
    } else {
      // No more sets, advance to next exercise
      get().advanceToNextExercise();
    }
  },

  advanceToNextExercise: () => {
    const state = get();
    const { sessionQueue, activeExerciseIndex } = state;

    if (activeExerciseIndex < sessionQueue.length - 1) {
      const nextExerciseIndex = activeExerciseIndex + 1;
      const nextExercise = sessionQueue[nextExerciseIndex];

      // Activate first set of next exercise
      const updatedSets = nextExercise.sets.map((s, idx) => ({
        ...s,
        uiStatus: (idx === 0 ? 'active' : 'pending') as SetUIStatus,
      }));

      const updatedQueue = [...sessionQueue];
      updatedQueue[nextExerciseIndex] = { ...nextExercise, sets: updatedSets };

      set({
        sessionQueue: updatedQueue,
        activeExerciseIndex: nextExerciseIndex,
        activeSetIndex: 0,
        agentMessage: `Moving to ${nextExercise.base.name}. ${nextExercise.context.lastPerformance ? `Last time: ${nextExercise.context.lastPerformance.last_weight}lbs × ${nextExercise.context.lastPerformance.last_reps}` : 'First time logging this movement.'}`,
      });
    } else {
      // Session complete
      set({
        agentMessage: 'Session complete! Great work today.',
      });
    }
  },

  // -------------------------------------------------------------------------
  // UTILITIES
  // -------------------------------------------------------------------------
  dismissAgentMessage: () => set({ agentMessage: null }),

  clearFutureAdjustment: (adjustmentId) => {
    const { futureAdjustments } = get();
    set({
      futureAdjustments: futureAdjustments.filter((adj) => adj.id !== adjustmentId),
    });
  },

  endSession: () =>
    set({
      isActive: false,
      agentMessage: 'Session ended.',
    }),

  resetSession: () =>
    set({
      isActive: false,
      sessionStartTime: null,
      sessionQueue: [],
      activeExerciseIndex: 0,
      activeSetIndex: 0,
      agentMessage: null,
      agentDecisions: [],
      readinessContext: null,
      workoutContext: 'building',
      workoutId: null,
      // Clear macro context
      currentBlockStatus: null,
      futureAdjustments: [],
      // Clear morning context
      morningContext: null,
    }),

  // -------------------------------------------------------------------------
  // SELECTORS
  // -------------------------------------------------------------------------
  getCurrentExercise: () => {
    const { sessionQueue, activeExerciseIndex } = get();
    return sessionQueue[activeExerciseIndex] || null;
  },

  getCurrentSet: () => {
    const { sessionQueue, activeExerciseIndex, activeSetIndex } = get();
    const exercise = sessionQueue[activeExerciseIndex];
    return exercise?.sets[activeSetIndex] || null;
  },

  getSessionProgress: () => {
    const { sessionQueue } = get();
    let completed = 0;
    let total = 0;

    sessionQueue.forEach((ex) => {
      ex.sets.forEach((s) => {
        total++;
        if (s.uiStatus === 'completed') completed++;
      });
    });

    return {
      completed,
      total,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  },

  getCompletedSets: () => {
    const { sessionQueue } = get();
    return sessionQueue.map((ex) => ({
      exerciseId: ex.base.id,
      sets: ex.sets.filter((s) => s.uiStatus === 'completed'),
    }));
  },

  // -------------------------------------------------------------------------
  // DYNAMIC EXERCISE MANAGEMENT (for freestyle mode)
  // -------------------------------------------------------------------------
  addExerciseToSession: (exercise, memory) => {
    const state = get();
    const { sessionQueue, readinessContext } = state;

    const newFluidExercise: FluidExercise = {
      base: exercise,
      sets: buildInitialSets(exercise, memory, readinessContext),
      context: {
        lastPerformance: memory,
        suggestedWeight: calculateSuggestedWeight(memory, readinessContext),
        suggestedReps: memory?.typical_rep_max || 8,
      },
    };

    set({
      sessionQueue: [...sessionQueue, newFluidExercise],
      agentMessage: `Added ${exercise.name} to your session.`,
    });
  },

  removeExerciseFromSession: (exerciseId) => {
    const state = get();
    const { sessionQueue, activeExerciseIndex } = state;

    const exerciseIdx = sessionQueue.findIndex((ex) => ex.base.id === exerciseId);
    if (exerciseIdx === -1) return;

    const updatedQueue = sessionQueue.filter((ex) => ex.base.id !== exerciseId);

    // Adjust activeExerciseIndex if needed
    let newActiveIndex = activeExerciseIndex;
    if (exerciseIdx < activeExerciseIndex) {
      newActiveIndex = activeExerciseIndex - 1;
    } else if (exerciseIdx === activeExerciseIndex && activeExerciseIndex >= updatedQueue.length) {
      newActiveIndex = Math.max(0, updatedQueue.length - 1);
    }

    set({
      sessionQueue: updatedQueue,
      activeExerciseIndex: newActiveIndex,
      agentMessage: 'Exercise removed from session.',
    });
  },
}));

// ============================================================================
// SELECTOR HOOKS
// ============================================================================

export const useFluidSession = () => useFluidSessionStore((state) => state);
export const useIsFluidSessionActive = () => useFluidSessionStore((state) => state.isActive);
export const useAgentMessage = () => useFluidSessionStore((state) => state.agentMessage);
export const useSessionQueue = () => useFluidSessionStore((state) => state.sessionQueue);
export const useActiveExerciseIndex = () => useFluidSessionStore((state) => state.activeExerciseIndex);
export const useMorningContext = () => useFluidSessionStore((state) => state.morningContext);
