# Deployment Guide

BASEUSDP is deployed on [Vercel](https://vercel.com) as a static single-page application with serverless API routes.

## Prerequisites

- Vercel account connected to the GitHub repository
- Environment variables configured in Vercel dashboard
- Domain `baseusdp.com` pointed to Vercel

## Deployment Flow

```
git push origin main
    │
    ▼
Vercel detects push
    │
    ▼
Install dependencies (npm ci --legacy-peer-deps)
    │
    ▼
Run build (npm run build)
    │
    ▼
Deploy to production
    │
    ▼
Assign to baseusdp.com
```

### Preview Deployments

Every pull request automatically gets a preview deployment at a unique URL (e.g., `baseusdp-git-feature-xyz.vercel.app`). This allows reviewing changes before merging to main.

## Build Configuration

| Setting | Value |
|---------|-------|
| Framework | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm ci --legacy-peer-deps` |
| Node.js Version | 20.x |

## Environment Variables

See [environment-variables.md](./environment-variables.md) for the full list. Critical production variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `VITE_BASE_RPC_URL` | No | Custom RPC URL (defaults to public) |
| `VITE_XMTP_ENV` | No | XMTP environment (`production`) |

## Post-Deployment Checks

After every production deployment:

1. Verify the landing page loads at `https://baseusdp.com`
2. Confirm wallet connection works
3. Check that API routes respond (`/api/auth/nonce`)
4. Verify WebSocket connection for real-time updates
5. Test a small transfer on Base Sepolia (if applicable)

## Rollback

To rollback to a previous deployment:

```bash
# List recent deployments
vercel ls

# Promote a specific deployment to production
vercel promote <deployment-url>
```

Or via the Vercel dashboard: Deployments > Select deployment > Promote to Production.

## Custom Domain

The domain `baseusdp.com` is configured with:

- `A` record pointing to Vercel's IP
- `CNAME` for `www` pointing to `cname.vercel-dns.com`
- SSL certificate auto-managed by Vercel

## Serverless Functions

API routes in `api/` are deployed as Vercel Serverless Functions:

| Route | Purpose | Runtime |
|-------|---------|---------|
| `/api/auth/nonce` | Generate auth nonce | Node.js 20 |
| `/api/auth/verify` | Verify wallet signature | Node.js 20 |
| `/api/zk-pay/*` | ZK proof endpoints | Node.js 20 |
| `/api/support/*` | Support ticket handling | Node.js 20 |

Each function has a 10-second timeout and 256 MB memory limit by default.
