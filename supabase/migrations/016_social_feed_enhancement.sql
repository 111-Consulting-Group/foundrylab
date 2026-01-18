-- Migration: Social Feed Enhancement
-- Description: Adds comments, notifications, and enhanced post features for world-class social feed

-- ============================================
-- Post Comments Table (with threading support)
-- ============================================

CREATE TABLE post_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES workout_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES post_comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_edited BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for comments
CREATE INDEX idx_post_comments_post ON post_comments(post_id, created_at DESC);
CREATE INDEX idx_post_comments_user ON post_comments(user_id);
CREATE INDEX idx_post_comments_parent ON post_comments(parent_comment_id);

-- ============================================
-- Notifications Table
-- ============================================

CREATE TYPE notification_type AS ENUM (
    'like',
    'comment',
    'comment_reply',
    'follow',
    'mention',
    'pr_achieved',
    'streak_milestone'
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title TEXT NOT NULL,
    body TEXT,

    -- Actor who triggered the notification
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Related entities (nullable based on type)
    post_id UUID REFERENCES workout_posts(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES post_comments(id) ON DELETE CASCADE,
    workout_id UUID REFERENCES workouts(id) ON DELETE CASCADE,

    -- Additional data as JSON for flexibility
    data JSONB,

    -- Status
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for notifications
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_actor ON notifications(actor_id);

-- ============================================
-- Enhance workout_posts table
-- ============================================

-- Add image support
ALTER TABLE workout_posts ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add comment count cache for performance
ALTER TABLE workout_posts ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0;

-- Add like count cache for performance
ALTER TABLE workout_posts ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0;

-- ============================================
-- Row Level Security for New Tables
-- ============================================

-- Enable RLS
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Post Comments Policies
CREATE POLICY "Users can view comments on public posts"
    ON post_comments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM workout_posts
            WHERE workout_posts.id = post_comments.post_id
            AND (workout_posts.is_public = true OR workout_posts.user_id = auth.uid())
        )
    );

CREATE POLICY "Authenticated users can create comments"
    ON post_comments FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM workout_posts
            WHERE workout_posts.id = post_comments.post_id
            AND (workout_posts.is_public = true OR workout_posts.user_id = auth.uid())
        )
    );

CREATE POLICY "Users can update their own comments"
    ON post_comments FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
    ON post_comments FOR DELETE
    USING (auth.uid() = user_id);

-- Notifications Policies
CREATE POLICY "Users can view their own notifications"
    ON notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications for any user"
    ON notifications FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Users can update their own notifications"
    ON notifications FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications"
    ON notifications FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- Functions and Triggers
-- ============================================

-- Function to update comment count on workout_posts
CREATE OR REPLACE FUNCTION update_post_comment_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE workout_posts
        SET comment_count = comment_count + 1
        WHERE id = NEW.post_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE workout_posts
        SET comment_count = GREATEST(0, comment_count - 1)
        WHERE id = OLD.post_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_comment_count
    AFTER INSERT OR DELETE ON post_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_post_comment_count();

-- Function to update like count on workout_posts
CREATE OR REPLACE FUNCTION update_post_like_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE workout_posts
        SET like_count = like_count + 1
        WHERE id = NEW.post_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE workout_posts
        SET like_count = GREATEST(0, like_count - 1)
        WHERE id = OLD.post_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_like_count
    AFTER INSERT OR DELETE ON post_likes
    FOR EACH ROW
    EXECUTE FUNCTION update_post_like_count();

-- Function to create notification on new like
CREATE OR REPLACE FUNCTION create_like_notification()
RETURNS TRIGGER AS $$
DECLARE
    post_owner_id UUID;
    actor_name TEXT;
BEGIN
    -- Get post owner
    SELECT user_id INTO post_owner_id
    FROM workout_posts
    WHERE id = NEW.post_id;

    -- Don't notify if user liked their own post
    IF post_owner_id = NEW.user_id THEN
        RETURN NEW;
    END IF;

    -- Get actor display name
    SELECT COALESCE(display_name, email) INTO actor_name
    FROM user_profiles
    WHERE id = NEW.user_id;

    -- Create notification
    INSERT INTO notifications (user_id, type, title, body, actor_id, post_id)
    VALUES (
        post_owner_id,
        'like',
        COALESCE(actor_name, 'Someone') || ' liked your workout',
        NULL,
        NEW.user_id,
        NEW.post_id
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_like_notification
    AFTER INSERT ON post_likes
    FOR EACH ROW
    EXECUTE FUNCTION create_like_notification();

-- Function to create notification on new comment
CREATE OR REPLACE FUNCTION create_comment_notification()
RETURNS TRIGGER AS $$
DECLARE
    post_owner_id UUID;
    parent_author_id UUID;
    actor_name TEXT;
    comment_preview TEXT;
BEGIN
    -- Get post owner
    SELECT user_id INTO post_owner_id
    FROM workout_posts
    WHERE id = NEW.post_id;

    -- Get actor display name
    SELECT COALESCE(display_name, email) INTO actor_name
    FROM user_profiles
    WHERE id = NEW.user_id;

    -- Truncate comment for preview
    comment_preview := LEFT(NEW.content, 100);
    IF LENGTH(NEW.content) > 100 THEN
        comment_preview := comment_preview || '...';
    END IF;

    -- If this is a reply, notify parent comment author
    IF NEW.parent_comment_id IS NOT NULL THEN
        SELECT user_id INTO parent_author_id
        FROM post_comments
        WHERE id = NEW.parent_comment_id;

        -- Don't notify if replying to own comment
        IF parent_author_id IS NOT NULL AND parent_author_id != NEW.user_id THEN
            INSERT INTO notifications (user_id, type, title, body, actor_id, post_id, comment_id)
            VALUES (
                parent_author_id,
                'comment_reply',
                COALESCE(actor_name, 'Someone') || ' replied to your comment',
                comment_preview,
                NEW.user_id,
                NEW.post_id,
                NEW.id
            );
        END IF;
    END IF;

    -- Notify post owner (if not the commenter and not already notified as parent)
    IF post_owner_id != NEW.user_id AND (parent_author_id IS NULL OR parent_author_id != post_owner_id) THEN
        INSERT INTO notifications (user_id, type, title, body, actor_id, post_id, comment_id)
        VALUES (
            post_owner_id,
            'comment',
            COALESCE(actor_name, 'Someone') || ' commented on your workout',
            comment_preview,
            NEW.user_id,
            NEW.post_id,
            NEW.id
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_comment_notification
    AFTER INSERT ON post_comments
    FOR EACH ROW
    EXECUTE FUNCTION create_comment_notification();

-- Function to create notification on new follow
CREATE OR REPLACE FUNCTION create_follow_notification()
RETURNS TRIGGER AS $$
DECLARE
    actor_name TEXT;
BEGIN
    -- Get follower display name
    SELECT COALESCE(display_name, email) INTO actor_name
    FROM user_profiles
    WHERE id = NEW.follower_id;

    -- Create notification for the followed user
    INSERT INTO notifications (user_id, type, title, body, actor_id)
    VALUES (
        NEW.following_id,
        'follow',
        COALESCE(actor_name, 'Someone') || ' started following you',
        NULL,
        NEW.follower_id
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_follow_notification
    AFTER INSERT ON follows
    FOR EACH ROW
    EXECUTE FUNCTION create_follow_notification();

-- ============================================
-- Initialize counts for existing posts
-- ============================================

-- Update comment counts
UPDATE workout_posts wp
SET comment_count = (
    SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = wp.id
);

-- Update like counts
UPDATE workout_posts wp
SET like_count = (
    SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = wp.id
);
