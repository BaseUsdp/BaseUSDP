/**
 * Void402 Auto Split and Exchange API (1:1 with NolviPay)
 * POST /api/zk/auto-split-and-exchange
 * 
 * Detects when funds arrive in holding wallet, then queues splits
 * with staggered send times for enhanced privacy.
 * 
 * QUEUE-BASED APPROACH:
 * - Calculates splits and inserts them into a queue table
 * - Each split has a scheduled_at time (1-3 minutes apart)
 * - Returns immediately without waiting (no timeout issues)
 * - Frontend polls /api/zk/process-split-queue to process each split
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Token mint addresses
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const USDT_MINT = new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB');

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
  const seed = crypto.createHash('sha256').update(depositId).digest();
  const privateKey = seed.slice(0, 32);
  return Keypair.fromSeed(privateKey);
}

function getSolanaConnection(): Connection {
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  return new Connection(rpcUrl, 'confirmed');
}

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
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
    const { depositId } = req.body;

    if (!depositId) {
      return res.status(400).json({ 
        error: 'Missing required parameter',
        message: 'depositId is required' 
      });
    }

    console.log(`🔍 AUTO-SPLIT: Checking holding wallet for deposit ${depositId}`);

    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    // Get deposit info from database
    const { data: depositData, error: dbError } = await supabase
      .from('zk_holding_wallets')
      .select('*')
      .eq('deposit_id', depositId)
      .single();

    if (dbError || !depositData) {
      return res.status(404).json({ 
        error: 'Deposit not found',
        message: `No deposit found with ID: ${depositId}` 
      });
    }

    const userWallet = depositData.user_wallet;
    if (!userWallet) {
      return res.status(400).json({ error: 'Invalid deposit', message: 'No user wallet' });
    }

    // Get privacy level from deposit (default: "full" for backwards compatibility)
    const privacyLevel = depositData.privacy_level || 'full';
    console.log(`🔒 AUTO-SPLIT: Privacy level = ${privacyLevel}`);

    // If already completed, return early
    if (depositData.status === 'completed') {
      return res.status(200).json({
        success: true,
        message: `Deposit ${depositId} is already completed`,
        status: depositData.status
      });
    }

    // Check if splits are already queued
    const { data: existingQueue } = await supabase
      .from('zk_split_queue')
      .select('id, status, scheduled_at, split_index')
      .eq('deposit_id', depositId)
      .order('split_index', { ascending: true });

    if (existingQueue && existingQueue.length > 0) {
      const totalSplits = existingQueue.length;
      const sentSplits = existingQueue.filter((s: any) => s.status === 'sent').length;
      const pendingSplits = existingQueue.filter((s: any) => s.status === 'pending').length;
      const failedSplits = existingQueue.filter((s: any) => s.status === 'failed').length;
      const nextPending = existingQueue.find((s: any) => s.status === 'pending');

      if (sentSplits === totalSplits) {
        await supabase
          .from('zk_holding_wallets')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('deposit_id', depositId);

        return res.status(200).json({
          success: true,
          message: 'All splits have been sent to Privacy Mixer',
          allSent: true,
          numSplits: totalSplits,
          pollQueue: true,
        });
      }

      return res.status(200).json({
        success: true,
        message: `Splits queued: ${sentSplits}/${totalSplits} sent`,
        numSplits: totalSplits,
        sentSplits,
        pendingSplits,
        failedSplits,
        nextScheduled: nextPending?.scheduled_at || null,
        pollQueue: true,
      });
    }

    const connection = getSolanaConnection();
    const holdingKeypair = generateHoldingWalletKeypair(depositId);
    const holdingPubkey = holdingKeypair.publicKey;
    const tokenMint = depositData.token === 'USDC' ? USDC_MINT : USDT_MINT;

    // Check holding wallet token balance
    const holdingTokenAccount = await getAssociatedTokenAddress(tokenMint, holdingPubkey);

    let actualAmount: bigint;
    try {
      const holdingAccount = await getAccount(connection, holdingTokenAccount);
      actualAmount = holdingAccount.amount;
    } catch (error: any) {
      if (error.name === 'TokenAccountNotFoundError' || 
          error.message?.includes('InvalidAccountData') ||
          error.message?.includes('AccountNotFound')) {
        return res.status(200).json({
          success: false,
          message: 'No funds detected in holding wallet yet',
          holdingWalletAddress: holdingPubkey.toString(),
          depositId: depositId
        });
      }
      throw error;
    }

    if (actualAmount === BigInt(0)) {
      return res.status(200).json({
        success: false,
        message: 'No funds detected in holding wallet yet',
        holdingWalletAddress: holdingPubkey.toString(),
        depositId: depositId
      });
    }

    // Verify amount is close to expected
    const originalExpectedAmount = BigInt(Math.floor(parseFloat(depositData.amount) * 1_000_000));
    const tolerance = BigInt(1000);
    const minRequiredAmount = originalExpectedAmount > tolerance ? originalExpectedAmount - tolerance : originalExpectedAmount;
    
    if (actualAmount < minRequiredAmount) {
      console.log(`⚠️ AUTO-SPLIT: Insufficient funds - Expected: ${originalExpectedAmount.toString()}, Received: ${actualAmount.toString()}`);
      return res.status(200).json({
        success: false,
        message: 'Insufficient funds received',
        holdingWalletAddress: holdingPubkey.toString(),
        depositId: depositId,
        expectedAmount: originalExpectedAmount.toString(),
        actualAmount: actualAmount.toString(),
      });
    }

    console.log(`💰 AUTO-SPLIT: Detected ${(Number(actualAmount) / 1e6).toFixed(6)} ${depositData.token} in holding wallet`);

    // =========================================================================
    // PUBLIC / PARTIAL PRIVACY: Skip ChangeNow, go directly to intermediate wallet
    // =========================================================================
    if (privacyLevel === 'public' || privacyLevel === 'partial') {
      console.log(`⚡ ${privacyLevel.toUpperCase()} PRIVACY: Skipping ChangeNow mixer, direct transfer to intermediate wallet`);
      
      // Queue a single "split" that goes directly to the intermediate wallet
      // process-split-queue will handle it differently for public/partial
      const splitData = {
        deposit_id: depositId,
        user_wallet: userWallet,
        token: depositData.token,
        split_index: 0,
        split_amount: (Number(actualAmount) / 1e6).toFixed(6),
        scheduled_at: new Date().toISOString(), // Immediate
        status: 'pending',
        privacy_level: privacyLevel, // Store privacy level for processing
      };

      const { error: insertError } = await supabase
        .from('zk_split_queue')
        .insert(splitData);

      if (insertError) {
        console.error(`❌ Failed to queue direct transfer:`, insertError);
        // Try without privacy_level column if it doesn't exist
        const { error: retryError } = await supabase
          .from('zk_split_queue')
          .insert({
            deposit_id: depositId,
            user_wallet: userWallet,
            token: depositData.token,
            split_index: 0,
            split_amount: (Number(actualAmount) / 1e6).toFixed(6),
            scheduled_at: new Date().toISOString(),
            status: 'pending',
          });
        if (retryError) {
          console.error(`❌ Retry also failed:`, retryError);
          return res.status(500).json({ error: 'Failed to queue direct transfer' });
        }
      }

      // Mark holding wallet as processing
      await supabase
        .from('zk_holding_wallets')
        .update({ 
          status: 'processing', 
          num_splits: 1,
          updated_at: new Date().toISOString() 
        })
        .eq('deposit_id', depositId);

      console.log(`✅ ${privacyLevel.toUpperCase()}: Queued direct transfer for deposit ${depositId}`);

      return res.status(200).json({
        success: true,
        message: `Queued direct transfer (${privacyLevel} privacy)`,
        numSplits: 1,
        splits: [{
          splitIndex: 1,
          amount: (Number(actualAmount) / 1e6).toFixed(6),
          scheduledAt: new Date().toISOString(),
        }],
        pollQueue: true,
        depositId: depositId,
        privacyLevel: privacyLevel,
      });
    }

    // =========================================================================
    // FULL PRIVACY: Split and send through ChangeNow mixer (existing logic)
    // =========================================================================
    console.log(`🔒 FULL PRIVACY: Splitting and routing through ChangeNow mixer`);

    // Calculate splits
    const PRIVACY_EXCHANGE_MIN = BigInt(3_000_000); // $3 minimum
    const maxPossibleSplits = Math.floor(Number(actualAmount) / Number(PRIVACY_EXCHANGE_MIN));
    
    let numSplits: number;
    if (maxPossibleSplits < 2) {
      if (actualAmount >= PRIVACY_EXCHANGE_MIN) {
        numSplits = 1;
      } else {
        await supabase
          .from('zk_holding_wallets')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('deposit_id', depositId);
        return res.status(200).json({
          success: false,
          message: `Amount is below minimum required for privacy exchange ($${Number(PRIVACY_EXCHANGE_MIN) / 1e6})`,
          amount: actualAmount.toString(),
          minimum: PRIVACY_EXCHANGE_MIN.toString()
        });
      }
    } else if (maxPossibleSplits >= 4) {
      numSplits = 2 + Math.floor(Math.random() * 3); // 2-4 splits
    } else {
      numSplits = 2;
    }
    
    numSplits = Math.min(numSplits, maxPossibleSplits);

    // Calculate split amounts
    const splits: bigint[] = [];
    
    if (numSplits === 1) {
      splits.push(actualAmount);
    } else {
      let remainingAmount = actualAmount;
      
      for (let i = 0; i < numSplits - 1; i++) {
        const remainingSplits = numSplits - i;
        const minRequiredForRemaining = PRIVACY_EXCHANGE_MIN * BigInt(remainingSplits);
        const maxAllowedForThisSplit = remainingAmount - minRequiredForRemaining + PRIVACY_EXCHANGE_MIN;
        
        const minForThisSplit = Number(PRIVACY_EXCHANGE_MIN);
        const maxForThisSplit = Number(maxAllowedForThisSplit);
        const randomAmount = BigInt(Math.floor(minForThisSplit + (Math.random() * (maxForThisSplit - minForThisSplit))));
        
        splits.push(randomAmount);
        remainingAmount -= randomAmount;
      }
      splits.push(remainingAmount);
      
      // Shuffle splits for privacy
      for (let i = splits.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [splits[i], splits[j]] = [splits[j], splits[i]];
      }
    }

    console.log(`🔒 PRIVACY: Queueing ${numSplits} splits with 1-3 minute delays:`, 
      splits.map(s => `${(Number(s) / 1e6).toFixed(6)} ${depositData.token}`));

    // Queue splits with staggered times (1-3 minutes apart)
    const now = new Date();
    const queuedSplits = [];

    for (let i = 0; i < splits.length; i++) {
      const delayMs = i === 0 ? 0 : (60000 + Math.floor(Math.random() * 120000));
      const scheduledAt = new Date(now.getTime() + (i === 0 ? 0 : (i * 60000 + delayMs)));
      
      const splitData = {
        deposit_id: depositId,
        user_wallet: userWallet,
        token: depositData.token,
        split_index: i,
        split_amount: (Number(splits[i]) / 1e6).toFixed(6),
        scheduled_at: scheduledAt.toISOString(),
        status: 'pending',
      };

      const { error: insertError } = await supabase
        .from('zk_split_queue')
        .insert(splitData);

      if (insertError) {
        console.error(`❌ Failed to queue split ${i + 1}:`, insertError);
        continue;
      }

      queuedSplits.push({
        splitIndex: i + 1,
        amount: (Number(splits[i]) / 1e6).toFixed(6),
        scheduledAt: scheduledAt.toISOString(),
      });

      console.log(`📋 Queued split ${i + 1}/${numSplits}: ${(Number(splits[i]) / 1e6).toFixed(6)} ${depositData.token} at ${scheduledAt.toISOString()}`);
    }

    // Mark holding wallet as processing
    await supabase
      .from('zk_holding_wallets')
      .update({ 
        status: 'processing', 
        num_splits: numSplits,
        updated_at: new Date().toISOString() 
      })
      .eq('deposit_id', depositId);

    console.log(`✅ AUTO-SPLIT: Queued ${queuedSplits.length} splits for deposit ${depositId}`);

    return res.status(200).json({
      success: true,
      message: `Queued ${queuedSplits.length} splits for privacy mixing`,
      numSplits: queuedSplits.length,
      splits: queuedSplits,
      pollQueue: true,
      depositId: depositId,
    });

  } catch (error: any) {
    console.error('❌ AUTO-SPLIT error:', error);
    return res.status(500).json({
      error: 'Failed to process auto-split',
      message: error.message || 'Unknown error'
    });
  }
}
