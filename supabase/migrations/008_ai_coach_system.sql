-- Migration: AI Coach System
-- Adds daily readiness tracking and training profile learning

-- ============================================================================
-- DAILY READINESS CHECK-INS
-- Quick pre-workout pulse to adjust training intensity
-- ============================================================================

CREATE TABLE IF NOT EXISTS daily_readiness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Check-in date (one per day max)
  check_in_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Core readiness metrics (1-5 scale)
  sleep_quality SMALLINT NOT NULL CHECK (sleep_quality BETWEEN 1 AND 5),
  muscle_soreness SMALLINT NOT NULL CHECK (muscle_soreness BETWEEN 1 AND 5), -- 1=fresh, 5=wrecked
  stress_level SMALLINT NOT NULL CHECK (stress_level BETWEEN 1 AND 5), -- 1=calm, 5=chaos

  -- Optional context
  notes TEXT,

  -- Computed readiness score (0-100, calculated on insert/update)
  readiness_score SMALLINT NOT NULL DEFAULT 50,

  -- What adjustment was suggested
  suggested_adjustment TEXT CHECK (suggested_adjustment IN ('full', 'moderate', 'light', 'rest')),

  -- What the user actually did
  adjustment_applied TEXT CHECK (adjustment_applied IN ('full', 'moderate', 'light', 'rest', 'skipped')),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One check-in per user per day
  UNIQUE(user_id, check_in_date)
);

-- Index for quick lookups
CREATE INDEX idx_daily_readiness_user_date ON daily_readiness(user_id, check_in_date DESC);

-- Auto-calculate readiness score on insert/update
CREATE OR REPLACE FUNCTION calculate_readiness_score()
RETURNS TRIGGER AS $$
BEGIN
  -- Formula: Higher sleep = better, Lower soreness = better, Lower stress = better
  -- sleep_quality: 1-5 (higher is better) -> contributes 8-40 points
  -- muscle_soreness: 1-5 (lower is better, inverted) -> contributes 6-30 points
  -- stress_level: 1-5 (lower is better, inverted) -> contributes 6-30 points
  -- Total range: 20-100, but we clamp to 0-100 for safety
  NEW.readiness_score := GREATEST(0, LEAST(100,
    (NEW.sleep_quality * 8) +           -- 8-40 points
    ((6 - NEW.muscle_soreness) * 6) +   -- 6-30 points (inverted)
    ((6 - NEW.stress_level) * 6)        -- 6-30 points (inverted)
  ));

  -- Determine suggested adjustment based on score
  NEW.suggested_adjustment := CASE
    WHEN NEW.readiness_score >= 80 THEN 'full'
    WHEN NEW.readiness_score >= 60 THEN 'moderate'
    WHEN NEW.readiness_score >= 40 THEN 'light'
    ELSE 'rest'
  END;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_readiness
  BEFORE INSERT OR UPDATE ON daily_readiness
  FOR EACH ROW
  EXECUTE FUNCTION calculate_readiness_score();

-- RLS Policies
ALTER TABLE daily_readiness ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own readiness"
  ON daily_readiness FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own readiness"
  ON daily_readiness FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own readiness"
  ON daily_readiness FOR UPDATE
  USING (auth.uid() = user_id);


-- ============================================================================
-- TRAINING PROFILES
-- Learned preferences and patterns (one row per user, evolves over time)
-- ============================================================================

CREATE TABLE IF NOT EXISTS training_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

  -- Basic info (can be set initially or learned)
  training_experience TEXT CHECK (training_experience IN ('beginner', 'intermediate', 'advanced')),
  primary_goal TEXT CHECK (primary_goal IN ('strength', 'hypertrophy', 'athletic', 'general', 'powerlifting', 'bodybuilding')),

  -- Learned capacity
  typical_weekly_days SMALLINT CHECK (typical_weekly_days BETWEEN 1 AND 7),
  average_session_minutes SMALLINT,

  -- Recovery patterns (learned over time)
  avg_sleep_quality NUMERIC(3,2), -- Rolling average
  avg_soreness_level NUMERIC(3,2),
  avg_stress_level NUMERIC(3,2),
  recovery_speed TEXT CHECK (recovery_speed IN ('fast', 'normal', 'slow')), -- Learned from readiness patterns

  -- Preferences (learned from behavior)
  preferred_exercises UUID[] DEFAULT '{}', -- Exercise IDs they frequently choose
  avoided_exercises UUID[] DEFAULT '{}',   -- Exercises they skip or substitute
  preferred_rep_ranges JSONB DEFAULT '{}', -- e.g., {"squat": "5-8", "curls": "10-15"}

  -- Equipment access (can be set or inferred)
  available_equipment TEXT[] DEFAULT '{}',

  -- Periodization state
  current_training_phase TEXT CHECK (current_training_phase IN ('accumulation', 'intensification', 'realization', 'deload', 'maintenance')),
  weeks_in_current_phase SMALLINT DEFAULT 0,

  -- Annual planning
  annual_goals JSONB DEFAULT '[]', -- [{goal, targetDate, priority}]
  competition_dates DATE[] DEFAULT '{}',

  -- Stats for learning
  total_workouts_logged INTEGER DEFAULT 0,
  total_volume_logged NUMERIC DEFAULT 0,
  check_ins_completed INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE training_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON training_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON training_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON training_profiles FOR UPDATE
  USING (auth.uid() = user_id);


-- ============================================================================
-- WORKOUT ADJUSTMENTS LOG
-- Track what adjustments were suggested and outcomes
-- ============================================================================

CREATE TABLE IF NOT EXISTS workout_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_id UUID REFERENCES workouts(id) ON DELETE SET NULL,
  readiness_id UUID REFERENCES daily_readiness(id) ON DELETE SET NULL,

  -- What triggered the adjustment
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('readiness', 'time_constraint', 'pain_report', 'missed_workout', 'user_request')),
  trigger_context JSONB, -- Details about the trigger

  -- What was suggested
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('intensity_reduction', 'volume_reduction', 'exercise_swap', 'workout_merge', 'rest_day', 'deload')),
  adjustment_details JSONB NOT NULL, -- Specific changes suggested

  -- User's response
  accepted BOOLEAN,
  modified BOOLEAN DEFAULT FALSE,
  user_override JSONB, -- If they modified the suggestion

  -- Outcome (filled after workout)
  workout_completed BOOLEAN,
  user_feedback TEXT CHECK (user_feedback IN ('too_easy', 'just_right', 'too_hard', 'skipped')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workout_adjustments_user ON workout_adjustments(user_id, created_at DESC);

-- RLS Policies
ALTER TABLE workout_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own adjustments"
  ON workout_adjustments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own adjustments"
  ON workout_adjustments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own adjustments"
  ON workout_adjustments FOR UPDATE
  USING (auth.uid() = user_id);


-- ============================================================================
-- HELPER FUNCTION: Update training profile stats
-- Called after workouts to learn patterns
-- ============================================================================

CREATE OR REPLACE FUNCTION update_training_profile_stats()
RETURNS TRIGGER AS $$
DECLARE
  profile_exists BOOLEAN;
BEGIN
  -- Only run when a workout is completed
  IF NEW.date_completed IS NOT NULL AND OLD.date_completed IS NULL THEN
    -- Check if profile exists
    SELECT EXISTS(SELECT 1 FROM training_profiles WHERE user_id = NEW.user_id) INTO profile_exists;

    IF profile_exists THEN
      UPDATE training_profiles
      SET
        total_workouts_logged = total_workouts_logged + 1,
        updated_at = NOW()
      WHERE user_id = NEW.user_id;
    ELSE
      -- Create profile if it doesn't exist
      INSERT INTO training_profiles (user_id, total_workouts_logged)
      VALUES (NEW.user_id, 1);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_profile_on_workout
  AFTER UPDATE ON workouts
  FOR EACH ROW
  EXECUTE FUNCTION update_training_profile_stats();


-- ============================================================================
-- HELPER FUNCTION: Update readiness averages in profile
-- Updates rolling averages when new readiness check-in is added
-- ============================================================================

CREATE OR REPLACE FUNCTION update_readiness_averages()
RETURNS TRIGGER AS $$
BEGIN
  -- Update or create training profile with new averages
  INSERT INTO training_profiles (user_id, avg_sleep_quality, avg_soreness_level, avg_stress_level, check_ins_completed)
  VALUES (
    NEW.user_id,
    NEW.sleep_quality,
    NEW.muscle_soreness,
    NEW.stress_level,
    1
  )
  ON CONFLICT (user_id) DO UPDATE SET
    avg_sleep_quality = (COALESCE(training_profiles.avg_sleep_quality, 3) * 0.9 + NEW.sleep_quality * 0.1),
    avg_soreness_level = (COALESCE(training_profiles.avg_soreness_level, 3) * 0.9 + NEW.muscle_soreness * 0.1),
    avg_stress_level = (COALESCE(training_profiles.avg_stress_level, 3) * 0.9 + NEW.stress_level * 0.1),
    check_ins_completed = training_profiles.check_ins_completed + 1,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_readiness_averages
  AFTER INSERT ON daily_readiness
  FOR EACH ROW
  EXECUTE FUNCTION update_readiness_averages();
