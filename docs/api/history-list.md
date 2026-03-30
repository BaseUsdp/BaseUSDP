# History List Endpoint

## `GET /api/privacy-usd/history`

Returns the transaction history for the authenticated user, including deposits, transfers, and withdrawals.

## Query Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | string | No | Filter by type: deposit, transfer, withdrawal |
| `limit` | number | No | Number of results (default: 20, max: 100) |
| `offset` | number | No | Pagination offset |
| `from` | string | No | Start date (ISO 8601) |
| `to` | string | No | End date (ISO 8601) |

## Response

### Success (200)
```json
{
  "transactions": [
    {
      "id": "txf_def456",
      "type": "transfer",
      "amount": "50.00",
      "fee": "0.15",
      "status": "confirmed",
      "timestamp": "2026-03-30T12:00:04Z",
      "transactionHash": "0x..."
    }
  ],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

## Authentication
Requires a valid JWT token.

## Note
Transaction history is reconstructed from on-chain events using the user's deposit notes. The server does not store a mapping between users and their transactions.
