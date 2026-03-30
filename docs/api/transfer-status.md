# Transfer Status Endpoint

## `GET /api/privacy-usd/transfer/:id/status`

Returns the current status of a private transfer.

## Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | The transfer ID |

## Response

### Success (200)
```json
{
  "transferId": "txf_def456",
  "status": "confirmed",
  "amount": "50",
  "fee": "0.15",
  "recipient": "0x1234...abcd",
  "transactionHash": "0x...",
  "blockNumber": 12345680,
  "timestamp": "2026-03-30T12:00:04Z"
}
```

### Status Values
| Status | Description |
|--------|-------------|
| `submitted` | Transfer submitted to the relayer |
| `pending` | Transaction broadcast to the network |
| `confirmed` | Transfer confirmed on-chain |
| `failed` | Transfer transaction reverted |

## Authentication
Requires a valid JWT token.

## Privacy Note
The transfer status endpoint only reveals information to the authenticated user who initiated the transfer. Third parties cannot query transfer status.
