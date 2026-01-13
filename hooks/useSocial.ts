/**
 * Social Hooks
 * 
 * Hooks for feed, follow, like, and share functionality
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/useAppStore';
import { calculateStreak, type StreakInfo } from '@/lib/streakUtils';
import type { WorkoutWithSets } from '@/types/database';

// Query keys
export const socialKeys = {
  all: ['social'] as const,
  feed: () => [...socialKeys.all, 'feed'] as const,
  followers: (userId: string) => [...socialKeys.all, 'followers', userId] as const,
  following: (userId: string) => [...socialKeys.all, 'following', userId] as const,
  likes: (postId: string) => [...socialKeys.all, 'likes', postId] as const,
  userSearch: (query: string) => [...socialKeys.all, 'userSearch', query] as const,
};

interface UserGoal {
  id: string;
  exercise_id: string;
  target_value: number;
  current_value: number | null;
  status: string;
  exercise?: {
    id: string;
    name: string;
  };
}

interface WorkoutPost {
  id: string;
  workout_id: string;
  user_id: string;
  caption: string | null;
  is_public: boolean;
  created_at: string;
  workout?: WorkoutWithSets;
  user?: {
    id: string;
    display_name: string | null;
    email: string | null;
  };
  user_goals?: UserGoal[];
  user_streak?: StreakInfo;
  like_count?: number;
  is_liked?: boolean;
}

/**
 * Get feed of posts from followed users
 */
export function useFeed(limit: number = 20) {
  const userId = useAppStore((state) => state.userId);

  return useQuery({
    queryKey: socialKeys.feed(),
    queryFn: async (): Promise<WorkoutPost[]> => {
      if (!userId) return [];

      // Get users this user follows
      const { data: following, error: followingError } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId);

      if (followingError) throw followingError;

      const followingIds = following?.map((f) => f.following_id) || [];
      
      // Include current user's posts too
      const userIdsToShow = [...followingIds, userId];

      // Get posts from followed users - fetch workouts with minimal nested data
      const { data: posts, error: postsError } = await supabase
        .from('workout_posts')
        .select(`
          *,
          workout:workouts(
            id,
            focus,
            date_completed,
            duration_minutes,
            block_id,
            week_number,
            day_number
          )
        `)
        .in('user_id', userIdsToShow)
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (postsError) {
        console.error('Error fetching posts:', postsError);
        throw postsError;
      }

      if (!posts || posts.length === 0) {
        return [];
      }

      // Get unique user IDs and workout IDs from posts
      const uniqueUserIds = [...new Set(posts.map((p: any) => p.user_id))];
      const workoutIds = posts.map((p: any) => p.workout_id).filter(Boolean);
      const postIds = posts.map((p) => p.id);

      // Run all data fetches in parallel for better performance
      const [
        { data: userProfiles },
        { data: sets },
        { data: likes },
        { data: goals },
      ] = await Promise.all([
        // Fetch user profiles
        supabase
          .from('user_profiles')
          .select('id, display_name, email')
          .in('id', uniqueUserIds),
        
        // Fetch workout sets - only for workouts in feed, exclude warmup sets
        workoutIds.length > 0
          ? supabase
              .from('workout_sets')
              .select(`
                *,
                exercise:exercises(id, name, modality, muscle_group)
              `)
              .in('workout_id', workoutIds)
              .eq('is_warmup', false)
              .order('workout_id, set_order')
              .limit(200) // Limit total sets to avoid huge queries
          : Promise.resolve({ data: null, error: null }),
        
        // Fetch likes
        supabase
          .from('post_likes')
          .select('post_id, user_id')
          .in('post_id', postIds),
        
        // Fetch active goals (simplified - only for users in feed)
        supabase
          .from('fitness_goals')
          .select(`
            id,
            user_id,
            exercise_id,
            target_value,
            current_value,
            status,
            exercise:exercises(id, name)
          `)
          .in('user_id', uniqueUserIds)
          .eq('status', 'active')
          .limit(50), // Limit goals to avoid huge queries
      ]);

      // Create maps for efficient lookups
      const profilesByUserId = new Map<string, any>();
      userProfiles?.forEach((profile) => {
        profilesByUserId.set(profile.id, profile);
      });

      const setsByWorkout = new Map<string, any[]>();
      sets?.forEach((set: any) => {
        const workoutId = set.workout_id;
        if (!setsByWorkout.has(workoutId)) {
          setsByWorkout.set(workoutId, []);
        }
        setsByWorkout.get(workoutId)!.push(set);
      });

      const likeCounts = new Map<string, number>();
      const userLikes = new Set<string>();
      likes?.forEach((like) => {
        likeCounts.set(like.post_id, (likeCounts.get(like.post_id) || 0) + 1);
        if (like.user_id === userId) {
          userLikes.add(like.post_id);
        }
      });

      const goalsByUser = new Map<string, UserGoal[]>();
      goals?.forEach((goal) => {
        const userGoals = goalsByUser.get(goal.user_id) || [];
        userGoals.push({
          id: goal.id,
          exercise_id: goal.exercise_id,
          target_value: goal.target_value,
          current_value: goal.current_value,
          status: goal.status,
          exercise: goal.exercise as { id: string; name: string } | undefined,
        });
        goalsByUser.set(goal.user_id, userGoals);
      });

      // Calculate streaks - OPTIMIZED: Only fetch last 30 days of workouts per user
      // This is much faster than fetching 500 workouts
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: recentWorkouts } = await supabase
        .from('workouts')
        .select('user_id, date_completed')
        .in('user_id', uniqueUserIds)
        .not('date_completed', 'is', null)
        .gte('date_completed', thirtyDaysAgo.toISOString())
        .order('date_completed', { ascending: false });

      const streaksByUser = new Map<string, StreakInfo>();
      const workoutDatesByUser = new Map<string, string[]>();

      recentWorkouts?.forEach((w) => {
        if (w.date_completed) {
          const dates = workoutDatesByUser.get(w.user_id) || [];
          dates.push(w.date_completed);
          workoutDatesByUser.set(w.user_id, dates);
        }
      });

      workoutDatesByUser.forEach((dates, usrId) => {
        streaksByUser.set(usrId, calculateStreak(dates));
      });

      // Assemble final posts with all data
      return posts.map((post: any) => {
        // Attach user profile
        post.user = profilesByUserId.get(post.user_id) || null;
        
        // Attach workout sets if workout exists
        if (post.workout) {
          post.workout.workout_sets = setsByWorkout.get(post.workout_id) || [];
        }

        return {
          ...post,
          like_count: likeCounts.get(post.id) || 0,
          is_liked: userLikes.has(post.id),
          user_goals: goalsByUser.get(post.user_id) || [],
          user_streak: streaksByUser.get(post.user_id) || undefined,
        } as WorkoutPost;
      });
    },
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 seconds - cache for 30s to reduce refetches
    gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache for 5 minutes
  });
}

/**
 * Follow/unfollow a user
 */
export function useFollow() {
  const userId = useAppStore((state) => state.userId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ followingId, follow }: { followingId: string; follow: boolean }): Promise<void> => {
      if (!userId) throw new Error('Not authenticated');

      if (follow) {
        const { error } = await supabase
          .from('follows')
          .insert({ follower_id: userId, following_id: followingId });

        if (error && error.code !== '23505') throw error; // Ignore duplicate follow
      } else {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', userId)
          .eq('following_id', followingId);

        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      // Invalidate feed and follow status queries
      queryClient.invalidateQueries({ queryKey: socialKeys.feed() });
      queryClient.invalidateQueries({ queryKey: ['followStatus', userId, variables.followingId] });
      queryClient.invalidateQueries({ queryKey: socialKeys.following(userId) });
    },
  });
}

/**
 * Like/unlike a post
 */
export function useLikePost() {
  const userId = useAppStore((state) => state.userId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, like }: { postId: string; like: boolean }): Promise<void> => {
      if (!userId) throw new Error('Not authenticated');

      if (like) {
        const { error } = await supabase
          .from('post_likes')
          .insert({ post_id: postId, user_id: userId });

        if (error && error.code !== '23505') throw error; // Ignore duplicate like
      } else {
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', userId);

        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: socialKeys.feed() });
      queryClient.invalidateQueries({ queryKey: socialKeys.likes(variables.postId) });
    },
  });
}

/**
 * Share a workout as a post
 */
export function useShareWorkout() {
  const userId = useAppStore((state) => state.userId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workoutId, caption }: { workoutId: string; caption?: string }): Promise<void> => {
      if (!userId) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('workout_posts')
        .insert({
          workout_id: workoutId,
          user_id: userId,
          caption: caption || null,
          is_public: true,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: socialKeys.feed() });
    },
  });
}

interface SearchUser {
  id: string;
  display_name: string | null;
  email: string | null;
}

/**
 * Search for users by email or display name
 */
export function useSearchUsers(searchQuery: string, limit: number = 20) {
  const userId = useAppStore((state) => state.userId);

  return useQuery({
    queryKey: socialKeys.userSearch(searchQuery),
    queryFn: async (): Promise<SearchUser[]> => {
      if (!userId || !searchQuery || searchQuery.length < 2) return [];

      const query = searchQuery.toLowerCase().trim();
      
      // Search by display_name or email (case-insensitive partial match)
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, display_name, email')
        .neq('id', userId) // Exclude current user
        .or(`display_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(limit);

      if (error) throw error;
      return (data || []) as SearchUser[];
    },
    enabled: !!userId && !!searchQuery && searchQuery.length >= 2,
  });
}
