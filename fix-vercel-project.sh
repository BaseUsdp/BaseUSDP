#!/bin/bash
export VERCEL_TOKEN=eD8KT5tedceAllAcoxOZ820t

echo "🔧 Fixing Vercel project links..."

# Frontend - link to correct project or create new
echo "Linking frontend to void402 project..."
cd "/Users/x/Documents/Cursor Projects/Void402"
vercel link --project=void402 --yes --token "$VERCEL_TOKEN" 2>&1 || vercel link --yes --token "$VERCEL_TOKEN"

# Backend - ensure it's linked correctly
echo "Linking backend to void402-backend project..."
cd "/Users/x/Documents/Cursor Projects/Void402/packages/backend"
vercel link --project=void402-backend --yes --token "$VERCEL_TOKEN" 2>&1 || vercel link --yes --token "$VERCEL_TOKEN"

echo ""
echo "✅ Project links fixed! Now deploy:"
echo "cd \"/Users/x/Documents/Cursor Projects/Void402\" && vercel --prod --yes"
echo "cd \"/Users/x/Documents/Cursor Projects/Void402/packages/backend\" && vercel --prod --yes"
