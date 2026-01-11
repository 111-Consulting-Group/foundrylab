-- Migration: Annual Periodization
-- Supports long-term training planning with macrocycles and mesocycles

-- ============================================================================
-- ANNUAL PLANS
-- Top-level yearly training plan
-- ============================================================================

CREATE TABLE IF NOT EXISTS annual_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Plan details
  name TEXT NOT NULL DEFAULT 'Training Year',
  year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  description TEXT,

  -- Overall goals for the year
  primary_goal TEXT CHECK (primary_goal IN ('strength', 'hypertrophy', 'powerlifting', 'athletic', 'general', 'bodybuilding', 'sport_specific')),
  secondary_goals TEXT[] DEFAULT '{}',

  -- Key metrics to track
  target_metrics JSONB DEFAULT '{}', -- {squat: 500, bench: 315, deadlift: 550, bodyweight: 200}

  -- Planning preferences
  preferred_block_length INTEGER DEFAULT 6, -- weeks
  deload_frequency INTEGER DEFAULT 4, -- every N weeks
  competition_focus BOOLEAN DEFAULT FALSE,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One active plan per user per year
  UNIQUE(user_id, year, is_active)
);

CREATE INDEX idx_annual_plans_user ON annual_plans(user_id, year DESC);
CREATE INDEX idx_annual_plans_active ON annual_plans(user_id) WHERE is_active = TRUE;

-- RLS Policies
ALTER TABLE annual_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own annual plans"
  ON annual_plans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own annual plans"
  ON annual_plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own annual plans"
  ON annual_plans FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own annual plans"
  ON annual_plans FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================================================
-- COMPETITIONS / KEY EVENTS
-- Target dates to peak for
-- ============================================================================

CREATE TABLE IF NOT EXISTS competitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  annual_plan_id UUID REFERENCES annual_plans(id) ON DELETE CASCADE,

  -- Event details
  name TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('powerlifting_meet', 'weightlifting_meet', 'strongman', 'crossfit_comp', 'sport_season', 'photo_shoot', 'vacation', 'other')),
  event_date DATE NOT NULL,

  -- Priority (affects peaking strategy)
  priority TEXT NOT NULL DEFAULT 'primary' CHECK (priority IN ('primary', 'secondary', 'tune_up')),

  -- Target performance
  target_lifts JSONB, -- {squat: 500, bench: 315, deadlift: 550}
  weight_class TEXT, -- "83kg", "198lbs", etc.

  -- Status
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'completed', 'cancelled')),
  result_notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_competitions_user ON competitions(user_id, event_date);
CREATE INDEX idx_competitions_plan ON competitions(annual_plan_id);

-- RLS Policies
ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own competitions"
  ON competitions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own competitions"
  ON competitions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own competitions"
  ON competitions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own competitions"
  ON competitions FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================================================
-- PLANNED BLOCKS
-- Scheduled future training blocks (mesocycles)
-- ============================================================================

CREATE TABLE IF NOT EXISTS planned_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  annual_plan_id UUID REFERENCES annual_plans(id) ON DELETE CASCADE,

  -- Block details
  name TEXT NOT NULL,
  description TEXT,
  block_type TEXT NOT NULL CHECK (block_type IN ('accumulation', 'intensification', 'realization', 'peaking', 'deload', 'transition', 'base_building', 'hypertrophy', 'strength', 'power')),

  -- Timing
  planned_start_date DATE NOT NULL,
  duration_weeks INTEGER NOT NULL DEFAULT 4,

  -- Goals for this block
  primary_focus TEXT CHECK (primary_focus IN ('strength', 'hypertrophy', 'power', 'conditioning', 'technique', 'recovery')),
  target_metrics JSONB, -- Block-specific targets

  -- Training parameters
  volume_level TEXT DEFAULT 'moderate' CHECK (volume_level IN ('low', 'moderate', 'high', 'very_high')),
  intensity_level TEXT DEFAULT 'moderate' CHECK (intensity_level IN ('low', 'moderate', 'high', 'very_high')),

  -- Link to actual block when created
  training_block_id UUID REFERENCES training_blocks(id) ON DELETE SET NULL,

  -- Sequencing
  sequence_order INTEGER NOT NULL DEFAULT 0,
  depends_on_competition UUID REFERENCES competitions(id) ON DELETE SET NULL,

  -- Status
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed', 'skipped')),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_planned_blocks_user ON planned_blocks(user_id, planned_start_date);
CREATE INDEX idx_planned_blocks_plan ON planned_blocks(annual_plan_id, sequence_order);

-- RLS Policies
ALTER TABLE planned_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own planned blocks"
  ON planned_blocks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own planned blocks"
  ON planned_blocks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own planned blocks"
  ON planned_blocks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own planned blocks"
  ON planned_blocks FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================================================
-- PHASE TRANSITIONS
-- Track phase changes and recommendations
-- ============================================================================

CREATE TABLE IF NOT EXISTS phase_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- What changed
  from_phase TEXT,
  to_phase TEXT NOT NULL,
  from_block_id UUID REFERENCES training_blocks(id) ON DELETE SET NULL,
  to_block_id UUID REFERENCES training_blocks(id) ON DELETE SET NULL,

  -- Why it changed
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('scheduled', 'user_initiated', 'ai_recommended', 'competition_prep', 'recovery_needed')),
  trigger_reason TEXT,

  -- AI recommendation details
  recommendation_context JSONB, -- What data led to this recommendation
  alternatives_considered JSONB, -- Other options that were evaluated

  -- User response
  accepted BOOLEAN,
  user_modification TEXT,

  -- Timestamps
  transition_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_phase_transitions_user ON phase_transitions(user_id, transition_date DESC);

-- RLS Policies
ALTER TABLE phase_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transitions"
  ON phase_transitions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transitions"
  ON phase_transitions FOR INSERT
  WITH CHECK (auth.uid() = user_id);


-- ============================================================================
-- HELPER VIEW: Annual Overview
-- Combines plans, blocks, and competitions for easy querying
-- ============================================================================

CREATE OR REPLACE VIEW annual_overview AS
SELECT
  ap.id AS plan_id,
  ap.user_id,
  ap.year,
  ap.name AS plan_name,
  ap.primary_goal,
  ap.is_active,

  -- Competitions count
  (SELECT COUNT(*) FROM competitions c WHERE c.annual_plan_id = ap.id) AS competition_count,

  -- Next competition
  (SELECT json_build_object(
    'id', c.id,
    'name', c.name,
    'date', c.event_date,
    'days_until', c.event_date - CURRENT_DATE
  ) FROM competitions c
  WHERE c.annual_plan_id = ap.id
    AND c.event_date >= CURRENT_DATE
    AND c.status = 'upcoming'
  ORDER BY c.event_date
  LIMIT 1) AS next_competition,

  -- Planned blocks count
  (SELECT COUNT(*) FROM planned_blocks pb WHERE pb.annual_plan_id = ap.id) AS planned_blocks_count,

  -- Current block
  (SELECT json_build_object(
    'id', pb.id,
    'name', pb.name,
    'type', pb.block_type,
    'weeks_remaining', (pb.planned_start_date + (pb.duration_weeks * 7) - CURRENT_DATE) / 7
  ) FROM planned_blocks pb
  WHERE pb.annual_plan_id = ap.id
    AND pb.status = 'active'
  LIMIT 1) AS current_block,

  -- Next planned block
  (SELECT json_build_object(
    'id', pb.id,
    'name', pb.name,
    'type', pb.block_type,
    'starts_in_days', pb.planned_start_date - CURRENT_DATE
  ) FROM planned_blocks pb
  WHERE pb.annual_plan_id = ap.id
    AND pb.status = 'planned'
    AND pb.planned_start_date > CURRENT_DATE
  ORDER BY pb.planned_start_date
  LIMIT 1) AS next_block

FROM annual_plans ap;


-- ============================================================================
-- FUNCTION: Get Block Recommendation
-- AI-powered suggestion for next training block
-- ============================================================================

CREATE OR REPLACE FUNCTION get_next_block_recommendation(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_next_comp RECORD;
  v_current_block RECORD;
  v_profile RECORD;
  v_weeks_to_comp INTEGER;
  v_recommendation JSONB;
BEGIN
  -- Get user's training profile
  SELECT * INTO v_profile FROM training_profiles WHERE user_id = p_user_id;

  -- Get next competition
  SELECT * INTO v_next_comp FROM competitions
  WHERE user_id = p_user_id
    AND event_date >= CURRENT_DATE
    AND status = 'upcoming'
  ORDER BY event_date
  LIMIT 1;

  -- Get current/recent block
  SELECT * INTO v_current_block FROM training_blocks
  WHERE user_id = p_user_id
    AND is_active = TRUE
  LIMIT 1;

  -- Calculate weeks to competition
  IF v_next_comp IS NOT NULL THEN
    v_weeks_to_comp := (v_next_comp.event_date - CURRENT_DATE) / 7;
  END IF;

  -- Build recommendation based on context
  v_recommendation := jsonb_build_object(
    'has_competition', v_next_comp IS NOT NULL,
    'weeks_to_competition', v_weeks_to_comp,
    'current_phase', v_profile.current_training_phase,
    'suggested_block_type', CASE
      WHEN v_weeks_to_comp IS NOT NULL AND v_weeks_to_comp <= 2 THEN 'peaking'
      WHEN v_weeks_to_comp IS NOT NULL AND v_weeks_to_comp <= 4 THEN 'realization'
      WHEN v_weeks_to_comp IS NOT NULL AND v_weeks_to_comp <= 8 THEN 'intensification'
      WHEN v_weeks_to_comp IS NOT NULL AND v_weeks_to_comp <= 12 THEN 'accumulation'
      WHEN v_profile.current_training_phase = 'accumulation' THEN 'intensification'
      WHEN v_profile.current_training_phase = 'intensification' THEN 'realization'
      WHEN v_profile.current_training_phase = 'realization' THEN 'deload'
      WHEN v_profile.current_training_phase = 'deload' THEN 'accumulation'
      ELSE 'accumulation'
    END,
    'suggested_duration', CASE
      WHEN v_weeks_to_comp IS NOT NULL AND v_weeks_to_comp <= 2 THEN 2
      WHEN v_weeks_to_comp IS NOT NULL AND v_weeks_to_comp <= 4 THEN v_weeks_to_comp
      WHEN v_profile.current_training_phase = 'deload' THEN 1
      ELSE 4
    END,
    'reasoning', CASE
      WHEN v_weeks_to_comp IS NOT NULL AND v_weeks_to_comp <= 2 THEN 'Competition in ' || v_weeks_to_comp || ' weeks - time to peak'
      WHEN v_weeks_to_comp IS NOT NULL AND v_weeks_to_comp <= 4 THEN 'Competition approaching - realization phase to express strength'
      WHEN v_weeks_to_comp IS NOT NULL AND v_weeks_to_comp <= 8 THEN 'Building intensity toward competition'
      WHEN v_weeks_to_comp IS NOT NULL THEN 'Building volume base before competition prep'
      WHEN v_profile.weeks_in_current_phase >= 4 THEN 'Time to transition to next phase'
      ELSE 'Continue building training base'
    END
  );

  RETURN v_recommendation;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
