# Username Lookup Endpoint

## `GET /api/privacy-usd/username/:username`

Resolves a username to a wallet address. Used during transfers to allow sending to usernames instead of raw addresses.

## Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `username` | string | Yes | The username to look up |

## Response

### Success (200)
```json
{
  "username": "alice",
  "address": "0x1234...abcd",
  "registeredAt": "2026-03-30T12:00:00Z"
}
```

### Error (404)
```json
{
  "error": "Username not found"
}
```

## Rate Limiting
- 30 requests per minute per IP address
- No authentication required for lookups

## Privacy Note
Username lookups are public by design. Users should be aware that registering a username creates a public mapping to their wallet address.
