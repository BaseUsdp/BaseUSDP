# WebSocket Protocol

## Overview
BaseUSDP provides real-time updates via WebSocket connections. This is used for live transaction status updates, payment notifications, and system announcements.

## Connection
```
wss://api.baseusdp.com/ws
```

## Authentication
Send an auth message immediately after connecting:
```json
{
  "type": "auth",
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

## Subscribing to Events
```json
{
  "type": "subscribe",
  "channels": ["deposits", "transfers", "payments"]
}
```

## Event Types

### deposit.confirmed
```json
{
  "type": "deposit.confirmed",
  "data": {
    "depositId": "dep_abc123",
    "amount": "100",
    "tier": 3,
    "blockNumber": 12345678
  }
}
```

### transfer.confirmed
```json
{
  "type": "transfer.confirmed",
  "data": {
    "transferId": "txf_def456",
    "amount": "50",
    "transactionHash": "0x..."
  }
}
```

### payment.received
```json
{
  "type": "payment.received",
  "data": {
    "paymentId": "pay_xyz789",
    "amount": "25.00",
    "from": "anonymous"
  }
}
```

## Heartbeat
The server sends a ping every 30 seconds. Clients must respond with a pong within 10 seconds or the connection will be closed.

## Reconnection
Implement exponential backoff for reconnection: start at 1 second, double up to 30 seconds maximum.
