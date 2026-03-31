/**
 * QR Payment Example
 *
 * Demonstrates generating and scanning QR codes for in-person payments.
 * Useful for point-of-sale integrations and physical retail.
 */

import { BaseUSDP } from '@baseusdp/sdk';
import QRCode from 'qrcode';

const client = new BaseUSDP({
  apiKey: process.env.BASEUSDP_API_KEY!,
  network: 'base-mainnet',
});

/**
 * Generate a QR code for a payment request (merchant side)
 */
async function generatePaymentQR(amount: string, description: string) {
  // Create payment request
  const payment = await client.payments.create({
    amount,
    currency: 'USDC',
    description,
    expiresIn: 300, // 5 minutes for in-person payments
  });

  // Generate QR code as data URL for display
  const qrDataUrl = await QRCode.toDataURL(payment.url, {
    width: 300,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'M',
  });

  console.log('Display this QR code to the customer:');
  console.log('Payment ID:', payment.id);
  console.log('Amount:', amount, 'USDC');
  console.log('Expires:', new Date(payment.expiresAt).toLocaleTimeString());

  return { payment, qrDataUrl };
}

/**
 * Monitor payment status (merchant side)
 */
async function monitorPayment(paymentId: string) {
  console.log('Waiting for customer to scan and pay...');

  const result = await client.payments.waitForConfirmation(paymentId, {
    timeout: 300000,
    pollInterval: 1000,
  });

  if (result.status === 'confirmed') {
    console.log('Payment received! Transaction:', result.transactionHash);
    return true;
  }

  console.log('Payment was not completed:', result.status);
  return false;
}

// Usage
async function main() {
  const { payment } = await generatePaymentQR('5.00', 'Espresso');
  await monitorPayment(payment.id);
}

main().catch(console.error);
