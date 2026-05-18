/**
 * Settle Payment Request API
 * POST /api/payments/settle
 * 
 * Marks a payment request as settled after successful payment.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { sendFarcasterNotification, getFidByWallet } from '../lib/farcaster-notifications.js';
import { sendTelegramNotification } from '../lib/telegram-notify.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const ALLOWED_ORIGINS = [
  "https://void402.com",
  "https://www.void402.com",
  "https://baseusdp.com",
  "https://www.baseusdp.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

function getAllowedOrigin(origin: string | undefined): string {
  if (!origin) return "https://www.baseusdp.com";
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (origin.match(/^https:\/\/code-whisperer-33[\w-]*\.vercel\.app/)) return origin;
  return "https://www.baseusdp.com";
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
    const { payment_id, paid_by, tx_hash } = req.body;

    if (!payment_id) {
      return res.status(400).json({ error: 'payment_id required' });
    }

    // Atomic update: only settle if still pending
    const { data: updated, error: updateError } = await supabase
      .from('payment_requests')
      .update({
        status: 'settled',
        paid_by: paid_by || null,
        tx_hash: tx_hash || null,
        settled_at: new Date().toISOString(),
      })
      .eq('payment_id', payment_id)
      .eq('status', 'pending')
      .select('payment_id');

    if (updateError) {
      console.error('[Payments] Settle error:', updateError);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!updated || updated.length === 0) {
      return res.status(400).json({ error: 'Payment request not found or already settled' });
    }

    console.log(`[Payments] Settled payment ${payment_id}`);

    // Send Farcaster notification to payment creator if they have a linked FID
    try {
      const { data: payment } = await supabase
        .from('payment_requests')
        .select('user_wallet')
        .eq('payment_id', payment_id)
        .single();

      if (payment?.user_wallet) {
        const creatorFid = await getFidByWallet(payment.user_wallet);
        if (creatorFid) {
          await sendFarcasterNotification(creatorFid, 'payment_settled');
        }
        sendTelegramNotification(payment.user_wallet, 'x402').catch(() => undefined);
      }
    } catch (notifError: any) {
      // Non-critical: log but don't fail the settlement
      console.warn('[Payments] Farcaster notification failed:', notifError.message);
    }

    return res.status(200).json({
      success: true,
      paymentId: payment_id,
      status: 'settled',
    });
  } catch (error: any) {
    console.error('[Payments] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal error' });
  }
}
