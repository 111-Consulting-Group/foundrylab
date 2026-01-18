-- Migration: Enhanced Reaction System
-- Description: Adds multiple reaction types beyond simple likes

-- ============================================
-- Reaction Types Enum
-- ============================================

CREATE TYPE reaction_type AS ENUM (
    'heart',      -- Classic like/love
    'fire',       -- Fire/hot
    'strong',     -- Muscle/strength
    'clap',       -- Applause/congrats
    'mindblown'   -- Mind blown/impressive
);

-- ============================================
-- Post Reactions Table (replaces simple likes for new reactions)
-- ============================================

CREATE TABLE post_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES workout_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reaction_type reaction_type NOT NULL DEFAULT 'heart',
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Each user can only have one reaction per post
    UNIQUE(post_id, user_id)
);

-- Indexes for reactions
CREATE INDEX idx_post_reactions_post ON post_reactions(post_id);
CREATE INDEX idx_post_reactions_user ON post_reactions(user_id);
CREATE INDEX idx_post_reactions_type ON post_reactions(post_id, reaction_type);

-- ============================================
-- Add reaction counts cache to workout_posts
-- ============================================

ALTER TABLE workout_posts ADD COLUMN IF NOT EXISTS reaction_counts JSONB DEFAULT '{}';

-- ============================================
-- Row Level Security for Reactions
-- ============================================

ALTER TABLE post_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reactions on accessible posts"
    ON post_reactions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM workout_posts
            WHERE workout_posts.id = post_reactions.post_id
            AND (workout_posts.is_public = true OR workout_posts.user_id = auth.uid())
        )
    );

CREATE POLICY "Authenticated users can add reactions"
    ON post_reactions FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM workout_posts
            WHERE workout_posts.id = post_reactions.post_id
            AND (workout_posts.is_public = true OR workout_posts.user_id = auth.uid())
        )
    );

CREATE POLICY "Users can update their own reactions"
    ON post_reactions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reactions"
    ON post_reactions FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- Function to update reaction counts cache
-- ============================================

CREATE OR REPLACE FUNCTION update_reaction_counts()
RETURNS TRIGGER AS $$
DECLARE
    new_counts JSONB;
BEGIN
    -- Calculate new counts for the affected post
    SELECT jsonb_object_agg(reaction_type, count)
    INTO new_counts
    FROM (
        SELECT reaction_type, COUNT(*) as count
        FROM post_reactions
        WHERE post_id = COALESCE(NEW.post_id, OLD.post_id)
        GROUP BY reaction_type
    ) counts;

    -- Update the workout_posts table
    UPDATE workout_posts
    SET reaction_counts = COALESCE(new_counts, '{}')
    WHERE id = COALESCE(NEW.post_id, OLD.post_id);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_reaction_counts
    AFTER INSERT OR UPDATE OR DELETE ON post_reactions
    FOR EACH ROW
    EXECUTE FUNCTION update_reaction_counts();

-- ============================================
-- Function to create notification on reaction
-- ============================================

CREATE OR REPLACE FUNCTION create_reaction_notification()
RETURNS TRIGGER AS $$
DECLARE
    post_owner_id UUID;
    actor_name TEXT;
    reaction_emoji TEXT;
BEGIN
    -- Get post owner
    SELECT user_id INTO post_owner_id
    FROM workout_posts
    WHERE id = NEW.post_id;

    -- Don't notify if user reacted to their own post
    IF post_owner_id = NEW.user_id THEN
        RETURN NEW;
    END IF;

    -- Get actor display name
    SELECT COALESCE(display_name, email) INTO actor_name
    FROM user_profiles
    WHERE id = NEW.user_id;

    -- Map reaction type to emoji for notification
    reaction_emoji := CASE NEW.reaction_type
        WHEN 'heart' THEN 'loved'
        WHEN 'fire' THEN 'thinks is fire'
        WHEN 'strong' THEN 'thinks is strong'
        WHEN 'clap' THEN 'applauded'
        WHEN 'mindblown' THEN 'is mind-blown by'
        ELSE 'reacted to'
    END;

    -- Create notification (update the existing like notification type)
    INSERT INTO notifications (user_id, type, title, body, actor_id, post_id, data)
    VALUES (
        post_owner_id,
        'like',
        COALESCE(actor_name, 'Someone') || ' ' || reaction_emoji || ' your workout',
        NULL,
        NEW.user_id,
        NEW.post_id,
        jsonb_build_object('reaction_type', NEW.reaction_type)
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_reaction_notification
    AFTER INSERT ON post_reactions
    FOR EACH ROW
    EXECUTE FUNCTION create_reaction_notification();

-- ============================================
-- Migrate existing likes to reactions
-- ============================================

INSERT INTO post_reactions (post_id, user_id, reaction_type, created_at)
SELECT post_id, user_id, 'heart', created_at
FROM post_likes
ON CONFLICT (post_id, user_id) DO NOTHING;

-- Initialize reaction counts for existing posts
UPDATE workout_posts wp
SET reaction_counts = COALESCE(
    (SELECT jsonb_object_agg(reaction_type, count)
     FROM (
         SELECT reaction_type, COUNT(*) as count
         FROM post_reactions pr
         WHERE pr.post_id = wp.id
         GROUP BY reaction_type
     ) counts),
    '{}'
);
