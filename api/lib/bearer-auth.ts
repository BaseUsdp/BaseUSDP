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
      console.error('[Bearer Auth] Supabase not configured');
      return { valid: false, error: 'Database not configured' };
    }

    // Look up session in database (case-insensitive wallet match, newest first)
    const { data: sessions, error } = await supabase
      .from('auth_sessions')
      .select('*')
      .eq('session_token', token)
      .ilike('user_wallet', wallet)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.log(`[Bearer Auth] Session lookup error for ${wallet.slice(0,8)}...: ${error.message}`);
      if (error.message?.includes('relation') || error.message?.includes('does not exist')) {
        return { valid: false, error: 'Session table not configured' };
      }
      return { valid: false, error: 'Invalid session token' };
    }

    const session = sessions?.[0];
    if (!session) {
      console.log(`[Bearer Auth] No session found for ${wallet.slice(0,8)}...`);
      return { valid: false, error: 'Session not found' };
    }

    // Check expiration
    if (new Date(session.expires_at) < new Date()) {
      console.log(`[Bearer Auth] Session expired for ${wallet.slice(0,8)}...`);
      await supabase.from('auth_sessions').delete().eq('session_token', token);
      return { valid: false, error: 'Session expired' };
    }

    console.log(`[Bearer Auth] Valid session for ${wallet.slice(0,8)}...`);
    return { valid: true };
  } catch (error: any) {
    console.error(`[Bearer Auth] Unexpected error: ${error.message}`);
    return { valid: false, error: error.message || 'Token verification failed' };
  }
}
