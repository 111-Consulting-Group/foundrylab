-- Check exercise RLS policy compliance
-- The RLS policy for exercises is:
-- "Anyone can view default exercises" - USING (is_custom = FALSE OR created_by = auth.uid())

-- Check the exercises from the workout sets
SELECT 
    e.id,
    e.name,
    e.is_custom,
    e.created_by,
    CASE 
        WHEN e.is_custom = FALSE THEN '✅ Visible (default exercise)'
        WHEN e.created_by = '5c817af2-a8d5-41a1-94e0-8cec84d66d8c' THEN '✅ Visible (owned by user)'
        ELSE '❌ BLOCKED by RLS (custom but owned by different user)'
    END as rls_status
FROM exercises e
WHERE e.id IN (
    SELECT DISTINCT exercise_id 
    FROM workout_sets 
    WHERE workout_id IN (
        SELECT id FROM workouts 
        WHERE user_id = '5c817af2-a8d5-41a1-94e0-8cec84d66d8c'
        LIMIT 1
    )
)
ORDER BY rls_status, e.name;

-- Count blocked exercises
SELECT 
    COUNT(*) as total_exercises,
    COUNT(*) FILTER (WHERE is_custom = FALSE OR created_by = '5c817af2-a8d5-41a1-94e0-8cec84d66d8c') as visible_exercises,
    COUNT(*) FILTER (WHERE is_custom = TRUE AND (created_by IS NULL OR created_by != '5c817af2-a8d5-41a1-94e0-8cec84d66d8c')) as blocked_exercises
FROM exercises
WHERE id IN (
    SELECT DISTINCT exercise_id 
    FROM workout_sets 
    WHERE workout_id IN (
        SELECT id FROM workouts 
        WHERE user_id = '5c817af2-a8d5-41a1-94e0-8cec84d66d8c'
    )
);
