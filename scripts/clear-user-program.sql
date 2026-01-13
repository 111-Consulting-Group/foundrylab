-- Clear a user's program data for a fresh start
-- Run this in Supabase Dashboard > SQL Editor
-- Replace 'USER_EMAIL_HERE' with the actual email

-- ============================================
-- Step 1: Preview what will be deleted
-- ============================================
-- Show user info
SELECT 
    id as user_id,
    email,
    created_at
FROM auth.users
WHERE email = 'USER_EMAIL_HERE';

-- Show training blocks to be deleted
SELECT 
    tb.id,
    tb.name,
    tb.is_active,
    tb.created_at,
    COUNT(w.id) as workout_count
FROM training_blocks tb
LEFT JOIN workouts w ON w.block_id = tb.id
WHERE tb.user_id = (SELECT id FROM auth.users WHERE email = 'USER_EMAIL_HERE')
GROUP BY tb.id, tb.name, tb.is_active, tb.created_at;

-- ============================================
-- Step 2: Delete all program data (cascade will handle workouts/sets)
-- ============================================
DO $$
DECLARE
    target_user_id UUID;
    deleted_blocks INTEGER;
    deleted_workouts INTEGER;
    deleted_prs INTEGER;
BEGIN
    -- Get the user's ID
    SELECT id INTO target_user_id
    FROM auth.users
    WHERE email = 'USER_EMAIL_HERE'
    LIMIT 1;
    
    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'User not found with email: USER_EMAIL_HERE';
    END IF;
    
    RAISE NOTICE 'Found user ID: %', target_user_id;
    
    -- Delete personal records first
    DELETE FROM personal_records WHERE user_id = target_user_id;
    GET DIAGNOSTICS deleted_prs = ROW_COUNT;
    RAISE NOTICE '🗑️  Deleted % personal records', deleted_prs;
    
    -- Delete training blocks (this cascades to workouts via block_id SET NULL, 
    -- but we need to delete workouts separately)
    DELETE FROM workouts WHERE user_id = target_user_id;
    GET DIAGNOSTICS deleted_workouts = ROW_COUNT;
    RAISE NOTICE '🗑️  Deleted % workouts (sets cascade automatically)', deleted_workouts;
    
    DELETE FROM training_blocks WHERE user_id = target_user_id;
    GET DIAGNOSTICS deleted_blocks = ROW_COUNT;
    RAISE NOTICE '🗑️  Deleted % training blocks', deleted_blocks;
    
    RAISE NOTICE '✅ User account cleared! Ready for fresh start.';
    
END $$;

-- ============================================
-- Step 3: Verify everything is cleared
-- ============================================
SELECT 
    'Training Blocks' as table_name,
    COUNT(*) as count
FROM training_blocks
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'USER_EMAIL_HERE')
UNION ALL
SELECT 
    'Workouts' as table_name,
    COUNT(*) as count
FROM workouts
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'USER_EMAIL_HERE')
UNION ALL
SELECT 
    'Personal Records' as table_name,
    COUNT(*) as count
FROM personal_records
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'USER_EMAIL_HERE');
