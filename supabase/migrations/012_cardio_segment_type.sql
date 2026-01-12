-- Migration: Add segment_type for cardio workout sets
-- This allows distinguishing warm-up, work, recovery, and cool-down segments

-- Create the segment type enum
CREATE TYPE segment_type AS ENUM ('warmup', 'work', 'recovery', 'cooldown');

-- Add segment_type column to workout_sets
-- Default to 'work' for existing data (most sets are working sets)
ALTER TABLE workout_sets 
ADD COLUMN segment_type segment_type DEFAULT 'work';

-- Update existing warmup sets to use the new enum
UPDATE workout_sets 
SET segment_type = 'warmup' 
WHERE is_warmup = true;

-- Add index for filtering by segment type (useful for analytics)
CREATE INDEX idx_workout_sets_segment_type ON workout_sets(segment_type);

-- Add comment for documentation
COMMENT ON COLUMN workout_sets.segment_type IS 'Type of segment: warmup, work, recovery, or cooldown. Used primarily for cardio exercises.';
