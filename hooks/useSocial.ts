/**
 * Social Hooks
 * 
 * Hooks for feed, follow, like, and share functionality
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/useAppStore';
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

      // Get posts from followed users
      const { data: posts, error: postsError } = await supabase
        .from('workout_posts')
        .select(`
          *,
          workout:workouts(
            *,
            workout_sets(
              *,
              exercise:exercises(*)
            )
          ),
          user:user_profiles(id, display_name, email)
        `)
        .in('user_id', userIdsToShow)
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (postsError) throw postsError;

      // Get like counts and user's likes
      const postIds = posts?.map((p) => p.id) || [];
      
      if (postIds.length > 0) {
        const { data: likes } = await supabase
          .from('post_likes')
          .select('post_id, user_id')
          .in('post_id', postIds);

        // Count likes per post
        const likeCounts = new Map<string, number>();
        const userLikes = new Set<string>();

        likes?.forEach((like) => {
          likeCounts.set(like.post_id, (likeCounts.get(like.post_id) || 0) + 1);
          if (like.user_id === userId) {
            userLikes.add(like.post_id);
          }
        });

        // Add like counts and is_liked to posts
        return (posts || []).map((post) => ({
          ...post,
          like_count: likeCounts.get(post.id) || 0,
          is_liked: userLikes.has(post.id),
        })) as WorkoutPost[];
      }

      return (posts || []) as WorkoutPost[];
    },
    enabled: !!userId,
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

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', userId)
          .eq('following_id', followingId);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: socialKeys.feed() });
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
