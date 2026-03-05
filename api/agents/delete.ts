/**
 * DELETE /api/agents/delete
 * Delete an agent and all associated data (Bearer/SIWE auth)
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
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  const bearerToken = extractBearerToken(req);
  if (!bearerToken) return res.status(401).json({ error: 'Authentication required' });

  const { wallet, agent_id } = req.body || {};
  if (!wallet || !agent_id) {
    return res.status(400).json({ error: 'wallet and agent_id are required' });
  }

  const tokenVerification = await verifyBearerToken(bearerToken, wallet);
  if (!tokenVerification.valid) {
    return res.status(403).json({ error: 'Invalid authentication' });
  }

  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  // Verify ownership
  const { data: existing } = await supabase
    .from('agent_profiles')
    .select('owner_wallet')
    .eq('id', agent_id)
    .single();

  if (!existing || existing.owner_wallet !== wallet) {
    return res.status(403).json({ error: 'Not authorized to delete this agent' });
  }

  // Delete agent — CASCADE will remove api_keys, spending_policies, spending_log
  const { error } = await supabase
    .from('agent_profiles')
    .delete()
    .eq('id', agent_id);

  if (error) {
    console.error('[Agents] Delete error:', error.message);
    return res.status(500).json({ error: 'Failed to delete agent' });
  }

  return res.status(200).json({ success: true });
}
