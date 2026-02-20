/**
 * Get Payment Request API
 * GET /api/payments/:id
 * 
 * Fetches a payment request by ID so the payment page can display it.
 * This is a PUBLIC endpoint — anyone with the link can view it.
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: 'Payment ID required' });
    }

    const { data: payment, error } = await supabase
      .from('payment_requests')
      .select('*')
      .eq('payment_id', id as string)
      .maybeSingle();

    if (error) {
      console.error('[Payments] Fetch error:', error);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!payment) {
      return res.status(404).json({ error: 'Payment request not found' });
    }

    return res.status(200).json({
      success: true,
      payment: {
        id: payment.payment_id,
        serviceName: payment.service_name || 'Payment Request',
        amount: payment.amount,
        token: payment.token || 'USDC',
        description: payment.description || '',
        status: payment.status,
        recipientWallet: payment.recipient || payment.user_wallet,
        createdAt: payment.created_at,
        paidBy: payment.paid_by,
        txHash: payment.tx_hash,
      },
    });
  } catch (error: any) {
    console.error('[Payments] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal error' });
  }
}
