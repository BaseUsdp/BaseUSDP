/**
 * Cancel Payment Request API
 * POST /api/payments/cancel
 * 
 * Cancels a payment request. Only the creator can cancel.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const ALLOWED_ORIGINS = [
  "https://void402.com",
  "https://www.void402.com",
  "https://orb402.com",
  "https://www.orb402.com",
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
    const { payment_id, wallet } = req.body;

    if (!payment_id || !wallet) {
      return res.status(400).json({ error: 'payment_id and wallet required' });
    }

    console.log(`[Payments] Attempting to cancel payment ${payment_id} for wallet ${wallet}`);

    // First, check if the payment request exists
    const { data: existing, error: fetchError } = await supabase
      .from('payment_requests')
      .select('payment_id, status, user_wallet')
      .eq('payment_id', payment_id)
      .maybeSingle();

    if (fetchError) {
      console.error('[Payments] Fetch error:', fetchError);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!existing) {
      console.error(`[Payments] Payment ${payment_id} not found`);
      return res.status(400).json({ error: 'Payment request not found' });
    }

    console.log(`[Payments] Found payment: status=${existing.status}, user_wallet=${existing.user_wallet}`);

    if (existing.status !== 'pending') {
      return res.status(400).json({ error: `Cannot cancel: payment is ${existing.status}` });
    }

    // Check ownership - try both user_wallet and recipient columns
    const ownerMatch = existing.user_wallet === wallet;
    if (!ownerMatch) {
      console.error(`[Payments] Wallet mismatch: DB=${existing.user_wallet}, Request=${wallet}`);
      return res.status(403).json({ error: 'Not authorized to cancel this payment' });
    }

    // Perform the update
    const { error: updateError } = await supabase
      .from('payment_requests')
      .update({ status: 'cancelled' })
      .eq('payment_id', payment_id);

    if (updateError) {
      console.error('[Payments] Update error:', updateError);
      return res.status(500).json({ error: 'Failed to cancel payment' });
    }

    console.log(`[Payments] Successfully cancelled payment ${payment_id}`);

    return res.status(200).json({
      success: true,
      paymentId: payment_id,
      status: 'cancelled',
    });
  } catch (error: any) {
    console.error('[Payments] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal error' });
  }
}
