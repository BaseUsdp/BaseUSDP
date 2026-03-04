/**
 * POST /api/agents/verify
 * Admin-only endpoint to verify an agent's passport on-chain
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { extractBearerToken, verifyBearerToken } from '../lib/bearer-auth.js';
import { getIdentityRegistryContract, getAgentSigner } from '../lib/agent-onchain.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const ADMIN_WALLETS = (process.env.ADMIN_WALLETS || '').split(',').map(w => w.trim().toLowerCase()).filter(Boolean);

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth
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

  // Admin check
  if (!ADMIN_WALLETS.includes(wallet.toLowerCase())) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  // Get agent's passport token ID
  const { data: agent, error } = await supabase
    .from('agent_profiles')
    .select('passport_token_id')
    .eq('id', agent_id)
    .single();

  if (error || !agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }

  if (!agent.passport_token_id) {
    return res.status(400).json({ error: 'Agent does not have an on-chain passport' });
  }

  try {
    const signer = getAgentSigner();
    const identity = getIdentityRegistryContract(signer);

    const tx = await identity.verifyAgent(agent.passport_token_id);
    const receipt = await tx.wait();

    // Update DB
    await supabase
      .from('agent_profiles')
      .update({ is_verified: true })
      .eq('id', agent_id);

    // Log to reputation log
    await supabase.from('agent_onchain_reputation_log').insert({
      agent_id,
      passport_token_id: agent.passport_token_id,
      event_type: 'verify',
      tx_hash: receipt.hash,
    });

    return res.status(200).json({
      success: true,
      txHash: receipt.hash,
      tokenId: agent.passport_token_id,
    });
  } catch (err: any) {
    console.error('[Verify] On-chain verification failed:', err.message);
    return res.status(500).json({ error: 'Verification failed: ' + err.message });
  }
}
