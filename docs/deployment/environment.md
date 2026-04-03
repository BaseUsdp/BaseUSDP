# Environment Configuration

## Public Variables (browser-exposed, prefixed NEXT_PUBLIC_)
| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `NEXT_PUBLIC_CHAIN_ID` | Yes | Target chain (8453=mainnet) |
| `NEXT_PUBLIC_RPC_URL` | No | Custom RPC endpoint |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | No | WalletConnect v2 ID |

## Server Variables (never exposed)
| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes | JWT signing secret (min 32 chars) |
| `REDIS_URL` | No | Redis connection URL |
| `RELAYER_PRIVATE_KEY` | Yes* | Relayer wallet private key |
| `WEBHOOK_SECRET` | No | Webhook signature secret |

*Required for production relayer operation.

## Security Notes
- Never commit `.env.local`
- Use different values per environment
- Rotate secrets regularly
