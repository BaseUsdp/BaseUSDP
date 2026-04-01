/**
 * Next.js API Route Integration
 *
 * Shows how to create a Next.js API route that accepts BaseUSDP payments.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { BaseUSDP } from '@baseusdp/sdk';

const client = new BaseUSDP({
  apiKey: process.env.BASEUSDP_API_KEY!,
  network: 'base-mainnet',
});

type PaymentResponse = {
  success: boolean;
  paymentId?: string;
  paymentUrl?: string;
  data?: any;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PaymentResponse>
) {
  if (req.method === 'POST') {
    // Create a payment request
    try {
      const { amount, description, orderId } = req.body;

      if (!amount || parseFloat(amount) <= 0) {
        return res.status(400).json({ success: false, error: 'Invalid amount' });
      }

      const payment = await client.payments.create({
        amount,
        currency: 'USDC',
        description: description || 'Payment',
        callbackUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/payment`,
        metadata: { orderId },
      });

      return res.status(201).json({
        success: true,
        paymentId: payment.id,
        paymentUrl: payment.url,
      });
    } catch (error) {
      console.error('Payment creation failed:', error);
      return res.status(500).json({ success: false, error: 'Failed to create payment' });
    }
  }

  if (req.method === 'GET') {
    // Check payment status
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ success: false, error: 'Payment ID required' });
    }

    try {
      const status = await client.payments.getStatus(id);
      return res.status(200).json({ success: true, data: status });
    } catch (error) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).json({ success: false, error: 'Method not allowed' });
}
