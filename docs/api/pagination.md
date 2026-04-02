# Pagination

## Overview
List endpoints in the BaseUSDP API use offset-based pagination.

## Query Parameters
| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `limit` | number | 20 | 100 | Number of items per page |
| `offset` | number | 0 | — | Number of items to skip |

## Response Format
All paginated responses include metadata:
```json
{
  "data": [...],
  "pagination": {
    "total": 150,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

## Example
```bash
# First page
GET /api/privacy-usd/history?limit=20&offset=0

# Second page
GET /api/privacy-usd/history?limit=20&offset=20

# Third page
GET /api/privacy-usd/history?limit=20&offset=40
```

## Sorting
Most list endpoints support sorting:
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `sort` | string | `createdAt` | Field to sort by |
| `order` | string | `desc` | Sort direction: `asc` or `desc` |

## Best Practices
- Use consistent page sizes across requests
- Cache results when possible
- Use WebSocket for real-time updates rather than frequent polling
