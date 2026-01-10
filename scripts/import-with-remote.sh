#!/bin/bash
# Script to import training block using remote Supabase
# Usage: ./scripts/import-with-remote.sh <supabase-url> <anon-key> <user-id>

if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ]; then
  echo "Usage: ./scripts/import-with-remote.sh <supabase-url> <anon-key> <user-id>"
  echo "Example: ./scripts/import-with-remote.sh https://xxx.supabase.co eyJ... abc-123"
  exit 1
fi

export EXPO_PUBLIC_SUPABASE_URL="$1"
export EXPO_PUBLIC_SUPABASE_ANON_KEY="$2"
USER_ID="$3"

echo "Importing training block with:"
echo "  URL: $EXPO_PUBLIC_SUPABASE_URL"
echo "  User ID: $USER_ID"
echo ""

node scripts/import-excel-block.js "/Users/andywolfe/Documents/Fitness/2026 Block 1.xlsx" "$USER_ID"
