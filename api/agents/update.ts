/**
 * PUT /api/agents/update
 * Update agent details / pause / resume (Bearer/SIWE auth)
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
  if (!origin) return "https://www.baseusdp.com";
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (origin.match(/^https:\/\/code-whisperer-33[\w-]*\.vercel\.app/)) return origin;
  return "https://www.baseusdp.com";
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

  const { wallet, agent_id, name, description, status } = req.body || {};
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
    return res.status(403).json({ error: 'Not authorized to update this agent' });
  }

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (status && ['active', 'paused', 'revoked'].includes(status)) updates.status = status;

  const { data: agent, error } = await supabase
    .from('agent_profiles')
    .update(updates)
    .eq('id', agent_id)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: 'Failed to update agent' });
  }

  return res.status(200).json({ success: true, agent });
}
