/**
 * Resolve Address API
 * GET /api/user/resolve-address?username=...
 *
 * Authenticated endpoint that resolves a username to a wallet address.
 * Needed for XMTP messaging where wallet addresses are required.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { extractBearerToken } from '../lib/bearer-auth.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const ALLOWED_ORIGINS = [
  "https://void402.com",
  "https://www.void402.com",
  "https://orb402.com",
  "https://www.orb402.com",
  "https://baseusdp.com",
  "https://www.baseusdp.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

function getAllowedOrigin(origin: string | undefined): string {
  if (!origin) return "https://www.orb402.com";
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (origin.match(/^https:\/\/code-whisperer-33[\w-]*\.vercel\.app/)) return origin;
  return "https://www.orb402.com";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getAllowedOrigin(req.headers.origin as string | undefined);
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Auth: extract bearer token and validate session
    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { data: session } = await supabase
      .from('auth_sessions')
      .select('user_wallet')
      .eq('session_token', token)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    // Get username from query
    const { username } = req.query;
    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: 'Username is required' });
    }

    const cleanUsername = username.trim().replace(/^@/, '');

    // Look up wallet address for username (case-insensitive)
    const { data: profile, error: lookupError } = await supabase
      .from('user_profiles')
      .select('wallet_address, username')
      .ilike('username', cleanUsername)
      .single();

    if (lookupError || !profile) {
      return res.status(404).json({ success: false, error: 'Username not found' });
    }

    return res.status(200).json({
      success: true,
      wallet_address: profile.wallet_address,
      username: profile.username,
    });
  } catch (error: any) {
    console.error('[ResolveAddress] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
