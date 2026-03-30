# x402 Merchant Integration Guide

## Overview
The x402 payment protocol enables merchants to accept privacy-preserving USDC payments through BaseUSDP. This guide covers integration from both technical and business perspectives.

## What is x402?
x402 is a payment protocol standard that uses HTTP 402 (Payment Required) status codes to facilitate machine-readable payment requests. Combined with BaseUSDP, merchants can accept payments without exposing customer transaction histories.

## Quick Start

### 1. Register as a Merchant
Contact the BaseUSDP team or register through the merchant portal to receive your merchant credentials and API keys.

### 2. Install the SDK
```bash
npm install @baseusdp/merchant-sdk
```

### 3. Create a Payment Request
```typescript
import { createPaymentRequest } from '@baseusdp/merchant-sdk';

const payment = await createPaymentRequest({
  amount: 25.00,
  currency: 'USDC',
  description: 'Order #12345',
  callbackUrl: 'https://yourstore.com/api/payment-callback',
  expiresIn: 3600, // 1 hour
});
```

### 4. Display Payment to Customer
Render the payment QR code or deep link for the customer to complete payment through their BaseUSDP wallet.

### 5. Handle Callback
When payment is confirmed, your callback URL receives a POST request with payment details and a cryptographic proof of payment.

## Webhook Events
- `payment.created` — Payment request was created
- `payment.pending` — Customer initiated payment
- `payment.confirmed` — Payment confirmed on-chain
- `payment.expired` — Payment request expired
- `payment.refunded` — Payment was refunded

## Testing
Use the BaseUSDP testnet environment for development. Testnet USDC is available from the faucet at faucet.baseusdp.com.

## Fee Structure
- Transaction fee: 0.3% per payment
- No monthly fees
- No setup fees
- Volume discounts available for high-throughput merchants
