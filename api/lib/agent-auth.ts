/**
 * Agent API Key Authentication Utilities
 * Mirrors bearer-auth.ts for AI agent programmatic access
 *
 * Key format: orbk_<64-char-hex>
 * Stored as SHA-256 hash only — raw key is shown once on creation
 */

import type { VercelRequest } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export interface AgentAuthResult {
  valid: boolean;
  agentId?: string;
  ownerWallet?: string;
  scopes?: string[];
  error?: string;
}

/**
 * Hash an API key using SHA-256
 */
export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

/**
 * Generate a new agent API key
 * Returns the raw key (show once) and its hash (store in DB)
 */
export function generateAgentApiKey(): { rawKey: string; keyHash: string; keyPrefix: string } {
  const bytes = new Uint8Array(32);
  // Use crypto.getRandomValues equivalent in Node
  require('crypto').randomFillSync(bytes);
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const rawKey = `orbk_${hex}`;
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = `orbk_${hex.slice(0, 8)}...`;
  return { rawKey, keyHash, keyPrefix };
}

/**
 * Extract agent API key from request headers
 * Accepts: X-Agent-Key header or Authorization: AgentKey <key>
 */
export function extractAgentKey(req: VercelRequest): string | null {
  // Check X-Agent-Key header first
  const agentKeyHeader = req.headers['x-agent-key'];
  if (agentKeyHeader && typeof agentKeyHeader === 'string') {
    return agentKeyHeader;
  }

  // Check Authorization: AgentKey <key>
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('AgentKey ')) {
    return authHeader.substring(9);
  }

  return null;
}

/**
 * Verify an agent API key against Supabase
 * Returns agent details on success
 */
export async function verifyAgentKey(rawKey: string): Promise<AgentAuthResult> {
  try {
    if (!supabase) {
      return { valid: false, error: 'Database not configured' };
    }

    // Validate key format
    if (!rawKey.startsWith('orbk_') || rawKey.length !== 69) {
      return { valid: false, error: 'Invalid API key format' };
    }

    const keyHash = hashApiKey(rawKey);

    // Look up key in database
    const { data: keyRecord, error } = await supabase
      .from('agent_api_keys')
      .select('id, agent_id, scopes, expires_at, revoked')
      .eq('key_hash', keyHash)
      .single();

    if (error || !keyRecord) {
      return { valid: false, error: 'Invalid API key' };
    }

    if (keyRecord.revoked) {
      return { valid: false, error: 'API key has been revoked' };
    }

    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
      return { valid: false, error: 'API key has expired' };
    }

    // Look up agent profile
    const { data: agent, error: agentError } = await supabase
      .from('agent_profiles')
      .select('id, owner_wallet, status')
      .eq('id', keyRecord.agent_id)
      .single();

    if (agentError || !agent) {
      return { valid: false, error: 'Agent not found' };
    }

    if (agent.status !== 'active') {
      return { valid: false, error: `Agent is ${agent.status}` };
    }

    // Update last_used_at (fire-and-forget)
    supabase
      .from('agent_api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', keyRecord.id)
      .then(() => {});

    return {
      valid: true,
      agentId: agent.id,
      ownerWallet: agent.owner_wallet,
      scopes: keyRecord.scopes || [],
    };
  } catch (err: any) {
    console.error(`[Agent Auth] Unexpected error: ${err.message}`);
    return { valid: false, error: 'Authentication failed' };
  }
}
