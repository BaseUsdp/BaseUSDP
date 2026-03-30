# Balance Query Endpoint

## `GET /api/privacy-usd/balance`

Returns the aggregated balance information for the authenticated user across all privacy tiers.

## Query Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tier` | number | No | Filter by specific privacy tier (1-4) |

## Response

### Success (200)
```json
{
  "totalBalance": "350.00",
  "tiers": [
    { "tier": 1, "balance": "5.00", "deposits": 5 },
    { "tier": 2, "balance": "40.00", "deposits": 4 },
    { "tier": 3, "balance": "200.00", "deposits": 2 },
    { "tier": 4, "balance": "0.00", "deposits": 0 }
  ],
  "pendingDeposits": "100.00",
  "lastUpdated": "2026-03-30T12:00:00Z"
}
```

## Authentication
Requires a valid JWT token. Balance information is derived from deposit notes stored client-side and verified against the on-chain Merkle tree.

## Privacy Note
Balance queries are performed locally using the user's deposit notes. The server only provides the current Merkle tree state — it does not know which deposits belong to which user.
