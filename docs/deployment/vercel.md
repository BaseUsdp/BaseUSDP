# Deploying to Vercel

## Quick Deploy
1. Fork the repository
2. Import in Vercel dashboard
3. Set environment variables (see .env.example)
4. Deploy

## Required Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_CHAIN_ID` (8453 for mainnet)

## Build Settings
- Framework: Next.js
- Build Command: `npm run build`
- Install: `npm ci`

## Custom Domain
Add domain in Vercel Settings > Domains. SSL provisioned automatically.

## Preview Deployments
Every PR gets a unique preview URL for testing.
