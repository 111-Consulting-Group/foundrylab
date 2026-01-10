# Fixing User Signup Issues

You're experiencing two issues:
1. **User profile not created** after signup (trigger may not be firing)
2. **"Email not confirmed" error** when trying to log in

## Issue 1: Disable Email Confirmation (CRITICAL)

Email confirmation is currently **ENABLED** in your Supabase project, which prevents users from logging in until they confirm their email.

### Steps to Fix:

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Authentication** → **Settings** (or **Providers**)
4. Find the **"Email Auth"** section
5. **Turn OFF** the toggle for **"Enable email confirmations"**
6. Click **Save**

**⚠️ Important**: This must be done for beta testing. Re-enable it for production!

### For Existing Users (Already Signed Up)

After disabling email confirmation, you still need to confirm existing users:

**Option A: Via Supabase Dashboard**
1. Go to **Authentication** → **Users**
2. Find the user (search by email: `corecompetency52@gmail.com`)
3. Click the **"..."** menu next to the user
4. Select **"Confirm email"**

**Option B: Via Script** (if you have service role key set up)
```bash
node scripts/fix-user-signup.js corecompetency52@gmail.com
```

## Issue 2: Database Trigger Not Creating User Profiles

The database trigger should automatically create a `user_profiles` entry when a user signs up, but it appears it's not working.

### Steps to Verify/Fix:

1. **Check if trigger exists**:
   - Go to Supabase Dashboard → **Database** → **Database Functions**
   - Look for function named `handle_new_user`
   - Go to **Database** → **Triggers**
   - Look for trigger `on_auth_user_created` on `auth.users` table

2. **If trigger doesn't exist, apply the migration**:
   
   **Option A: Via Supabase Dashboard**
   - Go to **Database** → **SQL Editor**
   - Copy the contents of `supabase/migrations/003_auth_triggers.sql`
   - Paste and run the SQL

   **Option B: Via Supabase CLI**
   ```bash
   supabase db push
   ```

3. **For existing users, create profile manually**:
   
   **Option A: Via Supabase Dashboard**
   - Go to **Table Editor** → `user_profiles`
   - Click **Insert row**
   - Fill in:
     - `id`: (the user's ID from `auth.users` table)
     - `email`: (user's email)
     - `display_name`: (optional, from user metadata)
   - Click **Save**

   **Option B: Via Script** (if you have service role key)
   ```bash
   node scripts/fix-user-signup.js corecompetency52@gmail.com
   ```
   This will:
   - Confirm the user's email
   - Create the profile if missing
   - Verify everything is correct

## Quick Fix for Current User

To fix the user you just created (`corecompetency52@gmail.com`):

### Step 1: Confirm Email
1. Go to Supabase Dashboard → Authentication → Users
2. Find `corecompetency52@gmail.com`
3. Click "..." → "Confirm email"

### Step 2: Create Profile
1. Go to Table Editor → `user_profiles`
2. Insert new row with:
   - `id`: `59af8252-db40-4331-ba0f-ed42be52327b` (from the console logs)
   - `email`: `corecompetency52@gmail.com`
   - `display_name`: (leave empty or set if you want)
3. Save

### Step 3: Disable Email Confirmation (for future signups)
As described in Issue 1 above.

## Verify Everything Works

After making these changes:

1. **Test signup flow**:
   - Go to `/signup`
   - Create a new account
   - Should automatically log in and redirect to dashboard

2. **Test login**:
   - Log out
   - Go to `/login`
   - Enter credentials
   - Should log in successfully

3. **Check database**:
   - Verify user exists in `auth.users`
   - Verify profile exists in `user_profiles`
   - Verify `email_confirmed_at` is set in `auth.users`

## Preventing Future Issues

1. **Ensure migration is applied**: Run `supabase db push` after pulling new migrations
2. **Keep email confirmation disabled** during development/beta
3. **Monitor Supabase logs**: Check for trigger errors in Database → Logs
