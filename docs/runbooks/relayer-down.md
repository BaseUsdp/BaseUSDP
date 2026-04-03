# Runbook: Relayer Down

## Symptoms
- Transfers fail with "relayer unavailable"
- Health check shows relayer error

## Actions
1. Check relayer logs
2. Verify relayer wallet has ETH for gas
3. Check Base network status
4. Restart relayer service if crashed

## User Impact
Transfers delayed. Deposits still work. Users can self-relay (reduced privacy).
