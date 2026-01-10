# Supabase Edge Functions for Foundry Lab

This directory contains Edge Functions for sending transactional emails via Resend API.

## Functions

- **send-welcome-email**: Sends welcome email to new users after signup
- **send-password-reset**: Sends password reset email (custom Resend template)
- **send-password-changed**: Sends confirmation email after password is changed

## Setup

### 1. Install Supabase CLI

```bash
npm install -g supabase
```

### 2. Login to Supabase

```bash
supabase login
```

### 3. Link to your project

```bash
supabase link --project-ref your-project-ref
```

### 4. Set Environment Variables

Set the following secrets in Supabase Dashboard (Project Settings > Edge Functions):

```bash
supabase secrets set RESEND_API_KEY=your_resend_api_key
supabase secrets set RESEND_FROM_EMAIL=noreply@yourdomain.com
supabase secrets set APP_URL=https://your-app-domain.com
```

Or via Dashboard:
- Go to Project Settings > Edge Functions > Secrets
- Add `RESEND_API_KEY`
- Add `RESEND_FROM_EMAIL` (must be from a verified Resend domain)
- Add `APP_URL` (your app's base URL for reset links)

### 5. Deploy Functions

```bash
# Deploy all functions
supabase functions deploy

# Or deploy individually
supabase functions deploy send-welcome-email
supabase functions deploy send-password-reset
supabase functions deploy send-password-changed
```

### 6. Configure Webhooks (Optional but Recommended)

For automatic email sending on auth events:

1. Go to Supabase Dashboard > Database > Webhooks
2. Create webhook for `auth.users` INSERT events → call `send-welcome-email`
3. Create webhook for password reset requests → call `send-password-reset`
4. Create webhook for password changes → call `send-password-changed`

**Note**: Alternatively, emails are sent from the client after auth operations (see `hooks/useAuth.ts`).

## Local Development

```bash
# Start Supabase locally
supabase start

# Serve functions locally
supabase functions serve

# Call a function locally
curl -X POST http://localhost:54321/functions/v1/send-welcome-email \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"user_email": "test@example.com", "display_name": "Test User"}'
```

## Testing

Test functions via Supabase Dashboard:
1. Go to Edge Functions
2. Select a function
3. Use the "Invoke" tab to test with sample payload

## Email Templates

All email templates use Foundry Lab's industrial lab aesthetic:
- Dark background (#0E1116)
- Graphite surfaces (#1C222B)
- Signal Blue accents (#2F80ED)
- Clean, data-focused design

Templates are defined in `_shared/resend.ts`.
