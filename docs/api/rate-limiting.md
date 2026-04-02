# Rate Limiting

## Overview
BaseUSDP API endpoints enforce rate limits to prevent abuse and ensure fair usage for all users.

## Default Limits
| Endpoint Category | Limit | Window |
|-------------------|-------|--------|
| Authentication | 10 requests | 1 minute |
| Read operations | 60 requests | 1 minute |
| Write operations | 20 requests | 1 minute |
| Proof submission | 5 requests | 1 minute |
| Username lookup | 30 requests | 1 minute |

## Rate Limit Headers
Every API response includes rate limit information:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1711800000
```

## Exceeding Limits
When you exceed the rate limit, the API returns HTTP 429:
```json
{
  "error": "Too Many Requests",
  "retryAfter": 30
}
```

## Merchant API Limits
Merchants with API keys receive higher rate limits:
| Plan | Read | Write | Proof |
|------|------|-------|-------|
| Free | 60/min | 20/min | 5/min |
| Pro | 300/min | 100/min | 25/min |
| Enterprise | Custom | Custom | Custom |

## Best Practices
- Implement exponential backoff on 429 responses
- Cache responses where possible
- Use WebSocket for real-time updates instead of polling
- Batch operations when available
