/**
 * GET /api/agents/passport?agent_id=<uuid>
 * Returns live on-chain passport status + reputation data for an agent
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import {
  isAgentVerified,
  isAgentRevoked,
  getAgentReputation,
  getAgentTrustScore,
} from '../lib/agent-onchain.js';

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const agentId = req.query.agent_id as string;
  if (!agentId) return res.status(400).json({ error: 'agent_id is required' });

  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  // Get agent profile with passport info
  const { data: agent, error } = await supabase
    .from('agent_profiles')
    .select('id, name, passport_token_id, passport_tx_hash, passport_chain, agent_wallet, is_verified, is_revoked, trust_score, trust_score_updated_at')
    .eq('id', agentId)
    .single();

  if (error || !agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  if (!agent.passport_token_id) {
    return res.status(200).json({
      success: true,
      passport: null,
      message: 'Agent does not have an on-chain passport',
    });
  }

  // Fetch live on-chain data
  try {
    const tokenId = agent.passport_token_id;
    const [verified, revoked, reputation] = await Promise.all([
      isAgentVerified(tokenId),
      isAgentRevoked(tokenId),
      getAgentReputation(tokenId),
    ]);

    // Update cached values in DB
    await supabase
      .from('agent_profiles')
      .update({
        is_verified: verified,
        is_revoked: revoked,
        trust_score: reputation.trustScore,
        trust_score_updated_at: new Date().toISOString(),
      })
      .eq('id', agentId);

    return res.status(200).json({
      success: true,
      passport: {
        tokenId,
        txHash: agent.passport_tx_hash,
        chain: agent.passport_chain,
        wallet: agent.agent_wallet,
        verified,
        revoked,
        trustScore: reputation.trustScore,
        reputation: {
          positiveSignals: reputation.positiveSignals,
          negativeSignals: reputation.negativeSignals,
          txCount: reputation.txCount,
          totalVolume: reputation.totalVolume,
        },
      },
    });
  } catch (err: any) {
    console.error('[Passport] On-chain query failed:', err.message);
    // Fall back to cached DB values
    return res.status(200).json({
      success: true,
      passport: {
        tokenId: agent.passport_token_id,
        txHash: agent.passport_tx_hash,
        chain: agent.passport_chain,
        wallet: agent.agent_wallet,
        verified: agent.is_verified,
        revoked: agent.is_revoked,
        trustScore: agent.trust_score,
        reputation: null,
        cached: true,
      },
    });
  }
}
