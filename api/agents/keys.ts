/**
 * POST /api/agents/keys — Generate API key for an agent
 * DELETE /api/agents/keys — Revoke an API key
 * (Bearer/SIWE auth)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { extractBearerToken, verifyBearerToken } from '../lib/bearer-auth.js';
import { generateAgentApiKey } from '../lib/agent-auth.js';

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  const bearerToken = extractBearerToken(req);
  if (!bearerToken) return res.status(401).json({ error: 'Authentication required' });

  if (req.method === 'POST') {
    const { wallet, agent_id, label, scopes, expires_in_days } = req.body || {};
    if (!wallet || !agent_id) {
      return res.status(400).json({ error: 'wallet and agent_id are required' });
    }

    const tokenVerification = await verifyBearerToken(bearerToken, wallet);
    if (!tokenVerification.valid) {
      return res.status(403).json({ error: 'Invalid authentication' });
    }

    // Verify ownership
    const { data: agent } = await supabase
      .from('agent_profiles')
      .select('owner_wallet')
      .eq('id', agent_id)
      .single();

    if (!agent || agent.owner_wallet !== wallet) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { rawKey, keyHash, keyPrefix } = generateAgentApiKey();

    const expiresAt = expires_in_days
      ? new Date(Date.now() + expires_in_days * 86400000).toISOString()
      : null;

    const { data: keyRecord, error } = await supabase
      .from('agent_api_keys')
      .insert({
        agent_id,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        label: label || null,
        scopes: scopes || ['transfer', 'withdraw', 'balance', 'logs'],
        expires_at: expiresAt,
      })
      .select('id, key_prefix, label, scopes, expires_at, created_at')
      .single();

    if (error) {
      console.error('[Agents] Key creation error:', error.message);
      return res.status(500).json({ error: 'Failed to create API key' });
    }

    // Return raw key — shown once only
    return res.status(201).json({
      success: true,
      key: rawKey,
      key_id: keyRecord.id,
      key_prefix: keyRecord.key_prefix,
      scopes: keyRecord.scopes,
      expires_at: keyRecord.expires_at,
    });
  }

  if (req.method === 'DELETE') {
    const { wallet, key_id } = req.body || {};
    if (!wallet || !key_id) {
      return res.status(400).json({ error: 'wallet and key_id are required' });
    }

    const tokenVerification = await verifyBearerToken(bearerToken, wallet);
    if (!tokenVerification.valid) {
      return res.status(403).json({ error: 'Invalid authentication' });
    }

    // Look up key and verify ownership through agent
    const { data: keyRecord } = await supabase
      .from('agent_api_keys')
      .select('id, agent_id')
      .eq('id', key_id)
      .single();

    if (!keyRecord) {
      return res.status(404).json({ error: 'Key not found' });
    }

    const { data: agent } = await supabase
      .from('agent_profiles')
      .select('owner_wallet')
      .eq('id', keyRecord.agent_id)
      .single();

    if (!agent || agent.owner_wallet !== wallet) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await supabase
      .from('agent_api_keys')
      .update({ revoked: true })
      .eq('id', key_id);

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
