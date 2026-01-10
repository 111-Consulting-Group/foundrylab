-- Check and fix user_id mismatch for training blocks
-- Run this in Supabase SQL Editor

-- First, let's see what we have
SELECT 
    'Training Blocks' as table_name,
    id,
    name,
    user_id,
    is_active
FROM training_blocks
ORDER BY created_at DESC;

SELECT 
    'Auth Users' as table_name,
    id as user_id,
    email
FROM auth.users
ORDER BY created_at DESC;

-- If the user_ids don't match, run this to fix:
-- UPDATE training_blocks 
-- SET user_id = '5c817af2-a8d5-41a1-94e0-8cec84d66d8c'
-- WHERE user_id != '5c817af2-a8d5-41a1-94e0-8cec84d66d8c';

-- UPDATE workouts 
-- SET user_id = '5c817af2-a8d5-41a1-94e0-8cec84d66d8c'
-- WHERE user_id != '5c817af2-a8d5-41a1-94e0-8cec84d66d8c';
