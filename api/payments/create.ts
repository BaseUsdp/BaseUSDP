/**
 * Create Payment Request API
 * POST /api/payments/create
 * 
 * Creates a new payment request stored in Supabase so anyone with the link can pay.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const ALLOWED_ORIGINS = [
  "https://void402.com",
  "https://www.void402.com",
  "https://orb402.com",
  "https://www.orb402.com",
  "https://baseusdp.com",
  "https://www.baseusdp.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

function getAllowedOrigin(origin: string | undefined): string {
  if (!origin) return "https://www.orb402.com";
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (origin.match(/^https:\/\/code-whisperer-33[\w-]*\.vercel\.app/)) return origin;
  return "https://www.orb402.com";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getAllowedOrigin(req.headers.origin as string | undefined);
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { amount, recipient_wallet, service_name, description, token } = req.body;

    if (!amount || !recipient_wallet || !service_name) {
      return res.status(400).json({ error: 'Missing required fields: amount, recipient_wallet, service_name' });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    if (parsedAmount > 999999.99) {
      return res.status(400).json({ error: 'Maximum amount is $999,999.99' });
    }

    // Generate payment ID
    const paymentId = `x402_${Math.random().toString(36).substr(2, 9)}`;

    // Generate payment hash for verification
    const paymentHash = createHash('sha256')
      .update(paymentId + parsedAmount.toString() + recipient_wallet + Date.now().toString())
      .digest('hex');

    // Insert into database (matches existing NolviPay schema + extra columns)
    let insertError: any = null;
    
    // Try with service_name and description columns first
    const { error: err1 } = await supabase
      .from('payment_requests')
      .insert({
        payment_id: paymentId,
        user_wallet: recipient_wallet,
        recipient: recipient_wallet,
        amount: parsedAmount,
        token: token || 'USDC',
        nonce: Date.now(),
        payment_hash: paymentHash,
        status: 'pending',
        service_name: service_name,
        description: description || '',
      });

    if (err1) {
      // Fallback: insert without service_name/description (columns might not exist)
      console.warn('[Payments] Insert with extra columns failed, trying fallback:', err1.message);
      const { error: err2 } = await supabase
        .from('payment_requests')
        .insert({
          payment_id: paymentId,
          user_wallet: recipient_wallet,
          recipient: recipient_wallet,
          amount: parsedAmount,
          token: token || 'USDC',
          nonce: Date.now(),
          payment_hash: paymentHash,
          status: 'pending',
        });
      insertError = err2;
    }

    if (insertError) {
      console.error('[Payments] Insert error:', insertError);
      return res.status(500).json({ error: 'Failed to create payment request' });
    }

    console.log(`[Payments] Created payment request ${paymentId} for $${parsedAmount}`);

    return res.status(200).json({
      success: true,
      paymentId,
      paymentHash,
      status: 'pending',
    });
  } catch (error: any) {
    console.error('[Payments] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal error' });
  }
}
