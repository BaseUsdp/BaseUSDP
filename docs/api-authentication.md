# API Authentication Guide

BASEUSDP uses wallet-based authentication. Users prove wallet ownership by signing a message, and receive a session token for subsequent API requests.

## Authentication Flow

```
┌──────────┐     1. Request nonce      ┌──────────┐
│          │ ─────────────────────────► │          │
│  Client  │     GET /api/auth/nonce    │  Server  │
│          │ ◄───────────────────────── │          │
│          │     { nonce: "abc123" }    │          │
│          │                            │          │
│          │     2. Sign message        │          │
│  Wallet  │     (user approves)        │          │
│          │                            │          │
│          │     3. Verify signature    │          │
│          │ ─────────────────────────► │          │
│          │     POST /api/auth/verify  │          │
│          │ ◄───────────────────────── │          │
│          │     { sessionToken: "..." }│          │
└──────────┘                            └──────────┘
```

### Step 1: Request Nonce

```http
GET /api/auth/nonce?wallet=0x742d...bD18&chain=base
```

Response:
```json
{
  "success": true,
  "nonce": "a1b2c3d4e5f6",
  "message": "Sign in to baseusdp.com\n\nNonce: a1b2c3d4e5f6\nIssued At: 2026-03-29T12:00:00Z",
  "expiresAt": 1743253200000
}
```

### Step 2: Sign Message

The client asks the user's wallet to sign the message:

```typescript
// EVM (MetaMask, Coinbase Wallet)
const signature = await window.ethereum.request({
  method: "personal_sign",
  params: [message, walletAddress],
});
```

### Step 3: Verify Signature

```http
POST /api/auth/verify
Content-Type: application/json

{
  "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
  "signature": "0x...",
  "nonce": "a1b2c3d4e5f6",
  "chain": "base"
}
```

Response:
```json
{
  "success": true,
  "sessionToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 86400,
  "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18"
}
```

## Using the Session Token

Include the token in all authenticated API requests:

```http
GET /api/zk-pay/balance
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

## Session Lifecycle

| Event | Behavior |
|-------|----------|
| Token issued | Valid for 24 hours |
| Token expired | Client must re-authenticate |
| Wallet disconnected | Token cleared from localStorage |
| Different wallet connected | Previous token invalidated |

## Security Considerations

- Nonces are single-use and expire after 5 minutes
- The signed message includes a timestamp for replay protection
- Session tokens are stored in `localStorage` (not cookies) to avoid CSRF
- Tokens are scoped to a specific wallet address
- Server validates the signature cryptographically — no password is ever stored
