-- Foundry Lab App Database Schema
-- Version: 1.0.0
-- Description: Initial schema for hybrid athlete tracking (Strength + Conditioning)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types/enums
CREATE TYPE exercise_modality AS ENUM ('Strength', 'Cardio', 'Hybrid');
CREATE TYPE primary_metric AS ENUM ('Weight', 'Watts', 'Pace', 'Distance');
CREATE TYPE record_type AS ENUM ('weight', 'reps', 'volume', 'e1rm', 'watts', 'pace');
CREATE TYPE units_preference AS ENUM ('imperial', 'metric');

-- ============================================
-- User Profiles Table
-- ============================================
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    display_name TEXT,
    weight_kg DECIMAL(5,2),
    height_cm DECIMAL(5,2),
    date_of_birth DATE,
    max_hr INTEGER, -- Maximum heart rate for zone calculations
    ftp INTEGER, -- Functional Threshold Power (watts)
    units_preference units_preference DEFAULT 'imperial',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Exercises Table
-- ============================================
CREATE TABLE exercises (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    modality exercise_modality NOT NULL DEFAULT 'Strength',
    primary_metric primary_metric NOT NULL DEFAULT 'Weight',
    muscle_group TEXT NOT NULL,
    equipment TEXT,
    instructions TEXT,
    is_custom BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure unique exercise names per user (custom) or globally (default)
    CONSTRAINT unique_exercise_name UNIQUE (name, created_by)
);

-- Index for fast exercise lookups
CREATE INDEX idx_exercises_name ON exercises(name);
CREATE INDEX idx_exercises_modality ON exercises(modality);
CREATE INDEX idx_exercises_muscle_group ON exercises(muscle_group);

-- ============================================
-- Training Blocks Table
-- ============================================
CREATE TABLE training_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    goal_prompt TEXT, -- The raw prompt user gave AI
    description TEXT,
    start_date DATE NOT NULL,
    duration_weeks INTEGER DEFAULT 6,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user's blocks
CREATE INDEX idx_training_blocks_user ON training_blocks(user_id);
CREATE INDEX idx_training_blocks_active ON training_blocks(user_id, is_active);

-- ============================================
-- Workouts Table (Template/Instance)
-- ============================================
CREATE TABLE workouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    block_id UUID REFERENCES training_blocks(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_number INTEGER,
    day_number INTEGER,
    focus TEXT NOT NULL, -- e.g., "Push", "Pull", "Zone 2"
    notes TEXT,
    scheduled_date DATE,
    date_completed TIMESTAMPTZ, -- Null if planned, set when completed
    duration_minutes INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for workout queries
CREATE INDEX idx_workouts_user ON workouts(user_id);
CREATE INDEX idx_workouts_block ON workouts(block_id);
CREATE INDEX idx_workouts_date ON workouts(user_id, date_completed DESC);
CREATE INDEX idx_workouts_scheduled ON workouts(user_id, scheduled_date);

-- ============================================
-- Workout Sets Table (Granular Data)
-- ============================================
CREATE TABLE workout_sets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
    set_order INTEGER NOT NULL,

    -- Target fields (Plan)
    target_reps INTEGER,
    target_rpe DECIMAL(3,1) CHECK (target_rpe >= 1 AND target_rpe <= 10),
    target_load DECIMAL(7,2),
    tempo TEXT, -- e.g., "3-0-1-0"

    -- Actual fields (Log) - Strength
    actual_weight DECIMAL(7,2),
    actual_reps INTEGER,
    actual_rpe DECIMAL(3,1) CHECK (actual_rpe >= 1 AND actual_rpe <= 10),

    -- Conditioning fields
    avg_watts INTEGER,
    avg_hr INTEGER,
    duration_seconds INTEGER,
    distance_meters INTEGER,
    avg_pace TEXT, -- e.g., "5:30/km"

    -- Metadata
    notes TEXT,
    is_warmup BOOLEAN DEFAULT FALSE,
    is_pr BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for set queries
CREATE INDEX idx_workout_sets_workout ON workout_sets(workout_id);
CREATE INDEX idx_workout_sets_exercise ON workout_sets(exercise_id);
CREATE INDEX idx_workout_sets_order ON workout_sets(workout_id, set_order);

-- ============================================
-- Personal Records Table
-- ============================================
CREATE TABLE personal_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    workout_set_id UUID REFERENCES workout_sets(id) ON DELETE SET NULL,
    record_type record_type NOT NULL,
    value DECIMAL(10,2) NOT NULL,
    unit TEXT NOT NULL,
    achieved_at TIMESTAMPTZ NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for PR lookups
CREATE INDEX idx_personal_records_user ON personal_records(user_id);
CREATE INDEX idx_personal_records_exercise ON personal_records(exercise_id);
CREATE INDEX idx_personal_records_type ON personal_records(user_id, exercise_id, record_type);

-- ============================================
-- Functions
-- ============================================

-- Calculate Estimated 1RM using Epley formula
CREATE OR REPLACE FUNCTION calculate_estimated_1rm(weight DECIMAL, reps INTEGER)
RETURNS DECIMAL AS $$
BEGIN
    IF reps = 1 THEN
        RETURN weight;
    ELSIF reps <= 0 OR weight <= 0 THEN
        RETURN 0;
    ELSE
        RETURN ROUND(weight * (1 + reps::DECIMAL / 30), 2);
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Get exercise history for a user
CREATE OR REPLACE FUNCTION get_exercise_history(
    exercise_uuid UUID,
    user_uuid UUID,
    limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
    set_id UUID,
    workout_id UUID,
    workout_date TIMESTAMPTZ,
    set_order INTEGER,
    actual_weight DECIMAL,
    actual_reps INTEGER,
    actual_rpe DECIMAL,
    avg_watts INTEGER,
    duration_seconds INTEGER,
    estimated_1rm DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ws.id AS set_id,
        ws.workout_id,
        w.date_completed AS workout_date,
        ws.set_order,
        ws.actual_weight,
        ws.actual_reps,
        ws.actual_rpe,
        ws.avg_watts,
        ws.duration_seconds,
        CASE
            WHEN ws.actual_weight IS NOT NULL AND ws.actual_reps IS NOT NULL
            THEN calculate_estimated_1rm(ws.actual_weight, ws.actual_reps)
            ELSE NULL
        END AS estimated_1rm
    FROM workout_sets ws
    JOIN workouts w ON ws.workout_id = w.id
    WHERE ws.exercise_id = exercise_uuid
      AND w.user_id = user_uuid
      AND w.date_completed IS NOT NULL
      AND ws.is_warmup = FALSE
    ORDER BY w.date_completed DESC, ws.set_order
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- Triggers
-- ============================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update trigger to all tables
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_exercises_updated_at
    BEFORE UPDATE ON exercises
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_training_blocks_updated_at
    BEFORE UPDATE ON training_blocks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_workouts_updated_at
    BEFORE UPDATE ON workouts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_workout_sets_updated_at
    BEFORE UPDATE ON workout_sets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Row Level Security (RLS)
-- ============================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;

-- User profiles policies
CREATE POLICY "Users can view own profile"
    ON user_profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON user_profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON user_profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Exercises policies (everyone can see default exercises, users see their custom)
CREATE POLICY "Anyone can view default exercises"
    ON exercises FOR SELECT
    USING (is_custom = FALSE OR created_by = auth.uid());

CREATE POLICY "Users can create custom exercises"
    ON exercises FOR INSERT
    WITH CHECK (auth.uid() = created_by AND is_custom = TRUE);

CREATE POLICY "Users can update own custom exercises"
    ON exercises FOR UPDATE
    USING (auth.uid() = created_by AND is_custom = TRUE);

CREATE POLICY "Users can delete own custom exercises"
    ON exercises FOR DELETE
    USING (auth.uid() = created_by AND is_custom = TRUE);

-- Training blocks policies
CREATE POLICY "Users can view own blocks"
    ON training_blocks FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own blocks"
    ON training_blocks FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own blocks"
    ON training_blocks FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own blocks"
    ON training_blocks FOR DELETE
    USING (auth.uid() = user_id);

-- Workouts policies
CREATE POLICY "Users can view own workouts"
    ON workouts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own workouts"
    ON workouts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workouts"
    ON workouts FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own workouts"
    ON workouts FOR DELETE
    USING (auth.uid() = user_id);

-- Workout sets policies (through workout ownership)
CREATE POLICY "Users can view sets of own workouts"
    ON workout_sets FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM workouts
            WHERE workouts.id = workout_sets.workout_id
            AND workouts.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create sets for own workouts"
    ON workout_sets FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM workouts
            WHERE workouts.id = workout_sets.workout_id
            AND workouts.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update sets of own workouts"
    ON workout_sets FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM workouts
            WHERE workouts.id = workout_sets.workout_id
            AND workouts.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete sets of own workouts"
    ON workout_sets FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM workouts
            WHERE workouts.id = workout_sets.workout_id
            AND workouts.user_id = auth.uid()
        )
    );

-- Personal records policies
CREATE POLICY "Users can view own PRs"
    ON personal_records FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own PRs"
    ON personal_records FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own PRs"
    ON personal_records FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own PRs"
    ON personal_records FOR DELETE
    USING (auth.uid() = user_id);
