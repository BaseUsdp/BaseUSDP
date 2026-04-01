# BaseUSDP Examples

This directory contains example code demonstrating how to integrate with BaseUSDP.

## Examples

### Basic Usage
- **[basic-payment.ts](./basic-payment.ts)** — Create a simple payment request
- **[private-transfer.ts](./private-transfer.ts)** — Perform a private USDC transfer with ZK proofs
- **[qr-payment.ts](./qr-payment.ts)** — Generate QR codes for in-person payments
- **[batch-payments.ts](./batch-payments.ts)** — Process multiple payments in bulk
- **[recurring-payment.ts](./recurring-payment.ts)** — Set up subscription-style recurring payments
- **[webhook-handler.ts](./webhook-handler.ts)** — Handle payment status webhooks

### Framework Integrations
- **[integrations/express-middleware.ts](./integrations/express-middleware.ts)** — Express.js x402 paywall middleware
- **[integrations/nextjs-api-route.ts](./integrations/nextjs-api-route.ts)** — Next.js API route for payments
- **[integrations/discord-bot.ts](./integrations/discord-bot.ts)** — Discord bot for USDC tips

## Prerequisites
- Node.js 18+
- A BaseUSDP API key (get one at baseusdp.com/developers)
- USDC on Base (use testnet for development)

## Running Examples
```bash
# Install dependencies
npm install @baseusdp/sdk

# Set environment variables
export BASEUSDP_API_KEY=your_api_key_here

# Run an example
npx ts-node examples/basic-payment.ts
```

## Need Help?
- [API Documentation](../docs/api/)
- [Guides](../docs/guides/)
- [GitHub Issues](https://github.com/BaseUsdp/BaseUSDP/issues)
