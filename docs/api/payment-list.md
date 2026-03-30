# Payment List Endpoint

## `GET /api/zk-pay/list`

Returns a list of payment requests created by the authenticated user, with filtering and pagination support.

## Query Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | string | No | Filter: pending, confirmed, expired, cancelled |
| `limit` | number | No | Results per page (default: 20, max: 100) |
| `offset` | number | No | Pagination offset |
| `sort` | string | No | Sort field: createdAt, amount, status |
| `order` | string | No | Sort order: asc, desc (default: desc) |

## Response

### Success (200)
```json
{
  "payments": [
    {
      "paymentId": "pay_xyz789",
      "amount": "25.00",
      "description": "Coffee and pastry",
      "status": "confirmed",
      "createdAt": "2026-03-30T12:00:00Z",
      "settledAt": "2026-03-30T12:05:00Z"
    }
  ],
  "total": 15,
  "limit": 20,
  "offset": 0
}
```

## Authentication
Requires a valid JWT token or merchant API key.
