# Auth Nonce Endpoint

## `GET /api/auth/generate-nonce`

Generates a cryptographic nonce for wallet signature authentication. The nonce is a one-time-use random string that must be signed by the user's wallet to prove ownership.

## Request
No request body required.

### Query Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `address` | string | Yes | The wallet address requesting authentication |

## Response

### Success (200)
```json
{
  "nonce": "a1b2c3d4e5f6...",
  "expiresAt": "2026-03-30T12:00:00Z",
  "message": "Sign this message to verify your wallet: a1b2c3d4e5f6..."
}
```

### Error (400)
```json
{
  "error": "Invalid wallet address format"
}
```

## Rate Limiting
- 10 requests per minute per IP address
- 5 requests per minute per wallet address

## Notes
- Nonces expire after 5 minutes
- Each nonce can only be used once for signature verification
- The message field contains the human-readable string that should be signed
