/**
 * Void402 Confirm Deposit API
 * POST /api/zk/confirm-deposit
 *
 * Records a successful Base chain deposit in the database.
 * Called by the frontend after the on-chain deposit transaction succeeds.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isValidBaseAddress } from '../lib/void402-base.js';
import { isBaseChain } from '../lib/chain-config.js';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const ALLOWED_ORIGINS = [
  "https://void402.com",
  "https://www.void402.com",
  "https://orb402.com",
  "https://www.orb402.com",
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
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!supabase) {
    return res.status(500).json({ success: false, error: "Database not configured" });
  }

  if (!isBaseChain()) {
    return res.status(400).json({ success: false, error: "Only supported on Base chain" });
  }

  try {
    const { wallet, amount, token, txHash } = req.body;

    if (!wallet || !amount || !token || !txHash) {
      return res.status(400).json({ error: 'wallet, amount, token, and txHash are required' });
    }

    if (!isValidBaseAddress(wallet)) {
      return res.status(400).json({ error: 'Invalid Base wallet address' });
    }

    if (!['USDC', 'USDT'].includes(token)) {
      return res.status(400).json({ error: 'Token must be USDC or USDT' });
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    // Prevent duplicate records for the same tx hash
    const { data: existing } = await supabase
      .from('zk_transactions')
      .select('id')
      .eq('tx_hash', txHash)
      .maybeSingle();

    if (existing) {
      console.log(`[confirm-deposit] Duplicate tx_hash ${txHash}, skipping insert`);
      return res.status(200).json({ success: true, message: 'Deposit already recorded' });
    }

    // Full insert with all fields
    const { error: insertError } = await supabase.from('zk_transactions').insert({
      sender_wallet: wallet,
      recipient_wallet: wallet,
      amount: amount,
      fee_percentage: 0,
      token_symbol: token,
      tx_hash: txHash,
      status: 'completed',
      privacy_level: 'full',
      transaction_type: 'deposit',
    });

    if (insertError) {
      console.warn(`[confirm-deposit] Full insert failed (${insertError.message}), trying minimal...`);

      // Minimal fallback
      const { error: minimalError } = await supabase.from('zk_transactions').insert({
        sender_wallet: wallet,
        recipient_wallet: wallet,
        amount: amount,
        token_symbol: token,
        tx_hash: txHash,
        status: 'completed',
        transaction_type: 'deposit',
      });

      if (minimalError) {
        console.error(`[confirm-deposit] Minimal insert also failed:`, minimalError.message);
        return res.status(500).json({ success: false, error: 'Failed to record deposit' });
      }
    }

    console.log(`[confirm-deposit] Recorded deposit: ${wallet.slice(0, 8)}... | ${amount} ${token} | tx: ${txHash.slice(0, 16)}...`);

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('[confirm-deposit] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to confirm deposit',
      message: error?.message || 'Unknown error occurred',
    });
  }
}
