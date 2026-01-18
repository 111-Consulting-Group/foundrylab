/**
 * Social Hooks
 * 
 * Hooks for feed, follow, like, and share functionality
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/useAppStore';
import { calculateStreak, type StreakInfo } from '@/lib/streakUtils';
import type { WorkoutWithSets, PostCommentWithUser, NotificationWithActor, UserProfile, ReactionType, ReactionCounts } from '@/types/database';

// Query keys
export const socialKeys = {
  all: ['social'] as const,
  feed: () => [...socialKeys.all, 'feed'] as const,
  followers: (userId: string) => [...socialKeys.all, 'followers', userId] as const,
  following: (userId: string) => [...socialKeys.all, 'following', userId] as const,
  likes: (postId: string) => [...socialKeys.all, 'likes', postId] as const,
  likers: (postId: string) => [...socialKeys.all, 'likers', postId] as const,
  reactions: (postId: string) => [...socialKeys.all, 'reactions', postId] as const,
  userSearch: (query: string) => [...socialKeys.all, 'userSearch', query] as const,
  comments: (postId: string) => [...socialKeys.all, 'comments', postId] as const,
  notifications: () => [...socialKeys.all, 'notifications'] as const,
  unreadCount: () => [...socialKeys.all, 'unreadCount'] as const,
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
  image_url: string | null;
  comment_count: number;
  like_count: number;
  reaction_counts: ReactionCounts;
  created_at: string;
  workout?: WorkoutWithSets;
  user?: {
    id: string;
    display_name: string | null;
    email: string | null;
  };
  user_goals?: UserGoal[];
  user_streak?: StreakInfo;
  is_liked?: boolean;
  user_reaction?: ReactionType | null;
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
      
      console.log('[Feed] Following IDs:', followingIds);
      console.log('[Feed] Total user IDs to show:', userIdsToShow.length);

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
      
      console.log('[Feed] Found', posts?.length || 0, 'posts');

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
        { data: reactions },
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

        // Fetch likes (legacy - for backwards compatibility)
        supabase
          .from('post_likes')
          .select('post_id, user_id')
          .in('post_id', postIds),

        // Fetch reactions (new reaction system)
        supabase
          .from('post_reactions')
          .select('post_id, user_id, reaction_type')
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

      // Process reactions
      const reactionCountsByPost = new Map<string, ReactionCounts>();
      const userReactions = new Map<string, ReactionType>();
      reactions?.forEach((reaction: any) => {
        // Build reaction counts
        const counts = reactionCountsByPost.get(reaction.post_id) || {};
        counts[reaction.reaction_type as ReactionType] = (counts[reaction.reaction_type as ReactionType] || 0) + 1;
        reactionCountsByPost.set(reaction.post_id, counts);

        // Track current user's reaction
        if (reaction.user_id === userId) {
          userReactions.set(reaction.post_id, reaction.reaction_type as ReactionType);
        }
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
        .order('date_completed', { ascending: false })
        .limit(500); // Limit to prevent large data fetches

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

        // Calculate total reactions for like_count (backwards compatible)
        const postReactionCounts = reactionCountsByPost.get(post.id) || {};
        const totalReactions = Object.values(postReactionCounts).reduce((sum: number, count) => sum + (count || 0), 0);

        return {
          ...post,
          like_count: totalReactions || likeCounts.get(post.id) || 0,
          is_liked: userLikes.has(post.id) || userReactions.has(post.id),
          reaction_counts: postReactionCounts,
          user_reaction: userReactions.get(post.id) || null,
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
      if (userId) {
        queryClient.invalidateQueries({ queryKey: socialKeys.following(userId) });
      }
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
 * Get list of users you are following
 */
export function useFollowing() {
  const userId = useAppStore((state) => state.userId);

  return useQuery({
    queryKey: socialKeys.following(userId || ''),
    queryFn: async (): Promise<SearchUser[]> => {
      if (!userId) return [];

      // Get users this user follows
      const { data: follows, error: followsError } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId);

      if (followsError) throw followsError;

      const followingIds = follows?.map((f) => f.following_id) || [];
      
      if (followingIds.length === 0) return [];

      // Get user profiles for followed users
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, display_name, email')
        .in('id', followingIds);

      if (profilesError) throw profilesError;
      return (profiles || []) as SearchUser[];
    },
    enabled: !!userId,
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
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

// ============================================================================
// COMMENTS HOOKS
// ============================================================================

/**
 * Get comments for a post (with threading support)
 */
export function useComments(postId: string) {
  return useQuery({
    queryKey: socialKeys.comments(postId),
    queryFn: async (): Promise<PostCommentWithUser[]> => {
      if (!postId) return [];

      // Fetch all comments for the post
      const { data: comments, error } = await supabase
        .from('post_comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (!comments || comments.length === 0) return [];

      // Fetch user profiles for all comment authors
      const userIds = [...new Set(comments.map(c => c.user_id))];
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, display_name, email')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      const profileMap = new Map<string, UserProfile>();
      profiles?.forEach(p => profileMap.set(p.id, p as UserProfile));

      // Build threaded comment structure
      const commentMap = new Map<string, PostCommentWithUser>();
      const topLevelComments: PostCommentWithUser[] = [];

      // First pass: create all comments with user info
      comments.forEach(comment => {
        const commentWithUser: PostCommentWithUser = {
          ...comment,
          user: profileMap.get(comment.user_id) || null,
          replies: [],
        };
        commentMap.set(comment.id, commentWithUser);
      });

      // Second pass: organize into threads
      comments.forEach(comment => {
        const commentWithUser = commentMap.get(comment.id)!;
        if (comment.parent_comment_id) {
          const parent = commentMap.get(comment.parent_comment_id);
          if (parent) {
            parent.replies = parent.replies || [];
            parent.replies.push(commentWithUser);
          } else {
            // Parent was deleted, show as top-level
            topLevelComments.push(commentWithUser);
          }
        } else {
          topLevelComments.push(commentWithUser);
        }
      });

      return topLevelComments;
    },
    enabled: !!postId,
    staleTime: 30 * 1000,
  });
}

/**
 * Add a comment to a post
 */
export function useAddComment() {
  const userId = useAppStore((state) => state.userId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      postId,
      content,
      parentCommentId,
    }: {
      postId: string;
      content: string;
      parentCommentId?: string;
    }): Promise<void> => {
      if (!userId) throw new Error('Not authenticated');
      if (!content.trim()) throw new Error('Comment cannot be empty');

      const { error } = await supabase.from('post_comments').insert({
        post_id: postId,
        user_id: userId,
        content: content.trim(),
        parent_comment_id: parentCommentId || null,
      });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: socialKeys.comments(variables.postId) });
      queryClient.invalidateQueries({ queryKey: socialKeys.feed() });
    },
  });
}

/**
 * Edit a comment
 */
export function useEditComment() {
  const userId = useAppStore((state) => state.userId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      commentId,
      postId,
      content,
    }: {
      commentId: string;
      postId: string;
      content: string;
    }): Promise<void> => {
      if (!userId) throw new Error('Not authenticated');
      if (!content.trim()) throw new Error('Comment cannot be empty');

      const { error } = await supabase
        .from('post_comments')
        .update({
          content: content.trim(),
          is_edited: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', commentId)
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: socialKeys.comments(variables.postId) });
    },
  });
}

/**
 * Delete a comment
 */
export function useDeleteComment() {
  const userId = useAppStore((state) => state.userId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      commentId,
      postId,
    }: {
      commentId: string;
      postId: string;
    }): Promise<void> => {
      if (!userId) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('post_comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: socialKeys.comments(variables.postId) });
      queryClient.invalidateQueries({ queryKey: socialKeys.feed() });
    },
  });
}

// ============================================================================
// NOTIFICATIONS HOOKS
// ============================================================================

/**
 * Get notifications for current user
 */
export function useNotifications(limit: number = 50) {
  const userId = useAppStore((state) => state.userId);

  return useQuery({
    queryKey: socialKeys.notifications(),
    queryFn: async (): Promise<NotificationWithActor[]> => {
      if (!userId) return [];

      const { data: notifications, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      if (!notifications || notifications.length === 0) return [];

      // Fetch actor profiles
      const actorIds = [...new Set(notifications.map(n => n.actor_id).filter(Boolean))];

      if (actorIds.length === 0) {
        return notifications.map(n => ({ ...n, actor: null }));
      }

      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, display_name, email')
        .in('id', actorIds);

      if (profilesError) throw profilesError;

      const profileMap = new Map<string, UserProfile>();
      profiles?.forEach(p => profileMap.set(p.id, p as UserProfile));

      return notifications.map(notification => ({
        ...notification,
        actor: notification.actor_id ? profileMap.get(notification.actor_id) || null : null,
      }));
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
  });
}

/**
 * Get unread notification count
 */
export function useUnreadNotificationCount() {
  const userId = useAppStore((state) => state.userId);

  return useQuery({
    queryKey: socialKeys.unreadCount(),
    queryFn: async (): Promise<number> => {
      if (!userId) return 0;

      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}

/**
 * Mark notification as read
 */
export function useMarkNotificationRead() {
  const userId = useAppStore((state) => state.userId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string): Promise<void> => {
      if (!userId) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: socialKeys.notifications() });
      queryClient.invalidateQueries({ queryKey: socialKeys.unreadCount() });
    },
  });
}

/**
 * Mark all notifications as read
 */
export function useMarkAllNotificationsRead() {
  const userId = useAppStore((state) => state.userId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<void> => {
      if (!userId) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: socialKeys.notifications() });
      queryClient.invalidateQueries({ queryKey: socialKeys.unreadCount() });
    },
  });
}

/**
 * Delete a notification
 */
export function useDeleteNotification() {
  const userId = useAppStore((state) => state.userId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string): Promise<void> => {
      if (!userId) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: socialKeys.notifications() });
      queryClient.invalidateQueries({ queryKey: socialKeys.unreadCount() });
    },
  });
}

// ============================================================================
// POST LIKERS HOOK
// ============================================================================

/**
 * Get list of users who liked a post
 */
export function usePostLikers(postId: string) {
  return useQuery({
    queryKey: socialKeys.likers(postId),
    queryFn: async (): Promise<SearchUser[]> => {
      if (!postId) return [];

      const { data: likes, error } = await supabase
        .from('post_likes')
        .select('user_id')
        .eq('post_id', postId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!likes || likes.length === 0) return [];

      const userIds = likes.map(l => l.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, display_name, email')
        .in('id', userIds);

      if (profilesError) throw profilesError;
      return (profiles || []) as SearchUser[];
    },
    enabled: !!postId,
    staleTime: 30 * 1000,
  });
}

// ============================================================================
// REACTIONS HOOKS
// ============================================================================

/**
 * Get user's reaction for a post
 */
export function useUserReaction(postId: string) {
  const userId = useAppStore((state) => state.userId);

  return useQuery({
    queryKey: socialKeys.reactions(postId),
    queryFn: async (): Promise<ReactionType | null> => {
      if (!userId || !postId) return null;

      const { data, error } = await supabase
        .from('post_reactions')
        .select('reaction_type')
        .eq('post_id', postId)
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
      return data?.reaction_type as ReactionType | null;
    },
    enabled: !!userId && !!postId,
    staleTime: 30 * 1000,
  });
}

/**
 * Add or update a reaction on a post
 */
export function useReactToPost() {
  const userId = useAppStore((state) => state.userId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      postId,
      reactionType,
    }: {
      postId: string;
      reactionType: ReactionType | null;
    }): Promise<void> => {
      if (!userId) throw new Error('Not authenticated');

      if (reactionType === null) {
        // Remove reaction
        const { error } = await supabase
          .from('post_reactions')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', userId);

        if (error) throw error;
      } else {
        // Upsert reaction (insert or update)
        const { error } = await supabase
          .from('post_reactions')
          .upsert(
            {
              post_id: postId,
              user_id: userId,
              reaction_type: reactionType,
            },
            {
              onConflict: 'post_id,user_id',
            }
          );

        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: socialKeys.reactions(variables.postId) });
      queryClient.invalidateQueries({ queryKey: socialKeys.feed() });
      queryClient.invalidateQueries({ queryKey: socialKeys.likers(variables.postId) });
    },
  });
}

/**
 * Get all users who reacted to a post (with reaction types)
 */
export function usePostReactors(postId: string) {
  return useQuery({
    queryKey: [...socialKeys.reactions(postId), 'users'] as const,
    queryFn: async (): Promise<Array<SearchUser & { reaction_type: ReactionType }>> => {
      if (!postId) return [];

      const { data: reactions, error } = await supabase
        .from('post_reactions')
        .select('user_id, reaction_type')
        .eq('post_id', postId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!reactions || reactions.length === 0) return [];

      const userIds = reactions.map(r => r.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, display_name, email')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      const profileMap = new Map<string, SearchUser>();
      profiles?.forEach(p => profileMap.set(p.id, p as SearchUser));

      return reactions.map(r => ({
        ...profileMap.get(r.user_id)!,
        reaction_type: r.reaction_type as ReactionType,
      })).filter(r => r.id);
    },
    enabled: !!postId,
    staleTime: 30 * 1000,
  });
}
