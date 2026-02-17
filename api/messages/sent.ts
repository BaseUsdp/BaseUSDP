/**
 * Get Sent Messages API
 * GET /api/messages/sent
 *
 * Returns messages sent by the authenticated user.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { extractBearerToken } from '../lib/bearer-auth';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const ALLOWED_ORIGINS = [
  "https://void402.com",
  "https://www.void402.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

function getAllowedOrigin(origin: string | undefined): string {
  if (!origin) return "https://www.void402.com";
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (origin.match(/^https:\/\/code-whisperer-33[\w-]*\.vercel\.app/)) return origin;
  return "https://www.void402.com";
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

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('username')
      .eq('wallet_address', session.user_wallet)
      .single();

    if (!profile || !profile.username || profile.username.includes('...')) {
      return res.status(200).json({ success: true, messages: [] });
    }

    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, recipient_username, message, read, created_at')
      .eq('sender_username', profile.username)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[Messages] Sent fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }

    return res.status(200).json({ success: true, messages: messages || [] });
  } catch (error: any) {
    console.error('[Messages] Sent error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
