-- Migration: Fix User Profile Discovery
-- Description: Updates RLS policy on user_profiles to allow authenticated users to discover other users
-- This is required for the social features (user search, profile viewing, following)

-- Drop the restrictive policy that only allows viewing own profile
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;

-- Create a new policy that allows all authenticated users to view all profiles
-- This enables user discovery and profile viewing for social features
CREATE POLICY "Authenticated users can view all profiles"
    ON user_profiles FOR SELECT
    USING (auth.role() = 'authenticated');

-- Note: UPDATE and INSERT policies remain unchanged - users can only modify their own profile
