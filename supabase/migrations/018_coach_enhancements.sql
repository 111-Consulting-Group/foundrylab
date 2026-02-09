-- ============================================================================
-- Coach Enhancements Migration
-- Adds intake tracking fields and user disruptions table for Adaptive Coach
-- ============================================================================

-- Add intake tracking fields to training_profiles
ALTER TABLE training_profiles
ADD COLUMN IF NOT EXISTS intake_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS intake_version TEXT DEFAULT 'v1',
ADD COLUMN IF NOT EXISTS autonomy_preference INTEGER CHECK (autonomy_preference >= 1 AND autonomy_preference <= 10),
ADD COLUMN IF NOT EXISTS concurrent_activities TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS concurrent_hours_per_week NUMERIC,
ADD COLUMN IF NOT EXISTS injuries TEXT,
ADD COLUMN IF NOT EXISTS exercise_aversions TEXT[];

-- Create user_disruptions table for tracking illness, travel, etc.
CREATE TABLE IF NOT EXISTS user_disruptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  disruption_type TEXT NOT NULL CHECK (disruption_type IN ('illness', 'travel', 'injury', 'life_stress', 'schedule')),
  start_date DATE NOT NULL,
  end_date DATE,
  severity TEXT DEFAULT 'moderate' CHECK (severity IN ('minor', 'moderate', 'major')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create a view for active disruptions (is_active computed at query time)
CREATE OR REPLACE VIEW active_user_disruptions AS
SELECT *,
  (end_date IS NULL OR end_date >= CURRENT_DATE) AS is_active
FROM user_disruptions;

-- Add indexes for user_disruptions
CREATE INDEX IF NOT EXISTS idx_user_disruptions_user_id ON user_disruptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_disruptions_dates ON user_disruptions(user_id, start_date, end_date);
-- Index for active disruptions (end_date is null or in the future)
CREATE INDEX IF NOT EXISTS idx_user_disruptions_active ON user_disruptions(user_id, end_date)
  WHERE end_date IS NULL OR end_date >= CURRENT_DATE;

-- RLS policies for user_disruptions
ALTER TABLE user_disruptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own disruptions"
  ON user_disruptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own disruptions"
  ON user_disruptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own disruptions"
  ON user_disruptions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own disruptions"
  ON user_disruptions FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_user_disruptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_disruptions_updated_at
  BEFORE UPDATE ON user_disruptions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_disruptions_updated_at();

-- Add intake state tracking to coach_conversations for persistence
ALTER TABLE coach_conversations
ADD COLUMN IF NOT EXISTS intake_state JSONB,
ADD COLUMN IF NOT EXISTS current_mode TEXT DEFAULT 'general';

-- Create index for finding incomplete intakes
CREATE INDEX IF NOT EXISTS idx_training_profiles_intake
  ON training_profiles(user_id)
  WHERE intake_completed_at IS NULL;

-- Comment the new fields
COMMENT ON COLUMN training_profiles.intake_completed_at IS 'Timestamp when the coach intake was completed';
COMMENT ON COLUMN training_profiles.intake_version IS 'Version of intake flow completed (for future migrations)';
COMMENT ON COLUMN training_profiles.autonomy_preference IS 'User preference for coaching style: 1=flexible framework, 10=precise prescriptions';
COMMENT ON COLUMN training_profiles.concurrent_activities IS 'Other activities: running, cycling, swimming, sports, hiking, other';
COMMENT ON COLUMN training_profiles.concurrent_hours_per_week IS 'Hours per week spent on concurrent activities';
COMMENT ON COLUMN training_profiles.injuries IS 'Free-text description of current injuries or limitations';
COMMENT ON COLUMN training_profiles.exercise_aversions IS 'Exercises the user wants to avoid';

COMMENT ON TABLE user_disruptions IS 'Track training disruptions like illness, travel, injury for coach context';
COMMENT ON COLUMN user_disruptions.is_active IS 'Computed: true if end_date is null or in the future';
