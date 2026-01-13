# Developer Sandbox Account

A clean testing account isolated from your main account.

## Quick Setup

```bash
# Create default sandbox account
node scripts/create-sandbox-account.js

# Or customize credentials
node scripts/create-sandbox-account.js dev@test.com password123 "Dev Tester"
```

## Default Credentials

- **Email:** `sandbox@foundrylab.dev`
- **Password:** `Sandbox123!`
- **Name:** `Dev Sandbox`

## Features

- ✅ Clean slate (no existing workouts/blocks)
- ✅ Isolated from main account
- ✅ Ready for testing whiteboard scanner
- ✅ Can upload photos from camera roll
- ✅ Can take new photos

## Usage

1. Run the script to create/update the account
2. Log out of your main account
3. Log in with sandbox credentials
4. Test features without affecting your main data

## Reset Sandbox

To clear all data and start fresh:

```bash
# Re-run the script - it will clear existing data
node scripts/create-sandbox-account.js
```

Or manually in Supabase SQL Editor:

```sql
-- Replace with actual sandbox user_id
DELETE FROM personal_records WHERE user_id = 'SANDBOX_USER_ID';
DELETE FROM movement_memory WHERE user_id = 'SANDBOX_USER_ID';
DELETE FROM workouts WHERE user_id = 'SANDBOX_USER_ID';
DELETE FROM training_blocks WHERE user_id = 'SANDBOX_USER_ID';
```
