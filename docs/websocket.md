# WebSocket Real-Time Transaction Status

BASEUSDP provides a WebSocket connection for real-time transaction lifecycle updates. Instead of polling the API, clients receive push notifications as transactions move through confirmation stages.

## Connection

```
wss://baseusdp.com/ws/transactions
```

The frontend automatically connects when a transaction is initiated. For local development, set the `VITE_WS_URL` environment variable.

## Protocol

### Client → Server

#### Subscribe to a transaction

```json
{ "type": "subscribe", "txHash": "0xabc123..." }
```

#### Unsubscribe

```json
{ "type": "unsubscribe", "txHash": "0xabc123..." }
```

#### Heartbeat ping

```json
{ "type": "ping" }
```

### Server → Client

#### Transaction update

```json
{
  "type": "tx_update",
  "txHash": "0xabc123...",
  "status": "confirmed",
  "confirmations": 3,
  "timestamp": 1711108800000,
  "error": null
}
```

#### Heartbeat pong

```json
{ "type": "pong" }
```

## Transaction Lifecycle

```
pending → submitted → confirming → confirmed
                                 ↘ failed
```

| Status | Description |
|--------|-------------|
| `pending` | Transaction created, not yet submitted to the network |
| `submitted` | Transaction broadcast to Base mempool |
| `confirming` | Included in a block, accumulating confirmations |
| `confirmed` | Reached sufficient confirmations (finalized) |
| `failed` | Transaction reverted or dropped |

## Frontend Usage

### Single Transaction

```tsx
import { useTransactionStatus } from "@/hooks/useTransactionStatus";

function TransactionTracker({ txHash }: { txHash: string }) {
  const { status, confirmations, isTerminal, error } =
    useTransactionStatus(txHash);

  if (error) return <div>Transaction failed: {error}</div>;
  if (isTerminal) return <div>Confirmed with {confirmations} confirmations</div>;

  return <div>Status: {status ?? "connecting..."}</div>;
}
```

### Dashboard (All Transactions)

```tsx
import { useAllTransactionUpdates } from "@/hooks/useTransactionStatus";

function LiveFeed() {
  const { updates } = useAllTransactionUpdates();

  return (
    <ul>
      {updates.map((u) => (
        <li key={u.txHash}>
          {u.txHash.slice(0, 10)}... — {u.status}
        </li>
      ))}
    </ul>
  );
}
```

## Reconnection

The WebSocket service automatically reconnects on abnormal disconnection using exponential backoff:

- Base interval: 3 seconds
- Maximum backoff: 30 seconds
- Maximum attempts: 10
- Pending subscriptions are re-sent after reconnection

Intentional disconnects (user navigates away, calls `disconnect()`) do not trigger reconnection.

## Heartbeat

A `ping` message is sent every 30 seconds to keep the connection alive. If the server does not respond, the connection is considered stale and the reconnection logic takes over.
