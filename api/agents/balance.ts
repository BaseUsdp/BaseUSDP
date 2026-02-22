/**
 * GET /api/agents/balance
 * Check owner's pool balance (AgentKey auth)
 * Uses same DB-based calculation as dashboard (/api/zk/balance/[wallet])
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { extractAgentKey, verifyAgentKey } from '../lib/agent-auth.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const ALLOWED_ORIGINS = [
  "https://void402.com", "https://www.void402.com",
  "https://orb402.com", "https://www.orb402.com",
  "http://localhost:5173", "http://localhost:3000",
];

function getAllowedOrigin(origin: string | undefined): string {
  if (!origin) return "https://www.orb402.com";
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (origin.match(/^https:\/\/code-whisperer-33[\w-]*\.vercel\.app/)) return origin;
  return "https://www.orb402.com";
}

async function calculateBalance(wallet: string, token: string): Promise<number> {
  if (!supabase) return 0;

  const { data: transactions, error } = await supabase
    .from('zk_transactions')
    .select('id, status, sender_wallet, recipient_wallet, amount, fee_percentage, token_symbol, transaction_type')
    .or(`sender_wallet.eq.${wallet},recipient_wallet.eq.${wallet}`)
    .eq('status', 'completed')
    .eq('token_symbol', token)
    .order('created_at', { ascending: true });

  if (error || !transactions) return 0;

  let balance = 0;
  for (const tx of transactions) {
    const amount = parseFloat(tx.amount || 0);
    const feePercent = tx.fee_percentage != null ? parseFloat(tx.fee_percentage) : 0;

    if (tx.transaction_type === 'withdraw') {
      balance -= amount;
    } else if (tx.sender_wallet === wallet && tx.recipient_wallet === wallet) {
      // Deposit
      const amountAfterFees = feePercent > 0 ? amount * (1 - feePercent / 100) : amount;
      balance += amountAfterFees;
    } else if (tx.recipient_wallet === wallet && tx.sender_wallet !== wallet) {
      // Received transfer
      const amountAfterFees = feePercent > 0 ? amount * (1 - feePercent / 100) : amount;
      balance += amountAfterFees;
    } else if (tx.sender_wallet === wallet && tx.recipient_wallet !== wallet) {
      // Sent transfer
      balance -= amount;
    }
  }

  return Math.max(0, balance);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getAllowedOrigin(req.headers.origin as string);
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Agent-Key');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const agentKey = extractAgentKey(req);
  if (!agentKey) return res.status(401).json({ error: 'Agent API key required' });

  const auth = await verifyAgentKey(agentKey);
  if (!auth.valid || !auth.ownerWallet) {
    return res.status(403).json({ error: auth.error || 'Invalid agent key' });
  }

  if (!auth.scopes?.includes('balance')) {
    return res.status(403).json({ error: 'API key does not have balance scope' });
  }

  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  try {
    const [usdcBalance, usdtBalance] = await Promise.all([
      calculateBalance(auth.ownerWallet, 'USDC'),
      calculateBalance(auth.ownerWallet, 'USDT'),
    ]);

    return res.status(200).json({
      success: true,
      wallet: auth.ownerWallet,
      balances: {
        USDC: parseFloat(usdcBalance.toFixed(2)),
        USDT: parseFloat(usdtBalance.toFixed(2)),
      },
    });
  } catch (err: any) {
    console.error(`[Agent Balance] Error:`, err.message);
    return res.status(500).json({ error: 'Failed to fetch balance' });
  }
}
