# Supabase Session Duration Configuration

To configure 30-day session duration for your Supabase project:

## Steps

1. **Go to Supabase Dashboard**
   - Navigate to your project at https://app.supabase.com
   
2. **Open Authentication Settings**
   - Click "Authentication" in the left sidebar
   - Click "Settings" or "Configuration"
   
3. **Configure Session Management**
   - Scroll to "Session Management" section
   - Set "Time-box user sessions" to `30d` (30 days)
   - Optionally disable "Inactivity timeout" or set it to a longer duration
   
4. **Save Changes**
   - Click "Save" to apply the changes

## Notes

- Session duration must be configured in the Supabase Dashboard (not in code)
- This setting applies to all users in your project
- Access tokens still expire after 1 hour (default), but are automatically refreshed using refresh tokens
- With `autoRefreshToken: true` in our client config, users won't notice token refreshes
- The 30-day setting means sessions expire 30 days after login, regardless of activity

## Current Client Configuration

Our app already has:
- `persistSession: true` - Sessions are saved to SecureStore (native) or localStorage (web)
- `autoRefreshToken: true` - Tokens are automatically refreshed before expiration

These settings ensure sessions persist across app restarts and tokens are refreshed automatically.
