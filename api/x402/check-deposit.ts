/**
 * Void402 x402 Check Deposit Status API (1:1 with CrabPrivacy)
 * GET /api/x402/check-deposit?depositId=xxx
 * 
 * Returns the current status and progress of an x402 deposit.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const ALLOWED_ORIGINS = [
  "https://void402.com",
  "https://www.void402.com",
  "https://orb402.com",
  "https://www.orb402.com",
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
    const { depositId } = req.query;

    if (!depositId) {
      return res.status(400).json({ error: 'depositId required' });
    }

    const { data: deposit, error } = await supabase
      .from('x402_deposits')
      .select('*')
      .eq('deposit_id', depositId as string)
      .maybeSingle();

    if (error) {
      console.error('[x402 Check] Error:', error);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!deposit) {
      return res.status(404).json({ error: 'Deposit not found' });
    }

    // Build status response
    const statusMap: Record<string, { step: number; label: string; description: string }> = {
      pending: {
        step: 1,
        label: 'Waiting for Base USDC',
        description: 'Scanning Base network for your USDC transfer...',
      },
      received: {
        step: 2,
        label: 'USDC Received',
        description: 'Your USDC has been received on Base! Initiating cross-chain bridge...',
      },
      bridging: {
        step: 3,
        label: 'Bridging to Solana',
        description: deposit.bridge_progress || 'Cross-chain bridge in progress...',
      },
      completed: {
        step: 4,
        label: 'Complete',
        description: `$${deposit.amount_credited?.toFixed(2) || deposit.received_amount?.toFixed(2)} USDC credited to your account!`,
      },
      failed: {
        step: -1,
        label: 'Failed',
        description: deposit.error_message || 'Deposit failed. Please contact support.',
      },
      refunded: {
        step: -1,
        label: 'Refunded',
        description: 'Deposit was refunded to your Base wallet.',
      },
    };

    const statusInfo = statusMap[deposit.status] || {
      step: 0,
      label: deposit.status,
      description: 'Processing...',
    };

    return res.status(200).json({
      success: true,
      deposit: {
        depositId: deposit.deposit_id,
        status: deposit.status,
        step: statusInfo.step,
        label: statusInfo.label,
        description: statusInfo.description,
        expectedAmount: deposit.expected_amount,
        receivedAmount: deposit.received_amount,
        amountCredited: deposit.amount_credited,
        feeAmount: deposit.fee_amount,
        baseTxHash: deposit.base_tx_hash,
        bridgeStatus: deposit.bridge_status,
        bridgeProgress: deposit.bridge_progress,
        sourceChain: deposit.source_chain,
        targetChain: deposit.target_chain,
        createdAt: deposit.created_at,
        completedAt: deposit.completed_at,
      },
    });
  } catch (error: any) {
    console.error('[x402 Check] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
