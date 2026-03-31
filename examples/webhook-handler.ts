/**
 * Webhook Handler Example
 *
 * Shows how to handle BaseUSDP payment webhook notifications in an Express.js server.
 * Webhooks are sent when payment status changes (confirmed, expired, refunded).
 */

import express from 'express';
import crypto from 'crypto';

const app = express();
app.use(express.json());

const WEBHOOK_SECRET = process.env.BASEUSDP_WEBHOOK_SECRET!;

// Verify webhook signature to ensure it came from BaseUSDP
function verifySignature(payload: string, signature: string): boolean {
  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

app.post('/webhooks/baseusdp', (req, res) => {
  const signature = req.headers['x-baseusdp-signature'] as string;
  const payload = JSON.stringify(req.body);

  // Verify the webhook signature
  if (!signature || !verifySignature(payload, signature)) {
    console.error('Invalid webhook signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = req.body;
  console.log('Received webhook:', event.type);

  switch (event.type) {
    case 'payment.confirmed':
      handlePaymentConfirmed(event.data);
      break;
    case 'payment.expired':
      handlePaymentExpired(event.data);
      break;
    case 'payment.refunded':
      handlePaymentRefunded(event.data);
      break;
    default:
      console.log('Unhandled event type:', event.type);
  }

  // Always respond 200 to acknowledge receipt
  res.status(200).json({ received: true });
});

function handlePaymentConfirmed(data: any) {
  console.log(`Payment ${data.paymentId} confirmed!`);
  console.log(`Amount: ${data.amount} USDC`);
  console.log(`Transaction: ${data.transactionHash}`);
  // Update your database, send confirmation email, fulfill order, etc.
}

function handlePaymentExpired(data: any) {
  console.log(`Payment ${data.paymentId} expired`);
  // Cancel the order, notify the customer, etc.
}

function handlePaymentRefunded(data: any) {
  console.log(`Payment ${data.paymentId} refunded`);
  // Process the refund in your system
}

app.listen(3001, () => {
  console.log('Webhook handler listening on port 3001');
});
