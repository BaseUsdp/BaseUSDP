# Deposit Create Endpoint

## `POST /api/privacy-usd/deposit`

Initiates a new USDC deposit into the BaseUSDP privacy pool. This endpoint validates the deposit parameters and returns the contract interaction details needed to execute the on-chain deposit.

## Request Body
```json
{
  "amount": "100",
  "tier": 3,
  "commitment": "0xabc123..."
}
```

### Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `amount` | string | Yes | Deposit amount in USDC (must match tier) |
| `tier` | number | Yes | Privacy tier (1-4) |
| `commitment` | string | Yes | The Pedersen commitment hash for this deposit |

## Response

### Success (200)
```json
{
  "depositId": "dep_abc123",
  "contractAddress": "0x...",
  "calldata": "0x...",
  "estimatedGas": "150000",
  "note": "baseusdp-deposit-v1-..."
}
```

### Error (400)
```json
{
  "error": "Amount does not match selected tier"
}
```

## Authentication
Requires a valid JWT token in the Authorization header.

## Notes
- The commitment is generated client-side and never reveals the deposit secret
- Save the returned note securely — it is needed for future transfers
- The deposit must be executed on-chain within 30 minutes
