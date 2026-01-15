/**
 * Achievements Hook
 *
 * Fetches user achievements and provides functions to check/award new ones.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/useAppStore';
import { calculateStreak, type StreakInfo } from '@/lib/streakUtils';
import {
  getAchievementById,
  checkStreakAchievements,
  checkConsistencyAchievements,
  checkVolumeAchievements,
  createPRAchievement,
  createBlockCompleteAchievement,
  type AchievementDefinition,
  ALL_ACHIEVEMENTS,
} from '@/lib/achievementUtils';
import type { AchievementType } from '@/types/database';

// Query keys
export const achievementKeys = {
  all: ['achievements'] as const,
  list: (userId: string) => [...achievementKeys.all, 'list', userId] as const,
  recent: (userId: string) => [...achievementKeys.all, 'recent', userId] as const,
  stats: (userId: string) => [...achievementKeys.all, 'stats', userId] as const,
};

interface StoredAchievement {
  id: string;
  user_id: string;
  achievement_type: AchievementType;
  label: string;
  description: string | null;
  icon: string | null;
  achievement_data: Record<string, any>;
  workout_id: string | null;
  exercise_id: string | null;
  block_id: string | null;
  is_active: boolean;
  earned_at: string;
  is_featured: boolean;
}

interface AchievementWithDefinition {
  stored: StoredAchievement;
  definition: AchievementDefinition;
}

/**
 * Get all achievements for a user
 */
export function useUserAchievements(userId?: string) {
  const currentUserId = useAppStore((state) => state.userId);
  const targetUserId = userId || currentUserId;

  return useQuery({
    queryKey: achievementKeys.list(targetUserId || ''),
    queryFn: async (): Promise<AchievementWithDefinition[]> => {
      if (!targetUserId) return [];

      const { data, error } = await supabase
        .from('user_achievements')
        .select('*')
        .eq('user_id', targetUserId)
        .order('earned_at', { ascending: false });

      if (error) throw error;

      // Map to definitions
      return (data || []).map((stored: StoredAchievement) => {
        // Try to find a matching definition by type and threshold
        let definition = ALL_ACHIEVEMENTS.find((d) => {
          if (d.type !== stored.achievement_type) return false;

          // For streak achievements, match by days
          if (d.type === 'streak' && stored.achievement_data.days) {
            return d.threshold === stored.achievement_data.days;
          }

          // For consistency, match by rate
          if (d.type === 'consistency' && stored.achievement_data.rate) {
            return d.threshold === stored.achievement_data.rate;
          }

          // For volume, match by total_lbs
          if (d.type === 'volume_milestone' && stored.achievement_data.total_lbs) {
            return d.threshold === stored.achievement_data.total_lbs;
          }

          return false;
        });

        // If no static definition found, create dynamic one
        if (!definition) {
          definition = {
            type: stored.achievement_type,
            id: stored.id,
            name: stored.label,
            description: stored.description || '',
            icon: stored.icon || 'ribbon',
            iconColor: '#8B5CF6',
            bgColor: 'rgba(139, 92, 246, 0.15)',
          };
        }

        return { stored, definition };
      });
    },
    enabled: !!targetUserId,
  });
}

/**
 * Get recent achievements (last 7 days)
 */
export function useRecentAchievements(limit: number = 5) {
  const userId = useAppStore((state) => state.userId);

  return useQuery({
    queryKey: achievementKeys.recent(userId || ''),
    queryFn: async (): Promise<AchievementWithDefinition[]> => {
      if (!userId) return [];

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data, error } = await supabase
        .from('user_achievements')
        .select('*')
        .eq('user_id', userId)
        .gte('earned_at', sevenDaysAgo.toISOString())
        .order('earned_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map((stored: StoredAchievement) => {
        const definition = getAchievementById(stored.id) || {
          type: stored.achievement_type,
          id: stored.id,
          name: stored.label,
          description: stored.description || '',
          icon: stored.icon || 'ribbon',
          iconColor: '#8B5CF6',
          bgColor: 'rgba(139, 92, 246, 0.15)',
        };
        return { stored, definition };
      });
    },
    enabled: !!userId,
  });
}

/**
 * Get achievement stats (counts by type)
 */
export function useAchievementStats() {
  const userId = useAppStore((state) => state.userId);

  return useQuery({
    queryKey: achievementKeys.stats(userId || ''),
    queryFn: async () => {
      if (!userId) return { total: 0, byType: {} };

      const { data, error } = await supabase
        .from('user_achievements')
        .select('achievement_type')
        .eq('user_id', userId);

      if (error) throw error;

      const byType: Record<AchievementType, number> = {
        pr: 0,
        streak: 0,
        block_complete: 0,
        consistency: 0,
        volume_milestone: 0,
      };

      (data || []).forEach((a: { achievement_type: AchievementType }) => {
        byType[a.achievement_type]++;
      });

      return {
        total: data?.length || 0,
        byType,
      };
    },
    enabled: !!userId,
  });
}

/**
 * Award an achievement
 */
export function useAwardAchievement() {
  const userId = useAppStore((state) => state.userId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      achievement,
      data,
      workoutId,
      exerciseId,
      blockId,
    }: {
      achievement: AchievementDefinition;
      data?: Record<string, any>;
      workoutId?: string;
      exerciseId?: string;
      blockId?: string;
    }) => {
      if (!userId) throw new Error('Not authenticated');

      const { error } = await supabase.from('user_achievements').insert({
        user_id: userId,
        achievement_type: achievement.type,
        label: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        achievement_data: data || {},
        workout_id: workoutId || null,
        exercise_id: exerciseId || null,
        block_id: blockId || null,
      });

      if (error && error.code !== '23505') {
        // Ignore duplicate constraint violation
        throw error;
      }

      return achievement;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: achievementKeys.all });
    },
  });
}

/**
 * Check and award achievements based on current stats
 * Call this after workout completion
 */
export function useCheckAchievements() {
  const userId = useAppStore((state) => state.userId);
  const awardAchievement = useAwardAchievement();

  const checkAndAward = async (workoutId?: string) => {
    if (!userId) return [];

    // Fetch existing achievements directly to avoid race conditions
    // (cached data might not be loaded yet when this is called)
    const { data: existingAchievementsData } = await supabase
      .from('user_achievements')
      .select('achievement_type, achievement_data')
      .eq('user_id', userId);

    // Build earnedIds from existing achievements by matching type and threshold
    const earnedIds: string[] = [];
    for (const stored of existingAchievementsData || []) {
      // Match streak achievements by threshold
      if (stored.achievement_type === 'streak' && stored.achievement_data?.days) {
        const matchingDef = ALL_ACHIEVEMENTS.find(
          (d) => d.type === 'streak' && d.threshold === stored.achievement_data.days
        );
        if (matchingDef) earnedIds.push(matchingDef.id);
      }
      // Match consistency achievements
      if (stored.achievement_type === 'consistency' && stored.achievement_data?.rate) {
        const matchingDef = ALL_ACHIEVEMENTS.find(
          (d) => d.type === 'consistency' && d.threshold === stored.achievement_data.rate
        );
        if (matchingDef) earnedIds.push(matchingDef.id);
      }
      // Match volume achievements
      if (stored.achievement_type === 'volume_milestone' && stored.achievement_data?.total_lbs) {
        const matchingDef = ALL_ACHIEVEMENTS.find(
          (d) => d.type === 'volume_milestone' && d.threshold === stored.achievement_data.total_lbs
        );
        if (matchingDef) earnedIds.push(matchingDef.id);
      }
    }
    const newAchievements: AchievementDefinition[] = [];

    // Fetch current stats
    const [streakResult, volumeResult] = await Promise.all([
      // Get workout dates for streak
      supabase
        .from('workouts')
        .select('date_completed')
        .eq('user_id', userId)
        .not('date_completed', 'is', null)
        .order('date_completed', { ascending: false })
        .limit(100),
      // Get total volume
      supabase
        .from('workout_sets')
        .select('actual_weight, actual_reps, workout:workouts!inner(user_id)')
        .eq('workout.user_id', userId)
        .eq('is_warmup', false),
    ]);

    // Calculate streak
    const workoutDates = streakResult.data?.map((w) => w.date_completed as string) || [];
    const streakInfo = calculateStreak(workoutDates);

    // Check streak achievements
    // Only award NEW milestones (3, 7, 14, 30, 60, 90 days)
    const streakAchievements = checkStreakAchievements(streakInfo.currentStreak, earnedIds);
    for (const achievement of streakAchievements) {
      try {
        await awardAchievement.mutateAsync({
          achievement,
          data: { days: achievement.threshold }, // Use threshold for matching, not current streak
          workoutId,
        });
        newAchievements.push(achievement);
      } catch {
        // Ignore errors (likely duplicate)
      }
    }

    // Check consistency achievements
    const consistencyAchievements = checkConsistencyAchievements(
      streakInfo.weeklyAdherence,
      earnedIds
    );
    for (const achievement of consistencyAchievements) {
      try {
        await awardAchievement.mutateAsync({
          achievement,
          data: { rate: achievement.threshold },
          workoutId,
        });
        newAchievements.push(achievement);
      } catch {
        // Ignore errors
      }
    }

    // Calculate total volume
    const totalVolume =
      volumeResult.data?.reduce((sum, set: any) => {
        return sum + (set.actual_weight || 0) * (set.actual_reps || 0);
      }, 0) || 0;

    // Check volume achievements
    const volumeAchievements = checkVolumeAchievements(totalVolume, earnedIds);
    for (const achievement of volumeAchievements) {
      try {
        await awardAchievement.mutateAsync({
          achievement,
          data: { total_lbs: achievement.threshold },
          workoutId,
        });
        newAchievements.push(achievement);
      } catch {
        // Ignore errors
      }
    }

    return newAchievements;
  };

  return { checkAndAward };
}

/**
 * Award a PR achievement
 */
export function useAwardPRAchievement() {
  const awardAchievement = useAwardAchievement();

  return useMutation({
    mutationFn: async ({
      exerciseName,
      value,
      unit,
      workoutId,
      exerciseId,
    }: {
      exerciseName: string;
      value: number;
      unit: string;
      workoutId?: string;
      exerciseId?: string;
    }) => {
      const achievement = createPRAchievement(exerciseName, value, unit);
      await awardAchievement.mutateAsync({
        achievement,
        data: { value, unit },
        workoutId,
        exerciseId,
      });
      return achievement;
    },
  });
}

/**
 * Award a block complete achievement
 */
export function useAwardBlockCompleteAchievement() {
  const awardAchievement = useAwardAchievement();

  return useMutation({
    mutationFn: async ({
      blockName,
      blockId,
      workoutId,
    }: {
      blockName: string;
      blockId: string;
      workoutId?: string;
    }) => {
      const achievement = createBlockCompleteAchievement(blockName);
      await awardAchievement.mutateAsync({
        achievement,
        data: { block_name: blockName },
        workoutId,
        blockId,
      });
      return achievement;
    },
  });
}
