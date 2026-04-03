# Health Check Endpoint

## `GET /api/health`

Returns the health status of the BaseUSDP API and its dependencies.

## Response (200)
```json
{
  "status": "healthy",
  "version": "0.5.0",
  "uptime": 86400,
  "checks": {
    "database": "ok",
    "redis": "ok",
    "rpc": "ok"
  },
  "timestamp": "2026-04-03T12:00:00Z"
}
```

## Response (503)
```json
{
  "status": "degraded",
  "checks": {
    "database": "ok",
    "redis": "error",
    "rpc": "ok"
  }
}
```

## No authentication required.
Used by load balancers, Docker health checks, and monitoring.
