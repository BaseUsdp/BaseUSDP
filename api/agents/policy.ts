/**
 * PUT /api/agents/policy
 * Set/update agent spending policy (Bearer/SIWE auth)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { extractBearerToken, verifyBearerToken } from '../lib/bearer-auth.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const ALLOWED_ORIGINS = [
  "https://void402.com", "https://www.void402.com",
  "https://baseusdp.com",
  "https://www.baseusdp.com",
  "http://localhost:5173", "http://localhost:3000",
];

function getAllowedOrigin(origin: string | undefined): string {
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (origin.match(/^https:\/\/code-whisperer-33[\w-]*\.vercel\.app/)) return origin;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getAllowedOrigin(req.headers.origin as string);
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });

  const bearerToken = extractBearerToken(req);
  if (!bearerToken) return res.status(401).json({ error: 'Authentication required' });

  const {
    wallet, agent_id, max_per_tx, daily_limit,
    allowed_tokens, allowed_recipients, blocked_recipients,
    time_window_start, time_window_end
  } = req.body || {};

  if (!wallet || !agent_id) {
    return res.status(400).json({ error: 'wallet and agent_id are required' });
  }

  const tokenVerification = await verifyBearerToken(bearerToken, wallet);
  if (!tokenVerification.valid) {
    return res.status(403).json({ error: 'Invalid authentication' });
  }

  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  // Verify ownership
  const { data: agent } = await supabase
    .from('agent_profiles')
    .select('owner_wallet')
    .eq('id', agent_id)
    .single();

  if (!agent || agent.owner_wallet !== wallet) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (max_per_tx !== undefined) updates.max_per_tx = max_per_tx;
  if (daily_limit !== undefined) updates.daily_limit = daily_limit;
  if (allowed_tokens !== undefined) updates.allowed_tokens = allowed_tokens;
  if (allowed_recipients !== undefined) updates.allowed_recipients = allowed_recipients;
  if (blocked_recipients !== undefined) updates.blocked_recipients = blocked_recipients;
  if (time_window_start !== undefined) updates.time_window_start = time_window_start;
  if (time_window_end !== undefined) updates.time_window_end = time_window_end;

  const { data: policy, error } = await supabase
    .from('agent_spending_policies')
    .upsert({
      agent_id,
      ...updates,
    }, { onConflict: 'agent_id' })
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: 'Failed to update policy' });
  }

  return res.status(200).json({ success: true, policy });
}
