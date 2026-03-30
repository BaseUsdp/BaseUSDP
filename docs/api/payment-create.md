# Payment Create Endpoint

## `POST /api/zk-pay/create`

Creates a new payment request that can be shared with a payer via QR code or payment link. Used by merchants and individuals to request payments.

## Request Body
```json
{
  "amount": "25.00",
  "currency": "USDC",
  "description": "Coffee and pastry",
  "expiresIn": 3600,
  "callbackUrl": "https://merchant.com/api/callback",
  "metadata": {
    "orderId": "ORD-12345",
    "customerEmail": "optional@example.com"
  }
}
```

### Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `amount` | string | Yes | Payment amount in specified currency |
| `currency` | string | Yes | Currency code (currently only USDC) |
| `description` | string | No | Human-readable payment description |
| `expiresIn` | number | No | Seconds until expiry (default: 3600) |
| `callbackUrl` | string | No | URL for payment status webhooks |
| `metadata` | object | No | Arbitrary key-value pairs for merchant use |

## Response

### Success (201)
```json
{
  "paymentId": "pay_xyz789",
  "paymentUrl": "https://baseusdp.com/pay/pay_xyz789",
  "qrCode": "data:image/png;base64,...",
  "amount": "25.00",
  "status": "pending",
  "expiresAt": "2026-03-30T13:00:00Z"
}
```

## Authentication
Requires a valid JWT token or merchant API key.
