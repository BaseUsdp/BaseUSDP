/**
 * Express Middleware Integration
 *
 * Middleware that verifies BaseUSDP payment before allowing access to protected routes.
 * Implements the x402 Payment Required flow.
 */

import { Request, Response, NextFunction } from 'express';
import { BaseUSDP } from '@baseusdp/sdk';

const client = new BaseUSDP({
  apiKey: process.env.BASEUSDP_API_KEY!,
  network: 'base-mainnet',
});

interface PaywallOptions {
  amount: string;
  description: string;
  expiresIn?: number;
}

/**
 * Creates Express middleware that requires payment before access.
 * Returns HTTP 402 with payment details if not paid.
 */
function requirePayment(options: PaywallOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Check if payment token is provided in header
    const paymentToken = req.headers['x-payment-token'] as string;

    if (paymentToken) {
      try {
        const verification = await client.payments.verify(paymentToken);
        if (verification.valid && verification.amount >= parseFloat(options.amount)) {
          // Payment verified, allow access
          req.body._paymentId = verification.paymentId;
          return next();
        }
      } catch {
        // Invalid token, fall through to create new payment
      }
    }

    // No valid payment — return 402 with payment instructions
    const payment = await client.payments.create({
      amount: options.amount,
      currency: 'USDC',
      description: options.description,
      expiresIn: options.expiresIn || 3600,
      metadata: {
        path: req.path,
        method: req.method,
      },
    });

    res.status(402).json({
      error: 'Payment Required',
      payment: {
        id: payment.id,
        amount: options.amount,
        currency: 'USDC',
        url: payment.url,
        expiresAt: payment.expiresAt,
      },
      instructions: 'Complete payment and include the payment token in x-payment-token header',
    });
  };
}

export { requirePayment };

// Usage example:
// app.get('/api/premium-data', requirePayment({ amount: '0.10', description: 'API access' }), handler);
