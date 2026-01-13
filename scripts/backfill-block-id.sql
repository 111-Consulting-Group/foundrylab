-- Backfill block_id for workouts missing it
-- This script associates all workouts without a block_id to the active training block

-- First, check which workouts are missing block_id
SELECT 
    id, 
    focus, 
    scheduled_date, 
    week_number, 
    day_number,
    block_id
FROM workouts
WHERE user_id = (SELECT id FROM auth.users LIMIT 1)
  AND block_id IS NULL
ORDER BY scheduled_date DESC
LIMIT 10;

-- Check the active training block
SELECT id, name, is_active
FROM training_blocks
WHERE user_id = (SELECT id FROM auth.users LIMIT 1)
  AND is_active = true;

-- Update all workouts without block_id to the active block
-- Uncomment the lines below to run the update:
-- UPDATE workouts
-- SET block_id = (
--     SELECT id 
--     FROM training_blocks 
--     WHERE user_id = workouts.user_id 
--       AND is_active = true 
--     LIMIT 1
-- )
-- WHERE block_id IS NULL
--   AND user_id = (SELECT id FROM auth.users LIMIT 1);

-- Verify the update
-- SELECT 
--     id, 
--     focus, 
--     scheduled_date, 
--     block_id
-- FROM workouts
-- WHERE user_id = (SELECT id FROM auth.users LIMIT 1)
-- ORDER BY scheduled_date DESC
-- LIMIT 10;
