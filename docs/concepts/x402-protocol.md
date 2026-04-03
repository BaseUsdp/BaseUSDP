# x402 Payment Protocol

## Overview
x402 is a payment protocol based on the HTTP 402 (Payment Required) status code. It enables machine-readable payment requests that can be settled using cryptocurrency.

## How It Works
1. Client requests a paid resource: `GET /api/premium-data`
2. Server returns `402 Payment Required` with payment details
3. Client completes payment via BaseUSDP
4. Client retries request with payment proof: `GET /api/premium-data` + `X-Payment-Token: ...`
5. Server verifies payment and serves the resource

## BaseUSDP x402 Implementation
BaseUSDP extends the x402 standard with privacy features:
- Payments are made through the privacy pool
- The merchant receives USDC but cannot identify the payer
- Payment proofs are zero-knowledge: they prove payment without revealing the payer

## Use Cases
- API monetization (pay-per-call)
- Content paywalls (pay-per-article)
- SaaS micro-billing (pay-per-use)
- IoT machine-to-machine payments
- Streaming payments for AI inference

## Integration
See [x402 Merchant Guide](../guides/x402-merchant-guide.md) and [Express Middleware Example](../../examples/integrations/express-middleware.ts).
