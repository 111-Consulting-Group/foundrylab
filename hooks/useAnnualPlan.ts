/**
 * useAnnualPlan Hook
 *
 * Manages annual training plans, competitions, and block scheduling.
 * Provides intelligent recommendations for periodization.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { useAuth } from '@/components/AuthProvider';
import {
  generateBlockRecommendations,
  generateAnnualTimeline,
  type RecommendationContext,
  type TimelineConfig,
} from '@/lib/periodization';
import { supabase } from '@/lib/supabase';
import type {
  AnnualPlan,
  BlockRecommendation,
  Competition,
  EventType,
  PlannedBlock,
  PlannedBlockStatus,
  TargetMetrics,
  TrainingGoal,
  TrainingProfile,
} from '@/types/database';

// ============================================================================
// Query Keys
// ============================================================================

const ANNUAL_QUERIES = {
  plans: 'annual-plans',
  activePlan: 'active-annual-plan',
  competitions: 'competitions',
  plannedBlocks: 'planned-blocks',
  recommendations: 'block-recommendations',
  timeline: 'annual-timeline',
};

// Cache times
const STALE_TIME = 5 * 60 * 1000; // 5 minutes
const GC_TIME = 10 * 60 * 1000; // 10 minutes

// ============================================================================
// Annual Plans Hooks
// ============================================================================

/**
 * Fetch active annual plan for the current year
 */
export function useActiveAnnualPlan() {
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();

  return useQuery({
    queryKey: [ANNUAL_QUERIES.activePlan, user?.id, currentYear],
    queryFn: async (): Promise<AnnualPlan | null> => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('annual_plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('year', currentYear)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as AnnualPlan | null;
    },
    enabled: !!user?.id,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

/**
 * Fetch all annual plans for user
 */
export function useAnnualPlans() {
  const { user } = useAuth();

  return useQuery({
    queryKey: [ANNUAL_QUERIES.plans, user?.id],
    queryFn: async (): Promise<AnnualPlan[]> => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('annual_plans')
        .select('*')
        .eq('user_id', user.id)
        .order('year', { ascending: false });

      if (error) throw error;
      return data as AnnualPlan[];
    },
    enabled: !!user?.id,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

/**
 * Create a new annual plan
 */
export function useCreateAnnualPlan() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      name?: string;
      year?: number;
      primary_goal: TrainingGoal;
      target_metrics?: TargetMetrics;
      competition_focus?: boolean;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('annual_plans')
        .insert({
          user_id: user.id,
          name: params.name || `${params.year || new Date().getFullYear()} Training Plan`,
          year: params.year || new Date().getFullYear(),
          primary_goal: params.primary_goal,
          target_metrics: params.target_metrics || {},
          competition_focus: params.competition_focus || false,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data as AnnualPlan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ANNUAL_QUERIES.plans] });
      queryClient.invalidateQueries({ queryKey: [ANNUAL_QUERIES.activePlan] });
    },
  });
}

/**
 * Update annual plan
 */
export function useUpdateAnnualPlan() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      updates: Partial<AnnualPlan>;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('annual_plans')
        .update({ ...params.updates, updated_at: new Date().toISOString() })
        .eq('id', params.id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data as AnnualPlan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ANNUAL_QUERIES.plans] });
      queryClient.invalidateQueries({ queryKey: [ANNUAL_QUERIES.activePlan] });
    },
  });
}

// ============================================================================
// Competitions Hooks
// ============================================================================

/**
 * Fetch competitions for a plan or all user competitions
 */
export function useCompetitions(planId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: [ANNUAL_QUERIES.competitions, user?.id, planId],
    queryFn: async (): Promise<Competition[]> => {
      if (!user?.id) return [];

      let query = supabase
        .from('competitions')
        .select('*')
        .eq('user_id', user.id)
        .order('event_date', { ascending: true });

      if (planId) {
        query = query.eq('annual_plan_id', planId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Competition[];
    },
    enabled: !!user?.id,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

/**
 * Fetch upcoming competitions
 */
export function useUpcomingCompetitions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: [ANNUAL_QUERIES.competitions, user?.id, 'upcoming'],
    queryFn: async (): Promise<Competition[]> => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('competitions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'upcoming')
        .gte('event_date', new Date().toISOString().split('T')[0])
        .order('event_date', { ascending: true });

      if (error) throw error;
      return data as Competition[];
    },
    enabled: !!user?.id,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

/**
 * Create a new competition
 */
export function useCreateCompetition() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      name: string;
      event_type: EventType;
      event_date: string;
      priority?: 'primary' | 'secondary' | 'tune_up';
      target_lifts?: TargetMetrics;
      weight_class?: string;
      annual_plan_id?: string;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('competitions')
        .insert({
          user_id: user.id,
          ...params,
          priority: params.priority || 'primary',
        })
        .select()
        .single();

      if (error) throw error;
      return data as Competition;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ANNUAL_QUERIES.competitions] });
      queryClient.invalidateQueries({ queryKey: [ANNUAL_QUERIES.recommendations] });
      queryClient.invalidateQueries({ queryKey: [ANNUAL_QUERIES.timeline] });
    },
  });
}

/**
 * Update a competition
 */
export function useUpdateCompetition() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      updates: Partial<Competition>;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('competitions')
        .update({ ...params.updates, updated_at: new Date().toISOString() })
        .eq('id', params.id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data as Competition;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ANNUAL_QUERIES.competitions] });
      queryClient.invalidateQueries({ queryKey: [ANNUAL_QUERIES.recommendations] });
    },
  });
}

/**
 * Delete a competition
 */
export function useDeleteCompetition() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (competitionId: string) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('competitions')
        .delete()
        .eq('id', competitionId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ANNUAL_QUERIES.competitions] });
      queryClient.invalidateQueries({ queryKey: [ANNUAL_QUERIES.timeline] });
    },
  });
}

// ============================================================================
// Planned Blocks Hooks
// ============================================================================

/**
 * Fetch planned blocks for a plan
 */
export function usePlannedBlocks(planId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: [ANNUAL_QUERIES.plannedBlocks, user?.id, planId],
    queryFn: async (): Promise<PlannedBlock[]> => {
      if (!user?.id) return [];

      let query = supabase
        .from('planned_blocks')
        .select('*')
        .eq('user_id', user.id)
        .order('planned_start_date', { ascending: true });

      if (planId) {
        query = query.eq('annual_plan_id', planId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PlannedBlock[];
    },
    enabled: !!user?.id,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

/**
 * Create a planned block
 */
export function useCreatePlannedBlock() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (block: Omit<PlannedBlock, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('planned_blocks')
        .insert({
          ...block,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as PlannedBlock;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ANNUAL_QUERIES.plannedBlocks] });
      queryClient.invalidateQueries({ queryKey: [ANNUAL_QUERIES.timeline] });
    },
  });
}

/**
 * Update a planned block
 */
export function useUpdatePlannedBlock() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      updates: Partial<PlannedBlock>;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('planned_blocks')
        .update({ ...params.updates, updated_at: new Date().toISOString() })
        .eq('id', params.id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data as PlannedBlock;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ANNUAL_QUERIES.plannedBlocks] });
      queryClient.invalidateQueries({ queryKey: [ANNUAL_QUERIES.timeline] });
    },
  });
}

/**
 * Delete a planned block
 */
export function useDeletePlannedBlock() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (blockId: string) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('planned_blocks')
        .delete()
        .eq('id', blockId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ANNUAL_QUERIES.plannedBlocks] });
      queryClient.invalidateQueries({ queryKey: [ANNUAL_QUERIES.timeline] });
    },
  });
}

// ============================================================================
// Block Recommendations Hook
// ============================================================================

/**
 * Get intelligent block recommendations based on context
 */
export function useBlockRecommendations() {
  const { user } = useAuth();

  return useQuery({
    queryKey: [ANNUAL_QUERIES.recommendations, user?.id],
    queryFn: async (): Promise<BlockRecommendation[]> => {
      if (!user?.id) return [];

      // Gather context
      const [profileResult, competitionsResult, blocksResult] = await Promise.all([
        supabase
          .from('training_profiles')
          .select('*')
          .eq('user_id', user.id)
          .single(),
        supabase
          .from('competitions')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'upcoming')
          .gte('event_date', new Date().toISOString().split('T')[0])
          .order('event_date', { ascending: true })
          .limit(1),
        supabase
          .from('planned_blocks')
          .select('*')
          .eq('user_id', user.id)
          .order('planned_start_date', { ascending: false })
          .limit(5),
      ]);

      const profile = profileResult.data as TrainingProfile | null;
      const nextCompetition = competitionsResult.data?.[0] as Competition | null;
      const recentBlocks = (blocksResult.data || []) as PlannedBlock[];

      const context: RecommendationContext = {
        profile,
        currentPhase: profile?.current_training_phase || null,
        weeksInPhase: profile?.weeks_in_current_phase || 0,
        nextCompetition,
        recentBlocks,
        goal: profile?.primary_goal || 'general',
      };

      return generateBlockRecommendations(context);
    },
    enabled: !!user?.id,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

// ============================================================================
// Timeline Generation Hook
// ============================================================================

/**
 * Generate or fetch annual timeline
 */
export function useAnnualTimeline(planId?: string) {
  const { user } = useAuth();
  const { data: plan } = useActiveAnnualPlan();
  const { data: competitions = [] } = useCompetitions(planId);
  const { data: plannedBlocks = [] } = usePlannedBlocks(planId);

  const timeline = useMemo(() => {
    if (!plan) return null;

    const startDate = new Date(plan.year, 0, 1);
    const endDate = new Date(plan.year, 11, 31);

    // If we have planned blocks, use them
    if (plannedBlocks.length > 0) {
      return {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        blocks: plannedBlocks,
        competitions,
        currentWeek: Math.ceil(
          (Date.now() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
        ),
        totalWeeks: 52,
      };
    }

    // Otherwise generate timeline
    const config: TimelineConfig = {
      startDate,
      endDate,
      goal: plan.primary_goal || 'general',
      competitions,
      deloadFrequency: plan.deload_frequency || 4,
    };

    const generatedBlocks = generateAnnualTimeline(config);

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      blocks: generatedBlocks,
      competitions,
      currentWeek: Math.ceil(
        (Date.now() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
      ),
      totalWeeks: 52,
    };
  }, [plan, competitions, plannedBlocks]);

  return {
    data: timeline,
    isLoading: !plan,
  };
}

// ============================================================================
// Composite Hook for Annual Planning
// ============================================================================

export function useAnnualPlanning() {
  const { data: activePlan, isLoading: planLoading } = useActiveAnnualPlan();
  const { data: competitions = [], isLoading: compsLoading } = useUpcomingCompetitions();
  const { data: plannedBlocks = [], isLoading: blocksLoading } = usePlannedBlocks(activePlan?.id);
  const { data: recommendations = [], isLoading: recsLoading } = useBlockRecommendations();
  const { data: timeline } = useAnnualTimeline(activePlan?.id);

  const createPlan = useCreateAnnualPlan();
  const createCompetition = useCreateCompetition();
  const createBlock = useCreatePlannedBlock();

  // Compute next competition
  const nextCompetition = useMemo(() => {
    return competitions.find(
      (c) => new Date(c.event_date) >= new Date() && c.status === 'upcoming'
    ) || null;
  }, [competitions]);

  // Compute current block
  const currentBlock = useMemo(() => {
    const now = new Date();
    return plannedBlocks.find((b) => {
      const start = new Date(b.planned_start_date);
      const end = new Date(start);
      end.setDate(end.getDate() + b.duration_weeks * 7);
      return now >= start && now <= end;
    }) || null;
  }, [plannedBlocks]);

  // Compute weeks until next competition
  const weeksToCompetition = useMemo(() => {
    if (!nextCompetition) return null;
    return Math.ceil(
      (new Date(nextCompetition.event_date).getTime() - Date.now()) /
        (7 * 24 * 60 * 60 * 1000)
    );
  }, [nextCompetition]);

  return {
    // Data
    activePlan,
    competitions,
    plannedBlocks,
    recommendations,
    timeline,
    nextCompetition,
    currentBlock,
    weeksToCompetition,

    // Loading states
    isLoading: planLoading || compsLoading || blocksLoading || recsLoading,

    // Actions
    createPlan,
    createCompetition,
    createBlock,
  };
}
