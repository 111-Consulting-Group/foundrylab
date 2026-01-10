-- Re-import training block data for user 5c817af2-a8d5-41a1-94e0-8cec84d66d8c
-- This script should be run directly in the Supabase SQL editor

-- First, delete any existing active blocks for this user
UPDATE training_blocks
SET is_active = FALSE
WHERE user_id = '5c817af2-a8d5-41a1-94e0-8cec84d66d8c'
  AND is_active = TRUE;

-- Check if we need to delete old data
-- DELETE FROM workout_sets WHERE workout_id IN (SELECT id FROM workouts WHERE user_id = '5c817af2-a8d5-41a1-94e0-8cec84d66d8c');
-- DELETE FROM workouts WHERE user_id = '5c817af2-a8d5-41a1-94e0-8cec84d66d8c';
-- DELETE FROM training_blocks WHERE user_id = '5c817af2-a8d5-41a1-94e0-8cec84d66d8c';

-- Simple solution: Just re-run the import script with service role key!
-- The issue is RLS. For now, let's output instructions for the user.

SELECT 'Please run the import script with the service role key:' AS message;
SELECT 'Add SUPABASE_SERVICE_ROLE_KEY to your .env file' AS instruction;
SELECT 'Then run: node scripts/import-excel-block.js "/Users/andywolfe/Documents/Fitness/2026 Block 1.xlsx" "5c817af2-a8d5-41a1-94e0-8cec84d66d8c"' AS command;
