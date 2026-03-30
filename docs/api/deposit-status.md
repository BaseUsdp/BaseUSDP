# Deposit Status Endpoint

## `GET /api/privacy-usd/deposit/:id/status`

Returns the current status of a deposit, including on-chain confirmation details.

## Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | The deposit ID returned from the create endpoint |

## Response

### Success (200)
```json
{
  "depositId": "dep_abc123",
  "status": "confirmed",
  "amount": "100",
  "tier": 3,
  "transactionHash": "0x...",
  "blockNumber": 12345678,
  "confirmations": 5,
  "timestamp": "2026-03-30T12:00:00Z",
  "leafIndex": 42
}
```

### Status Values
| Status | Description |
|--------|-------------|
| `pending` | Deposit submitted but not yet on-chain |
| `confirming` | Transaction included in a block, awaiting confirmations |
| `confirmed` | Deposit fully confirmed and available for transfers |
| `failed` | Deposit transaction reverted |

## Authentication
Requires a valid JWT token. Users can only query their own deposits.
