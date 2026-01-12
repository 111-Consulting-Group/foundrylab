-- Migration: Training Intelligence System
-- Description: Adds movement memory, confidence-based progression, pattern detection, and achievements
-- Philosophy: Make progressive overload inevitable through intelligent suggestions

-- ============================================
-- Custom Types
-- ============================================

-- Confidence levels for suggestions
CREATE TYPE confidence_level AS ENUM ('low', 'medium', 'high');

-- Trend detection for exercise performance
CREATE TYPE performance_trend AS ENUM ('progressing', 'stagnant', 'regressing');

-- Pattern types the system can detect
CREATE TYPE pattern_type AS ENUM (
    'training_split',        -- e.g., Push/Pull/Legs
    'exercise_pairing',      -- Exercises commonly done together
    'rep_range_preference',  -- User's typical rep ranges
    'training_day'           -- Preferred days for certain workouts
);

-- Achievement types
CREATE TYPE achievement_type AS ENUM (
    'pr',                    -- Personal record
    'streak',                -- Consecutive training days
    'block_complete',        -- Completed a training block
    'consistency',           -- High adherence rate
    'volume_milestone'       -- Lifetime volume milestones
);

-- ============================================
-- Movement Memory Table
-- ============================================
-- Caches per-exercise, per-user statistics for fast access
-- "Every movement has memory" - this is the core of the system

CREATE TABLE movement_memory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,

    -- Last exposure (most recent workout with this exercise)
    last_workout_id UUID REFERENCES workouts(id) ON DELETE SET NULL,
    last_date TIMESTAMPTZ,
    last_weight DECIMAL(7,2),
    last_reps INTEGER,
    last_rpe DECIMAL(3,1),
    last_sets INTEGER,
    last_context workout_context,
    last_total_volume DECIMAL(10,2), -- weight * reps * sets

    -- Aggregate statistics
    exposure_count INTEGER DEFAULT 0,
    first_logged TIMESTAMPTZ,
    avg_rpe DECIMAL(3,1),
    typical_rep_min INTEGER,
    typical_rep_max INTEGER,
    total_lifetime_volume DECIMAL(12,2) DEFAULT 0,

    -- Personal records for this exercise
    pr_weight DECIMAL(7,2),
    pr_weight_date TIMESTAMPTZ,
    pr_weight_reps INTEGER, -- reps at PR weight
    pr_reps INTEGER, -- max reps (at meaningful weight)
    pr_reps_weight DECIMAL(7,2), -- weight at max reps
    pr_reps_date TIMESTAMPTZ,
    pr_e1rm DECIMAL(7,2),
    pr_e1rm_date TIMESTAMPTZ,
    pr_volume DECIMAL(10,2), -- best single-session volume
    pr_volume_date TIMESTAMPTZ,

    -- Intelligence metadata
    confidence_level confidence_level DEFAULT 'low',
    trend performance_trend DEFAULT 'stagnant',
    days_since_last INTEGER, -- computed on read or via trigger

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_user_exercise UNIQUE(user_id, exercise_id)
);

-- Indexes for fast lookups
CREATE INDEX idx_movement_memory_user ON movement_memory(user_id);
CREATE INDEX idx_movement_memory_exercise ON movement_memory(exercise_id);
CREATE INDEX idx_movement_memory_last_date ON movement_memory(user_id, last_date DESC);
CREATE INDEX idx_movement_memory_confidence ON movement_memory(user_id, confidence_level);

-- ============================================
-- Detected Patterns Table
-- ============================================
-- Stores automatically detected training patterns

CREATE TABLE detected_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    pattern_type pattern_type NOT NULL,
    pattern_name TEXT, -- Human-readable, e.g., "Push A", "Upper/Lower Split"

    -- Flexible pattern data storage
    pattern_data JSONB NOT NULL DEFAULT '{}',
    -- Examples:
    -- training_split: { "splits": ["Push", "Pull", "Legs"], "days_per_week": 6 }
    -- exercise_pairing: { "exercises": ["Bench Press", "Incline DB"], "co_occurrence": 0.85 }
    -- training_day: { "focus": "Legs", "preferred_days": ["Monday", "Thursday"] }

    -- Confidence and stability
    confidence DECIMAL(3,2) NOT NULL DEFAULT 0.0 CHECK (confidence >= 0 AND confidence <= 1),
    confirmation_count INTEGER DEFAULT 1,
    first_detected TIMESTAMPTZ DEFAULT NOW(),
    last_confirmed TIMESTAMPTZ DEFAULT NOW(),

    -- Structure offer tracking
    offered_structure BOOLEAN DEFAULT FALSE,
    offered_at TIMESTAMPTZ,
    structure_accepted BOOLEAN,
    accepted_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_detected_patterns_user ON detected_patterns(user_id);
CREATE INDEX idx_detected_patterns_type ON detected_patterns(user_id, pattern_type);
CREATE INDEX idx_detected_patterns_confidence ON detected_patterns(user_id, confidence DESC);

-- ============================================
-- User Achievements Table
-- ============================================
-- Tracks achievements earned through training

CREATE TABLE user_achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    achievement_type achievement_type NOT NULL,
    label TEXT NOT NULL, -- Display label, e.g., "7-Day Streak"
    description TEXT,    -- Longer description if needed
    icon TEXT,           -- Emoji or icon identifier

    -- Achievement data (flexible)
    achievement_data JSONB DEFAULT '{}',
    -- Examples:
    -- streak: { "days": 7 }
    -- consistency: { "rate": 0.92, "period": "month" }
    -- volume_milestone: { "total_lbs": 1000000 }
    -- block_complete: { "block_name": "Summer Strength", "block_id": "..." }

    -- Source references (optional)
    workout_id UUID REFERENCES workouts(id) ON DELETE SET NULL,
    exercise_id UUID REFERENCES exercises(id) ON DELETE SET NULL,
    block_id UUID REFERENCES training_blocks(id) ON DELETE SET NULL,

    -- State
    is_active BOOLEAN DEFAULT TRUE, -- For streaks, is it still going?
    earned_at TIMESTAMPTZ DEFAULT NOW(),

    -- Visibility
    is_featured BOOLEAN DEFAULT FALSE, -- Show on profile?

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_user_achievements_user ON user_achievements(user_id);
CREATE INDEX idx_user_achievements_type ON user_achievements(achievement_type);
CREATE INDEX idx_user_achievements_earned ON user_achievements(user_id, earned_at DESC);
CREATE INDEX idx_user_achievements_featured ON user_achievements(user_id, is_featured) WHERE is_featured = TRUE;

-- Unique constraint to prevent duplicate achievements
CREATE UNIQUE INDEX idx_unique_achievement ON user_achievements(
    user_id,
    achievement_type,
    COALESCE((achievement_data->>'days')::int, 0),
    COALESCE((achievement_data->>'total_lbs')::bigint, 0),
    COALESCE(block_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(exercise_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

-- ============================================
-- Schema Modifications to Existing Tables
-- ============================================

-- Add confidence tracking to workout_sets
ALTER TABLE workout_sets ADD COLUMN IF NOT EXISTS suggestion_confidence confidence_level;
ALTER TABLE workout_sets ADD COLUMN IF NOT EXISTS suggestion_reasoning TEXT;

-- Add pattern reference to workouts (which pattern was this workout matched to?)
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS matched_pattern_id UUID REFERENCES detected_patterns(id) ON DELETE SET NULL;

-- Enhance workout_posts for social feed
ALTER TABLE workout_posts ADD COLUMN IF NOT EXISTS key_lifts JSONB DEFAULT '[]';
-- Format: [{ "exercise_name": "Bench Press", "weight": 225, "reps": 5, "is_pr": false, "progression": "+10 lbs" }]

ALTER TABLE workout_posts ADD COLUMN IF NOT EXISTS achievements JSONB DEFAULT '[]';
-- Format: [{ "type": "streak", "label": "7-Day Streak", "icon": "🔥" }]

ALTER TABLE workout_posts ADD COLUMN IF NOT EXISTS goal_context JSONB;
-- Format: { "type": "strength", "block_name": "Summer Strength", "phase": "accumulation" }

-- ============================================
-- Functions
-- ============================================

-- Calculate confidence level based on exposure data
CREATE OR REPLACE FUNCTION calculate_confidence_level(
    p_exposure_count INTEGER,
    p_days_since_last INTEGER,
    p_rpe_logged_ratio DECIMAL
) RETURNS confidence_level AS $$
DECLARE
    v_score INTEGER := 0;
BEGIN
    -- Exposure weight (max 40 points)
    IF p_exposure_count >= 5 THEN
        v_score := v_score + 40;
    ELSIF p_exposure_count >= 3 THEN
        v_score := v_score + 25;
    ELSE
        v_score := v_score + (p_exposure_count * 5);
    END IF;

    -- Recency weight (max 25 points)
    IF p_days_since_last <= 7 THEN
        v_score := v_score + 25;
    ELSIF p_days_since_last <= 14 THEN
        v_score := v_score + 15;
    ELSIF p_days_since_last <= 28 THEN
        v_score := v_score + 5;
    END IF;
    -- > 28 days = 0 points (stale data)

    -- RPE reporting weight (max 15 points)
    v_score := v_score + ROUND(COALESCE(p_rpe_logged_ratio, 0) * 15)::INTEGER;

    -- Note: Consistency (variance) would need more data to calculate
    -- For now, we add a base of 10 points
    v_score := v_score + 10;

    -- Return confidence level
    IF v_score >= 70 THEN
        RETURN 'high';
    ELSIF v_score >= 40 THEN
        RETURN 'medium';
    ELSE
        RETURN 'low';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- Detect trend from recent E1RM values
CREATE OR REPLACE FUNCTION detect_performance_trend(
    p_recent_e1rm DECIMAL,   -- Average of last 2 sessions
    p_older_e1rm DECIMAL     -- Average of 3+ sessions ago
) RETURNS performance_trend AS $$
DECLARE
    v_delta DECIMAL;
BEGIN
    IF p_older_e1rm IS NULL OR p_older_e1rm = 0 THEN
        RETURN 'stagnant';
    END IF;

    v_delta := (p_recent_e1rm - p_older_e1rm) / p_older_e1rm;

    IF v_delta > 0.02 THEN
        RETURN 'progressing';  -- > 2% improvement
    ELSIF v_delta < -0.02 THEN
        RETURN 'regressing';   -- > 2% decline
    ELSE
        RETURN 'stagnant';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- Update movement memory after a workout is completed
CREATE OR REPLACE FUNCTION update_movement_memory()
RETURNS TRIGGER AS $$
DECLARE
    v_set RECORD;
    v_exercise_stats RECORD;
    v_existing_memory movement_memory%ROWTYPE;
    v_new_e1rm DECIMAL;
    v_session_volume DECIMAL;
    v_rpe_logged_ratio DECIMAL;
    v_days_since INTEGER;
    v_trend performance_trend;
    v_confidence confidence_level;
BEGIN
    -- Only trigger when workout is completed
    IF NEW.date_completed IS NULL THEN
        RETURN NEW;
    END IF;

    -- Skip if already had a completion date (avoid re-triggering)
    IF OLD.date_completed IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Process each unique exercise in this workout
    FOR v_set IN
        SELECT DISTINCT exercise_id
        FROM workout_sets
        WHERE workout_id = NEW.id
        AND is_warmup = FALSE
    LOOP
        -- Calculate stats for this exercise in this workout
        SELECT
            COUNT(*) AS set_count,
            MAX(actual_weight) AS max_weight,
            MAX(actual_reps) FILTER (WHERE actual_weight = (
                SELECT MAX(actual_weight)
                FROM workout_sets
                WHERE workout_id = NEW.id AND exercise_id = v_set.exercise_id AND is_warmup = FALSE
            )) AS reps_at_max_weight,
            AVG(actual_rpe) AS avg_rpe,
            SUM(COALESCE(actual_weight, 0) * COALESCE(actual_reps, 0)) AS total_volume,
            MIN(actual_reps) AS min_reps,
            MAX(actual_reps) AS max_reps,
            COUNT(*) FILTER (WHERE actual_rpe IS NOT NULL) AS rpe_logged_count
        INTO v_exercise_stats
        FROM workout_sets
        WHERE workout_id = NEW.id
        AND exercise_id = v_set.exercise_id
        AND is_warmup = FALSE;

        -- Get existing memory if any
        SELECT * INTO v_existing_memory
        FROM movement_memory
        WHERE user_id = NEW.user_id
        AND exercise_id = v_set.exercise_id;

        -- Calculate new E1RM
        v_new_e1rm := calculate_estimated_1rm(v_exercise_stats.max_weight, v_exercise_stats.reps_at_max_weight);

        -- Calculate RPE logging ratio
        v_rpe_logged_ratio := CASE
            WHEN v_exercise_stats.set_count > 0
            THEN v_exercise_stats.rpe_logged_count::DECIMAL / v_exercise_stats.set_count
            ELSE 0
        END;

        -- Calculate days since last (will be 0 for new)
        v_days_since := CASE
            WHEN v_existing_memory.last_date IS NOT NULL
            THEN EXTRACT(DAY FROM (NOW() - v_existing_memory.last_date))::INTEGER
            ELSE 0
        END;

        -- Calculate confidence
        v_confidence := calculate_confidence_level(
            COALESCE(v_existing_memory.exposure_count, 0) + 1,
            v_days_since,
            v_rpe_logged_ratio
        );

        -- Calculate trend (needs historical data)
        -- For now, compare to existing PR E1RM
        IF v_existing_memory.pr_e1rm IS NOT NULL THEN
            v_trend := detect_performance_trend(v_new_e1rm, v_existing_memory.pr_e1rm);
        ELSE
            v_trend := 'stagnant';
        END IF;

        -- Upsert movement memory
        INSERT INTO movement_memory (
            user_id,
            exercise_id,
            last_workout_id,
            last_date,
            last_weight,
            last_reps,
            last_rpe,
            last_sets,
            last_context,
            last_total_volume,
            exposure_count,
            first_logged,
            avg_rpe,
            typical_rep_min,
            typical_rep_max,
            total_lifetime_volume,
            pr_weight,
            pr_weight_date,
            pr_weight_reps,
            pr_e1rm,
            pr_e1rm_date,
            pr_volume,
            pr_volume_date,
            confidence_level,
            trend,
            days_since_last
        )
        VALUES (
            NEW.user_id,
            v_set.exercise_id,
            NEW.id,
            NEW.date_completed,
            v_exercise_stats.max_weight,
            v_exercise_stats.reps_at_max_weight,
            v_exercise_stats.avg_rpe,
            v_exercise_stats.set_count,
            NEW.context,
            v_exercise_stats.total_volume,
            1,
            NEW.date_completed,
            v_exercise_stats.avg_rpe,
            v_exercise_stats.min_reps,
            v_exercise_stats.max_reps,
            v_exercise_stats.total_volume,
            v_exercise_stats.max_weight,
            NEW.date_completed,
            v_exercise_stats.reps_at_max_weight,
            v_new_e1rm,
            NEW.date_completed,
            v_exercise_stats.total_volume,
            NEW.date_completed,
            v_confidence,
            v_trend,
            0
        )
        ON CONFLICT (user_id, exercise_id) DO UPDATE SET
            last_workout_id = NEW.id,
            last_date = NEW.date_completed,
            last_weight = v_exercise_stats.max_weight,
            last_reps = v_exercise_stats.reps_at_max_weight,
            last_rpe = v_exercise_stats.avg_rpe,
            last_sets = v_exercise_stats.set_count,
            last_context = NEW.context,
            last_total_volume = v_exercise_stats.total_volume,
            exposure_count = movement_memory.exposure_count + 1,
            avg_rpe = (COALESCE(movement_memory.avg_rpe, 0) * movement_memory.exposure_count + v_exercise_stats.avg_rpe) / (movement_memory.exposure_count + 1),
            typical_rep_min = LEAST(COALESCE(movement_memory.typical_rep_min, v_exercise_stats.min_reps), v_exercise_stats.min_reps),
            typical_rep_max = GREATEST(COALESCE(movement_memory.typical_rep_max, v_exercise_stats.max_reps), v_exercise_stats.max_reps),
            total_lifetime_volume = COALESCE(movement_memory.total_lifetime_volume, 0) + v_exercise_stats.total_volume,
            -- Update PRs only if beaten
            pr_weight = CASE
                WHEN v_exercise_stats.max_weight > COALESCE(movement_memory.pr_weight, 0)
                THEN v_exercise_stats.max_weight
                ELSE movement_memory.pr_weight
            END,
            pr_weight_date = CASE
                WHEN v_exercise_stats.max_weight > COALESCE(movement_memory.pr_weight, 0)
                THEN NEW.date_completed
                ELSE movement_memory.pr_weight_date
            END,
            pr_weight_reps = CASE
                WHEN v_exercise_stats.max_weight > COALESCE(movement_memory.pr_weight, 0)
                THEN v_exercise_stats.reps_at_max_weight
                ELSE movement_memory.pr_weight_reps
            END,
            pr_e1rm = CASE
                WHEN v_new_e1rm > COALESCE(movement_memory.pr_e1rm, 0)
                THEN v_new_e1rm
                ELSE movement_memory.pr_e1rm
            END,
            pr_e1rm_date = CASE
                WHEN v_new_e1rm > COALESCE(movement_memory.pr_e1rm, 0)
                THEN NEW.date_completed
                ELSE movement_memory.pr_e1rm_date
            END,
            pr_volume = CASE
                WHEN v_exercise_stats.total_volume > COALESCE(movement_memory.pr_volume, 0)
                THEN v_exercise_stats.total_volume
                ELSE movement_memory.pr_volume
            END,
            pr_volume_date = CASE
                WHEN v_exercise_stats.total_volume > COALESCE(movement_memory.pr_volume, 0)
                THEN NEW.date_completed
                ELSE movement_memory.pr_volume_date
            END,
            confidence_level = v_confidence,
            trend = v_trend,
            days_since_last = v_days_since,
            updated_at = NOW();

    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for workout completion
CREATE TRIGGER trg_update_movement_memory
    AFTER UPDATE ON workouts
    FOR EACH ROW
    WHEN (NEW.date_completed IS NOT NULL AND OLD.date_completed IS NULL)
    EXECUTE FUNCTION update_movement_memory();


-- Function to get next time suggestion for an exercise
CREATE OR REPLACE FUNCTION get_next_time_suggestion(
    p_user_id UUID,
    p_exercise_id UUID
) RETURNS TABLE (
    exercise_id UUID,
    last_weight DECIMAL,
    last_reps INTEGER,
    last_rpe DECIMAL,
    last_date TIMESTAMPTZ,
    last_context workout_context,
    suggested_weight DECIMAL,
    suggested_reps INTEGER,
    suggested_rpe DECIMAL,
    confidence confidence_level,
    trend performance_trend,
    reasoning TEXT,
    exposure_count INTEGER,
    pr_e1rm DECIMAL
) AS $$
DECLARE
    v_memory movement_memory%ROWTYPE;
    v_suggested_weight DECIMAL;
    v_suggested_reps INTEGER;
    v_suggested_rpe DECIMAL := 8;
    v_reasoning TEXT;
BEGIN
    -- Get movement memory
    SELECT * INTO v_memory
    FROM movement_memory mm
    WHERE mm.user_id = p_user_id
    AND mm.exercise_id = p_exercise_id;

    -- No history
    IF v_memory IS NULL THEN
        RETURN QUERY SELECT
            p_exercise_id,
            NULL::DECIMAL, NULL::INTEGER, NULL::DECIMAL, NULL::TIMESTAMPTZ, NULL::workout_context,
            NULL::DECIMAL, NULL::INTEGER, 8::DECIMAL,
            'low'::confidence_level,
            'stagnant'::performance_trend,
            'No history for this exercise. Start with a comfortable weight.'::TEXT,
            0,
            NULL::DECIMAL;
        RETURN;
    END IF;

    -- Calculate suggestion based on last performance
    IF v_memory.last_rpe IS NULL OR v_memory.last_rpe < 7 THEN
        -- Low effort, add reps
        v_suggested_weight := v_memory.last_weight;
        v_suggested_reps := v_memory.last_reps + 1;
        v_suggested_rpe := 7.5;
        v_reasoning := 'Last set felt easy (RPE < 7). Try +1 rep at same weight.';
    ELSIF v_memory.last_rpe <= 8.5 THEN
        -- Moderate effort, add weight
        v_suggested_weight := v_memory.last_weight + 5; -- Simple +5 lb
        v_suggested_reps := v_memory.last_reps;
        v_suggested_rpe := 8;
        v_reasoning := 'Good effort last time (RPE ' || v_memory.last_rpe || '). Try +5 lbs.';
    ELSE
        -- Hard effort, maintain
        v_suggested_weight := v_memory.last_weight;
        v_suggested_reps := v_memory.last_reps;
        v_suggested_rpe := v_memory.last_rpe;
        v_reasoning := 'Last set was challenging (RPE ' || v_memory.last_rpe || '). Match it before progressing.';
    END IF;

    -- Adjust reasoning based on trend
    IF v_memory.trend = 'regressing' THEN
        v_suggested_weight := v_memory.last_weight * 0.9; -- Reduce 10%
        v_suggested_reps := v_memory.last_reps;
        v_reasoning := 'Recent regression detected. Starting lighter to rebuild.';
    ELSIF v_memory.trend = 'stagnant' AND v_memory.exposure_count > 5 THEN
        v_reasoning := v_reasoning || ' Note: Progress has plateaued. Consider varying rep range.';
    END IF;

    -- Add confidence context to reasoning
    IF v_memory.confidence_level = 'low' THEN
        v_reasoning := v_reasoning || ' (Low confidence - based on ' || v_memory.exposure_count || ' session(s))';
    END IF;

    RETURN QUERY SELECT
        p_exercise_id,
        v_memory.last_weight,
        v_memory.last_reps,
        v_memory.last_rpe,
        v_memory.last_date,
        v_memory.last_context,
        v_suggested_weight,
        v_suggested_reps,
        v_suggested_rpe,
        v_memory.confidence_level,
        v_memory.trend,
        v_reasoning,
        v_memory.exposure_count,
        v_memory.pr_e1rm;
END;
$$ LANGUAGE plpgsql STABLE;


-- ============================================
-- Row Level Security
-- ============================================

-- Movement Memory
ALTER TABLE movement_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own movement memory"
    ON movement_memory FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own movement memory"
    ON movement_memory FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own movement memory"
    ON movement_memory FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own movement memory"
    ON movement_memory FOR DELETE
    USING (auth.uid() = user_id);

-- Detected Patterns
ALTER TABLE detected_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own patterns"
    ON detected_patterns FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own patterns"
    ON detected_patterns FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own patterns"
    ON detected_patterns FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own patterns"
    ON detected_patterns FOR DELETE
    USING (auth.uid() = user_id);

-- User Achievements
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own achievements"
    ON user_achievements FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own achievements"
    ON user_achievements FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own achievements"
    ON user_achievements FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own achievements"
    ON user_achievements FOR DELETE
    USING (auth.uid() = user_id);

-- Allow viewing achievements on public profiles/posts
CREATE POLICY "Achievements visible for public posts"
    ON user_achievements FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM workout_posts
            WHERE workout_posts.user_id = user_achievements.user_id
            AND workout_posts.is_public = true
        )
    );

-- ============================================
-- Update Triggers
-- ============================================

CREATE TRIGGER update_movement_memory_updated_at
    BEFORE UPDATE ON movement_memory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_detected_patterns_updated_at
    BEFORE UPDATE ON detected_patterns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
