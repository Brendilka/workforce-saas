#!/bin/bash

# Script to deploy migrations and config to Supabase Cloud
# Usage: ./scripts/deploy-to-cloud.sh

set -e  # Exit on error

echo "🚀 Deploying to Supabase Cloud..."
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

# Check if project is linked
if [ ! -f .supabase/config.toml ]; then
    echo "⚠️  Project not linked to Supabase Cloud"
    echo ""
    echo "Run this command to link your project:"
    echo "  supabase link --project-ref YOUR_PROJECT_REF"
    echo ""
    echo "Find YOUR_PROJECT_REF at: https://supabase.com/dashboard/project/_/settings/general"
    exit 1
fi

echo "📦 Step 1: Pushing database migrations..."
supabase db push

echo ""
echo "🔐 Step 2: Verifying custom_access_token_hook function..."
supabase db execute "SELECT proname FROM pg_proc WHERE proname = 'custom_access_token_hook';"

echo ""
echo "✅ Migrations deployed successfully!"
echo ""
echo "⚠️  IMPORTANT: Manual step required!"
echo ""
echo "The auth hook config in config.toml only works for LOCAL development."
echo "For CLOUD, you must enable it in the dashboard:"
echo ""
echo "1. Go to: https://supabase.com/dashboard/project/_/auth/hooks"
echo "2. Find 'Custom Access Token' section"
echo "3. Toggle 'Enable hook' to ON"
echo "4. Select: public.custom_access_token_hook"
echo "5. Click 'Save'"
echo ""
echo "Alternatively, use the Management API (see scripts/enable-hook-api.sh)"
echo ""
