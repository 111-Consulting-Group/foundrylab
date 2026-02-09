-- ============================================================================
-- Running Schedule Migration
-- Adds running_schedule JSONB column for hybrid athlete support
--
-- REQUIRES: 008_ai_coach_system.sql (creates training_profiles table)
-- ============================================================================

-- Only add the column if the table exists (defensive check)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'training_profiles') THEN
    -- Add running_schedule column if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'training_profiles' AND column_name = 'running_schedule'
    ) THEN
      ALTER TABLE training_profiles ADD COLUMN running_schedule JSONB;
    END IF;
  ELSE
    RAISE NOTICE 'training_profiles table does not exist. Run migration 008_ai_coach_system.sql first.';
  END IF;
END
$$;

-- Add comment describing the structure (only if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'training_profiles' AND column_name = 'running_schedule'
  ) THEN
    COMMENT ON COLUMN training_profiles.running_schedule IS 'Running schedule for hybrid athletes: {days: string[], types: string[], weekly_mileage?: number, priority: "equal"|"running"|"lifting"}';
  END IF;
END
$$;

-- Create index for users who have a running schedule (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'training_profiles') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_training_profiles_running') THEN
      CREATE INDEX idx_training_profiles_running
        ON training_profiles(user_id)
        WHERE running_schedule IS NOT NULL;
    END IF;
  END IF;
END
$$;

-- ============================================================================
-- Example running_schedule JSON structure:
-- {
--   "days": ["tuesday", "thursday", "saturday"],
--   "types": ["easy_run", "tempo", "long_run"],
--   "weekly_mileage": 25,
--   "priority": "equal"
-- }
--
-- Valid run types: easy_run, tempo, intervals, long_run, recovery
-- Valid priorities: equal, running, lifting
-- ============================================================================
