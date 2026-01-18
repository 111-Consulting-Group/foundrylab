-- Migration: Workout Protocols and Periodization
-- Description: Adds protocol types (EMOM, Circuit, etc.) and periodization tracking
-- for better pattern detection from scanned workouts

-- ============================================
-- Add protocol type to workouts
-- ============================================

-- Protocol describes the workout structure
-- straight_sets: Traditional sets with rest between
-- emom: Every Minute On the Minute
-- amrap: As Many Rounds/Reps As Possible
-- circuit: Multiple exercises performed in sequence
-- interval: Work/rest intervals
-- ladder: Ascending/descending rep schemes
CREATE TYPE workout_protocol AS ENUM (
  'straight_sets',
  'emom',
  'amrap',
  'circuit',
  'interval',
  'ladder',
  'mixed'
);

ALTER TABLE workouts ADD COLUMN IF NOT EXISTS protocol workout_protocol DEFAULT 'straight_sets';

-- ============================================
-- Add periodization tracking
-- ============================================

-- Total weeks in the current training phase (complements week_number)
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS periodization_total_weeks INTEGER;

-- Normalized focus for pattern detection
-- Computed from raw focus but standardized (e.g., "Squat Day" -> "legs")
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS normalized_focus TEXT;

-- ============================================
-- Add protocol details to workout_sets
-- ============================================

-- For EMOM: interval duration in seconds (e.g., 60 for "every minute")
-- For circuits: which round this set belongs to
ALTER TABLE workout_sets ADD COLUMN IF NOT EXISTS protocol_interval_seconds INTEGER;
ALTER TABLE workout_sets ADD COLUMN IF NOT EXISTS protocol_round INTEGER;

-- Target percentage for percentage-based work (e.g., 0.55 for 55%)
ALTER TABLE workout_sets ADD COLUMN IF NOT EXISTS target_percentage DECIMAL(4,3);

-- ============================================
-- Index for protocol-based queries
-- ============================================

CREATE INDEX IF NOT EXISTS idx_workouts_protocol ON workouts(protocol);
CREATE INDEX IF NOT EXISTS idx_workouts_normalized_focus ON workouts(normalized_focus);

-- ============================================
-- Function to normalize focus labels
-- ============================================

CREATE OR REPLACE FUNCTION normalize_workout_focus(raw_focus TEXT)
RETURNS TEXT AS $$
DECLARE
  lower_focus TEXT;
BEGIN
  lower_focus := LOWER(TRIM(raw_focus));

  -- Push day variants
  IF lower_focus ~ '(push|chest|bench|press day|pressing)' THEN
    RETURN 'push';
  END IF;

  -- Pull day variants
  IF lower_focus ~ '(pull|back|row|deadlift day|pulling)' THEN
    RETURN 'pull';
  END IF;

  -- Legs day variants
  IF lower_focus ~ '(legs?|squat|lower|quad|ham|glute)' THEN
    RETURN 'legs';
  END IF;

  -- Upper body
  IF lower_focus ~ '(upper|upper body)' THEN
    RETURN 'upper';
  END IF;

  -- Lower body
  IF lower_focus ~ '(lower body)' THEN
    RETURN 'lower';
  END IF;

  -- Full body
  IF lower_focus ~ '(full|total|whole)' THEN
    RETURN 'full_body';
  END IF;

  -- Arms
  IF lower_focus ~ '(arms?|bicep|tricep|curl)' THEN
    RETURN 'arms';
  END IF;

  -- Shoulders
  IF lower_focus ~ '(shoulder|delt|ohp)' THEN
    RETURN 'shoulders';
  END IF;

  -- Core/Abs
  IF lower_focus ~ '(core|abs?|abdominal)' THEN
    RETURN 'core';
  END IF;

  -- Conditioning/Cardio
  IF lower_focus ~ '(cardio|conditioning|metcon|wod|hiit|circuit|echo|bike|run|row)' THEN
    RETURN 'conditioning';
  END IF;

  -- Return original if no match (lowercased)
  RETURN lower_focus;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- Trigger to auto-populate normalized_focus
-- ============================================

CREATE OR REPLACE FUNCTION set_normalized_focus()
RETURNS TRIGGER AS $$
BEGIN
  NEW.normalized_focus := normalize_workout_focus(NEW.focus);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_normalized_focus
  BEFORE INSERT OR UPDATE OF focus ON workouts
  FOR EACH ROW
  EXECUTE FUNCTION set_normalized_focus();

-- ============================================
-- Backfill existing workouts
-- ============================================

UPDATE workouts
SET normalized_focus = normalize_workout_focus(focus)
WHERE normalized_focus IS NULL;
