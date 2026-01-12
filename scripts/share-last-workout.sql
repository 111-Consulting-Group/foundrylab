-- Script to share your last completed workout to the feed
-- 
-- Option 1: Run this in Supabase SQL Editor (recommended)
-- This will use your current session to find and share your last workout
--
-- Note: This requires running as an authenticated user or using service role key
-- If you get permission errors, use Option 2 instead

-- Create a function to share the last workout (runs with current user context)
CREATE OR REPLACE FUNCTION share_last_workout()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id UUID;
    last_workout_id UUID;
BEGIN
    -- Get current user ID
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Must be authenticated to share workout';
    END IF;
    
    -- Find last completed workout that hasn't been shared
    SELECT w.id INTO last_workout_id
    FROM workouts w
    WHERE w.user_id = current_user_id
      AND w.date_completed IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 
        FROM workout_posts wp 
        WHERE wp.workout_id = w.id
      )
    ORDER BY w.date_completed DESC
    LIMIT 1;
    
    -- Share it if found
    IF last_workout_id IS NOT NULL THEN
        INSERT INTO workout_posts (workout_id, user_id, caption, is_public)
        VALUES (last_workout_id, current_user_id, NULL, true);
        RAISE NOTICE 'Successfully shared workout % to feed', last_workout_id;
    ELSE
        RAISE NOTICE 'No unshared completed workouts found';
    END IF;
END;
$$;

-- Run the function
SELECT share_last_workout();

-- Option 2: Direct SQL (replace YOUR_USER_ID with your actual user ID)
-- Run this version if Option 1 doesn't work
/*
INSERT INTO workout_posts (workout_id, user_id, caption, is_public)
SELECT 
    w.id,
    w.user_id,
    NULL as caption,
    true as is_public
FROM workouts w
WHERE w.date_completed IS NOT NULL
  AND w.user_id = 'YOUR_USER_ID'
  AND NOT EXISTS (
    SELECT 1 
    FROM workout_posts wp 
    WHERE wp.workout_id = w.id
  )
ORDER BY w.date_completed DESC
LIMIT 1;
*/
