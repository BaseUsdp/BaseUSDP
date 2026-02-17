/**
 * Send Message API
 * POST /api/messages/send
 *
 * Sends a private message from the authenticated user to a recipient by username.
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Auth: extract bearer token and resolve wallet
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

    // Resolve sender username
    const { data: senderProfile } = await supabase
      .from('user_profiles')
      .select('username')
      .eq('wallet_address', session.user_wallet)
      .single();

    if (!senderProfile || !senderProfile.username || senderProfile.username.includes('...')) {
      return res.status(400).json({ error: 'You need a custom username to send messages. Please set one in Settings.' });
    }

    const senderUsername = senderProfile.username;

    // Validate request body
    const { recipient_username, message } = req.body || {};

    if (!recipient_username || typeof recipient_username !== 'string') {
      return res.status(400).json({ error: 'Recipient username is required' });
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    if (message.trim().length > 1000) {
      return res.status(400).json({ error: 'Message must be 1000 characters or less' });
    }

    const cleanRecipient = recipient_username.replace(/^@/, '').trim();

    // Prevent sending to self
    if (cleanRecipient.toLowerCase() === senderUsername.toLowerCase()) {
      return res.status(400).json({ error: 'You cannot send a message to yourself' });
    }

    // Validate recipient exists
    const { data: recipientProfile } = await supabase
      .from('user_profiles')
      .select('username')
      .ilike('username', cleanRecipient)
      .single();

    if (!recipientProfile) {
      return res.status(404).json({ error: 'Recipient username not found' });
    }

    // Insert message
    const { data: inserted, error: insertError } = await supabase
      .from('messages')
      .insert({
        sender_username: senderUsername,
        recipient_username: recipientProfile.username,
        message: message.trim(),
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[Messages] Insert error:', insertError);
      return res.status(500).json({ error: 'Failed to send message' });
    }

    return res.status(200).json({ success: true, message_id: inserted.id });
  } catch (error: any) {
    console.error('[Messages] Send error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
