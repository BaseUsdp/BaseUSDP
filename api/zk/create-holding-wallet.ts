/**
 * Void402 Create Holding Wallet API (1:1 with NolviPay)
 * POST /api/zk/create-holding-wallet
 * 
 * Creates a deterministic holding wallet address for the user to send their full deposit to.
 * Once funds are detected, the system will automatically split and send to multiple Privacy Mixer exchanges.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Keypair } from '@solana/web3.js';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Token mint addresses
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

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

/**
 * Generate a unique keypair deterministically from depositId
 * This ensures each deposit gets a unique holding wallet address
 */
function generateHoldingWalletKeypair(depositId: string): Keypair {
  try {
    const seed = crypto.createHash('sha256').update(depositId).digest();
    const privateKey = seed.slice(0, 32);
    return Keypair.fromSeed(privateKey);
  } catch (error: any) {
    throw new Error(`Failed to generate keypair: ${error.message}`);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getAllowedOrigin(req.headers.origin as string | undefined);
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { wallet, amount, token } = req.body;

    if (!wallet || !amount || !token) {
      return res.status(400).json({ 
        error: 'Missing required parameters',
        message: 'wallet, amount, and token are required' 
      });
    }

    if (!['USDC', 'USDT'].includes(token)) {
      return res.status(400).json({ 
        error: 'Invalid token',
        message: 'Token must be USDC or USDT' 
      });
    }

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generate unique deposit ID: wallet_timestamp_token
    const depositId = `${wallet}_${Date.now()}_${token}`;

    // Check if a holding wallet already exists for this depositId
    try {
      const { data: existingWallet, error: checkError } = await supabase
        .from('zk_holding_wallets')
        .select('holding_wallet_address, status')
        .eq('deposit_id', depositId)
        .single();

      if (!checkError && existingWallet) {
        return res.status(200).json({
          success: true,
          holdingWalletAddress: existingWallet.holding_wallet_address,
          depositId: depositId,
          amount: amount,
          token: token,
          message: 'Send your full deposit to this address. The system will automatically split and process it through multiple Privacy Mixer exchanges.'
        });
      }
    } catch {
      // Table might not exist yet, continue
    }

    // Generate a unique holding wallet for this deposit
    const holdingKeypair = generateHoldingWalletKeypair(depositId);
    const holdingAddress = holdingKeypair.publicKey.toString();

    const tokenMint = token === 'USDC' ? USDC_MINT : USDT_MINT;

    // Store deposit info in database
    try {
      const { data: insertedWallet, error: dbError } = await supabase
        .from('zk_holding_wallets')
        .insert({
          deposit_id: depositId,
          user_wallet: wallet,
          holding_wallet_address: holdingAddress,
          amount: amount.toString(),
          token: token,
          token_mint: tokenMint,
          status: 'pending',
        })
        .select()
        .single();

      if (dbError) {
        // Check for duplicate (race condition)
        if (dbError.code === '23505' || dbError.message?.includes('duplicate') || dbError.message?.includes('unique')) {
          console.log(`⚠️ Duplicate deposit_id detected, fetching existing: ${depositId}`);
          const { data: existing, error: fetchError } = await supabase
            .from('zk_holding_wallets')
            .select('holding_wallet_address')
            .eq('deposit_id', depositId)
            .single();
          
          if (existing && !fetchError) {
            return res.status(200).json({
              success: true,
              holdingWalletAddress: existing.holding_wallet_address,
              depositId: depositId,
              amount: amount,
              token: token,
              message: 'Send your full deposit to this address. The system will automatically split and process it through multiple Privacy Mixer exchanges.'
            });
          }
        }
        
        console.error(`❌ Failed to store holding wallet:`, dbError);
        return res.status(500).json({
          error: 'Database error',
          message: `Failed to store deposit: ${dbError.message || 'Unknown database error'}`,
        });
      }
      
      if (!insertedWallet) {
        return res.status(500).json({
          error: 'Database error',
          message: 'Failed to store deposit: No data returned from insert'
        });
      }
      
      console.log(`✅ Holding wallet created: ${depositId} -> ${holdingAddress}`);
    } catch (dbInsertError: any) {
      console.error(`❌ Exception during database insert:`, dbInsertError);
      return res.status(500).json({
        error: 'Database error',
        message: `Failed to store deposit: ${dbInsertError.message || 'Unknown error'}`
      });
    }

    return res.status(200).json({
      success: true,
      holdingWalletAddress: holdingAddress,
      depositId: depositId,
      amount: amount,
      token: token,
      message: 'Send your full deposit to this address. The system will automatically split and process it through multiple Privacy Mixer exchanges.'
    });

  } catch (error: any) {
    console.error('❌ Error creating holding wallet:', error);
    return res.status(500).json({
      error: 'Failed to create holding wallet',
      message: error.message || 'Unknown error'
    });
  }
}
