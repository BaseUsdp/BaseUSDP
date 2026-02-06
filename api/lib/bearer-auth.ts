/**
 * Bearer Token Authentication Utilities
 * 1:1 with Nolvipay's bearer-auth.ts
 * 
 * Verifies session tokens stored in Supabase auth_sessions table
 */

import type { VercelRequest } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

/**
 * Extract bearer token from request headers
 */
export function extractBearerToken(req: VercelRequest): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Verify bearer token against Supabase auth_sessions table
 */
export async function verifyBearerToken(
  token: string,
  wallet: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    if (!supabase) {
      return { valid: false, error: 'Database not configured' };
    }

    // Look up session in database
    const { data: session, error } = await supabase
      .from('auth_sessions')
      .select('*')
      .eq('session_token', token)
      .eq('user_wallet', wallet)
      .single();

    if (error || !session) {
      return { valid: false, error: 'Invalid session token' };
    }

    // Check expiration
    if (new Date(session.expires_at) < new Date()) {
      // Delete expired session
      await supabase.from('auth_sessions').delete().eq('session_token', token);
      return { valid: false, error: 'Session expired' };
    }

    return { valid: true };
  } catch (error: any) {
    return { valid: false, error: error.message || 'Token verification failed' };
  }
}
