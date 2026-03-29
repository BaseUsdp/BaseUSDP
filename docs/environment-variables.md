# Environment Variables Reference

All environment variables used by the BASEUSDP frontend. Variables prefixed with `VITE_` are exposed to the client bundle.

## Client-Side Variables (VITE_)

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `VITE_API_URL` | string | `""` (prod) / `http://localhost:3000` (dev) | Backend API URL. Leave unset in production for same-origin. |
| `VITE_WS_URL` | string | `wss://api.baseusdp.com/ws` | WebSocket URL for real-time updates |
| `VITE_SUPABASE_URL` | string | — | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | string | — | Supabase anonymous/public API key |
| `VITE_BASE_RPC_URL` | string | Public RPC | Custom Base RPC endpoint |
| `VITE_BASE_CHAIN_ID` | string | `8453` | Base chain ID (8453 mainnet, 84532 sepolia) |
| `VITE_XMTP_ENV` | string | `dev` | XMTP environment (`production` or `dev`) |
| `VITE_WALLETCONNECT_PROJECT_ID` | string | — | WalletConnect Cloud project ID |
| `VITE_DEBUG` | string | — | Enable debug logging when set to `true` |
| `VITE_ANALYTICS_ID` | string | — | Analytics tracking ID |
| `VITE_SENTRY_DSN` | string | — | Sentry DSN for error reporting |

### Feature Flags

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `VITE_FEATURE_ZK_TRANSFERS` | string | `true` | Enable ZK proof transfers |
| `VITE_FEATURE_XMTP_MESSAGING` | string | `true` | Enable XMTP encrypted messaging |
| `VITE_FEATURE_X402_PAYMENTS` | string | `true` | Enable x402 payment links |
| `VITE_FEATURE_SWAP` | string | `true` | Enable token swapping |

## Server-Side Variables (API Routes)

These are used by Vercel serverless functions and are **not** exposed to the client:

| Variable | Description |
|----------|-------------|
| `SUPABASE_SERVICE_KEY` | Supabase service role key (full access) |
| `JWT_SECRET` | Secret for signing session tokens |
| `ZK_PROVING_KEY` | ZK proof generation key |
| `RELAY_PRIVATE_KEY` | Transaction relay wallet private key |
| `CODECOV_TOKEN` | Codecov upload token (CI only) |

## Local Development

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in the required values. For local development, most optional variables can be left unset.

3. Never commit `.env.local` or any file containing secrets.

## Vercel Configuration

Set environment variables in the Vercel dashboard:

1. Go to Project Settings > Environment Variables
2. Add each variable with the appropriate scope:
   - **Production**: Variables for `baseusdp.com`
   - **Preview**: Variables for PR preview deployments
   - **Development**: Variables for `vercel dev`

## Security Notes

- `VITE_` variables are embedded in the client bundle and visible to anyone
- Never put API keys, private keys, or secrets in `VITE_` variables
- The Supabase anon key is safe to expose (it's a public key with RLS policies)
- Use server-side variables for anything sensitive
