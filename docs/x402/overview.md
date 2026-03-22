# x402 Protocol Overview

x402 is an HTTP-native payment protocol that enables pay-per-request commerce on the web. BASEUSDP integrates x402 to allow users to create, share, and settle payment requests with optional ZK privacy.

## What is x402?

The name references HTTP status code `402 Payment Required` — a status code reserved since 1999 for future use in digital payments. x402 finally puts it to work.

x402 turns any URL into a payment endpoint. A merchant or service provider generates a payment link. The payer opens it, confirms in their wallet, and the transaction settles on-chain. No payment processor. No intermediary. No card numbers.

## How It Works

```
┌──────────┐     1. Create Payment     ┌──────────────┐
│          │ ──────────────────────────►│              │
│ Merchant │                            │  BASEUSDP    │
│          │◄────────────────────────── │  Backend     │
└──────────┘     2. Payment Link        │              │
                                        └──────┬───────┘
                                               │
┌──────────┐     3. Open Link           ┌──────┴───────┐
│          │ ──────────────────────────►│              │
│  Payer   │     4. Confirm in Wallet   │  Settlement  │
│          │ ──────────────────────────►│  Layer       │
│          │◄────────────────────────── │  (Base L2)   │
└──────────┘     5. Confirmation        └──────────────┘
```

### Step-by-Step

1. **Create** — The merchant calls the BASEUSDP API to create a payment request with an amount, currency (USDC), and optional metadata (memo, expiry, callback URL).

2. **Share** — The API returns a unique payment link (`https://baseusdp.com/pay/{id}`). The merchant shares this link however they want — embed it on a website, send it in a chat, put it in a QR code.

3. **Open** — The payer opens the link in their browser. The BASEUSDP frontend loads the payment details and prompts wallet connection.

4. **Confirm** — The payer reviews the amount and recipient, selects a privacy level (public, partial, or full ZK), and confirms the transaction in their wallet.

5. **Settle** — The transaction is submitted to Base. The merchant receives funds. Both parties get a confirmation with the transaction hash.

## Privacy Integration

x402 payments support all three BASEUSDP privacy tiers:

| Tier | What's Hidden | Use Case |
|------|--------------|----------|
| Public | Nothing | Tips, donations, public invoices |
| Partial | Amount | Freelancer payments, B2B |
| Full ZK | Sender, amount, link to recipient | Salary, sensitive transactions |

When the payer selects partial or full privacy, the payment is routed through the BASEUSDP privacy layer before settlement. The merchant still receives funds — they just can't be traced back to the payer on-chain.

## Why x402?

- **No accounts required** — Payers only need a wallet. No signup, no KYC for peer-to-peer transfers.
- **No payment processor** — Settlement happens directly on Base. No Stripe, no PayPal, no 2.9% + $0.30 fees.
- **Programmable** — Payment links can include expiry times, callback webhooks, metadata, and privacy preferences.
- **Composable** — Any app or service can create x402 payment links via the API and embed them anywhere.
- **Private by choice** — Payers decide how much privacy they want. The merchant doesn't have to opt in.

## Comparison

| Feature | Traditional Payment Link | x402 on BASEUSDP |
|---------|------------------------|------------------|
| Settlement time | 2-3 business days | ~2 seconds |
| Fees | 2.9% + $0.30 | Gas only (~$0.001) |
| Privacy | Full data shared with processor | Payer-controlled |
| Chargebacks | Yes | No (final settlement) |
| KYC required | Yes | No (wallet-based) |
| Programmable | Limited | Fully composable |
