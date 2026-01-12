-- Migration: Allow viewing workouts referenced by public posts
-- Description: Adds RLS policy to allow users to view workouts that are referenced by public workout_posts

-- Add policy to allow viewing workouts referenced by public posts
CREATE POLICY "Users can view workouts referenced by public posts"
    ON workouts FOR SELECT
    USING (
        -- Users can view their own workouts (existing policy still applies)
        auth.uid() = user_id
        OR
        -- Users can view workouts referenced by public posts
        EXISTS (
            SELECT 1 FROM workout_posts
            WHERE workout_posts.workout_id = workouts.id
            AND workout_posts.is_public = true
        )
    );

-- Add policy to allow viewing workout_sets for workouts referenced by public posts
CREATE POLICY "Users can view sets of workouts referenced by public posts"
    ON workout_sets FOR SELECT
    USING (
        -- Users can view sets of their own workouts (existing policy still applies)
        EXISTS (
            SELECT 1 FROM workouts
            WHERE workouts.id = workout_sets.workout_id
            AND workouts.user_id = auth.uid()
        )
        OR
        -- Users can view sets of workouts referenced by public posts
        EXISTS (
            SELECT 1 FROM workouts
            INNER JOIN workout_posts ON workout_posts.workout_id = workouts.id
            WHERE workouts.id = workout_sets.workout_id
            AND workout_posts.is_public = true
        )
    );
