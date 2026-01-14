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
  | 'swap_exercise';

export interface AgentDecision {
  type: 'weight_increase' | 'weight_decrease' | 'volume_adjustment' | 'exercise_swap' | 'rest_suggestion';
  reasoning: string;
  appliedAt: Date;
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

  logSet: (
    exerciseId: string,
    setId: string,
    result: { rpe: number; weight: number; reps: number }
  ) => void;

  requestModification: (intent: ModificationIntent, context?: string) => void;

  advanceToNextSet: () => void;
  advanceToNextExercise: () => void;

  addExerciseToSession: (exercise: Exercise, memory?: MovementMemory) => void;
  removeExerciseFromSession: (exerciseId: string) => void;

  dismissAgentMessage: () => void;
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

// ============================================================================
// AGENT LOGIC
// ============================================================================

interface AgentAnalysis {
  shouldAdjustWeight: boolean;
  weightMultiplier: number;
  reasoning: string;
  message: string;
}

function analyzeSetPerformance(
  result: { rpe: number; weight: number; reps: number },
  targetRpe: number | null,
  targetReps: number | null
): AgentAnalysis {
  const { rpe, weight, reps } = result;

  // RPE too low - set was easy
  if (rpe < 6) {
    return {
      shouldAdjustWeight: true,
      weightMultiplier: 1.05, // +5%
      reasoning: `RPE ${rpe} indicates room for progression`,
      message: `That looked easy! I've bumped up the weight for your next set.`,
    };
  }

  // RPE very low with high reps - significant headroom
  if (rpe <= 6.5 && reps >= (targetReps || 8)) {
    return {
      shouldAdjustWeight: true,
      weightMultiplier: 1.025, // +2.5%
      reasoning: `Strong performance at RPE ${rpe}`,
      message: `Solid set. Let's add a little weight.`,
    };
  }

  // RPE too high - struggling
  if (rpe >= 9.5) {
    return {
      shouldAdjustWeight: true,
      weightMultiplier: 0.95, // -5%
      reasoning: `RPE ${rpe} suggests fatigue`,
      message: `That was a grinder. I'm backing off the weight to keep quality high.`,
    };
  }

  // RPE high with missed reps
  if (rpe >= 9 && reps < (targetReps || 8)) {
    return {
      shouldAdjustWeight: true,
      weightMultiplier: 0.925, // -7.5%
      reasoning: `Missed target reps at high RPE`,
      message: `Let's drop the weight and hit those reps clean.`,
    };
  }

  // Goldilocks zone
  return {
    shouldAdjustWeight: false,
    weightMultiplier: 1,
    reasoning: '',
    message: '',
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

  // -------------------------------------------------------------------------
  // PERSISTENCE HELPERS
  // -------------------------------------------------------------------------
  setWorkoutId: (id) => set({ workoutId: id }),
  setOnSetCompleted: (callback) => set({ onSetCompleted: callback }),

  // -------------------------------------------------------------------------
  // INITIALIZE SESSION
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

    if (readiness) {
      const score = readiness.readiness_score;

      if (score < 40) {
        // HIGH FATIGUE MODE: Reduce total sets by 1 for all exercises
        agentMessage =
          "Recovery is critical today. I've stripped back the volume to keep you moving without digging a deeper hole.";

        sessionQueue = sessionQueue.map((fluidEx) => {
          if (fluidEx.sets.length > 1) {
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
      } else if (score > 85) {
        // PEAK PERFORMANCE MODE: Add a "Joker Set" to the first compound lift
        agentMessage =
          "Green light. I've added a challenge set to your main lift to test your strength.";

        const firstCompoundIndex = sessionQueue.findIndex((fluidEx) =>
          isCompoundLift(fluidEx.base)
        );

        if (firstCompoundIndex !== -1) {
          const compoundExercise = sessionQueue[firstCompoundIndex];
          const lastSet = compoundExercise.sets[compoundExercise.sets.length - 1];

          // Create a Joker Set based on the last set
          const jokerSet: FluidSet = {
            ...lastSet,
            id: `fluid-set-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            set_order: compoundExercise.sets.length + 1,
            actual_weight: null,
            actual_reps: null,
            actual_rpe: null,
            uiStatus: 'pending',
            agentReasoning: 'Joker Set - push your limits',
            agentAdjusted: true,
          };

          sessionQueue[firstCompoundIndex] = {
            ...compoundExercise,
            sets: [...compoundExercise.sets, jokerSet],
          };
        }
      }
      // Else: Standard volume - no modifications needed
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

    // Analyze performance
    const analysis = analyzeSetPerformance(
      result,
      currentSet.target_rpe,
      currentSet.target_reps
    );

    // Build updated sets array
    const updatedSets = [...exercise.sets];

    // Update current set with actual values
    updatedSets[setIdx] = {
      ...currentSet,
      actual_weight: result.weight,
      actual_reps: result.reps,
      actual_rpe: result.rpe,
      uiStatus: 'completed' as SetUIStatus,
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

    // Apply agent adjustments to next set if needed
    if (nextSet && analysis.shouldAdjustWeight) {
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
    } else if (nextSet) {
      // Just activate the next set without adjustment
      updatedSets[setIdx + 1] = {
        ...nextSet,
        uiStatus: 'active' as SetUIStatus,
      };
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
