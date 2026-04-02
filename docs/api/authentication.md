# API Authentication

## Overview
BaseUSDP uses wallet-based authentication. Users prove wallet ownership by signing a nonce with their private key, and receive a JWT for subsequent API calls.

## Authentication Flow

### Step 1: Request Nonce
```bash
GET /api/auth/generate-nonce?address=0x1234...
```

### Step 2: Sign Nonce
The client signs the returned message using the wallet's `personal_sign` method.

### Step 3: Verify Signature
```bash
POST /api/auth/verify-signature
{
  "address": "0x1234...",
  "signature": "0xabcd...",
  "nonce": "abc123..."
}
```

### Step 4: Use JWT
Include the JWT in all subsequent requests:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

## Token Lifecycle
- Access tokens expire after 24 hours
- Refresh tokens expire after 7 days
- Tokens are automatically refreshed by the client SDK

## Merchant API Keys
Merchants can also authenticate using API keys:
```
X-API-Key: bup_live_abc123...
```

API keys have the prefix `bup_live_` for production and `bup_test_` for testnet.

## Security Notes
- Never expose JWT tokens or API keys in client-side code
- Use HTTPS for all API communication
- Rotate API keys regularly
- Set appropriate CORS origins for your application
