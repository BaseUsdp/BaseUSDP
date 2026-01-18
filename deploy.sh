#!/bin/bash
export VERCEL_TOKEN="eD8KT5tedceAllAcoxOZ820t"

echo "Deploying frontend to Vercel production..."
cd "/Users/x/Documents/Cursor Projects/Void402"
vercel --prod --yes --token "$VERCEL_TOKEN"

echo ""
echo "Deploying backend to Vercel production..."
cd "/Users/x/Documents/Cursor Projects/Void402/packages/backend"
vercel --prod --yes --token "$VERCEL_TOKEN"

echo ""
echo "✅ Deployment complete!"
