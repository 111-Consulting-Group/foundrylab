# Authentication Setup Guide

This document explains the complete authentication flow setup for Foundry Lab.

## Overview

The authentication system includes:
- User signup with email/password
- Login
- Password reset flow
- Custom branded emails via Resend API
- Automatic user profile creation

## Architecture

### Frontend Flow
1. **Signup**: User fills form → `useSignup()` hook → Supabase Auth → Auto-login → Welcome email (via Edge Function)
2. **Password Reset**: User requests reset → `usePasswordReset()` hook → Supabase generates token → Reset email sent → User clicks link → Token validated → Password reset → Confirmation email

### Email Flow
- Welcome emails: Sent via Edge Function after successful signup
- Password reset emails: Sent by Supabase (with custom Resend template via Edge Function)
- Password changed emails: Sent via Edge Function after password update

## Setup Steps

### 1. Environment Variables

Add to your `.env` file:

```bash
# Supabase (already configured)
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# App URL (for password reset links)
EXPO_PUBLIC_APP_URL=https://your-app-domain.com

# Resend (for Edge Functions)
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=noreply@yourdomain.com  # Must be verified in Resend
```

### 2. Deploy Edge Functions

See `supabase/functions/README.md` for detailed instructions.

Quick start:
```bash
# Install Supabase CLI
npm install -g supabase

# Login and link project
supabase login
supabase link --project-ref your-project-ref

# Set secrets
supabase secrets set RESEND_API_KEY=your_key
supabase secrets set RESEND_FROM_EMAIL=noreply@yourdomain.com
supabase secrets set APP_URL=https://your-app-domain.com

# Deploy functions
supabase functions deploy
```

### 3. Configure Supabase Auth Settings

#### URL Configuration
In Supabase Dashboard > Authentication > URL Configuration:

- **Site URL**: Your app's base URL (e.g., `https://foundrylab.app`)
- **Redirect URLs**: Add your app URLs:
  - `https://foundrylab.app/auth/callback`
  - `http://localhost:8081/auth/callback` (for local dev)

#### **IMPORTANT: Disable Email Confirmation (for Beta Testing)**

In Supabase Dashboard > Authentication > Settings:

1. Find the **"Email Auth"** section
2. **Turn OFF** "Enable email confirmations" toggle
3. Save changes

**Why?** With email confirmations enabled, users cannot log in until they click the confirmation link in their email. For beta testing, we disable this so users can sign up and log in immediately.

**⚠️ Warning**: Only disable email confirmation for development/beta. Re-enable it for production!

### 4. Run Database Migration

```bash
# Apply the auth triggers migration
supabase db push

# Or manually run the migration
psql -h your-db-host -U postgres -d postgres -f supabase/migrations/003_auth_triggers.sql
```

This migration:
- Creates automatic user profile creation trigger
- Syncs email updates between `auth.users` and `user_profiles`

### 5. (Optional) Configure Webhooks for Automatic Emails

Instead of client-side email calls, you can configure webhooks in Supabase Dashboard:

1. Go to Database > Webhooks
2. Create webhook for `auth.users` INSERT → Call `send-welcome-email` Edge Function
3. Create webhook for password reset → Call `send-password-reset` Edge Function
4. Create webhook for password update → Call `send-password-changed` Edge Function

## Testing the Flow

### Test Signup
1. Navigate to `/signup`
2. Fill in email, password, display name
3. Submit
4. Should auto-login and redirect to dashboard
5. Check email for welcome message (if Edge Function is deployed)

### Test Password Reset
1. Navigate to `/forgot-password`
2. Enter email
3. Check email for reset link
4. Click link (should redirect to `/auth/callback` then `/reset-password`)
5. Enter new password
6. Submit
7. Should redirect to login
8. Check email for confirmation (if Edge Function is deployed)

### Test Login
1. Navigate to `/login`
2. Enter credentials
3. Should redirect to dashboard

## Troubleshooting

### User created but cannot log in - "Email not confirmed" error

**Problem**: User signs up successfully but gets "Email not confirmed" when trying to log in.

**Solution**:
1. **Disable email confirmation** (see step 3 above)
2. **For existing users**: Confirm their email manually:
   - Option A: Use the fix script (requires service role key):
     ```bash
     node scripts/fix-user-signup.js user@example.com
     ```
   - Option B: In Supabase Dashboard:
     - Go to Authentication > Users
     - Find the user
     - Click "..." menu > "Confirm email"

### User profile not created after signup

**Problem**: User is created in `auth.users` but no profile exists in `user_profiles`.

**Solution**:
1. **Verify the database trigger exists**:
   - Go to Supabase Dashboard > Database > Database Functions
   - Look for `handle_new_user` function
   - Go to Database > Triggers
   - Verify `on_auth_user_created` trigger exists on `auth.users` table

2. **If trigger doesn't exist, apply the migration**:
   - In Supabase Dashboard > SQL Editor, run `supabase/migrations/003_auth_triggers.sql`
   - Or use Supabase CLI: `supabase db push`

3. **For existing users, create profile manually**:
   ```bash
   node scripts/fix-user-signup.js user@example.com
   ```
   This script will:
   - Confirm the user's email
   - Create the user profile if missing
   - Verify everything is set up correctly

### Password reset link doesn't work
- Check that `EXPO_PUBLIC_APP_URL` is set correctly
- Verify redirect URL is added in Supabase Auth settings
- Check browser console for errors
- Ensure callback route (`/auth/callback`) is accessible

### Welcome email not sent
- Check Edge Function is deployed
- Verify `RESEND_API_KEY` is set in Supabase secrets
- Check Edge Function logs in Supabase Dashboard
- Verify `RESEND_FROM_EMAIL` is from a verified Resend domain

### User profile not created
- Check database migration `003_auth_triggers.sql` is applied
- Verify trigger function `handle_new_user()` exists
- Check Supabase logs for trigger errors

### Edge Functions return 401
- Ensure `EXPO_PUBLIC_SUPABASE_ANON_KEY` is set in client
- Check CORS headers in Edge Functions
- Verify function is deployed and accessible

## File Structure

```
app/
  login.tsx              # Login screen
  signup.tsx             # Signup screen
  forgot-password.tsx    # Password reset request
  reset-password.tsx     # Password reset form
  auth/
    callback.tsx         # Handles OAuth and reset token callbacks

hooks/
  useAuth.ts             # Auth mutations (signup, reset, etc.)

lib/
  validation.ts          # Email/password validation utilities

supabase/
  functions/
    _shared/
      resend.ts          # Resend email service and templates
    send-welcome-email/
      index.ts           # Welcome email Edge Function
    send-password-reset/
      index.ts           # Password reset email Edge Function
    send-password-changed/
      index.ts           # Password changed email Edge Function
  migrations/
    003_auth_triggers.sql  # Auto-create user profiles
```

## Security Notes

- Password reset tokens expire after 1 hour (Supabase default)
- Passwords must meet minimum requirements (8 chars, uppercase, lowercase, number)
- All auth operations use Supabase's secure token handling
- Email templates use Foundry Lab branding for authenticity
- Edge Functions require authentication (use anon key or session token)

## Next Steps

- [ ] Configure custom domain for Resend emails
- [ ] Set up webhooks for automatic email sending (optional)
- [ ] Test all flows in production environment
- [ ] Monitor Edge Function logs for errors
- [ ] Set up email delivery monitoring/alerts
