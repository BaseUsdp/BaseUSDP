/**
 * GET /api/agents
 * List operator's agents (Bearer/SIWE auth)
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const bearerToken = extractBearerToken(req);
  if (!bearerToken) return res.status(401).json({ error: 'Authentication required' });

  const wallet = req.query.wallet as string;
  if (!wallet) return res.status(400).json({ error: 'wallet query parameter required' });

  const tokenVerification = await verifyBearerToken(bearerToken, wallet);
  if (!tokenVerification.valid) {
    return res.status(403).json({ error: 'Invalid authentication' });
  }

  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  const { data: agents, error } = await supabase
    .from('agent_profiles')
    .select('*, agent_spending_policies(*)')
    .eq('owner_wallet', wallet)
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({ error: 'Failed to fetch agents' });
  }

  return res.status(200).json({ success: true, agents: agents || [] });
}
