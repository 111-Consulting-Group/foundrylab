-- Migration: Progression System and Social Features
-- Description: Adds workout context, progression tracking, block phases, and social infrastructure

-- Workout context type
CREATE TYPE workout_context AS ENUM ('building', 'maintaining', 'deloading', 'testing', 'unstructured');

-- Add context to workouts table
ALTER TABLE workouts ADD COLUMN context workout_context DEFAULT 'unstructured';

-- Block phase tracking (accumulation, intensification, realization, deload)
ALTER TABLE training_blocks ADD COLUMN phase TEXT;

-- Progression tracking per set
ALTER TABLE workout_sets ADD COLUMN progression_type TEXT; -- '+5lb', '+1rep', 'matched', 'regressed', null
ALTER TABLE workout_sets ADD COLUMN previous_set_id UUID REFERENCES workout_sets(id) ON DELETE SET NULL;

-- Index for progression queries
CREATE INDEX idx_workout_sets_exercise_user ON workout_sets(exercise_id, workout_id);
CREATE INDEX idx_workouts_context ON workouts(user_id, context, date_completed);

-- ============================================
-- Social Tables
-- ============================================

-- Follows table (user relationships)
CREATE TABLE follows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(follower_id, following_id),
    CHECK (follower_id != following_id)
);

-- Indexes for follows
CREATE INDEX idx_follows_follower ON follows(follower_id);
CREATE INDEX idx_follows_following ON follows(following_id);

-- Workout posts (shared workouts)
CREATE TABLE workout_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    caption TEXT,
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for posts
CREATE INDEX idx_workout_posts_user ON workout_posts(user_id);
CREATE INDEX idx_workout_posts_workout ON workout_posts(workout_id);
CREATE INDEX idx_workout_posts_public ON workout_posts(is_public, created_at DESC);

-- Post likes
CREATE TABLE post_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES workout_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

-- Indexes for likes
CREATE INDEX idx_post_likes_post ON post_likes(post_id);
CREATE INDEX idx_post_likes_user ON post_likes(user_id);

-- ============================================
-- Row Level Security for Social Tables
-- ============================================

-- Enable RLS
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;

-- Follows policies
CREATE POLICY "Users can view who they follow"
    ON follows FOR SELECT
    USING (auth.uid() = follower_id OR auth.uid() = following_id);

CREATE POLICY "Users can create follows"
    ON follows FOR INSERT
    WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can delete their own follows"
    ON follows FOR DELETE
    USING (auth.uid() = follower_id);

-- Workout posts policies
CREATE POLICY "Users can view public posts"
    ON workout_posts FOR SELECT
    USING (is_public = true OR auth.uid() = user_id);

CREATE POLICY "Users can create their own posts"
    ON workout_posts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts"
    ON workout_posts FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts"
    ON workout_posts FOR DELETE
    USING (auth.uid() = user_id);

-- Post likes policies
CREATE POLICY "Users can view likes on posts they can see"
    ON post_likes FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM workout_posts
            WHERE workout_posts.id = post_likes.post_id
            AND (workout_posts.is_public = true OR workout_posts.user_id = auth.uid())
        )
    );

CREATE POLICY "Users can create likes"
    ON post_likes FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM workout_posts
            WHERE workout_posts.id = post_likes.post_id
            AND (workout_posts.is_public = true OR workout_posts.user_id = auth.uid())
        )
    );

CREATE POLICY "Users can delete their own likes"
    ON post_likes FOR DELETE
    USING (auth.uid() = user_id);
