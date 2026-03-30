# Auth Verify Endpoint

## `POST /api/auth/verify-signature`

Verifies a wallet signature against a previously generated nonce. On success, returns a JWT session token for authenticated API access.

## Request Body
```json
{
  "address": "0x1234...abcd",
  "signature": "0xabcd...1234",
  "nonce": "a1b2c3d4e5f6..."
}
```

### Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `address` | string | Yes | The wallet address that signed the nonce |
| `signature` | string | Yes | The EIP-191 signature of the nonce message |
| `nonce` | string | Yes | The nonce that was signed |

## Response

### Success (200)
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresAt": "2026-03-31T12:00:00Z",
  "user": {
    "address": "0x1234...abcd",
    "username": null,
    "tier": "standard",
    "createdAt": "2026-03-30T12:00:00Z"
  }
}
```

### Error (401)
```json
{
  "error": "Invalid signature or expired nonce"
}
```

## Security
- Signatures are verified using ecrecover to derive the signer address
- Nonces are invalidated immediately after use
- JWT tokens expire after 24 hours
- Tokens can be refreshed using the refresh endpoint
