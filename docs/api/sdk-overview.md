# SDK Overview

## Installation
```bash
npm install @baseusdp/sdk
```

## Quick Start
```typescript
import { BaseUSDP } from '@baseusdp/sdk';

const client = new BaseUSDP({
  apiKey: 'your-api-key',
  network: 'base-mainnet',
});

// Create a payment
const payment = await client.payments.create({
  amount: '10.00',
  currency: 'USDC',
});
```

## SDK Modules
- `client.payments` — Create and manage payment requests
- `client.transfers` — Private transfers and withdrawals
- `client.pool` — Privacy pool interactions
- `client.users` — Username registration and lookup
- `client.webhooks` — Webhook management

## Configuration Options
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | string | — | Your API key |
| `network` | string | base-mainnet | Network to connect to |
| `timeout` | number | 30000 | Request timeout (ms) |
| `retries` | number | 3 | Retry count for failed requests |

## Error Handling
```typescript
try {
  await client.payments.create({ ... });
} catch (error) {
  if (error instanceof BaseUSDPError) {
    console.log(error.code); // Machine-readable code
    console.log(error.message); // Human-readable message
  }
}
```

## TypeScript Support
The SDK is written in TypeScript and includes full type definitions.
