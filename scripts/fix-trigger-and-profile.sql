-- Complete fix: Create profile for existing user + ensure trigger is set up correctly
-- Run this in Supabase Dashboard > SQL Editor

-- ============================================
-- Step 1: Fix the trigger function (adds SET search_path which is critical)
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NULL)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ============================================
-- Step 2: Ensure trigger exists (will create or recreate)
-- ============================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- Step 3: Create profile for existing user
-- ============================================
DO $$
DECLARE
    user_record RECORD;
BEGIN
    -- Find the user by email (change email if needed)
    SELECT id, email, raw_user_meta_data->>'display_name' as display_name
    INTO user_record
    FROM auth.users
    WHERE email = 'corecompetency52@gmail.com'
    LIMIT 1;
    
    IF user_record.id IS NOT NULL THEN
        -- Insert profile if it doesn't exist
        INSERT INTO public.user_profiles (id, email, display_name)
        VALUES (
            user_record.id,
            user_record.email,
            user_record.display_name
        )
        ON CONFLICT (id) DO UPDATE
        SET 
            email = EXCLUDED.email,
            display_name = COALESCE(EXCLUDED.display_name, user_profiles.display_name);
        
        RAISE NOTICE '✅ Profile created/updated for user: % (ID: %)', user_record.email, user_record.id;
    ELSE
        RAISE NOTICE '❌ User not found with email: corecompetency52@gmail.com';
        RAISE NOTICE '💡 Tip: Check the email address or find the user ID in Authentication > Users';
    END IF;
END $$;

-- ============================================
-- Step 4: Verify everything worked
-- ============================================
-- Check if profile exists
SELECT 
    'Profile Status' as check_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM public.user_profiles WHERE email = 'corecompetency52@gmail.com')
        THEN '✅ Profile exists'
        ELSE '❌ Profile missing'
    END as status;

-- Check if trigger exists
SELECT 
    'Trigger Status' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_trigger t
            JOIN pg_proc p ON t.tgfoid = p.oid
            WHERE tgname = 'on_auth_user_created'
            AND proname = 'handle_new_user'
        )
        THEN '✅ Trigger exists'
        ELSE '❌ Trigger missing'
    END as status;

-- Show the profile if it exists
SELECT id, email, display_name, created_at 
FROM public.user_profiles 
WHERE email = 'corecompetency52@gmail.com';
