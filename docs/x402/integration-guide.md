# x402 Integration Guide

This guide shows how to integrate x402 payments into your application using the BASEUSDP API.

## Quick Start

### 1. Create a Payment Link

```typescript
const response = await fetch("https://baseusdp.com/api/zk-pay/create", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_SESSION_TOKEN"
  },
  body: JSON.stringify({
    amount: "10.00",
    recipientAddress: "0xYourWalletAddress",
    memo: "Payment for API access"
  })
});

const { paymentUrl, paymentId } = await response.json();
// paymentUrl = "https://baseusdp.com/pay/x402_abc123"
```

### 2. Share the Link

Embed it anywhere — your website, a chat message, an email, or a QR code.

```html
<a href="https://baseusdp.com/pay/x402_abc123">Pay $10.00 USDC</a>
```

### 3. Check Payment Status

```typescript
const status = await fetch(
  "https://baseusdp.com/api/zk-pay/status/x402_abc123"
);
const { status: paymentStatus, txHash } = await status.json();

if (paymentStatus === "completed") {
  // Grant access, ship product, etc.
}
```

---

## React Integration

### Payment Button Component

```tsx
import { useState } from "react";

interface PaymentButtonProps {
  amount: string;
  recipientAddress: string;
  memo?: string;
  onPaymentCreated?: (paymentUrl: string) => void;
}

export function PaymentButton({
  amount,
  recipientAddress,
  memo,
  onPaymentCreated
}: PaymentButtonProps) {
  const [loading, setLoading] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);

  const createPayment = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/zk-pay/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, recipientAddress, memo })
      });
      const data = await res.json();
      setPaymentUrl(data.paymentUrl);
      onPaymentCreated?.(data.paymentUrl);
    } finally {
      setLoading(false);
    }
  };

  if (paymentUrl) {
    return (
      <a href={paymentUrl} target="_blank" rel="noopener noreferrer">
        Pay {amount} USDC
      </a>
    );
  }

  return (
    <button onClick={createPayment} disabled={loading}>
      {loading ? "Creating..." : `Request ${amount} USDC`}
    </button>
  );
}
```

### Polling for Settlement

```tsx
import { useEffect, useState } from "react";

export function usePaymentStatus(paymentId: string | null) {
  const [status, setStatus] = useState<string>("pending");
  const [txHash, setTxHash] = useState<string | null>(null);

  useEffect(() => {
    if (!paymentId) return;

    const poll = setInterval(async () => {
      const res = await fetch(`/api/zk-pay/status/${paymentId}`);
      const data = await res.json();
      setStatus(data.status);

      if (data.txHash) setTxHash(data.txHash);

      if (["completed", "expired", "failed"].includes(data.status)) {
        clearInterval(poll);
      }
    }, 3000);

    return () => clearInterval(poll);
  }, [paymentId]);

  return { status, txHash };
}
```

---

## Webhook Integration

### Setting Up a Webhook Receiver

```typescript
// Express.js example
import express from "express";
import crypto from "crypto";

const app = express();
app.use(express.json());

const WEBHOOK_SECRET = process.env.BASEUSDP_WEBHOOK_SECRET;

app.post("/webhooks/payment", (req, res) => {
  // Verify signature
  const signature = req.headers["x-baseusdp-signature"] as string;
  const expectedSignature = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(JSON.stringify(req.body))
    .digest("hex");

  if (signature !== expectedSignature) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const { event, paymentId, amount, txHash } = req.body;

  if (event === "payment.settled") {
    // Fulfill the order
    console.log(`Payment ${paymentId} settled: ${amount} USDC (tx: ${txHash})`);
  }

  res.status(200).json({ received: true });
});
```

---

## Use Cases

### Pay-Per-Article

```typescript
// Middleware that checks for payment before serving content
async function paywall(req, res, next) {
  const paymentId = req.cookies.x402_payment;

  if (paymentId) {
    const status = await checkPaymentStatus(paymentId);
    if (status === "completed") return next();
  }

  // Create payment and redirect
  const { paymentUrl } = await createPayment({
    amount: "0.50",
    recipientAddress: PUBLISHER_WALLET,
    memo: `Article: ${req.params.slug}`,
    callbackUrl: `${BASE_URL}/webhooks/payment`
  });

  res.redirect(paymentUrl);
}
```

### Invoice System

```typescript
async function createInvoice(invoice: Invoice) {
  const payment = await createPayment({
    amount: invoice.total.toString(),
    recipientAddress: BUSINESS_WALLET,
    memo: `Invoice #${invoice.id}`,
    expiresIn: 604800, // 7 days
    callbackUrl: `${BASE_URL}/webhooks/invoice`,
    metadata: {
      invoiceId: invoice.id,
      customerId: invoice.customerId
    }
  });

  // Send payment link to customer
  await sendEmail(invoice.customerEmail, {
    subject: `Invoice #${invoice.id} — ${invoice.total} USDC`,
    paymentUrl: payment.paymentUrl
  });

  return payment;
}
```

### QR Code Payments (Point of Sale)

```tsx
import QRCode from "qrcode.react";

function PointOfSale({ amount }: { amount: string }) {
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const { status } = usePaymentStatus(paymentId);

  const generate = async () => {
    const res = await fetch("/api/zk-pay/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        recipientAddress: MERCHANT_WALLET,
        memo: `POS Sale — ${amount} USDC`
      })
    });
    const data = await res.json();
    setPaymentUrl(data.paymentUrl);
    setPaymentId(data.paymentId);
  };

  if (status === "completed") {
    return <div>Payment received</div>;
  }

  return (
    <div>
      {paymentUrl ? (
        <QRCode value={paymentUrl} size={256} />
      ) : (
        <button onClick={generate}>Generate QR — {amount} USDC</button>
      )}
    </div>
  );
}
```

---

## Best Practices

1. **Always verify webhook signatures** — Never trust incoming webhook payloads without verifying the HMAC signature.

2. **Set reasonable expiry times** — Short-lived links (1-24 hours) for real-time transactions, longer (7 days) for invoices.

3. **Use the callback URL** — Don't rely on polling alone. Webhooks are more reliable and lower latency.

4. **Handle all terminal states** — Your integration should handle `completed`, `expired`, and `failed` states gracefully.

5. **Let the payer choose privacy** — Don't force a privacy level. The payer's choice is part of the x402 design.
