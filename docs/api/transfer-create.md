# Transfer Create Endpoint

## `POST /api/privacy-usd/transfer`

Creates a private transfer from the privacy pool to a recipient address. Requires a valid zero-knowledge proof generated client-side.

## Request Body
```json
{
  "proof": "0x...",
  "publicInputs": {
    "root": "0x...",
    "nullifierHash": "0x...",
    "recipient": "0x1234...abcd",
    "amount": "50",
    "fee": "0.15"
  }
}
```

### Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `proof` | string | Yes | The ZK-SNARK proof bytes |
| `publicInputs.root` | string | Yes | Merkle tree root at time of proof generation |
| `publicInputs.nullifierHash` | string | Yes | Hash of the nullifier to prevent double-spending |
| `publicInputs.recipient` | string | Yes | Recipient Base address |
| `publicInputs.amount` | string | Yes | Transfer amount in USDC |
| `publicInputs.fee` | string | Yes | Protocol fee amount |

## Response

### Success (200)
```json
{
  "transferId": "txf_def456",
  "transactionHash": "0x...",
  "status": "submitted",
  "estimatedConfirmation": "2026-03-30T12:00:04Z"
}
```

### Error (400)
```json
{
  "error": "Invalid proof or spent nullifier"
}
```

## Notes
- Proof generation happens entirely client-side in the browser
- The relayer submits the transaction to prevent linking sender address to recipient
- Nullifier hashes are tracked to prevent double-spending
