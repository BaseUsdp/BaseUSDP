/**
 * Void402 Process Pending Exchanges API (1:1 with NolviPay)
 * POST /api/zk/process-pending-exchanges
 * 
 * Processes ChangeNow exchanges and credits user accounts.
 * Uses smart contract deposit instruction to properly initialize UserBalance PDA.
 * Flow: Mixer Withdrawal Wallet -> Intermediate Wallet -> Pool PDA
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getAccount,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { createClient } from '@supabase/supabase-js';
import {
  derivePoolPDA,
  deriveUserBalancePDA,
  VOID402_PROGRAM_ID,
} from '../lib/void402-solana.js';
import { getPrivacyUsdWalletPool } from '../lib/intermediate-wallet-pool.js';
import { isBaseChain } from '../lib/chain-config.js';
import {
  getBaseProvider,
  getTokenAddress,
  getContractAddress,
  getPrivacyPoolContract,
  ERC20_ABI,
} from '../lib/void402-base.js';
import { getBaseIntermediateWalletPool } from '../lib/intermediate-wallet-pool-base.js';
import { ethers } from 'ethers';

// Token mints
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const USDT_MINT = new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB');

// Instruction discriminator for deposit
const DEPOSIT_DISCRIMINATOR = Buffer.from([242, 35, 198, 137, 82, 225, 242, 182]);

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

function buildDepositInstruction({
  user,
  userBalance,
  pool,
  tokenMint,
  userTokenAccount,
  poolTokenAccount,
  amountLamports,
}: {
  user: PublicKey;
  userBalance: PublicKey;
  pool: PublicKey;
  tokenMint: PublicKey;
  userTokenAccount: PublicKey;
  poolTokenAccount: PublicKey;
  amountLamports: bigint;
}) {
  const args = Buffer.alloc(8);
  args.writeBigUInt64LE(amountLamports, 0);
  
  const instructionData = Buffer.concat([DEPOSIT_DISCRIMINATOR, args]);
  
  return {
    programId: VOID402_PROGRAM_ID,
    keys: [
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: userBalance, isSigner: false, isWritable: true },
      { pubkey: pool, isSigner: false, isWritable: true },
      { pubkey: tokenMint, isSigner: false, isWritable: false },
      { pubkey: userTokenAccount, isSigner: false, isWritable: true },
      { pubkey: poolTokenAccount, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: instructionData,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getAllowedOrigin(req.headers.origin as string | undefined);
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  console.log('🔍 process-pending-exchanges: Handler started');

  try {
    const params = req.method === 'POST' ? (req.body || {}) : (req.query || {});
    const { wallet, depositId, statusOnly } = params;
    console.log(`📋 Processing exchanges for wallet: ${wallet || 'ALL'}, depositId: ${depositId || 'ALL'}, statusOnly: ${!!statusOnly}`);

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // ============ STATUS-ONLY MODE ============
    // Fast path: just check exchange completion counts without triggering processing.
    // The cron job (every 2 minutes) handles actual on-chain processing.
    if (statusOnly && depositId) {
      const { data: allExchanges } = await supabase
        .from('zk_exchanges')
        .select('id, status')
        .eq('deposit_id', depositId);

      if (allExchanges && allExchanges.length > 0) {
        const completedCount = allExchanges.filter((e: any) => e.status === 'deposit_complete').length;
        const allComplete = completedCount === allExchanges.length;

        return res.status(200).json({
          success: true,
          message: allComplete ? 'All exchanges completed' : 'Processing...',
          processed: 0,
          depositId,
          totalExchanges: allExchanges.length,
          completedExchanges: completedCount,
          allComplete,
        });
      }

      // No exchanges yet — check if this is a public/partial deposit
      const { data: holdingData } = await supabase
        .from('zk_holding_wallets')
        .select('privacy_level, status')
        .eq('deposit_id', depositId)
        .single();

      if (holdingData) {
        const privacyLevel = holdingData.privacy_level || 'full';
        const isDirectDeposit = privacyLevel === 'public' || privacyLevel === 'partial';
        if (isDirectDeposit) {
          const allComplete = holdingData.status === 'completed';
          return res.status(200).json({
            success: true,
            message: allComplete ? 'Direct deposit completed' : 'Processing direct deposit...',
            processed: 0,
            depositId,
            totalExchanges: 0,
            completedExchanges: 0,
            allComplete,
            privacyLevel,
            skipMixer: true,
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: 'No pending exchanges yet',
        processed: 0,
        depositId,
        totalExchanges: 0,
        completedExchanges: 0,
        allComplete: false,
      });
    }

    // ============ FULL PROCESSING MODE ============
    // Find exchanges that haven't been credited to user yet
    // Skip 'deposit_complete' (already done). Include 'processing' so stale claims
    // can be detected and recovered (the loop handles stale claim detection).
    let query = supabase
      .from('zk_exchanges')
      .select('*')
      .neq('status', 'deposit_complete')
      .order('created_at', { ascending: true })
      .limit(20);

    // Filter by depositId first (most specific)
    if (depositId) {
      query = query.eq('deposit_id', depositId);
      console.log(`📋 Filtering exchanges by depositId: ${depositId}`);
    } else if (wallet) {
      // Fallback: filter by wallet's holding wallets
      const { data: holdingWallets } = await supabase
        .from('zk_holding_wallets')
        .select('deposit_id')
        .eq('user_wallet', wallet);
      
      if (holdingWallets && holdingWallets.length > 0) {
        const depositIds = holdingWallets.map((hw: any) => hw.deposit_id);
        query = query.in('deposit_id', depositIds);
        console.log(`📋 Filtering exchanges by ${depositIds.length} deposit(s) for wallet ${wallet}`);
      } else {
        query = query.eq('user_wallet', wallet);
        console.log(`📋 No holding wallets found, filtering by user_wallet`);
      }
    }
    
    const { data: exchanges, error: queryError } = await query;

    if (queryError) {
      console.error('Query error:', queryError);
      return res.status(500).json({ error: 'Query failed', details: queryError.message });
    }

    console.log(`📋 Found ${exchanges?.length || 0} exchanges to process`);

    if (!exchanges || exchanges.length === 0) {
      // No pending exchanges - check if they're ALL completed already
      if (depositId) {
        const { data: allExchanges } = await supabase
          .from('zk_exchanges')
          .select('id, status')
          .eq('deposit_id', depositId);
        
        if (allExchanges && allExchanges.length > 0) {
          const completedCount = allExchanges.filter((e: any) => e.status === 'deposit_complete').length;
          const allComplete = completedCount === allExchanges.length;
          
          console.log(`📋 All exchanges for deposit ${depositId}: ${completedCount}/${allExchanges.length} complete`);
          
          return res.status(200).json({ 
            success: true, 
            message: allComplete ? 'All exchanges completed' : 'No pending exchanges yet',
            processed: 0,
            depositId,
            totalExchanges: allExchanges.length,
            completedExchanges: completedCount,
            allComplete,
          });
        }
        
        // No exchanges found - check if this is a public/partial deposit (no mixer)
        // In that case, check the holding wallet status
        const { data: holdingData } = await supabase
          .from('zk_holding_wallets')
          .select('privacy_level, status')
          .eq('deposit_id', depositId)
          .single();
        
        if (holdingData) {
          const privacyLevel = holdingData.privacy_level || 'full';
          const isDirectDeposit = privacyLevel === 'public' || privacyLevel === 'partial';
          
          if (isDirectDeposit) {
            // For public/partial, the deposit is complete when holding wallet is completed
            const allComplete = holdingData.status === 'completed';
            console.log(`📋 Direct deposit ${depositId} (${privacyLevel}): status=${holdingData.status}, complete=${allComplete}`);
            
            return res.status(200).json({ 
              success: true, 
              message: allComplete ? 'Direct deposit completed (no mixer)' : 'Processing direct deposit...',
              processed: 0,
              depositId,
              totalExchanges: 0,
              completedExchanges: 0,
              allComplete, // True if holding wallet is completed
              privacyLevel,
              skipMixer: true,
            });
          }
        }
      }
      
      // No exchanges found at all yet (Full privacy - waiting for ChangeNow)
      return res.status(200).json({ 
        success: true, 
        message: 'No pending exchanges yet',
        processed: 0,
        depositId: depositId || null,
        totalExchanges: 0,
        completedExchanges: 0,
        allComplete: false,
      });
    }

    const CHANGENOW_API_KEY = process.env.CHANGENOW_API_KEY || '';
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');

    const results: any[] = [];
    let processedCount = 0;
    let updatedCount = 0;

    for (const exchange of exchanges) {
      try {
        console.log(`\n🔄 Processing exchange ${exchange.exchange_id}`);

        // Get user wallet
        let userWallet = exchange.user_wallet;
        let token = exchange.token;
        
        if (!userWallet) {
          const { data: holdingData } = await supabase
            .from('zk_holding_wallets')
            .select('user_wallet, token')
            .eq('deposit_id', exchange.deposit_id)
            .maybeSingle();
          
          if (holdingData) {
            userWallet = holdingData.user_wallet;
            token = token || holdingData.token;
          }
        }
        
        if (!userWallet) {
          console.log(`  ⚠️ No user_wallet for ${exchange.exchange_id}`);
          results.push({ exchangeId: exchange.exchange_id, status: 'error', error: 'No user_wallet' });
          continue;
        }

        // Check ChangeNow status and get actual output amount
        let changenowOutputAmount: number | null = null;
        
        const cnResponse = await fetch(
          `https://api.changenow.io/v1/transactions/${exchange.exchange_id}/${CHANGENOW_API_KEY}`,
          { method: 'GET', headers: { 'Content-Type': 'application/json' } }
        );
        
        if (!cnResponse.ok) {
          console.log(`  ⚠️ ChangeNow API error: ${cnResponse.status}`);
          results.push({ exchangeId: exchange.exchange_id, status: 'api_error' });
          continue;
        }

        const cnStatus = await cnResponse.json();
        console.log(`  📊 ChangeNow status: ${cnStatus.status}, amountTo: ${cnStatus.amountTo}`);

        // Update ChangeNow status in DB (track separately from our processing status)
        const cnStatusStr = cnStatus.status;
        if (cnStatusStr !== exchange.changenow_status && cnStatusStr !== exchange.status) {
          try {
            await supabase
              .from('zk_exchanges')
              .update({ 
                changenow_status: cnStatusStr,
                // Only update status to ChangeNow's status if we haven't started processing
                ...(exchange.status !== 'deposit_complete' && exchange.status !== 'processing' 
                  ? { status: cnStatusStr } : {}),
              })
              .eq('id', exchange.id);
          } catch {
            // changenow_status column might not exist
            await supabase
              .from('zk_exchanges')
              .update({ status: cnStatusStr })
              .eq('id', exchange.id);
          }
          updatedCount++;
        }

        if (cnStatusStr !== 'finished') {
          results.push({ exchangeId: exchange.exchange_id, status: cnStatusStr, action: 'waiting' });
          continue;
        }

        // Get actual output amount from ChangeNow (what they actually sent to mixer)
        changenowOutputAmount = cnStatus.amountTo ? parseFloat(cnStatus.amountTo) : null;
        console.log(`  💰 ChangeNow output: ${changenowOutputAmount} ${token}`);

        // Skip if already processed AND status confirms it
        if (exchange.deposit_processed === true && exchange.status === 'deposit_complete') {
          console.log(`  ✅ Already processed`);
          results.push({ exchangeId: exchange.exchange_id, status: 'already_processed' });
          continue;
        }
        
        // If deposit_processed is true but status is NOT deposit_complete,
        // another instance might still be working on it — OR it's a stale claim.
        // Check created_at to detect stale claims (stuck for >10 minutes).
        if (exchange.deposit_processed === true) {
          const createdAt = new Date(exchange.created_at).getTime();
          const staleCutoffMs = 10 * 60 * 1000; // 10 minutes
          const ageMs = Date.now() - createdAt;

          if (ageMs > staleCutoffMs) {
            console.log(`  🔄 Stale claim detected (age ${Math.round(ageMs / 60000)}m), resetting for retry...`);
            try {
              await supabase.from('zk_exchanges')
                .update({ deposit_processed: false, status: 'finished' })
                .eq('id', exchange.id)
                .eq('status', 'processing');
            } catch {
              try {
                await supabase.from('zk_exchanges')
                  .update({ status: 'finished' })
                  .eq('id', exchange.id);
              } catch {}
            }
            // Fall through to normal claim flow below
          } else {
            console.log(`  ⏭️ Exchange is being processed by another instance (age ${Math.round(ageMs / 1000)}s), skipping`);
            results.push({ exchangeId: exchange.exchange_id, status: 'in_progress' });
            continue;
          }
        }

        // ======== ATOMIC CLAIM: prevent duplicate processing ========
        // Use TWO locks simultaneously: deposit_processed AND status='processing'
        // This ensures even if one column doesn't exist, the other blocks duplicates.
        let claimSucceeded = false;
        try {
          const { data: claimed, error: claimError } = await supabase
            .from('zk_exchanges')
            .update({ deposit_processed: true, status: 'processing' })
            .eq('id', exchange.id)
            .eq('status', 'finished')
            .neq('deposit_processed', true)
            .select('id');

          if (claimError) {
            // Column might not exist - try status-only locking
            console.warn(`  ⚠️ Claim error (column may not exist): ${claimError.message}`);
            const { data: statusClaim } = await supabase
              .from('zk_exchanges')
              .update({ status: 'processing' })
              .eq('id', exchange.id)
              .eq('status', 'finished')
              .select('id');
            
            claimSucceeded = !!(statusClaim && statusClaim.length > 0);
          } else {
            claimSucceeded = !!(claimed && claimed.length > 0);
          }
        } catch (claimErr: any) {
          console.warn(`  ⚠️ Claim exception: ${claimErr.message}`);
          // Try status-only claim as last resort
          try {
            const { data: statusClaim } = await supabase
              .from('zk_exchanges')
              .update({ status: 'processing' })
              .eq('id', exchange.id)
              .eq('status', 'finished')
              .select('id');
            claimSucceeded = !!(statusClaim && statusClaim.length > 0);
          } catch {
            claimSucceeded = false;
          }
        }

        if (!claimSucceeded) {
          console.log(`  ⏭️ Already claimed by another process, skipping`);
          results.push({ exchangeId: exchange.exchange_id, status: 'already_claimed' });
          continue;
        }

        console.log(`  🔒 Claimed exchange ${exchange.exchange_id} for processing (status=processing)`);

        // Exchange is finished - process it
        console.log(`  💰 Processing for user ${userWallet}`);

        // Get user's intermediate wallet (use limit(1) — user may have multiple token rows)
        const { data: walletMappings } = await supabase
          .from('zk_user_wallets')
          .select('intermediate_wallet')
          .eq('user_wallet', userWallet)
          .limit(1);
        const walletMapping = walletMappings?.[0] || null;

        let intermediateWallet: string;

        if (!walletMapping?.intermediate_wallet) {
          console.log(`  📝 No intermediate wallet for ${userWallet}, creating one...`);
          
          try {
            const intermediatePool = getPrivacyUsdWalletPool();
            await intermediatePool.initialize();
            
            const { data: assignedWallets } = await supabase
              .from('zk_user_wallets')
              .select('intermediate_wallet')
              .not('intermediate_wallet', 'is', null);
            
            const assignedWalletSet = new Set((assignedWallets || []).map((w: any) => w.intermediate_wallet));
            
            let foundWallet = null;
            let attempts = 0;
            const maxAttempts = 100;
            
            while (attempts < maxAttempts && !foundWallet) {
              const candidate = await intermediatePool.getAvailableWallet();
              if (!assignedWalletSet.has(candidate.publicKey)) {
                foundWallet = candidate;
                break;
              }
              attempts++;
            }
            
            if (!foundWallet) {
              const allWallets = intermediatePool.getAllWallets();
              if (allWallets.length > 0) {
                foundWallet = allWallets[0];
                console.log(`  ⚠️ Reusing wallet ${foundWallet.publicKey}`);
              }
            }
            
            if (!foundWallet) {
              // Release claim before continuing — prevents permanent stuck state
              try { await supabase.from('zk_exchanges').update({ deposit_processed: false, status: 'finished' }).eq('id', exchange.id); } catch {}
              results.push({ exchangeId: exchange.exchange_id, status: 'error', error: 'No intermediate wallets' });
              continue;
            }
            
            intermediateWallet = foundWallet.publicKey;
            
            const { error: insertError } = await supabase
              .from('zk_user_wallets')
              .insert({
                user_wallet: userWallet,
                intermediate_wallet: intermediateWallet,
                token: token,
              });
            
            if (insertError) {
              const { data: existingMappings } = await supabase
                .from('zk_user_wallets')
                .select('intermediate_wallet')
                .eq('user_wallet', userWallet)
                .limit(1);
              const existingMapping = existingMappings?.[0] || null;
              
              if (existingMapping?.intermediate_wallet) {
                intermediateWallet = existingMapping.intermediate_wallet;
              } else {
                // Release claim before continuing — prevents permanent stuck state
                try { await supabase.from('zk_exchanges').update({ deposit_processed: false, status: 'finished' }).eq('id', exchange.id); } catch {}
                results.push({ exchangeId: exchange.exchange_id, status: 'error', error: 'Failed to assign intermediate wallet' });
                continue;
              }
            } else {
              console.log(`  ✅ Assigned intermediate wallet: ${intermediateWallet.substring(0, 8)}...`);
            }
          } catch (poolError: any) {
            console.error(`  ❌ Error creating intermediate wallet:`, poolError.message);
            // Release claim before continuing — prevents permanent stuck state
            try { await supabase.from('zk_exchanges').update({ deposit_processed: false, status: 'finished' }).eq('id', exchange.id); } catch {}
            results.push({ exchangeId: exchange.exchange_id, status: 'error', error: 'Failed to create intermediate wallet' });
            continue;
          }
        } else {
          intermediateWallet = walletMapping.intermediate_wallet;
        }

        // ======================== BASE CHAIN EXCHANGE PROCESSING ========================
        if (isBaseChain()) {
          try {
            const provider = getBaseProvider();
            const tokenAddress = getTokenAddress(token || 'USDC');
            const poolAddress = getContractAddress();

            const mixerAddress = process.env.MIXER_WITHDRAWAL_WALLET_ADDRESS_BASE;
            const mixerPrivateKey = process.env.MIXER_WITHDRAWAL_WALLET_PRIVATE_KEY_BASE;

            if (!mixerAddress || !mixerPrivateKey) {
              // Release claim before continuing — prevents permanent stuck state
              try { await supabase.from('zk_exchanges').update({ deposit_processed: false, status: 'finished' }).eq('id', exchange.id); } catch {}
              results.push({ exchangeId: exchange.exchange_id, status: 'error', error: 'Base mixer not configured' });
              continue;
            }

            // Load mixer signer
            const mixerSigner = new ethers.Wallet(mixerPrivateKey, provider);
            const mixerTokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, mixerSigner);

            // Check mixer token balance
            const mixerBalance: bigint = await mixerTokenContract.balanceOf(mixerAddress);
            const splitAmount = ethers.parseUnits(exchange.split_amount, 6);
            const actualOutputAmount = changenowOutputAmount
              ? ethers.parseUnits(changenowOutputAmount.toString(), 6)
              : splitAmount * 85n / 100n;

            // Check if intermediate already has funds
            const intTokenCheck = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
            const intBalance: bigint = await intTokenCheck.balanceOf(intermediateWallet);

            if (intBalance >= actualOutputAmount * 80n / 100n) {
              console.log(`  💰 Funds already in intermediate: ${ethers.formatUnits(intBalance, 6)} ${token}`);
            } else {
              if (mixerBalance < actualOutputAmount * 50n / 100n) {
                console.log(`  ⚠️ Mixer balance too low: ${ethers.formatUnits(mixerBalance, 6)}`);
                results.push({ exchangeId: exchange.exchange_id, status: 'waiting_for_funds', balance: Number(mixerBalance) / 1e6 });
                // Release claim
                try {
                  await supabase.from('zk_exchanges').update({ deposit_processed: false, status: 'finished' }).eq('id', exchange.id);
                } catch {
                  await supabase.from('zk_exchanges').update({ status: 'finished' }).eq('id', exchange.id);
                }
                continue;
              }

              // Transfer actual output amount from mixer to intermediate
              const transferAmount = mixerBalance < actualOutputAmount ? mixerBalance - 1n : actualOutputAmount;
              console.log(`  📤 Mixer -> Intermediate: ${ethers.formatUnits(transferAmount, 6)} ${token}`);

              const tx1 = await mixerTokenContract.transfer(intermediateWallet, transferAmount);
              await tx1.wait();
              console.log(`  ✅ Mixer -> Intermediate: ${tx1.hash}`);
            }

            // Fund intermediate with ETH for gas
            const intEthBalance = await provider.getBalance(intermediateWallet);
            const intEthNeeded = ethers.parseEther("0.001");
            if (intEthBalance < intEthNeeded) {
              const fundAmount = intEthNeeded - intEthBalance;
              let funded = false;

              // Try funders in order: collection wallet, then mixer wallet as fallback
              const funderKeys = [
                { name: 'collection', key: process.env.COLLECTION_WALLET_PRIVATE_KEY_BASE },
                { name: 'mixer', key: process.env.MIXER_WITHDRAWAL_WALLET_PRIVATE_KEY_BASE },
              ];

              for (const { name, key } of funderKeys) {
                if (!key || funded) continue;
                try {
                  const funder = new ethers.Wallet(key, provider);
                  const funderBalance = await provider.getBalance(funder.address);
                  const estimatedGas = ethers.parseEther("0.00015"); // ~150k gas at low Base fees
                  if (funderBalance < fundAmount + estimatedGas) {
                    console.warn(`  ⚠️ ${name} wallet (${funder.address.slice(0, 10)}...) has insufficient ETH: ${ethers.formatEther(funderBalance)} ETH, need ~${ethers.formatEther(fundAmount + estimatedGas)}`);
                    continue;
                  }
                  const fundTx = await funder.sendTransaction({ to: intermediateWallet, value: fundAmount });
                  await fundTx.wait();
                  console.log(`  ⚡ Funded intermediate with ${ethers.formatEther(fundAmount)} ETH from ${name} wallet: ${fundTx.hash}`);
                  funded = true;
                } catch (fundErr: any) {
                  console.warn(`  ⚠️ Failed to fund from ${name} wallet: ${fundErr.message}`);
                }
              }

              if (!funded) {
                throw new Error('Cannot fund intermediate wallet with ETH for gas - all funder wallets depleted. Top up COLLECTION_WALLET_PRIVATE_KEY_BASE with ETH on Base.');
              }
            }

            // Get intermediate wallet key from pool
            const basePool = getBaseIntermediateWalletPool();
            await basePool.initialize();
            const intWalletData = await basePool.getWalletByAddress(intermediateWallet);

            if (!intWalletData) {
              // Release claim before continuing — prevents permanent stuck state
              try { await supabase.from('zk_exchanges').update({ deposit_processed: false, status: 'finished' }).eq('id', exchange.id); } catch {}
              results.push({ exchangeId: exchange.exchange_id, status: 'error', error: 'No Base intermediate keypair' });
              continue;
            }

            // Intermediate -> Contract (approve + deposit)
            const intSigner = new ethers.Wallet(intWalletData.privateKey, provider);
            const intUsdcSigner = new ethers.Contract(tokenAddress, ERC20_ABI, intSigner);
            const pool = getPrivacyPoolContract(intSigner);

            // Get current intermediate balance
            const currentIntBalance: bigint = await intUsdcSigner.balanceOf(intermediateWallet);
            console.log(`  💰 Intermediate balance: ${ethers.formatUnits(currentIntBalance, 6)} ${token}`);

            const approveTx = await intUsdcSigner.approve(poolAddress, currentIntBalance);
            await approveTx.wait();
            console.log(`  ✅ Approve: ${approveTx.hash}`);

            const depositTx = await pool.deposit(tokenAddress, currentIntBalance);
            const depositReceipt = await depositTx.wait();
            console.log(`  ✅ Intermediate -> Pool deposit: ${depositReceipt.hash}`);

            // Calculate amounts
            const finalAmount = changenowOutputAmount || Number(currentIntBalance) / 1e6;

            // Record in zk_transactions
            try {
              await supabase.from('zk_transactions').insert({
                sender_wallet: userWallet,
                recipient_wallet: userWallet,
                amount: finalAmount,
                fee_percentage: 0,
                token_symbol: token,
                tx_hash: depositReceipt.hash,
                status: 'completed',
                privacy_level: 'full',
                transaction_type: 'deposit',
              });
            } catch (logError: any) {
              console.error('❌ Error logging deposit:', logError);
            }

            // Mark exchange as fully processed
            try {
              await supabase.from('zk_exchanges')
                .update({ status: 'deposit_complete', user_wallet: userWallet, deposit_processed: true })
                .eq('id', exchange.id);
            } catch {
              await supabase.from('zk_exchanges')
                .update({ status: 'deposit_complete', user_wallet: userWallet })
                .eq('id', exchange.id);
            }

            processedCount++;
            results.push({ exchangeId: exchange.exchange_id, status: 'processed', amount: finalAmount });
            continue;

          } catch (error: any) {
            console.error(`  ❌ Base exchange error: ${error.message}`);
            // Release claim
            try {
              await supabase.from('zk_exchanges').update({ deposit_processed: false, status: 'finished' }).eq('id', exchange.id);
            } catch {
              try { await supabase.from('zk_exchanges').update({ status: 'finished' }).eq('id', exchange.id); } catch {}
            }
            results.push({ exchangeId: exchange.exchange_id, status: 'error', error: error.message });
            continue;
          }
        }
        // ======================== END BASE CHAIN EXCHANGE PROCESSING ========================

        const tokenMint = token === 'USDC' ? USDC_MINT : USDT_MINT;

        // Get mixer wallet
        const mixerAddress = process.env.MIXER_WITHDRAWAL_WALLET_ADDRESS;
        const mixerPrivateKey = process.env.MIXER_WITHDRAWAL_WALLET_PRIVATE_KEY;

        if (!mixerAddress || !mixerPrivateKey) {
          // Release claim before continuing — prevents permanent stuck state
          try { await supabase.from('zk_exchanges').update({ deposit_processed: false, status: 'finished' }).eq('id', exchange.id); } catch {}
          results.push({ exchangeId: exchange.exchange_id, status: 'error', error: 'Mixer not configured' });
          continue;
        }

        // Load mixer keypair
        let mixerKeypair: Keypair;
        try {
          const privateKeyArray = JSON.parse(mixerPrivateKey);
          mixerKeypair = Keypair.fromSecretKey(Uint8Array.from(privateKeyArray));
        } catch {
          const bs58 = (await import('bs58')).default;
          mixerKeypair = Keypair.fromSecretKey(bs58.decode(mixerPrivateKey) as Uint8Array);
        }

        const mixerPubkey = new PublicKey(mixerAddress);
        const mixerTokenAccount = await getAssociatedTokenAddress(tokenMint, mixerPubkey);
        const intermediatePubkey = new PublicKey(intermediateWallet);
        const intermediateTokenAccount = await getAssociatedTokenAddress(tokenMint, intermediatePubkey);

        // Check if funds are already in intermediate wallet
        let intermediateBalance = 0;
        try {
          const intAccount = await getAccount(connection, intermediateTokenAccount);
          intermediateBalance = Number(intAccount.amount) / 1_000_000;
        } catch {
          // ATA doesn't exist yet
        }

        const splitAmount = parseFloat(exchange.split_amount);
        // Use actual ChangeNow output amount (what they sent to mixer), NOT the original split amount
        const actualOutputAmount = changenowOutputAmount || splitAmount * 0.85;
        
        // If intermediate already has funds >= 80% of the actual output, skip mixer transfer
        if (intermediateBalance >= actualOutputAmount * 0.8) {
          console.log(`  💰 Funds already in intermediate: ${intermediateBalance.toFixed(6)} ${token}`);
        } else {
          // Check mixer balance
          let mixerBalance: number;
          try {
            const mixerAccount = await getAccount(connection, mixerTokenAccount);
            mixerBalance = Number(mixerAccount.amount) / 1_000_000;
            console.log(`  💰 Mixer balance: ${mixerBalance}`);
          } catch {
            console.log(`  ⚠️ No funds in mixer yet`);
            // Release claim so it can be retried
            try { await supabase.from('zk_exchanges').update({ deposit_processed: false, status: 'finished' }).eq('id', exchange.id); } catch {}
            results.push({ exchangeId: exchange.exchange_id, status: 'waiting_for_funds' });
            continue;
          }

          if (mixerBalance < actualOutputAmount * 0.5) {
            console.log(`  ⚠️ Balance too low: ${mixerBalance}, need ~${actualOutputAmount}`);
            // Release claim so it can be retried
            try { await supabase.from('zk_exchanges').update({ deposit_processed: false, status: 'finished' }).eq('id', exchange.id); } catch {}
            results.push({ exchangeId: exchange.exchange_id, status: 'waiting_for_funds', balance: mixerBalance });
            continue;
          }

          // Transfer ONLY the actual ChangeNow output amount from mixer to intermediate
          // Do NOT use splitAmount * 1.1 as that pulls from other users' funds
          const transferAmount = Math.min(mixerBalance - 0.001, actualOutputAmount);
          const transferLamports = Math.floor(transferAmount * 1_000_000);

          console.log(`  📤 Transferring ${transferAmount.toFixed(6)} ${token}`);

          let needsCreateATA = false;
          try {
            await getAccount(connection, intermediateTokenAccount);
          } catch {
            needsCreateATA = true;
          }

          const { blockhash } = await connection.getLatestBlockhash();
          const tx = new Transaction();
          tx.recentBlockhash = blockhash;
          tx.feePayer = mixerPubkey;

          if (needsCreateATA) {
            tx.add(createAssociatedTokenAccountInstruction(
              mixerPubkey, intermediateTokenAccount, intermediatePubkey, tokenMint
            ));
          }

          tx.add(createTransferInstruction(
            mixerTokenAccount, intermediateTokenAccount, mixerPubkey, BigInt(transferLamports)
          ));

          tx.sign(mixerKeypair);
          const sig1 = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 3 });
          console.log(`  📤 Mixer → Intermediate: ${sig1}`);
          
          // Poll for confirmation
          let confirmed1 = false;
          for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 2000));
            const status = await connection.getSignatureStatus(sig1);
            if (status.value?.confirmationStatus === 'confirmed' || status.value?.confirmationStatus === 'finalized') {
              confirmed1 = true;
              break;
            }
            if (status.value?.err) {
              throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
            }
          }
          if (!confirmed1) {
            throw new Error(`Transaction ${sig1} not confirmed after 60 seconds`);
          }
        }

        // Smart contract deposit: Intermediate → Pool
        const walletPool = getPrivacyUsdWalletPool();
        await walletPool.initialize();

        const intWalletData = await walletPool.getWalletByPublicKey(intermediateWallet);
        if (!intWalletData) {
          // Release claim before continuing — prevents permanent stuck state
          try { await supabase.from('zk_exchanges').update({ deposit_processed: false, status: 'finished' }).eq('id', exchange.id); } catch {}
          results.push({ exchangeId: exchange.exchange_id, status: 'error', error: 'No keypair' });
          continue;
        }
        const intKeypair = Keypair.fromSecretKey(Uint8Array.from(intWalletData.privateKey));

        // Get intermediate balance
        const intAccount = await getAccount(connection, intermediateTokenAccount);
        const intBalance = Number(intAccount.amount);
        const intBalanceBigInt = BigInt(intBalance);

        // Derive PDAs
        const poolPDA = await derivePoolPDA(tokenMint.toBase58());
        const userBalancePDA = await deriveUserBalancePDA(intermediateWallet, tokenMint.toBase58());
        const poolTokenAccount = await getAssociatedTokenAddress(tokenMint, poolPDA, true);

        console.log(`  🔐 Smart contract deposit: Intermediate → Pool`);
        console.log(`     Amount: ${(intBalance / 1_000_000).toFixed(6)} ${token}`);

        // Fund intermediate wallet with SOL for rent if needed
        // The Deposit instruction creates a UserBalance PDA which requires rent
        const MIN_REQUIRED_SOL = 0.003; // ~0.001566 for PDA rent + buffer for fees
        const intermediateSOLBalance = await connection.getBalance(intermediatePubkey);
        const intermediateSOLInSol = intermediateSOLBalance / 1_000_000_000;
        console.log(`  💰 Intermediate SOL balance: ${intermediateSOLInSol.toFixed(6)} SOL`);
        
        if (intermediateSOLInSol < MIN_REQUIRED_SOL) {
          console.log(`  ⚡ Funding intermediate wallet with SOL for rent...`);
          const mainWalletKey = process.env.MAIN_WALLET_PRIVATE_KEY || process.env.COLLECTION_WALLET_PRIVATE_KEY;
          
          if (mainWalletKey) {
            try {
              let mainKeypair: Keypair;
              try {
                const keyArray = JSON.parse(mainWalletKey);
                mainKeypair = Keypair.fromSecretKey(Uint8Array.from(keyArray));
              } catch {
                const bs58Module = (await import('bs58')).default;
                mainKeypair = Keypair.fromSecretKey(bs58Module.decode(mainWalletKey) as Uint8Array);
              }
              
              const fundAmount = 0.005 * 1_000_000_000; // 0.005 SOL
              const { blockhash: fundBlockhash } = await connection.getLatestBlockhash();
              const fundTx = new Transaction();
              fundTx.recentBlockhash = fundBlockhash;
              fundTx.feePayer = mainKeypair.publicKey;
              fundTx.add(SystemProgram.transfer({
                fromPubkey: mainKeypair.publicKey,
                toPubkey: intermediatePubkey,
                lamports: Math.floor(fundAmount),
              }));
              fundTx.sign(mainKeypair);
              
              const fundSig = await connection.sendRawTransaction(fundTx.serialize(), { skipPreflight: true });
              console.log(`  ✅ Funded intermediate with 0.005 SOL: ${fundSig}`);
              
              // Wait for confirmation
              for (let i = 0; i < 15; i++) {
                await new Promise(r => setTimeout(r, 2000));
                const fundStatus = await connection.getSignatureStatus(fundSig);
                if (fundStatus.value?.confirmationStatus === 'confirmed' || fundStatus.value?.confirmationStatus === 'finalized') {
                  break;
                }
              }
            } catch (fundErr: any) {
              console.error(`  ⚠️ Failed to fund intermediate wallet: ${fundErr.message}`);
              // Try to continue anyway - the deposit might still work if there's enough SOL
            }
          } else {
            console.warn(`  ⚠️ No MAIN_WALLET_PRIVATE_KEY set - cannot fund intermediate wallet`);
          }
        }

        // Build smart contract deposit transaction
        const { blockhash: blockhash2 } = await connection.getLatestBlockhash();
        const tx2 = new Transaction();
        tx2.recentBlockhash = blockhash2;
        tx2.feePayer = mixerPubkey; // Mixer pays the fee

        // Check if pool token account exists
        let needsPoolATA = false;
        try {
          await getAccount(connection, poolTokenAccount);
        } catch {
          needsPoolATA = true;
        }

        if (needsPoolATA) {
          tx2.add(createAssociatedTokenAccountInstruction(
            mixerPubkey, poolTokenAccount, poolPDA, tokenMint
          ));
        }

        // Add deposit instruction
        const depositIx = buildDepositInstruction({
          user: intermediatePubkey,
          userBalance: userBalancePDA,
          pool: poolPDA,
          tokenMint: tokenMint,
          userTokenAccount: intermediateTokenAccount,
          poolTokenAccount: poolTokenAccount,
          amountLamports: intBalanceBigInt,
        });
        tx2.add(new TransactionInstruction(depositIx));

        tx2.sign(mixerKeypair, intKeypair);
        
        const sig2 = await connection.sendRawTransaction(tx2.serialize(), { skipPreflight: false, maxRetries: 3 });
        console.log(`  📤 Intermediate → Pool: ${sig2}`);
        
        // Poll for confirmation
        let confirmed2 = false;
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 2000));
          const status = await connection.getSignatureStatus(sig2);
          if (status.value?.confirmationStatus === 'confirmed' || status.value?.confirmationStatus === 'finalized') {
            confirmed2 = true;
            break;
          }
          if (status.value?.err) {
            throw new Error(`Deposit failed: ${JSON.stringify(status.value.err)}`);
          }
        }
        if (!confirmed2) {
          throw new Error(`Transaction ${sig2} not confirmed after 60 seconds`);
        }

        console.log(`  ✅ Smart contract deposit confirmed!`);

        // Calculate amounts - use the actual ChangeNow output, not the full intermediate balance
        // No platform fee on deposits — users get the full amount from ChangeNow
        const finalAmount = actualOutputAmount;
        const FEE_PERCENTAGE = 0;
        const feeAmount = 0;
        const amountReceived = finalAmount;

        // Record deposit in zk_transactions
        try {
          const { error: insertError } = await supabase.from('zk_transactions').insert({
            sender_wallet: userWallet,
            recipient_wallet: userWallet,
            amount: finalAmount,
            fee_percentage: FEE_PERCENTAGE,
            token_symbol: token,
            tx_hash: sig2,
            status: 'completed',
            privacy_level: 'full',
            transaction_type: 'deposit',
          });
          if (insertError) {
            console.warn(`⚠️ Full insert failed (${insertError.message}), trying minimal...`);
            await supabase.from('zk_transactions').insert({
              sender_wallet: userWallet,
              recipient_wallet: userWallet,
              amount: finalAmount,
              token_symbol: token,
              tx_hash: sig2,
              status: 'completed',
              privacy_level: 'full',
              transaction_type: 'deposit',
            });
          }
        } catch (logError: any) {
          console.error('❌ Error logging deposit:', logError);
        }

        console.log(`  ✅ Recorded: $${amountReceived.toFixed(2)} ${token}`);

        // Mark exchange as fully processed
        try {
          await supabase.from('zk_exchanges')
            .update({ status: 'deposit_complete', user_wallet: userWallet, deposit_processed: true })
            .eq('id', exchange.id);
        } catch {
          // If deposit_processed column doesn't exist, just update status
          await supabase.from('zk_exchanges')
            .update({ status: 'deposit_complete', user_wallet: userWallet })
            .eq('id', exchange.id);
        }

        processedCount++;
        results.push({ exchangeId: exchange.exchange_id, status: 'processed', amount: amountReceived });

      } catch (error: any) {
        console.error(`  ❌ Error: ${error.message}`);
        
        // Release the claim so it can be retried on the next poll
        try {
          await supabase.from('zk_exchanges')
            .update({ deposit_processed: false, status: 'finished' })
            .eq('id', exchange.id);
          console.log(`  🔓 Released claim on ${exchange.exchange_id} for retry`);
        } catch (releaseErr) {
          // If deposit_processed column doesn't exist, just reset status
          try {
            await supabase.from('zk_exchanges')
              .update({ status: 'finished' })
              .eq('id', exchange.id);
            console.log(`  🔓 Released claim via status reset on ${exchange.exchange_id}`);
          } catch (releaseErr2) {
            console.error(`  ❌ Failed to release claim:`, releaseErr2);
          }
        }
        
        results.push({ exchangeId: exchange.exchange_id, status: 'error', error: error.message });
      }
    }

    console.log(`\n✅ Done: ${processedCount} processed, ${updatedCount} updated`);

    // Get total exchange counts for this deposit to help frontend track progress
    let totalExchangeCount = 0;
    let completedExchangeCount = 0;
    if (depositId) {
      let allExchanges: any[] | null = null;
      const { data: exData, error: exError } = await supabase
        .from('zk_exchanges')
        .select('id, status, deposit_processed')
        .eq('deposit_id', depositId);
      
      if (exError) {
        // deposit_processed column might not exist, try without it
        const { data: exData2 } = await supabase
          .from('zk_exchanges')
          .select('id, status')
          .eq('deposit_id', depositId);
        allExchanges = exData2;
      } else {
        allExchanges = exData;
      }
      
      if (allExchanges) {
        totalExchangeCount = allExchanges.length;
        // Only count 'deposit_complete' as truly finished (not 'processing' which is mid-flight)
        completedExchangeCount = allExchanges.filter(
          (e: any) => e.status === 'deposit_complete'
        ).length;
      }
    }

    return res.status(200).json({
      success: true,
      processed: processedCount,
      updated: updatedCount,
      results,
      totalExchanges: totalExchangeCount,
      completedExchanges: completedExchangeCount,
      allComplete: totalExchangeCount > 0 && completedExchangeCount === totalExchangeCount,
    });

  } catch (error: any) {
    console.error('❌ Fatal error:', error);
    return res.status(500).json({ error: 'Failed', message: error.message });
  }
}
