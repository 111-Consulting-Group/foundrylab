-- ============================================================================
-- Migration 020: Fix Missing Tables and Columns
--
-- Addresses database schema gaps that cause API errors:
-- 1. Creates `goals` table (code expects this, migration 006 creates `fitness_goals`)
-- 2. Adds `is_current` column to `personal_records`
-- 3. Creates `journey_signals` table for journey detection
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Goals Table
-- The app code queries 'goals' but migration 006 creates 'fitness_goals'
-- Create a simple 'goals' table that matches what the code expects
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    exercise_id UUID REFERENCES exercises(id) ON DELETE SET NULL,

    -- Goal definition
    goal_type TEXT NOT NULL DEFAULT 'e1rm', -- 'e1rm', 'weight', 'reps', 'volume', 'custom'
    target_value DECIMAL NOT NULL,
    target_unit TEXT NOT NULL DEFAULT 'lbs',
    description TEXT,

    -- Tracking
    starting_value DECIMAL,
    current_value DECIMAL,
    target_date DATE,

    -- Status
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'achieved', 'abandoned', 'paused'
    achieved_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_exercise ON goals(exercise_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(user_id, status);

-- Enable RLS
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

-- RLS Policies (drop if exist to avoid conflicts)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own goals" ON goals;
    DROP POLICY IF EXISTS "Users can create own goals" ON goals;
    DROP POLICY IF EXISTS "Users can update own goals" ON goals;
    DROP POLICY IF EXISTS "Users can delete own goals" ON goals;
EXCEPTION
    WHEN undefined_table THEN NULL;
END $$;

CREATE POLICY "Users can view own goals"
    ON goals FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own goals"
    ON goals FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goals"
    ON goals FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own goals"
    ON goals FOR DELETE
    USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 2. Add is_current column to personal_records
-- Used to identify the current PR for each exercise/record_type
-- ----------------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'personal_records' AND column_name = 'is_current'
    ) THEN
        ALTER TABLE personal_records ADD COLUMN is_current BOOLEAN DEFAULT true;

        -- Create index for faster queries
        CREATE INDEX IF NOT EXISTS idx_personal_records_current
            ON personal_records(user_id, exercise_id, is_current)
            WHERE is_current = true;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. Journey Signals Table
-- Tracks user behavior to detect their preferred training style
-- (freestyler, planner, guided)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS journey_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    signal_type TEXT NOT NULL,
    context JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_journey_signals_user ON journey_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_journey_signals_recent ON journey_signals(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_journey_signals_type ON journey_signals(user_id, signal_type);

-- Enable RLS
ALTER TABLE journey_signals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own signals" ON journey_signals;
    DROP POLICY IF EXISTS "Users can create own signals" ON journey_signals;
EXCEPTION
    WHEN undefined_table THEN NULL;
END $$;

CREATE POLICY "Users can view own signals"
    ON journey_signals FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own signals"
    ON journey_signals FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 4. Ensure daily_readiness table has correct permissions
-- This table should exist from migration 008
-- ----------------------------------------------------------------------------

DO $$
BEGIN
    -- Verify daily_readiness exists before adding policies
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_readiness') THEN
        -- Re-enable RLS in case it was disabled
        ALTER TABLE daily_readiness ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Comments
-- ----------------------------------------------------------------------------

COMMENT ON TABLE goals IS 'User fitness goals for tracking progress toward targets';
COMMENT ON COLUMN personal_records.is_current IS 'True if this is the current PR for this exercise/record_type';
COMMENT ON TABLE journey_signals IS 'Tracks user behavior signals for journey detection (freestyler/planner/guided)';
