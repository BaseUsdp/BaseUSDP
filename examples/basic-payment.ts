/**
 * Basic Payment Example
 *
 * Demonstrates how to create a simple payment request using the BaseUSDP SDK.
 * This example shows the merchant-side flow for requesting payment from a customer.
 */

import { BaseUSDP } from '@baseusdp/sdk';

// Initialize the SDK with your API key
const client = new BaseUSDP({
  apiKey: process.env.BASEUSDP_API_KEY!,
  network: 'base-mainnet', // or 'base-sepolia' for testing
});

async function createBasicPayment() {
  // Create a payment request
  const payment = await client.payments.create({
    amount: '25.00',
    currency: 'USDC',
    description: 'Coffee shop order #1234',
    expiresIn: 3600, // 1 hour
    metadata: {
      orderId: 'ORD-1234',
      customerName: 'Alice',
    },
  });

  console.log('Payment created:', payment.id);
  console.log('Payment URL:', payment.url);
  console.log('QR Code:', payment.qrCode);

  // Wait for payment confirmation
  const confirmed = await client.payments.waitForConfirmation(payment.id, {
    timeout: 300000, // 5 minutes
    pollInterval: 2000, // Check every 2 seconds
  });

  if (confirmed.status === 'confirmed') {
    console.log('Payment confirmed!');
    console.log('Transaction hash:', confirmed.transactionHash);
  } else {
    console.log('Payment expired or failed:', confirmed.status);
  }
}

createBasicPayment().catch(console.error);
