/**
 * List Payment Requests API
 * GET /api/payments/list?wallet=xxx
 * 
 * Lists all payment requests created by a specific wallet.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const ALLOWED_ORIGINS = [
  "https://void402.com",
  "https://www.void402.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

function getAllowedOrigin(origin: string | undefined): string {
  if (!origin) return "https://www.void402.com";
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (origin.match(/^https:\/\/code-whisperer-33[\w-]*\.vercel\.app/)) return origin;
  return "https://www.void402.com";
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
    const { wallet } = req.query;

    if (!wallet) {
      return res.status(400).json({ error: 'Wallet address required' });
    }

    const { data: payments, error } = await supabase
      .from('payment_requests')
      .select('*')
      .eq('user_wallet', wallet as string)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[Payments] List error:', error);
      return res.status(500).json({ error: 'Database error' });
    }

    const formattedPayments = (payments || []).map((p: any) => ({
      id: p.payment_id,
      serviceName: p.service_name || 'Payment Request',
      amount: p.amount?.toString() || '0',
      token: p.token || 'USDC',
      description: p.description || '',
      status: p.status,
      createdAt: p.created_at,
      paidBy: p.paid_by,
      txHash: p.tx_hash,
    }));

    return res.status(200).json({
      success: true,
      payments: formattedPayments,
    });
  } catch (error: any) {
    console.error('[Payments] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal error' });
  }
}
