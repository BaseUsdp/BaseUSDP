# x402 API Reference

Complete API reference for creating, retrieving, and settling x402 payment requests on BASEUSDP.

## Base URL

```
https://baseusdp.com/api/zk-pay
```

All endpoints require a valid session token unless otherwise noted.

---

## Create Payment Request

Creates a new x402 payment request and returns a shareable payment link.

```
POST /create
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amount` | `string` | Yes | Payment amount in USDC (e.g., `"10.00"`) |
| `recipientAddress` | `string` | Yes | Recipient wallet address (`0x...`) |
| `memo` | `string` | No | Human-readable description of the payment |
| `expiresIn` | `number` | No | Expiry time in seconds (default: 86400 / 24 hours) |
| `callbackUrl` | `string` | No | Webhook URL to receive settlement notification |
| `metadata` | `object` | No | Arbitrary key-value data attached to the payment |

### Example Request

```json
{
  "amount": "25.00",
  "recipientAddress": "0x1234567890abcdef1234567890abcdef12345678",
  "memo": "Invoice #1042 — Design work",
  "expiresIn": 172800,
  "callbackUrl": "https://merchant.com/webhooks/payment",
  "metadata": {
    "invoiceId": "1042",
    "customer": "alice.eth"
  }
}
```

### Response

```json
{
  "success": true,
  "paymentId": "x402_a1b2c3d4e5f6",
  "paymentUrl": "https://baseusdp.com/pay/x402_a1b2c3d4e5f6",
  "amount": "25.00",
  "currency": "USDC",
  "recipientAddress": "0x1234567890abcdef1234567890abcdef12345678",
  "status": "pending",
  "expiresAt": "2026-03-24T11:00:00.000Z",
  "createdAt": "2026-03-22T11:00:00.000Z"
}
```

---

## Get Payment Status

Retrieves the current status of a payment request. **No authentication required** — payment links are public by design.

```
GET /status/:paymentId
```

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `paymentId` | `string` | The payment ID (e.g., `x402_a1b2c3d4e5f6`) |

### Response

```json
{
  "success": true,
  "paymentId": "x402_a1b2c3d4e5f6",
  "status": "completed",
  "amount": "25.00",
  "currency": "USDC",
  "recipientAddress": "0x1234567890abcdef1234567890abcdef12345678",
  "memo": "Invoice #1042 — Design work",
  "txHash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  "privacyLevel": "partial",
  "settledAt": "2026-03-22T11:05:32.000Z",
  "expiresAt": "2026-03-24T11:00:00.000Z",
  "createdAt": "2026-03-22T11:00:00.000Z"
}
```

### Payment Statuses

| Status | Description |
|--------|-------------|
| `pending` | Created, waiting for payer to open and confirm |
| `awaiting_confirmation` | Transaction submitted, waiting for on-chain confirmation |
| `completed` | Payment settled on-chain |
| `expired` | Payment link expired before settlement |
| `failed` | Transaction failed on-chain |

---

## Settle Payment

Submits a signed transaction to settle a pending payment. Called by the frontend after the payer confirms in their wallet.

```
POST /settle
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `paymentId` | `string` | Yes | The payment ID to settle |
| `signedTransaction` | `string` | Yes | Hex-encoded signed transaction |
| `privacyLevel` | `string` | Yes | `"public"`, `"partial"`, or `"full"` |
| `senderAddress` | `string` | Yes | Payer's wallet address |

### Example Request

```json
{
  "paymentId": "x402_a1b2c3d4e5f6",
  "signedTransaction": "0x02f8730184...",
  "privacyLevel": "partial",
  "senderAddress": "0xabcdef1234567890abcdef1234567890abcdef12"
}
```

### Response

```json
{
  "success": true,
  "txHash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  "status": "awaiting_confirmation",
  "estimatedConfirmation": 2
}
```

---

## List Payments

Returns all payment requests created by the authenticated user.

```
GET /list
```

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | `string` | all | Filter by status |
| `limit` | `number` | 20 | Results per page (max 100) |
| `offset` | `number` | 0 | Pagination offset |

### Response

```json
{
  "success": true,
  "payments": [
    {
      "paymentId": "x402_a1b2c3d4e5f6",
      "amount": "25.00",
      "status": "completed",
      "memo": "Invoice #1042",
      "createdAt": "2026-03-22T11:00:00.000Z"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

---

## Webhook Callback

When a `callbackUrl` is provided during payment creation, BASEUSDP sends a POST request to that URL upon settlement.

### Callback Payload

```json
{
  "event": "payment.settled",
  "paymentId": "x402_a1b2c3d4e5f6",
  "amount": "25.00",
  "currency": "USDC",
  "txHash": "0xabcdef...",
  "status": "completed",
  "settledAt": "2026-03-22T11:05:32.000Z"
}
```

### Verification

Callbacks include an `X-BASEUSDP-Signature` header containing an HMAC-SHA256 signature of the request body. Verify this against your webhook secret to ensure authenticity.

---

## Error Responses

All endpoints return errors in a consistent format:

```json
{
  "success": false,
  "error": "PAYMENT_NOT_FOUND",
  "message": "No payment found with the given ID"
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|------------|-------------|
| `INVALID_AMOUNT` | 400 | Amount is zero, negative, or not a valid number |
| `INVALID_ADDRESS` | 400 | Recipient address is not a valid Ethereum address |
| `PAYMENT_NOT_FOUND` | 404 | Payment ID does not exist |
| `PAYMENT_EXPIRED` | 410 | Payment link has expired |
| `PAYMENT_ALREADY_SETTLED` | 409 | Payment has already been completed |
| `INSUFFICIENT_BALANCE` | 402 | Payer does not have enough USDC |
| `TRANSACTION_FAILED` | 500 | On-chain transaction reverted |
| `UNAUTHORIZED` | 401 | Missing or invalid session token |
