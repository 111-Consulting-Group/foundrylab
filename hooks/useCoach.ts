/**
 * useCoach Hook
 *
 * Manages AI coach conversations with context-aware responses.
 * Handles message history, context gathering, and API communication.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAppStore } from '@/stores/useAppStore';
import {
  buildContextSnapshot,
  buildSystemPrompt,
  getQuickSuggestions,
  parseCoachResponse,
  type QuickSuggestion,
} from '@/lib/coachContext';
import { supabase } from '@/lib/supabase';
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

// ============================================================================
// Constants
// ============================================================================

// WARNING: This API key is exposed in client-side code.
// TODO: Move to a backend proxy (Supabase Edge Function) before production.
// The proxy should validate user authentication and rate-limit requests.
const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

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
// Main Coach Hook
// ============================================================================

interface UseCoachOptions {
  conversationId?: string | null;
  contextType?: ConversationContextType;
  workoutId?: string;
  blockId?: string;
}

export function useCoach(options: UseCoachOptions = {}) {
  const userId = useAppStore((state) => state.userId);
  const queryClient = useQueryClient();

  // Local state for current conversation
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(
    options.conversationId || null
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

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

  // Generate quick suggestions based on context
  const quickSuggestions = useMemo((): QuickSuggestion[] => {
    if (!context) return [];
    return getQuickSuggestions(context);
  }, [context]);

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

        // Call OpenAI API
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              { role: 'system', content: buildSystemPrompt(context) },
              ...historyMessages,
              { role: 'user', content: sanitizedMessage },
            ],
            temperature: 0.7,
            max_tokens: 1000,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || 'Failed to get coach response');
        }

        const data = await response.json();
        const assistantContent = data.choices[0]?.message?.content || 'I apologize, I had trouble responding. Please try again.';

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
    ]
  );

  // Start new conversation
  const startNewConversation = useCallback(() => {
    setCurrentConversationId(null);
    setMessages([]);
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
