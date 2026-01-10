-- Share training program with a user
-- Just change the email address below and run

DO $$
DECLARE
    new_user_id UUID;
    original_block_id UUID;
    new_block_id UUID;
    block_name TEXT;
    workout_count INTEGER;
    set_count INTEGER;
    user_email TEXT := 'kelsea.wolfe@gmail.com';  -- ← Change this email address
BEGIN
    -- Get the new user's ID
    SELECT id INTO new_user_id
    FROM auth.users
    WHERE email = user_email
    LIMIT 1;
    
    IF new_user_id IS NULL THEN
        RAISE EXCEPTION 'User not found with email: %', user_email;
    END IF;
    
    RAISE NOTICE 'Found user ID: %', new_user_id;
    
    -- Confirm their email if not already confirmed
    UPDATE auth.users
    SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
    WHERE id = new_user_id;
    
    RAISE NOTICE '✅ Email confirmed for user';
    
    -- Get your most recent active training block
    -- To use a specific block, replace this SELECT with: original_block_id := 'YOUR_BLOCK_ID_HERE'::UUID;
    SELECT id, name
    INTO original_block_id, block_name
    FROM training_blocks
    WHERE is_active = true
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF original_block_id IS NULL THEN
        RAISE EXCEPTION 'No active training block found. Please check your training blocks or specify a block ID manually.';
    END IF;
    
    RAISE NOTICE 'Found training block: % (ID: %)', block_name, original_block_id;
    
    -- Check if user already has this block (by name)
    IF EXISTS (
        SELECT 1 FROM training_blocks 
        WHERE user_id = new_user_id 
        AND name LIKE block_name || '%'
    ) THEN
        RAISE NOTICE '⚠️  User already has a block with similar name. Skipping block creation to avoid duplicates.';
        RAISE NOTICE '   If you want to force copy, delete the existing block first or modify this script.';
    ELSE
        -- Copy the training block to the new user
        INSERT INTO training_blocks (user_id, name, goal_prompt, description, start_date, duration_weeks, is_active)
        SELECT 
            new_user_id,
            name || ' (Shared)',
            goal_prompt,
            description,
            start_date,
            duration_weeks,
            true
        FROM training_blocks
        WHERE id = original_block_id
        RETURNING id INTO new_block_id;
        
        RAISE NOTICE '✅ Training block copied to new user with ID: %', new_block_id;
        
        -- Now copy all the workouts associated with the original block
        INSERT INTO workouts (block_id, user_id, week_number, day_number, focus, notes, scheduled_date, date_completed, duration_minutes)
        SELECT 
            new_block_id,  -- The newly created block for the new user
            new_user_id,
            week_number,
            day_number,
            focus,
            notes,
            scheduled_date,
            NULL as date_completed,  -- Reset completion status so they can log fresh
            duration_minutes
        FROM workouts
        WHERE block_id = original_block_id
        AND user_id != new_user_id;  -- Only copy workouts from the original user
        
        GET DIAGNOSTICS workout_count = ROW_COUNT;
        RAISE NOTICE '✅ Copied % workouts to new user', workout_count;
        
        -- Copy workout sets (the planned/target sets, not logged sets)
        -- This gives them the program structure
        INSERT INTO workout_sets (
            workout_id, 
            exercise_id, 
            set_order, 
            target_reps, 
            target_rpe, 
            target_load, 
            tempo, 
            duration_seconds, 
            notes, 
            is_warmup
        )
        SELECT 
            new_w.id,  -- The new workout ID
            ws.exercise_id,
            ws.set_order,
            ws.target_reps,
            ws.target_rpe,
            ws.target_load,
            ws.tempo,
            ws.duration_seconds,
            ws.notes,
            COALESCE(ws.is_warmup, false)
        FROM workout_sets ws
        JOIN workouts old_w ON ws.workout_id = old_w.id
        JOIN workouts new_w ON new_w.user_id = new_user_id 
            AND new_w.block_id = new_block_id
            AND new_w.week_number = old_w.week_number 
            AND new_w.day_number = old_w.day_number
        WHERE old_w.block_id = original_block_id
        AND old_w.user_id != new_user_id
        AND ws.actual_weight IS NULL;  -- Only copy planned/target sets, not logged sets
        
        GET DIAGNOSTICS set_count = ROW_COUNT;
        RAISE NOTICE '✅ Copied % workout sets (target/planned sets only)', set_count;
        
        RAISE NOTICE '';
        RAISE NOTICE '✨ Successfully shared program with %', user_email;
        RAISE NOTICE '   Block: %', block_name || ' (Shared)';
        RAISE NOTICE '   Workouts: %', workout_count;
        RAISE NOTICE '   Sets: %', set_count;
    END IF;
    
END $$;

-- Verify the user now has the program
SELECT 
    'Verification' as status,
    tb.name as block_name,
    tb.is_active,
    COUNT(w.id) as workout_count
FROM training_blocks tb
LEFT JOIN workouts w ON w.block_id = tb.id
WHERE tb.user_id = (
    SELECT id FROM auth.users WHERE email = 'kelsea.wolfe@gmail.com'  -- ← Change this too if needed
)
GROUP BY tb.id, tb.name, tb.is_active;
