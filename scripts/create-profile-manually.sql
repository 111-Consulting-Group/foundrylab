-- Manually create user profile for existing user
-- This SQL bypasses RLS by using the SECURITY DEFINER function approach

-- Step 1: Create the profile using a temporary function that bypasses RLS
DO $$
DECLARE
    user_record RECORD;
BEGIN
    -- Find the user by email
    SELECT id, email, raw_user_meta_data->>'display_name' as display_name
    INTO user_record
    FROM auth.users
    WHERE email = 'corecompetency52@gmail.com'
    LIMIT 1;
    
    -- Insert profile if user found and profile doesn't exist
    IF user_record.id IS NOT NULL THEN
        INSERT INTO public.user_profiles (id, email, display_name)
        VALUES (
            user_record.id,
            user_record.email,
            user_record.display_name
        )
        ON CONFLICT (id) DO NOTHING;
        
        RAISE NOTICE 'Profile created for user: %', user_record.email;
    ELSE
        RAISE NOTICE 'User not found with email: corecompetency52@gmail.com';
    END IF;
END $$;

-- Step 2: Verify the profile was created
SELECT id, email, display_name, created_at 
FROM public.user_profiles 
WHERE email = 'corecompetency52@gmail.com';
