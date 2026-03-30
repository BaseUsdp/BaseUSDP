# Username Register Endpoint

## `POST /api/privacy-usd/username/register`

Registers a human-readable username for the authenticated wallet address. Usernames provide a convenient way to receive payments without sharing wallet addresses.

## Request Body
```json
{
  "username": "alice"
}
```

### Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `username` | string | Yes | Desired username (3-20 chars, alphanumeric and hyphens) |

## Response

### Success (201)
```json
{
  "username": "alice",
  "address": "0x1234...abcd",
  "registeredAt": "2026-03-30T12:00:00Z"
}
```

### Error (409)
```json
{
  "error": "Username already taken"
}
```

## Validation Rules
- 3-20 characters long
- Alphanumeric characters and hyphens only
- Cannot start or end with a hyphen
- Case-insensitive (stored lowercase)
- Cannot contain profanity or reserved words

## Authentication
Requires a valid JWT token. Each wallet can register one username.
