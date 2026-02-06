/**
 * Bearer Token Authentication Utilities
 * 1:1 with Nolvipay's bearer-auth.ts
 */

import type { VercelRequest } from '@vercel/node';
import crypto from 'crypto';

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
 * Verify bearer token
 */
export async function verifyBearerToken(
  token: string,
  wallet: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Parse token (format: payloadBase64.signature)
    const parts = token.split('.');
    if (parts.length !== 2) {
      return { valid: false, error: 'Invalid token format' };
    }

    const [payloadBase64, signature] = parts;
    
    // Verify signature
    const secret = process.env.JWT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'default-secret-change-in-production';
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payloadBase64)
      .digest('base64');

    if (signature !== expectedSignature) {
      return { valid: false, error: 'Invalid token signature' };
    }

    // Parse payload
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
    
    // Verify wallet matches
    if (payload.wallet !== wallet) {
      return { valid: false, error: 'Token wallet mismatch' };
    }

    // Check expiration
    if (payload.expiresAt < Date.now()) {
      return { valid: false, error: 'Token expired' };
    }

    return { valid: true };
  } catch (error: any) {
    return { valid: false, error: error.message || 'Token verification failed' };
  }
}
