# Rate Limiting

BASEUSDP implements rate limiting on all API endpoints to protect against abuse and ensure fair usage.

## Client-Side Limits

| Action | Limit | Window |
|--------|-------|--------|
| Nonce requests | 5 | per minute |
| Auth verification | 3 | per minute |
| Transfer submission | 10 | per minute |
| Swap quotes | 30 | per minute |
| Balance queries | 60 | per minute |
| Support tickets | 3 | per hour |

## Response Headers

Rate limit information is included in API response headers:

```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1743253260
```

## Rate Limit Exceeded

When a rate limit is exceeded, the API returns:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 30

{
  "success": false,
  "error": "Rate limit exceeded. Please try again in 30 seconds.",
  "retryAfter": 30
}
```

## Client-Side Handling

The API service layer automatically handles 429 responses:

```typescript
async function apiRequest(url: string, options: RequestInit) {
  const response = await fetch(url, options);

  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get("Retry-After") ?? "30");
    // Show user-friendly message
    toast.error(`Too many requests. Please wait ${retryAfter} seconds.`);
    return null;
  }

  return response.json();
}
```

## Implementation

Rate limiting is implemented at the Vercel serverless function level using an in-memory store with sliding window counters. For production scale, this should be backed by Redis or a similar distributed store.

### Per-IP Limiting

All endpoints are rate-limited per IP address. This prevents a single user from overwhelming the service.

### Per-Wallet Limiting

Authenticated endpoints additionally limit by wallet address, preventing a user from circumventing IP limits with proxies.

## WebSocket Rate Limiting

| Message Type | Limit | Window |
|-------------|-------|--------|
| Subscribe | 10 | per minute |
| Ping | 2 | per minute |
| Auth | 3 | per minute |

Exceeding WebSocket rate limits results in a warning message. Persistent abuse leads to connection termination.

## Best Practices for Contributors

1. Always debounce user inputs that trigger API calls
2. Cache API responses when possible (use TanStack Query)
3. Use the `throttle` utility from `src/utils/memoize.ts` for frequent operations
4. Show loading states instead of allowing rapid resubmission
5. Implement exponential backoff for retries
