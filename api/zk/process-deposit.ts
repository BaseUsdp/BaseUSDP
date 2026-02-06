/**
 * Void402 Process Deposit API (1:1 with Nolvipay)
 * POST /api/zk/process-deposit
 * 
 * Server-side endpoint that processes deposits after user signs transaction.
 * Flow: Collection Wallet → Intermediate Wallet → Pool
 * 
 * This completes the privacy stack by moving funds through intermediate wallets.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { 
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  Keypair,
  SystemProgram,
} from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  createCloseAccountInstruction,
  getAccount,
} from '@solana/spl-token';
import { 
  derivePoolPDA, 
  deriveUserBalancePDA,
  getSolanaConnection,
  VOID402_PROGRAM_ID,
} from '../lib/void402-solana.js';
import { getPrivacyUsdWalletPool } from '../lib/intermediate-wallet-pool.js';
import { extractBearerToken, verifyBearerToken } from '../lib/bearer-auth.js';
import { createClient } from '@supabase/supabase-js';
import { getUSDPHolderTier, calculateFeePercentage } from '../lib/tier-service.js';
import bs58 from 'bs58';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// USDC and USDT mint addresses on Solana
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const USDT_MINT = new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB');

// Instruction discriminator for deposit: [242, 35, 198, 137, 82, 225, 242, 182]
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
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!supabase) {
    return res.status(500).json({ success: false, error: "Database not configured" });
  }

  try {
    const { transaction_signature, mixer_exchange_id, wallet, amount, token, source_network, wallet_signature, message_to_sign } = req.body;

    // Check if this is a Privacy Mixer deposit or regular deposit
    const isMixerDeposit = !!mixer_exchange_id;

    if (isMixerDeposit) {
      // Privacy Mixer deposit - only need exchange_id, wallet, amount, token
      if (!mixer_exchange_id || !wallet || !amount || !token) {
        return res.status(400).json({ error: 'Mixer exchange ID, wallet, amount, and token are required for Privacy Mixer deposits' });
      }
    } else {
      // Regular deposit - need transaction_signature
      if (!transaction_signature || !wallet || !amount || !token) {
        return res.status(400).json({ error: 'Transaction signature, wallet, amount, and token are required' });
      }
    }

    if (!['USDC', 'USDT'].includes(token)) {
      return res.status(400).json({ error: 'Token must be USDC or USDT' });
    }

    // CRITICAL SECURITY: Require bearer token authentication
    const bearerToken = extractBearerToken(req);
    
    if (!bearerToken) {
      console.error(`❌ SECURITY: Missing bearer token for process-deposit. Wallet: ${wallet}`);
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'You must authenticate first. Please call /api/auth/nonce and /api/auth/verify to get a bearer token.'
      });
    }

    // Verify bearer token
    const tokenVerification = await verifyBearerToken(bearerToken, wallet);
    
    if (!tokenVerification.valid) {
      console.error(`❌ SECURITY: Invalid bearer token for process-deposit. Wallet: ${wallet}, Error: ${tokenVerification.error}`);
      return res.status(403).json({ 
        error: 'Invalid authentication',
        message: tokenVerification.error || 'Bearer token is invalid or expired. Please authenticate again.'
      });
    }

    const connection = getSolanaConnection();
    const tokenMint = token === 'USDC' ? USDC_MINT : USDT_MINT;
    
    // For regular deposits, verify the transaction exists and was successful
    if (!isMixerDeposit) {
      try {
        const txStatus = await connection.getSignatureStatus(transaction_signature);
        if (!txStatus.value || txStatus.value.err) {
          return res.status(400).json({ error: 'Transaction failed or not found' });
        }
      } catch (error) {
        console.error('Error verifying transaction:', error);
        return res.status(400).json({ error: 'Could not verify transaction' });
      }
    }

    // Get user's assigned intermediate wallet from database
    let { data: walletMapping, error: dbError } = await supabase
      .from('zk_user_wallets')
      .select('intermediate_wallet, token')
      .eq('user_wallet', wallet)
      .maybeSingle();

    let intermediateWalletPublicKey: string;

    if (dbError || !walletMapping) {
      // No intermediate wallet assigned - assign one from the pool
      console.log(`[Process Deposit] No intermediate wallet found for ${wallet}, auto-assigning for ${token}...`);
      
      const intermediatePool = getPrivacyUsdWalletPool();
      await intermediatePool.initialize();
      
      // Get all currently assigned intermediate wallets to avoid reuse
      const { data: assignedWallets } = await supabase
        .from('zk_user_wallets')
        .select('intermediate_wallet')
        .not('intermediate_wallet', 'is', null);
      
      const assignedWalletSet = new Set((assignedWallets || []).map((w: any) => w.intermediate_wallet));
      
      // Try to find an available wallet that's not already assigned
      let intermediateWallet = null;
      let attempts = 0;
      const maxAttempts = 100;
      
      while (attempts < maxAttempts && !intermediateWallet) {
        const candidate = await intermediatePool.getAvailableWallet();
        if (!assignedWalletSet.has(candidate.publicKey)) {
          intermediateWallet = candidate;
          break;
        }
        attempts++;
      }
      
      // If still no wallet found after checking all, allow reuse of least recently used wallet
      if (!intermediateWallet) {
        console.warn('[Process Deposit] All wallets assigned, reusing least recently used wallet for privacy');
        const allWallets = intermediatePool.getAllWallets();
        if (allWallets.length === 0) {
          return res.status(500).json({ 
            error: 'No intermediate wallets available', 
            message: 'Intermediate wallet pool is empty. Please contact support.' 
          });
        }
        const sorted = [...allWallets].sort((a, b) => {
          if (!a.lastUsed && !b.lastUsed) return 0;
          if (!a.lastUsed) return -1;
          if (!b.lastUsed) return 1;
          return a.lastUsed.getTime() - b.lastUsed.getTime();
        });
        intermediateWallet = sorted[0];
        console.log(`[Process Deposit] Reusing wallet ${intermediateWallet.publicKey} (last used: ${intermediateWallet.lastUsed || 'never'})`);
      }
      
      intermediateWalletPublicKey = intermediateWallet.publicKey;
      
      // Store the mapping in database
      const { error: insertError } = await supabase
        .from('zk_user_wallets')
        .insert({
          user_wallet: wallet,
          intermediate_wallet: intermediateWalletPublicKey,
          token: token,
        });

      if (insertError) {
        console.error('[Process Deposit] Error storing intermediate wallet mapping:', insertError);
        // If insert fails due to unique constraint, try to fetch existing record
        const { data: existingMapping } = await supabase
          .from('zk_user_wallets')
          .select('intermediate_wallet')
          .eq('user_wallet', wallet)
          .maybeSingle();
        
        if (existingMapping) {
          console.log(`[Process Deposit] Found existing intermediate wallet for ${wallet}, reusing it`);
          intermediateWalletPublicKey = existingMapping.intermediate_wallet;
        } else {
          return res.status(500).json({ error: 'Failed to assign intermediate wallet' });
        }
      } else {
        console.log(`[Process Deposit] Assigned intermediate wallet ${intermediateWalletPublicKey} to ${wallet} for ${token}`);
      }
    } else {
      intermediateWalletPublicKey = walletMapping.intermediate_wallet;
      if (walletMapping.token !== token) {
        console.log(`[Process Deposit] Reusing intermediate wallet ${intermediateWalletPublicKey} (originally for ${walletMapping.token}, now for ${token})`);
      }
    }

    // Determine source wallet (mixer withdrawal wallet for Privacy Mixer, collection wallet for regular deposits)
    let sourceKeypair: Keypair;
    let sourcePubkey: PublicKey;
    let sourceWalletName: string;
    let mixerBalanceBeforeTransfer: bigint | null = null;
    
    if (isMixerDeposit) {
      // Privacy Mixer deposit - use mixer withdrawal wallet
      const mixerWithdrawalAddress = process.env.MIXER_WITHDRAWAL_WALLET_ADDRESS;
      const mixerWithdrawalPrivateKey = process.env.MIXER_WITHDRAWAL_WALLET_PRIVATE_KEY;
      
      if (!mixerWithdrawalAddress || !mixerWithdrawalPrivateKey) {
        throw new Error('MIXER_WITHDRAWAL_WALLET_ADDRESS and MIXER_WITHDRAWAL_WALLET_PRIVATE_KEY environment variables not set');
      }
      
      try {
        const privateKeyArray = JSON.parse(mixerWithdrawalPrivateKey);
        sourceKeypair = Keypair.fromSecretKey(Uint8Array.from(privateKeyArray));
      } catch {
        sourceKeypair = Keypair.fromSecretKey(bs58.decode(mixerWithdrawalPrivateKey));
      }
      sourcePubkey = sourceKeypair.publicKey;
      sourceWalletName = 'mixer withdrawal wallet';
      
      console.log(`🔒 PRIVACY MIXER: Processing deposit from mixer withdrawal wallet (exchange: ${mixer_exchange_id})`);
      
      // Update database with mixer exchange info
      await supabase
        .from('zk_user_wallets')
        .update({
          mixer_exchange_id: mixer_exchange_id,
          mixer_status: 'processing',
        })
        .eq('user_wallet', wallet)
        .eq('token', token);
    } else {
      // Regular deposit - use collection wallet
      const collectionWalletAddress = process.env.COLLECTION_WALLET_ADDRESS || process.env.COLLECTION_WALLET;
      const collectionWalletPrivateKey = process.env.COLLECTION_WALLET_PRIVATE_KEY;
      
      if (!collectionWalletAddress || !collectionWalletPrivateKey) {
        throw new Error('COLLECTION_WALLET_ADDRESS and COLLECTION_WALLET_PRIVATE_KEY environment variables not set');
      }
      
      try {
        const privateKeyArray = JSON.parse(collectionWalletPrivateKey);
        sourceKeypair = Keypair.fromSecretKey(Uint8Array.from(privateKeyArray));
      } catch {
        sourceKeypair = Keypair.fromSecretKey(bs58.decode(collectionWalletPrivateKey));
      }
      sourcePubkey = sourceKeypair.publicKey;
      sourceWalletName = 'collection wallet';
      
      console.log(`📥 REGULAR DEPOSIT: Processing deposit from collection wallet`);
    }

    // Get intermediate wallet from pool
    const intermediatePool = getPrivacyUsdWalletPool();
    await intermediatePool.initialize();
    const intermediateWallet = await intermediatePool.getWalletByPublicKey(intermediateWalletPublicKey);
    
    if (!intermediateWallet) {
      return res.status(400).json({ error: 'Intermediate wallet not found in pool' });
    }

    // Create intermediate wallet keypair
    const intermediateKeypair = Keypair.fromSecretKey(Uint8Array.from(intermediateWallet.privateKey));
    const intermediatePubkey = intermediateKeypair.publicKey;

    // Derive PDAs
    const poolPDA = await derivePoolPDA(tokenMint.toBase58());
    const userBalancePDA = await deriveUserBalancePDA(intermediateWallet.publicKey, tokenMint.toBase58());

    // Get associated token accounts
    const sourceTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      sourcePubkey
    );
    
    const intermediateTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      intermediatePubkey
    );
    
    const poolTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      poolPDA,
      true // allowOwnerOffCurve
    );

    // Calculate deposit amount after fees (tier-based fee)
    let baseAmount = parseFloat(amount);
    const originalDepositAmount = parseFloat(amount);
    
    // Get user's tier
    const tierInfo = await getUSDPHolderTier(wallet);
    const feePercentage = calculateFeePercentage(10.0, tierInfo.tier, 'deposit');
    
    const feeAmount = baseAmount * (feePercentage / 100);
    const amountAfterFees = baseAmount - feeAmount;
    
    console.log(`💰 Deposit fee calculation (Tier ${tierInfo.tier}): ${baseAmount} ${token} - ${feeAmount.toFixed(6)} ${token} (${feePercentage}%) = ${amountAfterFees.toFixed(6)} ${token} deposited`);
    
    // Convert to lamports (USDC/USDT have 6 decimals)
    const amountLamports = BigInt(Math.floor(amountAfterFees * 1_000_000));

    // Check intermediate wallet SOL balance
    const intermediateSolBalance = await connection.getBalance(intermediatePubkey);
    
    // Check if user balance PDA exists
    let userBalanceExists = false;
    try {
      const userBalanceAccountInfo = await connection.getAccountInfo(userBalancePDA);
      if (userBalanceAccountInfo && userBalanceAccountInfo.owner.equals(VOID402_PROGRAM_ID)) {
        userBalanceExists = true;
      }
    } catch {
      userBalanceExists = false;
    }
    
    // Check if pool PDA exists
    let poolExists = false;
    try {
      const poolAccountInfo = await connection.getAccountInfo(poolPDA);
      if (poolAccountInfo && poolAccountInfo.owner.equals(VOID402_PROGRAM_ID)) {
        poolExists = true;
      }
    } catch {
      poolExists = false;
    }
    
    // Get actual rent exemption requirements
    const SYSTEM_ACCOUNT_RENT = await connection.getMinimumBalanceForRentExemption(0);
    const ASSOCIATED_TOKEN_ACCOUNT_RENT = await connection.getMinimumBalanceForRentExemption(165);
    
    // Check if intermediate wallet's token account exists
    let intermediateAccountExists = false;
    try {
      await connection.getTokenAccountBalance(intermediateTokenAccount);
      intermediateAccountExists = true;
    } catch {
      intermediateAccountExists = false;
    }
    
    // Check source wallet balance
    const TRANSACTION_FEE_ESTIMATE = 10_000;
    const TOTAL_INSTRUCTIONS = 3 + (intermediateAccountExists ? 0 : 1) + (userBalanceExists ? 0 : 1) + (poolExists ? 0 : 1);
    const ESTIMATED_TX_FEES = TRANSACTION_FEE_ESTIMATE * TOTAL_INSTRUCTIONS;
    const RENT_FOR_ATA = intermediateAccountExists ? 0 : ASSOCIATED_TOKEN_ACCOUNT_RENT;
    const MIN_SOURCE_BALANCE_NEEDED = ESTIMATED_TX_FEES + RENT_FOR_ATA + (SYSTEM_ACCOUNT_RENT * 2);
    
    const sourceBalance = await connection.getBalance(sourcePubkey);
    
    if (sourceBalance < MIN_SOURCE_BALANCE_NEEDED) {
      return res.status(400).json({ 
        error: `${sourceWalletName} has insufficient SOL balance`,
        details: {
          message: `${sourceWalletName} needs at least ${(MIN_SOURCE_BALANCE_NEEDED / 1_000_000_000).toFixed(6)} SOL for transaction fees and account creation. Current balance: ${(sourceBalance / 1_000_000_000).toFixed(6)} SOL`,
          sourceWallet: sourcePubkey.toString(),
          currentBalance: sourceBalance / 1e9,
          required: MIN_SOURCE_BALANCE_NEEDED / 1e9,
        }
      });
    }
    
    // Check if we can close the source token account after transfer
    let shouldCloseSourceAccount = false;
    let sourceAccountBalance = BigInt(0);
    try {
      const sourceAccount = await getAccount(connection, sourceTokenAccount);
      sourceAccountBalance = sourceAccount.amount;
      if (sourceAccountBalance === amountLamports) {
        shouldCloseSourceAccount = true;
        console.log(`💰 OPTIMIZATION: Will close source token account after transfer to return rent to ${sourceWalletName}`);
      }
    } catch {
      shouldCloseSourceAccount = false;
    }

    // Build transaction
    const instructions = [];

    // Step 1: Create intermediate wallet ATA (funded by source directly)
    if (!intermediateAccountExists) {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          sourcePubkey,
          intermediateTokenAccount,
          intermediatePubkey,
          tokenMint
        )
      );
    }

    // Step 2: Transfer SPL tokens from source to intermediate
    instructions.push(
      createTransferInstruction(
        sourceTokenAccount,
        intermediateTokenAccount,
        sourcePubkey,
        amountLamports
      )
    );

    // Step 3: Close source token account if it will be empty
    if (shouldCloseSourceAccount) {
      instructions.push(
        createCloseAccountInstruction(
          sourceTokenAccount,
          sourcePubkey,
          sourcePubkey,
          []
        )
      );
    }

    // Step 4: Deposit from intermediate wallet to pool
    try {
      await connection.getTokenAccountBalance(poolTokenAccount);
    } catch {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          sourcePubkey,
          poolTokenAccount,
          poolPDA,
          tokenMint
        )
      );
    }

    // Build deposit instruction
    const depositIx = buildDepositInstruction({
      user: intermediatePubkey,
      userBalance: userBalancePDA,
      pool: poolPDA,
      tokenMint: tokenMint,
      userTokenAccount: intermediateTokenAccount,
      poolTokenAccount: poolTokenAccount,
      amountLamports: amountLamports,
    });

    instructions.push(depositIx);

    // Step 5: Transfer remaining SOL from intermediate wallet back to source
    const MIN_INTERMEDIATE_SOL_BUFFER = SYSTEM_ACCOUNT_RENT + 50_000;
    const ESTIMATED_DEPOSIT_FEE = 10_000;
    const ESTIMATED_TRANSFER_FEE = 10_000;
    const SAFETY_MARGIN = 100_000;
    const REQUIRED_BUFFER = MIN_INTERMEDIATE_SOL_BUFFER + ESTIMATED_DEPOSIT_FEE + ESTIMATED_TRANSFER_FEE + SAFETY_MARGIN;
    
    if (intermediateSolBalance > REQUIRED_BUFFER) {
      const solToReturn = intermediateSolBalance - REQUIRED_BUFFER;
      if (solToReturn > 0) {
        instructions.push(
          SystemProgram.transfer({
            fromPubkey: intermediatePubkey,
            toPubkey: sourcePubkey,
            lamports: solToReturn,
          })
        );
        console.log(`💰 OPTIMIZATION: Added SOL transfer to return ${(solToReturn / 1e9).toFixed(6)} SOL from intermediate wallet to ${sourceWalletName}`);
      }
    }

    // Build and sign transaction
    console.log(`📝 Building transaction: ${instructions.length} instructions`);
    console.log(`   Source wallet (${sourceWalletName}): ${sourcePubkey.toString()}`);
    console.log(`   Intermediate wallet: ${intermediatePubkey.toString()}`);
    console.log(`   Transfer amount: ${(Number(amountLamports) / 1_000_000).toFixed(6)} ${token}`);
    
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
    const txMessage = new TransactionMessage({
      payerKey: sourcePubkey,
      recentBlockhash: blockhash,
      instructions: instructions,
    }).compileToLegacyMessage();

    const transaction = new VersionedTransaction(txMessage);
    
    // Sign with both source and intermediate wallets
    console.log(`🔐 Signing transaction with:`);
    console.log(`   1. Source keypair (${sourceWalletName}): ${sourceKeypair.publicKey.toString()}`);
    console.log(`   2. Intermediate keypair: ${intermediateKeypair.publicKey.toString()}`);
    
    try {
      transaction.sign([sourceKeypair, intermediateKeypair]);
      console.log(`✅ Transaction signed successfully`);
    } catch (signError: any) {
      console.error(`❌ Error signing transaction:`, signError);
      throw new Error(`Failed to sign transaction: ${signError.message}`);
    }

    // Send transaction
    console.log(`📤 Sending transaction to Solana network...`);
    let signature: string;
    try {
      signature = await connection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });
      console.log(`✅ Transaction sent with signature: ${signature}`);
    } catch (sendError: any) {
      console.error(`❌ Error sending transaction:`, sendError);
      throw new Error(`Failed to send transaction: ${sendError.message}`);
    }

    console.log(`✅ Void402: ${sourceWalletName} → Intermediate wallet → Pool - TX: ${signature}`);

    // Wait for confirmation
    let transactionConfirmed = false;
    try {
      console.log(`⏳ Waiting for transaction confirmation: ${signature}...`);
      await Promise.race([
        connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight,
        }, 'confirmed'),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Transaction confirmation timeout after 90s')), 90000)
        )
      ]);
      transactionConfirmed = true;
      console.log(`✅ Transaction confirmed: ${signature}`);
    } catch (confirmError: any) {
      console.error(`❌ Transaction confirmation error:`, confirmError);
      // Check if transaction was actually successful
      if (confirmError.message?.includes('timeout')) {
        try {
          await new Promise(resolve => setTimeout(resolve, 5000));
          const status = await connection.getSignatureStatus(signature);
          
          if (status.value && (status.value.confirmationStatus === 'confirmed' || status.value.confirmationStatus === 'finalized')) {
            if (!status.value.err) {
              console.log(`✅ Transaction confirmed (after timeout check): ${signature}`);
              transactionConfirmed = true;
            }
          }
        } catch (statusError) {
          console.error(`❌ Error checking transaction status:`, statusError);
        }
      }
      
      if (!transactionConfirmed) {
        throw confirmError;
      }
    }

    // Log transaction to history
    const transactionAmountReceived = amountAfterFees;
    
    try {
      console.log('💾 Recording deposit to database:', {
        sender_wallet: wallet,
        amount: originalDepositAmount,
        amount_received: transactionAmountReceived,
        fee_percentage: feePercentage,
        tx_hash: signature,
        status: 'completed',
      });
      
      const { data: insertData, error: insertError } = await supabase
        .from('zk_transactions')
        .insert({
          sender_wallet: wallet,
          recipient_wallet: wallet,
          amount: originalDepositAmount,
          amount_received: transactionAmountReceived,
          fee_percentage: feePercentage,
          token_symbol: token,
          tx_hash: signature,
          status: 'completed',
          privacy_level: 'full',
        })
        .select();
        
      if (insertError) {
        console.error('❌ Database insert error:', insertError);
      } else {
        console.log('✅ Deposit recorded successfully:', insertData);
      }
    } catch (logError: any) {
      console.error('❌ Exception logging deposit transaction:', logError);
      // Don't fail the deposit if logging fails
    }

    return res.status(200).json({
      success: true,
      signature: signature,
      message: 'Deposit processed successfully',
      amount: originalDepositAmount,
      amount_received: transactionAmountReceived,
      fee: feeAmount,
      fee_percentage: feePercentage,
    });
  } catch (error: any) {
    console.error('❌ Error processing deposit:', error);
    console.error('❌ Error stack:', error?.stack);
    
    return res.status(500).json({ 
      success: false,
      error: 'Failed to process deposit', 
      message: error?.message || 'Unknown error occurred',
    });
  }
}
