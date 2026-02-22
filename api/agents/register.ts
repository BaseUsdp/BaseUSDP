/**
 * POST /api/agents/register
 * Register a new AI agent (human operator auth via Bearer/SIWE)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { extractBearerToken, verifyBearerToken } from '../lib/bearer-auth.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const ALLOWED_ORIGINS = [
  "https://void402.com", "https://www.void402.com",
  "https://orb402.com", "https://www.orb402.com",
  "http://localhost:5173", "http://localhost:3000",
];

function getAllowedOrigin(origin: string | undefined): string {
  if (!origin) return "https://www.orb402.com";
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (origin.match(/^https:\/\/code-whisperer-33[\w-]*\.vercel\.app/)) return origin;
  return "https://www.orb402.com";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getAllowedOrigin(req.headers.origin as string);
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const bearerToken = extractBearerToken(req);
  if (!bearerToken) return res.status(401).json({ error: 'Authentication required' });

  const { wallet, name, description } = req.body || {};
  if (!wallet || !name) {
    return res.status(400).json({ error: 'wallet and name are required' });
  }

  const tokenVerification = await verifyBearerToken(bearerToken, wallet);
  if (!tokenVerification.valid) {
    return res.status(403).json({ error: 'Invalid authentication' });
  }

  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  const { data: agent, error } = await supabase
    .from('agent_profiles')
    .insert({
      owner_wallet: wallet,
      name,
      description: description || null,
    })
    .select()
    .single();

  if (error) {
    console.error('[Agents] Registration error:', error.message);
    return res.status(500).json({ error: 'Failed to register agent' });
  }

  // Create default spending policy
  await supabase.from('agent_spending_policies').insert({
    agent_id: agent.id,
  });

  return res.status(201).json({ success: true, agent });
}
