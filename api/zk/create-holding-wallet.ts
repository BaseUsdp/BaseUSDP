/**
 * Void402 Create Holding Wallet API (1:1 with NolviPay)
 * POST /api/zk/create-holding-wallet
 * 
 * Creates a deterministic holding wallet address for the user to send their full deposit to.
 * Also builds the unsigned transaction for the user to sign (so frontend doesn't need RPC access).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { 
  Connection, 
  Keypair, 
  PublicKey, 
  Transaction, 
  SystemProgram,
} from '@solana/web3.js';
import { 
  getAssociatedTokenAddress, 
  createAssociatedTokenAccountInstruction, 
  createTransferInstruction,
} from '@solana/spl-token';
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

function generateHoldingWalletKeypair(depositId: string): Keypair {
  try {
    const seed = crypto.createHash('sha256').update(depositId).digest();
    const privateKey = seed.slice(0, 32);
    return Keypair.fromSeed(privateKey);
  } catch (error: any) {
    throw new Error(`Failed to generate keypair: ${error.message}`);
  }
}

function getSolanaConnection(): Connection {
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  return new Connection(rpcUrl, 'confirmed');
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
    const connection = getSolanaConnection();

    // Generate unique deposit ID: wallet_timestamp_token
    const depositId = `${wallet}_${Date.now()}_${token}`;

    // Generate a unique holding wallet for this deposit
    const holdingKeypair = generateHoldingWalletKeypair(depositId);
    const holdingAddress = holdingKeypair.publicKey.toString();
    const tokenMintStr = token === 'USDC' ? USDC_MINT : USDT_MINT;
    const tokenMint = new PublicKey(tokenMintStr);
    const userPubkey = new PublicKey(wallet);
    const holdingPubkey = holdingKeypair.publicKey;

    // Store deposit info in database
    try {
      const { error: dbError } = await supabase
        .from('zk_holding_wallets')
        .insert({
          deposit_id: depositId,
          user_wallet: wallet,
          holding_wallet_address: holdingAddress,
          amount: amount.toString(),
          token: token,
          token_mint: tokenMintStr,
          status: 'pending',
        });

      if (dbError) {
        if (dbError.code === '23505' || dbError.message?.includes('duplicate') || dbError.message?.includes('unique')) {
          console.log(`⚠️ Duplicate deposit_id, continuing: ${depositId}`);
        } else {
          console.error(`❌ Failed to store holding wallet:`, dbError);
          return res.status(500).json({
            error: 'Database error',
            message: `Failed to store deposit: ${dbError.message || 'Unknown database error'}`,
          });
        }
      }
      
      console.log(`✅ Holding wallet created: ${depositId} -> ${holdingAddress}`);
    } catch (dbInsertError: any) {
      console.error(`❌ Exception during database insert:`, dbInsertError);
      return res.status(500).json({
        error: 'Database error',
        message: `Failed to store deposit: ${dbInsertError.message || 'Unknown error'}`
      });
    }

    // Build unsigned transaction: User -> Holding Wallet
    const depositAmount = parseFloat(amount);
    const transferAmount = BigInt(Math.floor(depositAmount * 1_000_000));

    const userTokenAccount = await getAssociatedTokenAddress(tokenMint, userPubkey);
    const holdingTokenAccount = await getAssociatedTokenAddress(tokenMint, holdingPubkey);

    const tx = new Transaction();
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;
    tx.feePayer = userPubkey;

    // Check if holding wallet ATA exists
    let holdingATAExists = false;
    try {
      const accountInfo = await connection.getAccountInfo(holdingTokenAccount);
      holdingATAExists = accountInfo !== null;
    } catch {
      holdingATAExists = false;
    }

    if (!holdingATAExists) {
      tx.add(
        createAssociatedTokenAccountInstruction(
          userPubkey,
          holdingTokenAccount,
          holdingPubkey,
          tokenMint
        )
      );
    }

    tx.add(
      createTransferInstruction(
        userTokenAccount,
        holdingTokenAccount,
        userPubkey,
        transferAmount
      )
    );

    // Serialize to base64 for frontend
    const serializedTx = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
    const txBase64 = Buffer.from(serializedTx).toString('base64');

    return res.status(200).json({
      success: true,
      holdingWalletAddress: holdingAddress,
      depositId: depositId,
      amount: amount,
      token: token,
      transaction: txBase64,
      message: 'Sign and submit this transaction to deposit to the holding wallet.'
    });

  } catch (error: any) {
    console.error('❌ Error creating holding wallet:', error);
    return res.status(500).json({
      error: 'Failed to create holding wallet',
      message: error.message || 'Unknown error'
    });
  }
}
