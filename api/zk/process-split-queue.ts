/**
 * Void402 Process Split Queue API (1:1 with NolviPay)
 * POST /api/zk/process-split-queue
 * 
 * Processes queued splits that are ready to send to ChangeNow.
 * Called by frontend polling to process staggered splits without timeout issues.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Connection, PublicKey, Keypair, Transaction, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount, createTransferInstruction, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const CHANGENOW_API_KEY = process.env.CHANGENOW_API_KEY;
const CHANGENOW_BASE_URL = 'https://api.changenow.io/v1';
const MIXER_WITHDRAWAL_WALLET = process.env.MIXER_WITHDRAWAL_WALLET_ADDRESS;

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

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getAllowedOrigin(req.headers.origin as string | undefined);
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { depositId, wallet } = req.body;

    const supabase = getSupabaseClient();
    if (!supabase) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    // Find pending or failed (for retry) splits that are ready to send
    let query = supabase
      .from('zk_split_queue')
      .select('*')
      .or('status.eq.pending,status.eq.failed')
      .lte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(1);

    if (depositId) {
      query = query.eq('deposit_id', depositId);
    }
    if (wallet) {
      query = query.eq('user_wallet', wallet);
    }

    const { data: pendingSplits, error: queryError } = await query;

    if (queryError) {
      console.error('Error querying split queue:', queryError);
      return res.status(500).json({ error: 'Failed to query split queue' });
    }

    if (!pendingSplits || pendingSplits.length === 0) {
      // Check if there are upcoming pending splits
      const { data: upcomingSplits } = await supabase
        .from('zk_split_queue')
        .select('id, scheduled_at, split_index')
        .eq('status', 'pending')
        .eq('deposit_id', depositId || '')
        .order('scheduled_at', { ascending: true })
        .limit(5);

      // Check if all splits are sent
      const { data: allSplits } = await supabase
        .from('zk_split_queue')
        .select('id, status')
        .eq('deposit_id', depositId || '');

      const totalSplits = allSplits?.length || 0;
      const sentSplits = allSplits?.filter((s: any) => s.status === 'sent').length || 0;
      const failedSplits = allSplits?.filter((s: any) => s.status === 'failed').length || 0;

      if (totalSplits > 0 && sentSplits === totalSplits) {
        return res.status(200).json({
          success: true,
          message: 'All splits have been sent',
          allSent: true,
          totalSplits,
          sentSplits,
        });
      }

      return res.status(200).json({
        success: true,
        message: 'No splits ready to process yet',
        pendingSplits: upcomingSplits?.length || 0,
        nextScheduled: upcomingSplits?.[0]?.scheduled_at || null,
        totalSplits,
        sentSplits,
        failedSplits,
      });
    }

    const split = pendingSplits[0];
    
    // Check retry count for failed splits (max 3 retries)
    const retryCount = split.retry_count || 0;
    const MAX_RETRIES = 3;
    
    if (split.status === 'failed' && retryCount >= MAX_RETRIES) {
      console.log(`❌ Split ${split.split_index + 1} has failed ${retryCount} times, marking as permanently failed`);
      await supabase
        .from('zk_split_queue')
        .update({ status: 'permanently_failed', updated_at: new Date().toISOString() })
        .eq('id', split.id);
      return res.status(200).json({ 
        success: false, 
        message: 'Split permanently failed after max retries',
        splitId: split.id 
      });
    }
    
    const isRetry = split.status === 'failed';
    if (isRetry) {
      console.log(`🔄 Retrying split ${split.split_index + 1} (attempt ${retryCount + 1}/${MAX_RETRIES}) for deposit ${split.deposit_id}`);
    } else {
      console.log(`🔄 Processing split ${split.split_index + 1} for deposit ${split.deposit_id}`);
    }

    // Mark as sending
    await supabase
      .from('zk_split_queue')
      .update({ 
        status: 'sending', 
        retry_count: isRetry ? retryCount + 1 : retryCount,
        updated_at: new Date().toISOString() 
      })
      .eq('id', split.id);

    // =========================================================================
    // Check privacy level: PUBLIC/PARTIAL skip ChangeNow, go direct to intermediate
    // =========================================================================
    // First get the holding wallet info to check privacy_level
    const { data: holdingData } = await supabase
      .from('zk_holding_wallets')
      .select('privacy_level')
      .eq('deposit_id', split.deposit_id)
      .single();
    
    const privacyLevel = holdingData?.privacy_level || split.privacy_level || 'full';
    
    if (privacyLevel === 'public' || privacyLevel === 'partial') {
      // =========================================================================
      // PUBLIC / PARTIAL: Direct transfer to intermediate wallet (no ChangeNow)
      // =========================================================================
      console.log(`⚡ ${privacyLevel.toUpperCase()} PRIVACY: Processing direct transfer (no ChangeNow)`);
      
      try {
        const bs58 = (await import('bs58')).default;
        const connection = getSolanaConnection();
        const holdingKeypair = generateHoldingWalletKeypair(split.deposit_id);
        const holdingPubkey = holdingKeypair.publicKey;
        const tokenMint = split.token === 'USDC' ? USDC_MINT : USDT_MINT;
        
        // Get holding wallet token account
        const holdingTokenAccount = await getAssociatedTokenAddress(tokenMint, holdingPubkey);
        
        // Check holding wallet balance
        let holdingBalance: bigint;
        try {
          const holdingAccount = await getAccount(connection, holdingTokenAccount);
          holdingBalance = holdingAccount.amount;
        } catch (error: any) {
          await supabase
            .from('zk_split_queue')
            .update({ status: 'failed', error_message: 'No funds in holding wallet', updated_at: new Date().toISOString() })
            .eq('id', split.id);
          return res.status(400).json({ error: 'No funds in holding wallet' });
        }
        
        const splitAmount = BigInt(Math.floor(parseFloat(split.split_amount) * 1_000_000));
        
        if (holdingBalance < splitAmount) {
          await supabase
            .from('zk_split_queue')
            .update({ 
              status: 'failed', 
              error_message: `Insufficient balance: have ${holdingBalance}, need ${splitAmount}`,
              updated_at: new Date().toISOString() 
            })
            .eq('id', split.id);
          return res.status(400).json({ error: 'Insufficient balance in holding wallet' });
        }
        
        // Get or assign intermediate wallet for this user
        let { data: walletMapping } = await supabase
          .from('zk_user_wallets')
          .select('intermediate_wallet')
          .eq('user_wallet', split.user_wallet)
          .maybeSingle();
        
        let intermediateWalletAddress: string;
        
        if (!walletMapping) {
          // Auto-assign intermediate wallet from pool
          const { getPrivacyUsdWalletPool } = await import('../lib/intermediate-wallet-pool.js');
          const intermediatePool = getPrivacyUsdWalletPool();
          await intermediatePool.initialize();
          const intermediateWallet = await intermediatePool.getAvailableWallet();
          intermediateWalletAddress = intermediateWallet.publicKey;
          
          await supabase
            .from('zk_user_wallets')
            .insert({
              user_wallet: split.user_wallet,
              intermediate_wallet: intermediateWalletAddress,
              token: split.token,
            });
          console.log(`✅ Auto-assigned intermediate wallet: ${intermediateWalletAddress}`);
        } else {
          intermediateWalletAddress = walletMapping.intermediate_wallet;
        }
        
        // Get intermediate wallet keypair from pool
        const { getPrivacyUsdWalletPool } = await import('../lib/intermediate-wallet-pool.js');
        const intermediatePool = getPrivacyUsdWalletPool();
        await intermediatePool.initialize();
        const intermediateWalletData = await intermediatePool.getWalletByPublicKey(intermediateWalletAddress);
        
        if (!intermediateWalletData) {
          await supabase
            .from('zk_split_queue')
            .update({ status: 'failed', error_message: 'Intermediate wallet not found in pool', updated_at: new Date().toISOString() })
            .eq('id', split.id);
          return res.status(500).json({ error: 'Intermediate wallet not found' });
        }
        
        const intermediatePubkey = new PublicKey(intermediateWalletAddress);
        const intermediateTokenAccount = await getAssociatedTokenAddress(tokenMint, intermediatePubkey);
        
        // Build transaction: Holding -> Intermediate (direct, no ChangeNow)
        const instructions: TransactionInstruction[] = [];
        
        // Check if we need to fund holding wallet with SOL for fees
        const holdingSolBalance = await connection.getBalance(holdingPubkey);
        const MIN_SOL_FOR_FEES = 2_500_000; // 0.0025 SOL
        const FUNDING_AMOUNT = 5_000_000; // 0.005 SOL
        let feePayerKeypair: Keypair | null = null;
        let needsFunding = holdingSolBalance < MIN_SOL_FOR_FEES;
        
        if (needsFunding) {
          const MAIN_WALLET_PRIVATE_KEY = process.env.MAIN_WALLET_PRIVATE_KEY || process.env.SOLANA_MAIN_WALLET_PRIVATE_KEY;
          if (MAIN_WALLET_PRIVATE_KEY) {
            try {
              let mainKeypair: Keypair;
              try {
                const privateKeyArray = JSON.parse(MAIN_WALLET_PRIVATE_KEY);
                mainKeypair = Keypair.fromSecretKey(Uint8Array.from(privateKeyArray));
              } catch {
                mainKeypair = Keypair.fromSecretKey(bs58.decode(MAIN_WALLET_PRIVATE_KEY) as Uint8Array);
              }
              feePayerKeypair = mainKeypair;
            } catch (error: any) {
              console.error(`Cannot fund holding wallet:`, error);
            }
          }
        }
        
        if (needsFunding && feePayerKeypair) {
          instructions.push(
            SystemProgram.transfer({
              fromPubkey: feePayerKeypair.publicKey,
              toPubkey: holdingPubkey,
              lamports: FUNDING_AMOUNT,
            })
          );
        }
        
        // Check if intermediate token account exists
        let intermediateAccountExists = false;
        try {
          await getAccount(connection, intermediateTokenAccount);
          intermediateAccountExists = true;
        } catch {}
        
        if (!intermediateAccountExists) {
          instructions.push(
            createAssociatedTokenAccountInstruction(
              needsFunding && feePayerKeypair ? feePayerKeypair.publicKey : holdingPubkey,
              intermediateTokenAccount,
              intermediatePubkey,
              tokenMint
            )
          );
        }
        
        // Transfer from holding to intermediate
        instructions.push(
          createTransferInstruction(
            holdingTokenAccount,
            intermediateTokenAccount,
            holdingPubkey,
            splitAmount
          )
        );
        
        console.log(`📤 ${privacyLevel.toUpperCase()}: Sending ${split.split_amount} ${split.token} directly to intermediate wallet...`);
        
        // Send transaction
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
        const transferTx = new Transaction();
        transferTx.feePayer = needsFunding && feePayerKeypair ? feePayerKeypair.publicKey : holdingPubkey;
        transferTx.recentBlockhash = blockhash;
        transferTx.lastValidBlockHeight = lastValidBlockHeight;
        
        for (const ix of instructions) {
          transferTx.add(ix);
        }
        
        if (needsFunding && feePayerKeypair) {
          transferTx.sign(feePayerKeypair, holdingKeypair);
        } else {
          transferTx.sign(holdingKeypair);
        }
        
        const signature = await connection.sendRawTransaction(transferTx.serialize(), {
          skipPreflight: false,
          maxRetries: 3,
        });
        
        console.log(`✅ Holding → Intermediate transfer sent: ${signature}`);
        
        // Wait for confirmation
        await connection.confirmTransaction(signature, 'confirmed');
        console.log(`✅ ${privacyLevel.toUpperCase()} Holding → Intermediate confirmed: ${signature}`);
        
        // =====================================================================
        // STEP 2: Smart contract deposit (Intermediate → Pool)
        // This is CRITICAL - without this, funds stay in intermediate forever
        // =====================================================================
        const { 
          derivePoolPDA, 
          deriveUserBalancePDA,
          VOID402_PROGRAM_ID,
        } = await import('../lib/void402-solana.js');
        
        // Re-fetch intermediate balance (should now have the funds)
        await new Promise(r => setTimeout(r, 2000)); // Give blockchain time to update
        
        let intBalance: bigint;
        try {
          const intAccount = await getAccount(connection, intermediateTokenAccount);
          intBalance = intAccount.amount;
        } catch {
          throw new Error('Failed to read intermediate wallet balance after transfer');
        }
        
        console.log(`  💰 Intermediate balance: ${(Number(intBalance) / 1e6).toFixed(6)} ${split.token}`);
        
        // Derive PDAs for smart contract
        const poolPDA = await derivePoolPDA(tokenMint.toBase58());
        const userBalancePDA = await deriveUserBalancePDA(intermediateWalletAddress, tokenMint.toBase58());
        const poolTokenAccount = await getAssociatedTokenAddress(tokenMint, poolPDA, true);
        
        // Fund intermediate wallet with SOL if needed (for UserBalance PDA rent)
        const MIN_REQUIRED_SOL = 0.003;
        const intermediateSOLBalance = await connection.getBalance(intermediatePubkey);
        const intermediateSOLInSol = intermediateSOLBalance / 1_000_000_000;
        
        if (intermediateSOLInSol < MIN_REQUIRED_SOL) {
          console.log(`  ⚡ Funding intermediate with SOL for rent...`);
          const mainWalletKey = process.env.MAIN_WALLET_PRIVATE_KEY || process.env.SOLANA_MAIN_WALLET_PRIVATE_KEY;
          
          if (mainWalletKey) {
            try {
              let mainKeypair: Keypair;
              try {
                const keyArray = JSON.parse(mainWalletKey);
                mainKeypair = Keypair.fromSecretKey(Uint8Array.from(keyArray));
              } catch {
                mainKeypair = Keypair.fromSecretKey(bs58.decode(mainWalletKey) as Uint8Array);
              }
              
              const fundAmount = 0.005 * 1_000_000_000;
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
            }
          }
        }
        
        // Build smart contract deposit transaction
        const { blockhash: blockhash2 } = await connection.getLatestBlockhash();
        const tx2 = new Transaction();
        tx2.recentBlockhash = blockhash2;
        tx2.feePayer = intermediatePubkey;
        
        // Check if pool token account exists
        let needsPoolATA = false;
        try {
          await getAccount(connection, poolTokenAccount);
        } catch {
          needsPoolATA = true;
        }
        
        if (needsPoolATA) {
          // Use main wallet to pay for pool ATA creation if intermediate doesn't have enough SOL
          const mainWalletKey = process.env.MAIN_WALLET_PRIVATE_KEY || process.env.SOLANA_MAIN_WALLET_PRIVATE_KEY;
          if (mainWalletKey) {
            let mainKeypair: Keypair;
            try {
              const keyArray = JSON.parse(mainWalletKey);
              mainKeypair = Keypair.fromSecretKey(Uint8Array.from(keyArray));
            } catch {
              mainKeypair = Keypair.fromSecretKey(bs58.decode(mainWalletKey) as Uint8Array);
            }
            tx2.feePayer = mainKeypair.publicKey;
            tx2.add(createAssociatedTokenAccountInstruction(
              mainKeypair.publicKey, poolTokenAccount, poolPDA, tokenMint
            ));
          }
        }
        
        // Build deposit instruction (same discriminator as process-pending-exchanges)
        const DEPOSIT_DISCRIMINATOR = Buffer.from([242, 35, 198, 137, 82, 225, 242, 182]);
        const args = Buffer.alloc(8);
        args.writeBigUInt64LE(intBalance, 0);
        const instructionData = Buffer.concat([DEPOSIT_DISCRIMINATOR, args]);
        
        const depositIx: TransactionInstruction = {
          programId: VOID402_PROGRAM_ID,
          keys: [
            { pubkey: intermediatePubkey, isSigner: true, isWritable: true },
            { pubkey: userBalancePDA, isSigner: false, isWritable: true },
            { pubkey: poolPDA, isSigner: false, isWritable: true },
            { pubkey: tokenMint, isSigner: false, isWritable: false },
            { pubkey: intermediateTokenAccount, isSigner: false, isWritable: true },
            { pubkey: poolTokenAccount, isSigner: false, isWritable: true },
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data: instructionData,
        };
        tx2.add(depositIx);
        
        // Get intermediate wallet keypair for signing
        const intKeypair = Keypair.fromSecretKey(Uint8Array.from(intermediateWalletData.privateKey));
        
        // Sign with appropriate keypairs
        if (needsPoolATA) {
          const mainWalletKey = process.env.MAIN_WALLET_PRIVATE_KEY || process.env.SOLANA_MAIN_WALLET_PRIVATE_KEY;
          if (mainWalletKey) {
            let mainKeypair: Keypair;
            try {
              const keyArray = JSON.parse(mainWalletKey);
              mainKeypair = Keypair.fromSecretKey(Uint8Array.from(keyArray));
            } catch {
              mainKeypair = Keypair.fromSecretKey(bs58.decode(mainWalletKey) as Uint8Array);
            }
            tx2.sign(mainKeypair, intKeypair);
          } else {
            tx2.sign(intKeypair);
          }
        } else {
          tx2.sign(intKeypair);
        }
        
        const sig2 = await connection.sendRawTransaction(tx2.serialize(), { skipPreflight: false, maxRetries: 3 });
        console.log(`  📤 Intermediate → Pool (smart contract): ${sig2}`);
        
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
            throw new Error(`Smart contract deposit failed: ${JSON.stringify(status.value.err)}`);
          }
        }
        if (!confirmed2) {
          throw new Error(`Transaction ${sig2} not confirmed after 60 seconds`);
        }
        
        console.log(`  ✅ Smart contract deposit confirmed!`);
        
        // Mark split as sent
        await supabase
          .from('zk_split_queue')
          .update({
            status: 'sent',
            transaction_signature: sig2,
            exchange_id: `direct_${privacyLevel}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', split.id);
        
        // Record in zk_transactions
        const amountInCurrency = Number(intBalance) / 1e6;
        
        const { error: txError } = await supabase.from('zk_transactions').insert({
          sender_wallet: split.user_wallet,
          recipient_wallet: split.user_wallet,
          amount: amountInCurrency,
          fee_percentage: 0,
          token_symbol: split.token,
          tx_hash: sig2,
          status: 'completed',
          privacy_level: privacyLevel,
          transaction_type: 'deposit',
        });
        
        if (txError) {
          console.warn(`⚠️ Failed to log transaction:`, txError.message);
          await supabase.from('zk_transactions').insert({
            sender_wallet: split.user_wallet,
            recipient_wallet: split.user_wallet,
            amount: amountInCurrency,
            token_symbol: split.token,
            tx_hash: sig2,
            status: 'completed',
            transaction_type: 'deposit',
          });
        }
        
        console.log(`✅ ${privacyLevel.toUpperCase()} deposit completed: ${amountInCurrency} ${split.token}`);
        
        // Mark holding wallet as completed
        await supabase
          .from('zk_holding_wallets')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('deposit_id', split.deposit_id);
        
        return res.status(200).json({
          success: true,
          message: `${privacyLevel.charAt(0).toUpperCase() + privacyLevel.slice(1)} deposit completed (no mixer)`,
          splitIndex: split.split_index + 1,
          signature: sig2,
          totalSplits: 1,
          sentSplits: 1,
          pendingSplits: 0,
          allSent: true,
          privacyLevel,
        });
        
      } catch (error: any) {
        console.error(`❌ ${privacyLevel.toUpperCase()} direct transfer failed:`, error);
        await supabase
          .from('zk_split_queue')
          .update({
            status: 'failed',
            error_message: error.message || 'Unknown error',
            updated_at: new Date().toISOString()
          })
          .eq('id', split.id);
        return res.status(500).json({
          success: false,
          error: error.message || 'Failed to process direct transfer',
          privacyLevel,
        });
      }
    }
    
    // =========================================================================
    // FULL PRIVACY: Use ChangeNow mixer (existing logic)
    // =========================================================================
    console.log(`🔒 FULL PRIVACY: Routing through ChangeNow mixer`);

    // Check if ChangeNow API is configured
    if (!CHANGENOW_API_KEY || !MIXER_WITHDRAWAL_WALLET) {
      await supabase
        .from('zk_split_queue')
        .update({ status: 'failed', error_message: 'ChangeNow not configured', updated_at: new Date().toISOString() })
        .eq('id', split.id);
      return res.status(500).json({ error: 'Privacy Mixer not configured' });
    }

    const connection = getSolanaConnection();
    const holdingKeypair = generateHoldingWalletKeypair(split.deposit_id);
    const holdingPubkey = holdingKeypair.publicKey;
    const tokenMint = split.token === 'USDC' ? USDC_MINT : USDT_MINT;

    // Get holding wallet token account
    const holdingTokenAccount = await getAssociatedTokenAddress(tokenMint, holdingPubkey);

    // Check holding wallet balance
    let holdingBalance: bigint;
    try {
      const holdingAccount = await getAccount(connection, holdingTokenAccount);
      holdingBalance = holdingAccount.amount;
    } catch (error: any) {
      await supabase
        .from('zk_split_queue')
        .update({ status: 'failed', error_message: 'No funds in holding wallet', updated_at: new Date().toISOString() })
        .eq('id', split.id);
      return res.status(400).json({ error: 'No funds in holding wallet' });
    }

    const splitAmount = BigInt(Math.floor(parseFloat(split.split_amount) * 1_000_000));

    if (holdingBalance < splitAmount) {
      await supabase
        .from('zk_split_queue')
        .update({ 
          status: 'failed', 
          error_message: `Insufficient balance: have ${holdingBalance}, need ${splitAmount}`,
          updated_at: new Date().toISOString() 
        })
        .eq('id', split.id);
      return res.status(400).json({ error: 'Insufficient balance in holding wallet' });
    }

    // Create ChangeNow exchange
    const fromCurrency = split.token === 'USDC' ? 'usdcsol' : 'usdtsol';
    const toCurrency = fromCurrency;
    const splitAmountInCurrency = (Number(splitAmount) / 1e6).toString();
    const splitId = `${split.deposit_id}_split_${split.split_index + 1}`;

    const transactionData: any = {
      from: fromCurrency,
      to: toCurrency,
      address: MIXER_WITHDRAWAL_WALLET,
      amount: splitAmountInCurrency,
      userId: splitId,
      contactEmail: ''
    };

    try {
      console.log(`📤 Creating ChangeNow exchange for split ${split.split_index + 1}...`);

      const changenowResponse = await fetch(`${CHANGENOW_BASE_URL}/transactions/${CHANGENOW_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Void402/1.0',
          'Accept': 'application/json',
        },
        body: JSON.stringify(transactionData)
      });

      const changenowData = await changenowResponse.json();

      if (!changenowResponse.ok || !changenowData.id) {
        throw new Error(`ChangeNow API error: ${JSON.stringify(changenowData)}`);
      }

      const payinAddress = changenowData.payinAddress || changenowData.address || changenowData.depositAddress;
      
      if (!payinAddress) {
        throw new Error(`Missing deposit address in ChangeNow response`);
      }

      if (payinAddress === MIXER_WITHDRAWAL_WALLET) {
        throw new Error(`ChangeNow returned withdrawal wallet as deposit address`);
      }

      console.log(`✅ ChangeNow exchange ${changenowData.id} created. Deposit: ${payinAddress}`);

      // Check if we need to fund holding wallet with SOL for fees
      const holdingSolBalance = await connection.getBalance(holdingPubkey);
      const MIN_SOL_FOR_FEES = 2_500_000; // 0.0025 SOL
      const FUNDING_AMOUNT = 5_000_000; // 0.005 SOL

      let feePayerKeypair: Keypair | null = null;
      let needsFunding = holdingSolBalance < MIN_SOL_FOR_FEES;

      if (needsFunding) {
        const MAIN_WALLET_PRIVATE_KEY = process.env.MAIN_WALLET_PRIVATE_KEY || process.env.SOLANA_MAIN_WALLET_PRIVATE_KEY;
        if (MAIN_WALLET_PRIVATE_KEY) {
          try {
            let mainKeypair: Keypair;
            try {
              const privateKeyArray = JSON.parse(MAIN_WALLET_PRIVATE_KEY);
              mainKeypair = Keypair.fromSecretKey(Uint8Array.from(privateKeyArray));
            } catch {
              const bs58 = (await import('bs58')).default;
              mainKeypair = Keypair.fromSecretKey(bs58.decode(MAIN_WALLET_PRIVATE_KEY) as Uint8Array);
            }
            feePayerKeypair = mainKeypair;
          } catch (error: any) {
            throw new Error(`Cannot fund holding wallet: ${error.message}`);
          }
        } else {
          throw new Error('Holding wallet has insufficient SOL and MAIN_WALLET_PRIVATE_KEY not set');
        }
      }

      // Build and send transfer transaction
      const changenowPayinPubkey = new PublicKey(payinAddress);
      const changenowTokenAccount = await getAssociatedTokenAddress(tokenMint, changenowPayinPubkey);

      // Check if ChangeNow token account exists
      let changenowAccountExists = false;
      try {
        await getAccount(connection, changenowTokenAccount);
        changenowAccountExists = true;
      } catch {
        changenowAccountExists = false;
      }

      // Build transaction instructions
      const instructions: TransactionInstruction[] = [];

      // Fund holding wallet if needed
      if (needsFunding && feePayerKeypair) {
        instructions.push(
          SystemProgram.transfer({
            fromPubkey: feePayerKeypair.publicKey,
            toPubkey: holdingPubkey,
            lamports: FUNDING_AMOUNT,
          })
        );
      }

      // Create token account if needed
      if (!changenowAccountExists) {
        instructions.push(
          createAssociatedTokenAccountInstruction(
            needsFunding && feePayerKeypair ? feePayerKeypair.publicKey : holdingPubkey,
            changenowTokenAccount,
            changenowPayinPubkey,
            tokenMint
          )
        );
      }

      // Add transfer instruction
      instructions.push(
        createTransferInstruction(
          holdingTokenAccount,
          changenowTokenAccount,
          holdingPubkey,
          splitAmount
        )
      );

      console.log(`📤 Sending ${splitAmountInCurrency} ${split.token} to ChangeNow...`);

      // Retry logic for blockhash errors
      let signature = '';
      let sendAttempts = 0;
      const maxSendAttempts = 3;
      
      while (sendAttempts < maxSendAttempts) {
        sendAttempts++;
        try {
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
          
          const transferTx = new Transaction();
          transferTx.feePayer = needsFunding && feePayerKeypair ? feePayerKeypair.publicKey : holdingPubkey;
          transferTx.recentBlockhash = blockhash;
          transferTx.lastValidBlockHeight = lastValidBlockHeight;
          
          for (const ix of instructions) {
            transferTx.add(ix);
          }

          // Sign
          if (needsFunding && feePayerKeypair) {
            transferTx.sign(feePayerKeypair, holdingKeypair);
          } else {
            transferTx.sign(holdingKeypair);
          }

          signature = await connection.sendRawTransaction(transferTx.serialize(), {
            skipPreflight: false,
            maxRetries: 3,
          });
          
          console.log(`✅ Transaction sent on attempt ${sendAttempts}: ${signature}`);
          break;
          
        } catch (sendError: any) {
          const errorMessage = sendError.message || '';
          if (errorMessage.includes('Blockhash not found') && sendAttempts < maxSendAttempts) {
            console.log(`⚠️ Blockhash expired, retrying (attempt ${sendAttempts}/${maxSendAttempts})...`);
            await new Promise(resolve => setTimeout(resolve, 500));
            continue;
          }
          throw sendError;
        }
      }
      
      if (!signature) {
        throw new Error('Failed to send transaction after max attempts');
      }

      // Wait for confirmation
      let confirmed = false;
      try {
        await Promise.race([
          connection.confirmTransaction(signature, 'confirmed'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 60000))
        ]);
        confirmed = true;
      } catch (confirmError: any) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        const status = await connection.getSignatureStatus(signature);
        if (status.value && !status.value.err) {
          confirmed = true;
        }
      }

      if (!confirmed) {
        throw new Error(`Transaction ${signature} not confirmed`);
      }

      console.log(`✅ Split ${split.split_index + 1} sent successfully! TX: ${signature}`);

      // Update queue with success
      await supabase
        .from('zk_split_queue')
        .update({
          status: 'sent',
          exchange_id: changenowData.id,
          exchange_deposit_address: payinAddress,
          transaction_signature: signature,
          updated_at: new Date().toISOString()
        })
        .eq('id', split.id);

      // Add to zk_exchanges for tracking
      let exchangeInserted = false;
      const { error: exchangeInsertError } = await supabase
        .from('zk_exchanges')
        .insert({
          deposit_id: split.deposit_id,
          exchange_id: changenowData.id,
          split_index: split.split_index,
          user_wallet: split.user_wallet,
          token: split.token,
          split_amount: splitAmountInCurrency,
          status: 'waiting',
          changenow_status: 'waiting',
          deposit_processed: false,
        });
      
      if (exchangeInsertError) {
        console.warn(`⚠️ Full insert failed (${exchangeInsertError.message}), trying without deposit_processed...`);
        // deposit_processed column might not exist - try without it
        const { error: fallbackError } = await supabase
          .from('zk_exchanges')
          .insert({
            deposit_id: split.deposit_id,
            exchange_id: changenowData.id,
            split_index: split.split_index,
            user_wallet: split.user_wallet,
            token: split.token,
            split_amount: splitAmountInCurrency,
            status: 'waiting',
          });
        if (fallbackError) {
          console.error(`❌ Failed to insert exchange record:`, fallbackError);
        } else {
          exchangeInserted = true;
        }
      } else {
        exchangeInserted = true;
      }
      
      if (exchangeInserted) {
        console.log(`✅ Exchange ${changenowData.id} recorded in database for wallet ${split.user_wallet}`);
      }

      // Check remaining splits
      const { data: remainingSplits } = await supabase
        .from('zk_split_queue')
        .select('id, status, scheduled_at')
        .eq('deposit_id', split.deposit_id)
        .order('split_index', { ascending: true });

      const totalSplits = remainingSplits?.length || 0;
      const sentSplits = remainingSplits?.filter((s: any) => s.status === 'sent').length || 0;
      const pendingSplitsCount = remainingSplits?.filter((s: any) => s.status === 'pending').length || 0;
      const nextPending = remainingSplits?.find((s: any) => s.status === 'pending');

      return res.status(200).json({
        success: true,
        message: `Split ${split.split_index + 1} sent successfully`,
        splitIndex: split.split_index + 1,
        exchangeId: changenowData.id,
        signature,
        totalSplits,
        sentSplits,
        pendingSplits: pendingSplitsCount,
        nextScheduled: nextPending?.scheduled_at || null,
        allSent: sentSplits === totalSplits,
      });

    } catch (error: any) {
      console.error(`❌ Failed to process split ${split.split_index + 1}:`, error);

      await supabase
        .from('zk_split_queue')
        .update({
          status: 'failed',
          error_message: error.message || 'Unknown error',
          updated_at: new Date().toISOString()
        })
        .eq('id', split.id);

      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to process split',
        splitIndex: split.split_index + 1,
      });
    }

  } catch (error: any) {
    console.error('❌ Fatal error in process-split-queue:', error);
    return res.status(500).json({
      error: 'Failed to process split queue',
      message: error.message || 'Unknown error'
    });
  }
}
