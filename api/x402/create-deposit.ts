/**
 * Void402 x402 Create Deposit API (1:1 with CrabPrivacy)
 * POST /api/x402/create-deposit
 * 
 * Creates a new Base → Solana cross-chain deposit.
 * Returns the Base wallet address for the user to send USDC to.
 * REQUIRES Phantom wallet signature for verification.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

const BASE_WALLET_ADDRESS = process.env.BASE_WALLET_ADDRESS;
const BASE_RPC_URL = 'https://mainnet.base.org';

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
  if (!origin) return "https://www.void402.com";
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (origin.match(/^https:\/\/code-whisperer-33[\w-]*\.vercel\.app/)) return origin;
  return "https://www.void402.com";
}

/**
 * Get current Base block number
 */
async function getCurrentBlockNumber(): Promise<number> {
  try {
    const response = await fetch(BASE_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_blockNumber',
        params: []
      }),
    });
    
    const data = await response.json();
    if (data.result) {
      return parseInt(data.result, 16);
    }
    return 0;
  } catch (error) {
    console.error('[x402] Failed to get block number:', error);
    return 0;
  }
}

/**
 * Verify Phantom wallet signature
 */
function verifySignature(wallet: string, signature: string, message: string): boolean {
  try {
    const publicKeyBytes = bs58.decode(wallet);
    const signatureBytes = bs58.decode(signature);
    const messageBytes = new TextEncoder().encode(message);
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch (error) {
    console.error('[x402] Signature verification error:', error);
    return false;
  }
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

  if (!BASE_WALLET_ADDRESS) {
    return res.status(500).json({ error: 'Base wallet not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { wallet, amount, wallet_signature, message_to_sign } = req.body;

    if (!wallet || !amount) {
      return res.status(400).json({ error: 'Wallet and amount required' });
    }

    // CRITICAL: Require Phantom signature to prove wallet ownership
    if (!wallet_signature || !message_to_sign) {
      return res.status(403).json({
        error: 'Wallet signature required',
        message: 'You must sign a message with your wallet to create x402 deposits.',
      });
    }

    // Verify the signature
    const signatureValid = verifySignature(wallet, wallet_signature, message_to_sign);
    if (!signatureValid) {
      return res.status(403).json({
        error: 'Invalid signature',
        message: 'The wallet signature is invalid. Please sign the message again.',
      });
    }

    // Verify message contains expected content
    const expectedMessagePart = `Void402 x402 Deposit`;
    if (!message_to_sign.includes(expectedMessagePart)) {
      return res.status(403).json({
        error: 'Invalid message content',
        message: 'Invalid message content. Please sign the correct message.',
      });
    }

    const depositAmount = parseFloat(amount);

    // Validate amount
    if (isNaN(depositAmount) || depositAmount < 5) {
      return res.status(400).json({ error: 'Minimum deposit is 5 USDC' });
    }

    if (depositAmount > 999999.99) {
      return res.status(400).json({ error: 'Maximum deposit is $999,999.99' });
    }

    // Generate unique deposit ID
    const depositId = `x402_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Get current block number for reliable detection
    const startingBlockNumber = await getCurrentBlockNumber();
    console.log(`[x402] Recording starting block: ${startingBlockNumber}`);

    // Create deposit record
    const { error: insertError } = await supabase
      .from('x402_deposits')
      .insert({
        deposit_id: depositId,
        user_wallet: wallet,
        expected_amount: depositAmount,
        deposit_address: BASE_WALLET_ADDRESS,
        status: 'pending',
        source_chain: 'base',
        target_chain: 'solana',
        source_token: 'USDC',
        target_token: 'USDC',
        starting_block_number: startingBlockNumber,
      });

    if (insertError) {
      console.error('[x402] Insert error:', insertError);
      return res.status(500).json({ error: 'Failed to create deposit' });
    }

    console.log(`[x402] Created deposit ${depositId} for ${wallet}: $${depositAmount}`);

    return res.status(200).json({
      success: true,
      depositId,
      depositAddress: BASE_WALLET_ADDRESS,
      expectedAmount: depositAmount,
      sourceChain: 'Base',
      targetChain: 'Solana',
      instructions: `Send exactly ${depositAmount} USDC on Base network to ${BASE_WALLET_ADDRESS}`,
    });

  } catch (error: any) {
    console.error('[x402] Create deposit error:', error);
    return res.status(500).json({ error: error.message || 'Internal error' });
  }
}
