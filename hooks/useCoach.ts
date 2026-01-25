/**
 * useCoach Hook
 *
 * Manages AI coach conversations with context-aware responses.
 * Handles message history, context gathering, and API communication.
 *
 * NEW: Supports 8 interaction modes for the Adaptive Training Coach:
 * - intake: Conversational onboarding
 * - reflect: Summarize understanding
 * - history: Analyze training patterns
 * - phase: Determine current phase
 * - weekly_planning: Sunday planning
 * - daily: What to do today
 * - post_workout: Session evaluation
 * - explain: Reasoning on demand
 * - general: Free conversation
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAppStore } from '@/stores/useAppStore';
import {
  buildContextSnapshot,
  getQuickSuggestions as getLegacyQuickSuggestions,
  parseCoachResponse,
  type QuickSuggestion,
} from '@/lib/coachContext';
import {
  buildFullSystemPrompt,
  getNextIntakeSection,
} from '@/lib/coachPrompts';
import {
  detectModeFromMessage,
  getQuickSuggestions as getModeQuickSuggestions,
  detectIntakeSectionFromResponse,
} from '@/lib/modeDetection';
import { supabase } from '@/lib/supabase';
import { useJourneySignals } from './useJourneySignals';
import type {
  ChatMessage,
  CoachContext,
  CoachConversation,
  CoachMessage,
  ContextSnapshot,
  ConversationContextType,
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
import type {
  CoachMode,
  ExtendedCoachContext,
  IntakeState,
  IntakeSection,
  IntakeResponses,
} from '@/types/coach';

// ============================================================================
// Constants
// ============================================================================

// Input validation constants
const MAX_MESSAGE_LENGTH = 2000;
const MIN_MESSAGE_LENGTH = 1;

const COACH_QUERIES = {
  conversations: 'coach-conversations',
  messages: 'coach-messages',
  context: 'coach-context',
};

// Cache times
const CONTEXT_STALE_TIME = 5 * 60 * 1000; // 5 minutes
const MESSAGES_STALE_TIME = 30 * 1000; // 30 seconds

// ============================================================================
// Context Gathering Hook
// ============================================================================

/**
 * Gather all relevant training context for the AI coach
 */
export function useCoachContext() {
  const userId = useAppStore((state) => state.userId);

  return useQuery({
    queryKey: [COACH_QUERIES.context, userId],
    queryFn: async (): Promise<CoachContext> => {
      if (!userId) throw new Error('Not authenticated');

      // Fetch all context data in parallel
      const [
        profileResult,
        blockResult,
        readinessResult,
        workoutsResult,
        prsResult,
        goalsResult,
      ] = await Promise.all([
        // Training profile
        supabase
          .from('training_profiles')
          .select('*')
          .eq('user_id', userId)
          .single(),

        // Active training block
        supabase
          .from('training_blocks')
          .select('*')
          .eq('user_id', userId)
          .eq('is_active', true)
          .single(),

        // Today's readiness
        supabase
          .from('daily_readiness')
          .select('*')
          .eq('user_id', userId)
          .eq('check_in_date', new Date().toISOString().split('T')[0])
          .single(),

        // Recent workouts (last 10)
        supabase
          .from('workouts')
          .select('*')
          .eq('user_id', userId)
          .order('date_completed', { ascending: false, nullsFirst: false })
          .limit(10),

        // Recent PRs (last 5)
        supabase
          .from('personal_records')
          .select('*, exercises(name)')
          .eq('user_id', userId)
          .eq('is_current', true)
          .order('achieved_at', { ascending: false })
          .limit(5),

        // Active goals
        supabase
          .from('goals')
          .select('*, exercises(name)')
          .eq('user_id', userId)
          .eq('status', 'active'),
      ]);

      // Get upcoming workout if we have an active block
      let upcomingWorkout: WorkoutWithSets | null = null;
      if (blockResult.data) {
        const { data: nextWorkout } = await supabase
          .from('workouts')
          .select(`
            *,
            workout_sets(*, exercise:exercises(*))
          `)
          .eq('block_id', blockResult.data.id)
          .is('date_completed', null)
          .order('week_number', { ascending: true })
          .order('day_number', { ascending: true })
          .limit(1)
          .single();

        upcomingWorkout = nextWorkout as WorkoutWithSets | null;
      }

      // Map PRs with exercise names
      const prsWithNames = (prsResult.data || []).map((pr: PersonalRecord & { exercises?: { name: string } }) => ({
        ...pr,
        exercise_name: pr.exercises?.name || pr.exercise_name || 'Unknown',
      }));

      // Map goals with exercise names
      const goalsWithNames = (goalsResult.data || []).map((g: Goal & { exercises?: { name: string } }) => ({
        ...g,
        exercise_name: g.exercises?.name || g.exercise_name || 'Unknown',
      }));

      return {
        profile: profileResult.data as TrainingProfile | null,
        currentBlock: blockResult.data as TrainingBlock | null,
        todayReadiness: readinessResult.data as DailyReadiness | null,
        recentWorkouts: (workoutsResult.data || []) as Workout[],
        upcomingWorkout,
        recentPRs: prsWithNames as PersonalRecordWithExercise[],
        goals: goalsWithNames as GoalWithExercise[],
      };
    },
    enabled: !!userId,
    staleTime: CONTEXT_STALE_TIME,
    gcTime: CONTEXT_STALE_TIME * 2,
  });
}

// ============================================================================
// Conversations Hook
// ============================================================================

/**
 * Fetch user's coach conversations
 */
export function useCoachConversations() {
  const userId = useAppStore((state) => state.userId);

  return useQuery({
    queryKey: [COACH_QUERIES.conversations, userId],
    queryFn: async (): Promise<CoachConversation[]> => {
      if (!userId) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('coach_conversations')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as CoachConversation[];
    },
    enabled: !!userId,
    staleTime: MESSAGES_STALE_TIME,
  });
}

/**
 * Fetch messages for a specific conversation
 */
export function useConversationMessages(conversationId: string | null) {
  const userId = useAppStore((state) => state.userId);

  return useQuery({
    queryKey: [COACH_QUERIES.messages, conversationId],
    queryFn: async (): Promise<CoachMessage[]> => {
      if (!conversationId) return [];

      const { data, error } = await supabase
        .from('coach_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as CoachMessage[];
    },
    enabled: !!userId && !!conversationId,
    staleTime: MESSAGES_STALE_TIME,
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate current week number from training block dates
 */
function calculateCurrentWeekFromBlock(block: TrainingBlock): number {
  if (!block.start_date) return 1;

  const startDate = new Date(block.start_date);
  const now = new Date();
  const diffTime = now.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const weekNumber = Math.floor(diffDays / 7) + 1;

  // Clamp to valid range
  return Math.max(1, Math.min(weekNumber, block.duration_weeks || 4));
}

/**
 * Build system prompt for legacy mode (non-adaptive)
 * This is the original basic prompt for backwards compatibility
 */
function buildSystemPrompt(context: CoachContext): string {
  const parts = [
    'You are a helpful strength training coach. Be conversational, supportive, and give evidence-based advice.',
  ];

  if (context.profile) {
    parts.push(`\nUser profile: ${context.profile.training_experience} level, goal: ${context.profile.primary_goal}`);
  }

  if (context.currentBlock) {
    parts.push(`\nCurrent training block: ${context.currentBlock.name}`);
  }

  if (context.recentWorkouts?.length) {
    parts.push(`\nRecent activity: ${context.recentWorkouts.length} workouts in the last period`);
  }

  return parts.join('');
}

// ============================================================================
// Main Coach Hook
// ============================================================================

interface UseCoachOptions {
  conversationId?: string | null;
  contextType?: ConversationContextType;
  workoutId?: string;
  blockId?: string;
  /** Enable the new Adaptive Coach mode system */
  useAdaptiveMode?: boolean;
}

export function useCoach(options: UseCoachOptions = {}) {
  const userId = useAppStore((state) => state.userId);
  const queryClient = useQueryClient();
  const { trackSignal } = useJourneySignals();

  // Local state for current conversation
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(
    options.conversationId || null
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  // NEW: Mode state for Adaptive Coach
  const [currentMode, setCurrentMode] = useState<CoachMode>('general');
  const [intakeState, setIntakeState] = useState<IntakeState>({
    currentSection: 'goals',
    completedSections: [],
    responses: {},
    isComplete: false,
  });

  // Fetch context
  const { data: context, isLoading: contextLoading } = useCoachContext();

  // Fetch conversation messages when we have an ID
  const { data: savedMessages } = useConversationMessages(currentConversationId);

  // Convert saved messages to chat format
  const chatMessages = useMemo((): ChatMessage[] => {
    if (messages.length > 0) return messages;
    if (!savedMessages) return [];

    return savedMessages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: new Date(m.created_at),
      suggestedAction: m.suggested_action || undefined,
    }));
  }, [messages, savedMessages]);

  // Build extended context for Adaptive Coach mode
  const extendedContext = useMemo((): ExtendedCoachContext => {
    return {
      profile: context?.profile ? {
        userId: userId || '',
        trainingExperience: context.profile.training_experience,
        primaryGoal: context.profile.primary_goal,
        recoverySpeed: context.profile.recovery_speed,
        totalWorkoutsLogged: context.profile.total_workouts_logged,
      } : null,
      intakeState,
      intakeComplete: intakeState.isComplete,
      currentBlock: context?.currentBlock ? {
        id: context.currentBlock.id,
        name: context.currentBlock.name,
        week: calculateCurrentWeekFromBlock(context.currentBlock),
        totalWeeks: context.currentBlock.duration_weeks || 4,
        phase: context.profile?.current_training_phase,
      } : null,
      todayReadiness: context?.todayReadiness ? {
        score: context.todayReadiness.readiness_score,
        sleep: context.todayReadiness.sleep_quality,
        soreness: context.todayReadiness.muscle_soreness,
        stress: context.todayReadiness.stress_level,
      } : null,
      recentWorkouts: (context?.recentWorkouts || []).map((w) => ({
        id: w.id,
        date: w.date_completed || w.scheduled_date || '',
        focus: w.focus,
        completed: !!w.date_completed,
        exerciseCount: 0, // Would need to fetch workout_sets to get this
      })),
      upcomingWorkout: context?.upcomingWorkout ? {
        id: context.upcomingWorkout.id,
        focus: context.upcomingWorkout.focus,
        exercises: (context.upcomingWorkout.workout_sets || []).map((s) => ({
          name: s.exercise?.name || '',
          sets: 1,
          reps: s.target_reps?.toString(),
        })),
      } : null,
      recentPRs: (context?.recentPRs || []).map((pr) => ({
        exerciseName: pr.exercise_name || '',
        type: pr.record_type || 'weight',
        value: pr.value || 0,
        date: pr.achieved_at || '',
      })),
      activeGoals: (context?.goals || []).filter((g) => g.status === 'active').map((g) => ({
        description: g.exercise_name || '',
        targetValue: g.target_value,
        currentValue: g.current_value,
        targetDate: g.target_date,
      })),
      movementMemory: [], // Would need to fetch from movement_memory table
      activeDisruptions: [], // Would need to fetch from user_disruptions table
      concurrentTraining: intakeState.responses.concurrent_activities ? {
        activities: intakeState.responses.concurrent_activities,
        hoursPerWeek: intakeState.responses.concurrent_hours_per_week || 0,
      } : undefined,
    };
  }, [context, intakeState, userId]);

  // Generate quick suggestions based on context and mode
  const quickSuggestions = useMemo((): QuickSuggestion[] => {
    if (!context) return [];

    // Use mode-aware suggestions for Adaptive Coach
    if (options.useAdaptiveMode) {
      const modeSuggestions = getModeQuickSuggestions(currentMode, extendedContext);
      return modeSuggestions.map((s, i) => ({
        id: `mode-${i}`,
        label: s,
        prompt: s,
        icon: 'chatbubble-outline',
      }));
    }

    // Fall back to legacy suggestions
    return getLegacyQuickSuggestions(context);
  }, [context, options.useAdaptiveMode, currentMode, extendedContext]);

  // Create new conversation mutation
  const createConversation = useMutation({
    mutationFn: async (contextType: ConversationContextType = 'general') => {
      if (!userId) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('coach_conversations')
        .insert({
          user_id: userId,
          context_type: contextType,
          workout_id: options.workoutId || null,
          block_id: options.blockId || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as CoachConversation;
    },
    onSuccess: (data) => {
      setCurrentConversationId(data.id);
      queryClient.invalidateQueries({ queryKey: [COACH_QUERIES.conversations] });
    },
  });

  // Save message to database
  const saveMessage = useCallback(
    async (
      conversationId: string,
      role: 'user' | 'assistant',
      content: string,
      contextSnapshot?: ContextSnapshot,
      suggestedAction?: ChatMessage['suggestedAction']
    ) => {
      if (!userId) return;

      await supabase.from('coach_messages').insert({
        conversation_id: conversationId,
        user_id: userId,
        role,
        content,
        context_snapshot: contextSnapshot || null,
        suggested_action: suggestedAction || null,
      });
    },
    [userId]
  );

  // AbortController ref for cleanup
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Send message to AI
  const sendMessage = useCallback(
    async (userMessage: string) => {
      if (!userId || !context) return;

      // Input validation
      const trimmedMessage = userMessage.trim();
      if (trimmedMessage.length < MIN_MESSAGE_LENGTH) {
        console.warn('Message too short');
        return;
      }
      if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
        console.warn('Message too long, truncating');
      }
      const sanitizedMessage = trimmedMessage.slice(0, MAX_MESSAGE_LENGTH);

      // Cancel any pending request
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      // Create conversation if needed
      let convId = currentConversationId;
      if (!convId) {
        const conv = await createConversation.mutateAsync(options.contextType || 'general');
        convId = conv.id;
      }

      // Build context snapshot
      const contextSnapshot = buildContextSnapshot(context);

      // Mode detection for Adaptive Coach
      let activeMode = currentMode;
      if (options.useAdaptiveMode) {
        const detectedMode = detectModeFromMessage(sanitizedMessage, extendedContext);
        if (detectedMode !== activeMode) {
          activeMode = detectedMode;
          setCurrentMode(detectedMode);
        }

        // Handle intake section progression based on user response
        if (activeMode === 'intake' && !intakeState.isComplete) {
          const { answersCurrentSection, extractedData } = detectIntakeSectionFromResponse(
            sanitizedMessage,
            intakeState.currentSection
          );

          if (answersCurrentSection && Object.keys(extractedData).length > 0) {
            const newResponses = { ...intakeState.responses, ...extractedData } as IntakeResponses;
            const newCompletedSections = intakeState.completedSections.includes(intakeState.currentSection)
              ? intakeState.completedSections
              : [...intakeState.completedSections, intakeState.currentSection];

            const nextSection = getNextIntakeSection(newCompletedSections);

            setIntakeState({
              ...intakeState,
              responses: newResponses,
              completedSections: newCompletedSections,
              currentSection: nextSection || intakeState.currentSection,
              isComplete: nextSection === null,
              completedAt: nextSection === null ? new Date().toISOString() : undefined,
            });
          }
        }
      }

      // Add user message to UI immediately
      const userChatMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: sanitizedMessage,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userChatMessage]);

      // Save user message
      await saveMessage(convId, 'user', sanitizedMessage, contextSnapshot);

      // Track journey signal for coach interaction
      trackSignal('use_coach', { action: 'message', context_type: options.contextType });

      // Add streaming placeholder
      const streamingId = `assistant-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: streamingId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          isStreaming: true,
        },
      ]);
      setIsStreaming(true);

      try {
        // Build conversation history for API
        const historyMessages = chatMessages.slice(-10).map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

        // Get auth session for Edge Function
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error('Please log in to use the coach');
        }

        // Build appropriate system prompt
        const systemPrompt = options.useAdaptiveMode
          ? buildFullSystemPrompt(activeMode, extendedContext, sanitizedMessage)
          : buildSystemPrompt(context);

        // Call AI Coach Edge Function (secure - API key is server-side)
        const response = await fetch(
          `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai-coach`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              messages: [
                ...historyMessages,
                { role: 'user', content: sanitizedMessage },
              ],
              systemPrompt,
              temperature: options.useAdaptiveMode ? 0.8 : 0.7,
              maxTokens: options.useAdaptiveMode ? 1500 : 1000,
            }),
            signal: abortControllerRef.current.signal,
          }
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to get coach response');
        }

        const data = await response.json();
        const assistantContent = data.message || 'I apologize, I had trouble responding. Please try again.';

        // Parse response for actions
        const parsed = parseCoachResponse(assistantContent);

        // Update UI with final response
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamingId
              ? {
                  ...m,
                  content: parsed.message,
                  isStreaming: false,
                  suggestedAction: parsed.suggestedAction,
                }
              : m
          )
        );

        // Save assistant message
        await saveMessage(convId, 'assistant', parsed.message, undefined, parsed.suggestedAction);

        // Update conversation title if first message
        if (chatMessages.length === 0) {
          const title = sanitizedMessage.slice(0, 50) + (sanitizedMessage.length > 50 ? '...' : '');
          await supabase
            .from('coach_conversations')
            .update({ title })
            .eq('id', convId);
        }
      } catch (error) {
        // Don't show error for aborted requests
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        console.error('Coach API error:', error);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamingId
              ? {
                  ...m,
                  content: 'Sorry, I had trouble connecting. Please try again.',
                  isStreaming: false,
                }
              : m
          )
        );
      } finally {
        setIsStreaming(false);
      }
    },
    [
      userId,
      context,
      currentConversationId,
      createConversation,
      saveMessage,
      chatMessages,
      options.contextType,
      options.useAdaptiveMode,
      currentMode,
      intakeState,
      extendedContext,
      trackSignal,
    ]
  );

  // Start new conversation
  const startNewConversation = useCallback((resetMode = true) => {
    setCurrentConversationId(null);
    setMessages([]);
    if (resetMode) {
      setCurrentMode('general');
      setIntakeState({
        currentSection: 'goals',
        completedSections: [],
        responses: {},
        isComplete: false,
      });
    }
  }, []);

  // Load existing conversation
  const loadConversation = useCallback((conversationId: string) => {
    setCurrentConversationId(conversationId);
    setMessages([]);
  }, []);

  return {
    // State
    messages: chatMessages,
    isStreaming,
    isLoading: contextLoading,
    currentConversationId,
    context,

    // Adaptive Coach Mode State
    currentMode,
    setCurrentMode,
    intakeState,
    setIntakeState,
    extendedContext,

    // Actions
    sendMessage,
    startNewConversation,
    loadConversation,

    // Suggestions
    quickSuggestions,
  };
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Hook for applying suggested actions from coach
 *
 * NOTE: Action handlers are not yet fully implemented.
 * Currently logs the action and marks it as acknowledged.
 * Full implementation would integrate with workout/block mutations.
 */
export function useApplyCoachAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (action: ChatMessage['suggestedAction']) => {
      if (!action) throw new Error('No action to apply');

      // Validate action has required fields
      if (!action.type || !action.label) {
        throw new Error('Invalid action: missing type or label');
      }

      // Handle different action types
      // NOTE: These are placeholder implementations that acknowledge the action
      // Full implementations would modify workouts/blocks in the database
      switch (action.type) {
        case 'adjust_workout':
          // Future: Apply intensity/volume adjustments to workout sets
          console.log('[Coach Action] Workout adjustment acknowledged:', action.details);
          // Mark action as applied (UI feedback)
          return { ...action, applied: true };

        case 'swap_exercise':
          // Future: Swap exercise in workout template
          console.log('[Coach Action] Exercise swap acknowledged:', action.details);
          return { ...action, applied: true };

        case 'schedule_deload':
          // Future: Insert deload week into training block
          console.log('[Coach Action] Deload scheduling acknowledged:', action.details);
          return { ...action, applied: true };

        case 'modify_block':
          // Future: Modify training block parameters
          console.log('[Coach Action] Block modification acknowledged:', action.details);
          return { ...action, applied: true };

        case 'add_note':
          // Future: Add note to workout or exercise
          console.log('[Coach Action] Note addition acknowledged:', action.details);
          return { ...action, applied: true };

        case 'set_goal':
          // Future: Create a new goal
          console.log('[Coach Action] Goal setting acknowledged:', action.details);
          return { ...action, applied: true };

        default:
          console.warn('[Coach Action] Unknown action type:', action.type);
          throw new Error(`Unknown action type: ${action.type}`);
      }
    },
    onSuccess: () => {
      // Invalidate relevant queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['workouts'] });
      queryClient.invalidateQueries({ queryKey: ['training-blocks'] });
    },
    onError: (error) => {
      console.error('[Coach Action] Failed to apply action:', error);
    },
  });
}
