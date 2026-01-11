-- Migration: Goals System
-- Description: Adds fitness goals table for tracking user objectives
-- Users can set goals like "Squat 405 by June" and track progress

-- Goals table
CREATE TABLE fitness_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    exercise_id UUID REFERENCES exercises(id) ON DELETE SET NULL,

    -- Goal definition
    goal_type TEXT NOT NULL DEFAULT 'e1rm', -- 'e1rm', 'weight', 'reps', 'volume', 'watts', 'pace', 'distance', 'custom'
    target_value DECIMAL NOT NULL,
    target_unit TEXT NOT NULL DEFAULT 'lbs', -- 'lbs', 'kg', 'reps', 'watts', 'min/mi', 'mi', 'km'
    description TEXT, -- Custom description like "Compete in powerlifting meet"

    -- Tracking
    starting_value DECIMAL, -- Where user was when they set the goal
    current_value DECIMAL, -- Latest measured value
    target_date DATE, -- Optional deadline

    -- Status
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'achieved', 'abandoned', 'paused'
    achieved_at TIMESTAMPTZ, -- When goal was hit

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_fitness_goals_user ON fitness_goals(user_id);
CREATE INDEX idx_fitness_goals_exercise ON fitness_goals(exercise_id);
CREATE INDEX idx_fitness_goals_status ON fitness_goals(user_id, status);

-- Enable RLS
ALTER TABLE fitness_goals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own goals"
    ON fitness_goals FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own goals"
    ON fitness_goals FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goals"
    ON fitness_goals FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own goals"
    ON fitness_goals FOR DELETE
    USING (auth.uid() = user_id);

-- Also allow viewing goals of users you follow (for social feed)
CREATE POLICY "Users can view goals of followed users"
    ON fitness_goals FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM follows
            WHERE follows.follower_id = auth.uid()
            AND follows.following_id = fitness_goals.user_id
        )
    );

-- Function to update current_value and check achievement
CREATE OR REPLACE FUNCTION update_goal_progress()
RETURNS TRIGGER AS $$
BEGIN
    -- If we just hit or exceeded the target
    IF NEW.current_value >= NEW.target_value AND OLD.current_value < NEW.target_value THEN
        NEW.status := 'achieved';
        NEW.achieved_at := NOW();
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_goal_progress
    BEFORE UPDATE OF current_value ON fitness_goals
    FOR EACH ROW
    EXECUTE FUNCTION update_goal_progress();
