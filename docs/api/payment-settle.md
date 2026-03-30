# Payment Settle Endpoint

## `POST /api/zk-pay/settle/:id`

Settles an outstanding payment by submitting a zero-knowledge proof of payment. Called by the payer's client after generating a proof.

## Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | The payment ID to settle |

## Request Body
```json
{
  "proof": "0x...",
  "nullifierHash": "0x...",
  "root": "0x..."
}
```

## Response

### Success (200)
```json
{
  "paymentId": "pay_xyz789",
  "status": "confirmed",
  "transactionHash": "0x...",
  "settledAt": "2026-03-30T12:05:00Z"
}
```

### Error (400)
```json
{
  "error": "Invalid proof or payment already settled"
}
```

## Webhook
If the payment was created with a callbackUrl, a webhook will be sent with the settlement details upon confirmation.
