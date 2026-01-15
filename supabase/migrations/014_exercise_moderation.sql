-- Migration: Exercise Moderation System
-- Description: Adds support for user-contributed exercises with moderation workflow
-- Prevents database pollution while allowing immediate logging of unmatched exercises

-- ============================================
-- Add columns to exercises table
-- ============================================

-- Status: Controls visibility and moderation state
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved' 
  CHECK (status IN ('approved', 'pending', 'rejected'));

-- Aliases: Array of alternative names for better fuzzy matching
-- Example: ['seated db press', 'db shoulder press', 'dumbbell shoulder press']
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS aliases TEXT[] DEFAULT '{}';

-- Merged into: If an exercise was a duplicate, points to the canonical exercise
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS merged_into UUID REFERENCES exercises(id) ON DELETE SET NULL;

-- Usage count: Track popularity for moderation prioritization
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;

-- ============================================
-- Update existing exercises to approved status
-- ============================================

UPDATE exercises SET status = 'approved' WHERE status IS NULL;

-- ============================================
-- Indexes for performance
-- ============================================

-- Index for filtering by status (for moderation queue)
CREATE INDEX IF NOT EXISTS idx_exercises_status ON exercises(status) WHERE status = 'pending';

-- Index for usage count (for sorting moderation queue)
CREATE INDEX IF NOT EXISTS idx_exercises_usage_count ON exercises(usage_count DESC) WHERE status = 'pending';

-- GIN index for aliases array search
CREATE INDEX IF NOT EXISTS idx_exercises_aliases ON exercises USING GIN(aliases);

-- ============================================
-- Function to increment usage count
-- ============================================

CREATE OR REPLACE FUNCTION increment_exercise_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE exercises 
  SET usage_count = usage_count + 1
  WHERE id = NEW.exercise_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-increment usage when workout_sets are created
CREATE TRIGGER trigger_increment_exercise_usage
  AFTER INSERT ON workout_sets
  FOR EACH ROW
  EXECUTE FUNCTION increment_exercise_usage();

-- ============================================
-- View for admin moderation queue
-- ============================================

CREATE OR REPLACE VIEW pending_exercises_moderation AS
SELECT 
  e.id,
  e.name,
  e.muscle_group,
  e.equipment,
  e.modality,
  e.created_by,
  e.usage_count,
  e.created_at,
  up.display_name as creator_name,
  up.email as creator_email
FROM exercises e
LEFT JOIN user_profiles up ON e.created_by = up.id
WHERE e.status = 'pending'
ORDER BY e.usage_count DESC, e.created_at DESC;
