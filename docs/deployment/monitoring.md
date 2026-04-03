# Monitoring Guide

## Health Endpoints
- `GET /api/health` — Overall system health
- Docker container health checks (configured in docker-compose.yml)

## Key Metrics to Monitor
- API response times (p50, p95, p99)
- Error rate by endpoint
- Proof generation success rate
- Relayer transaction submission latency
- Pool balance and deposit count
- WebSocket connection count

## Recommended Stack
- **Error tracking:** Sentry
- **Uptime monitoring:** Better Uptime or Checkly
- **Metrics:** Prometheus + Grafana
- **Logging:** Structured JSON logs via Pino
- **Alerting:** PagerDuty or Opsgenie

## Alert Thresholds
| Metric | Warning | Critical |
|--------|---------|----------|
| API error rate | > 1% | > 5% |
| Response time p95 | > 2s | > 5s |
| Relayer balance | < 0.05 ETH | < 0.01 ETH |
| Pool contract balance discrepancy | Any | Any |

## Runbooks
Keep runbooks in docs/runbooks/ for common operational scenarios.
