/**
 * GET /api/agents/logs
 * Spending log history (AgentKey or Bearer auth)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { extractAgentKey, verifyAgentKey } from '../lib/agent-auth.js';
import { extractBearerToken, verifyBearerToken } from '../lib/bearer-auth.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const ALLOWED_ORIGINS = [
  "https://void402.com", "https://www.void402.com",
  "https://orb402.com", "https://www.orb402.com",
  "https://baseusdp.com",
  "https://www.baseusdp.com",
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Agent-Key');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  let agentId: string | undefined;

  // Try AgentKey auth first
  const agentKey = extractAgentKey(req);
  if (agentKey) {
    const auth = await verifyAgentKey(agentKey);
    if (!auth.valid) return res.status(403).json({ error: auth.error });
    if (!auth.scopes?.includes('logs')) {
      return res.status(403).json({ error: 'API key does not have logs scope' });
    }
    agentId = auth.agentId;
  } else {
    // Try Bearer auth
    const bearerToken = extractBearerToken(req);
    if (!bearerToken) return res.status(401).json({ error: 'Authentication required' });

    const wallet = req.query.wallet as string;
    const queryAgentId = req.query.agent_id as string;
    if (!wallet || !queryAgentId) {
      return res.status(400).json({ error: 'wallet and agent_id query parameters required' });
    }

    const tokenVerification = await verifyBearerToken(bearerToken, wallet);
    if (!tokenVerification.valid) return res.status(403).json({ error: 'Invalid authentication' });

    // Verify agent ownership
    const { data: agent } = await supabase
      .from('agent_profiles')
      .select('owner_wallet')
      .eq('id', queryAgentId)
      .single();

    if (!agent || agent.owner_wallet !== wallet) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    agentId = queryAgentId;
  }

  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;

  const { data: logs, error, count } = await supabase
    .from('agent_spending_log')
    .select('*', { count: 'exact' })
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return res.status(500).json({ error: 'Failed to fetch logs' });
  }

  return res.status(200).json({
    success: true,
    logs: logs || [],
    total: count || 0,
    limit,
    offset,
  });
}
