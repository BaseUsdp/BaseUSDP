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
  TransactionInstruction,
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
import { getPrivacyUsdWalletPool, IntermediateWallet } from '../lib/intermediate-wallet-pool.js';
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
  "https://baseusdp.com",
  "https://www.baseusdp.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

function getAllowedOrigin(origin: string | undefined): string {
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (origin.match(/^https:\/\/code-whisperer-33[\w-]*\.vercel\.app/)) return origin;
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
}): TransactionInstruction {
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
    const { transaction_signature, mixer_exchange_id, wallet, amount, token } = req.body;

    // Check if this is a Privacy Mixer deposit or regular deposit
    const isMixerDeposit = !!mixer_exchange_id;

    if (isMixerDeposit) {
      if (!mixer_exchange_id || !wallet || !amount || !token) {
        return res.status(400).json({ error: 'Mixer exchange ID, wallet, amount, and token are required for Privacy Mixer deposits' });
      }
    } else {
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
        message: 'You must authenticate first.'
      });
    }

    const tokenVerification = await verifyBearerToken(bearerToken, wallet);
    
    if (!tokenVerification.valid) {
      console.error(`❌ SECURITY: Invalid bearer token for process-deposit. Wallet: ${wallet}, Error: ${tokenVerification.error}`);
      return res.status(403).json({ 
        error: 'Invalid authentication',
        message: tokenVerification.error || 'Bearer token is invalid or expired.'
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
      console.log(`[Process Deposit] No intermediate wallet found for ${wallet}, auto-assigning for ${token}...`);
      
      const intermediatePool = getPrivacyUsdWalletPool();
      await intermediatePool.initialize();
      
      const { data: assignedWallets } = await supabase
        .from('zk_user_wallets')
        .select('intermediate_wallet')
        .not('intermediate_wallet', 'is', null);
      
      const assignedWalletSet = new Set((assignedWallets || []).map((w: any) => w.intermediate_wallet));
      
      let intermediateWallet: IntermediateWallet | null = null;
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
      
      if (!intermediateWallet) {
        const allWallets = intermediatePool.getAllWallets();
        if (allWallets.length === 0) {
          return res.status(500).json({ error: 'No intermediate wallets available' });
        }
        const sorted = [...allWallets].sort((a, b) => {
          if (!a.lastUsed && !b.lastUsed) return 0;
          if (!a.lastUsed) return -1;
          if (!b.lastUsed) return 1;
          return a.lastUsed.getTime() - b.lastUsed.getTime();
        });
        intermediateWallet = sorted[0];
      }
      
      intermediateWalletPublicKey = intermediateWallet.publicKey;
      
      const { error: insertError } = await supabase
        .from('zk_user_wallets')
        .insert({
          user_wallet: wallet,
          intermediate_wallet: intermediateWalletPublicKey,
          token: token,
        });

      if (insertError) {
        const { data: existingMapping } = await supabase
          .from('zk_user_wallets')
          .select('intermediate_wallet')
          .eq('user_wallet', wallet)
          .maybeSingle();
        
        if (existingMapping) {
          intermediateWalletPublicKey = existingMapping.intermediate_wallet;
        } else {
          return res.status(500).json({ error: 'Failed to assign intermediate wallet' });
        }
      }
    } else {
      intermediateWalletPublicKey = walletMapping.intermediate_wallet;
    }

    // Determine source wallet
    let sourceKeypair: Keypair;
    let sourcePubkey: PublicKey;
    let sourceWalletName: string;
    let mixerBalanceBeforeTransfer: bigint | null = null;
    
    if (isMixerDeposit) {
      const mixerWithdrawalAddress = process.env.MIXER_WITHDRAWAL_WALLET_ADDRESS;
      const mixerWithdrawalPrivateKey = process.env.MIXER_WITHDRAWAL_WALLET_PRIVATE_KEY;
      
      if (!mixerWithdrawalAddress || !mixerWithdrawalPrivateKey) {
        throw new Error('MIXER_WITHDRAWAL_WALLET_ADDRESS and MIXER_WITHDRAWAL_WALLET_PRIVATE_KEY not set');
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
      
      await supabase
        .from('zk_user_wallets')
        .update({ mixer_exchange_id, mixer_status: 'processing' })
        .eq('user_wallet', wallet)
        .eq('token', token);
    } else {
      const collectionWalletAddress = process.env.COLLECTION_WALLET_ADDRESS || process.env.COLLECTION_WALLET;
      const collectionWalletPrivateKey = process.env.COLLECTION_WALLET_PRIVATE_KEY;
      
      if (!collectionWalletAddress || !collectionWalletPrivateKey) {
        throw new Error('COLLECTION_WALLET_ADDRESS and COLLECTION_WALLET_PRIVATE_KEY not set');
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

    const intermediateKeypair = Keypair.fromSecretKey(Uint8Array.from(intermediateWallet.privateKey));
    const intermediatePubkey = intermediateKeypair.publicKey;

    // Derive PDAs
    const poolPDA = await derivePoolPDA(tokenMint.toBase58());
    const userBalancePDA = await deriveUserBalancePDA(intermediateWallet.publicKey, tokenMint.toBase58());

    // Get associated token accounts
    const sourceTokenAccount = await getAssociatedTokenAddress(tokenMint, sourcePubkey);
    const intermediateTokenAccount = await getAssociatedTokenAddress(tokenMint, intermediatePubkey);
    const poolTokenAccount = await getAssociatedTokenAddress(tokenMint, poolPDA, true);

    // =========================================================================
    // CHANGENOW API LOGIC (1:1 with Nolvipay)
    // =========================================================================
    let actualReceivedAmount: number | null = null;
    
    if (isMixerDeposit) {
      // Query ChangeNow API to get actual amount received
      try {
        const CHANGENOW_API_KEY = process.env.CHANGENOW_API_KEY;
        const CHANGENOW_BASE_URL = 'https://api.changenow.io/v1';
        
        if (CHANGENOW_API_KEY) {
          console.log(`🔍 PRIVACY MIXER: Querying ChangeNow API for exchange ${mixer_exchange_id}...`);
          
          const changenowResponse = await fetch(`${CHANGENOW_BASE_URL}/transactions/${mixer_exchange_id}/${CHANGENOW_API_KEY}`, {
            method: 'GET',
            headers: {
              'User-Agent': 'Void402/1.0',
              'Accept': 'application/json',
            },
          });
          
          if (changenowResponse.ok) {
            const changenowData = await changenowResponse.json();
            console.log(`📋 PRIVACY MIXER: ChangeNow API response:`, JSON.stringify(changenowData, null, 2));
            
            const amountReceive = changenowData.amountReceive;
            const expectedReceiveAmount = changenowData.expectedReceiveAmount;
            
            console.log(`💰 PRIVACY MIXER: amountSend: ${changenowData.amountSend}, amountReceive: ${amountReceive}, expectedReceiveAmount: ${expectedReceiveAmount}`);
            
            if (amountReceive && parseFloat(amountReceive) > 0) {
              actualReceivedAmount = parseFloat(amountReceive);
              console.log(`💰 PRIVACY MIXER: Using amountReceive: ${actualReceivedAmount.toFixed(6)} ${token}`);
            } else if (expectedReceiveAmount && parseFloat(expectedReceiveAmount) > 0) {
              actualReceivedAmount = parseFloat(expectedReceiveAmount);
              console.log(`💰 PRIVACY MIXER: Using expectedReceiveAmount: ${actualReceivedAmount.toFixed(6)} ${token}`);
            }
          } else {
            console.warn(`⚠️ PRIVACY MIXER: ChangeNow API failed. Status: ${changenowResponse.status}`);
          }
        }
      } catch (error: any) {
        console.error(`❌ Error querying ChangeNow API:`, error);
      }
      
      // Verify funds have arrived in mixer wallet
      const expectedAmountLamports = BigInt(Math.floor(parseFloat(amount) * 1_000_000));
      const minExpectedAmount = expectedAmountLamports - (expectedAmountLamports / BigInt(20)); // 5% variance
      
      let mixerWalletBalance = BigInt(0);
      let fundsArrived = false;
      const maxRetries = 12;
      let retryCount = 0;
      
      console.log(`🔍 PRIVACY MIXER: Verifying funds in mixer wallet...`);
      console.log(`   Expected: ${(Number(expectedAmountLamports) / 1_000_000).toFixed(6)} ${token}`);
      console.log(`   Minimum: ${(Number(minExpectedAmount) / 1_000_000).toFixed(6)} ${token}`);
      
      while (!fundsArrived && retryCount < maxRetries) {
        try {
          const sourceAccount = await getAccount(connection, sourceTokenAccount);
          mixerWalletBalance = sourceAccount.amount;
          
          console.log(`   Balance: ${(Number(mixerWalletBalance) / 1_000_000).toFixed(6)} ${token} (attempt ${retryCount + 1}/${maxRetries})`);
          
          if (mixerWalletBalance >= minExpectedAmount) {
            fundsArrived = true;
            console.log(`✅ PRIVACY MIXER: Funds confirmed!`);
            break;
          } else {
            console.log(`⏳ Waiting 5s...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            retryCount++;
          }
        } catch (error: any) {
          if (error.name === 'TokenAccountNotFoundError' || error.message?.includes('AccountNotFound')) {
            console.log(`⏳ Token account doesn't exist yet. Waiting 5s...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            retryCount++;
          } else {
            throw error;
          }
        }
      }
      
      if (!fundsArrived) {
        return res.status(400).json({ 
          error: 'Funds not yet arrived in mixer wallet',
          message: `Funds have not arrived after ${maxRetries * 5} seconds. Please try again.`,
          details: {
            mixerWallet: sourcePubkey.toString(),
            expectedAmount: (Number(expectedAmountLamports) / 1_000_000).toFixed(6),
            currentBalance: (Number(mixerWalletBalance) / 1_000_000).toFixed(6),
            exchangeId: mixer_exchange_id
          }
        });
      }
      
      // Use actual balance if ChangeNow API didn't provide amount
      if (actualReceivedAmount === null && mixerWalletBalance > BigInt(0)) {
        actualReceivedAmount = Number(mixerWalletBalance) / 1_000_000;
        console.log(`💰 PRIVACY MIXER: Using mixer wallet balance: ${actualReceivedAmount.toFixed(6)} ${token}`);
      }
      
      mixerBalanceBeforeTransfer = mixerWalletBalance;
    }

    // Use actual received amount or original amount
    let baseAmount = actualReceivedAmount !== null ? actualReceivedAmount : parseFloat(amount);
    const originalDepositAmount = parseFloat(amount);
    
    // For mixer deposits, ensure we don't transfer more than available
    if (isMixerDeposit) {
      try {
        const sourceAccount = await getAccount(connection, sourceTokenAccount);
        const actualMixerBalance = Number(sourceAccount.amount) / 1_000_000;
        
        if (baseAmount > actualMixerBalance) {
          console.log(`⚠️ PRIVACY MIXER: Adjusting amount from ${baseAmount.toFixed(6)} to ${actualMixerBalance.toFixed(6)} ${token}`);
          baseAmount = actualMixerBalance;
        }
      } catch (error: any) {
        console.warn(`⚠️ Could not verify mixer wallet balance:`, error);
      }
    }
    
    // No platform fee on deposits — users get the full amount from ChangeNow
    const tierInfo = await getUSDPHolderTier(wallet);
    const feePercentage = 0;
    const feeAmount = 0;
    const amountAfterFees = baseAmount;
    
    if (isMixerDeposit && actualReceivedAmount !== null) {
      const changeNowFee = originalDepositAmount - actualReceivedAmount;
      console.log(`💰 PRIVACY MIXER FEE BREAKDOWN:`);
      console.log(`   Original: ${originalDepositAmount.toFixed(6)} ${token}`);
      console.log(`   ChangeNow fee: ${changeNowFee.toFixed(6)} ${token}`);
      console.log(`   Received: ${actualReceivedAmount.toFixed(6)} ${token}`);
      console.log(`   Our fee (Tier ${tierInfo.tier}): ${feeAmount.toFixed(6)} ${token} (${feePercentage}%)`);
      console.log(`   Final: ${amountAfterFees.toFixed(6)} ${token}`);
    } else {
      console.log(`💰 Deposit fee (Tier ${tierInfo.tier}): ${baseAmount} - ${feeAmount.toFixed(6)} (${feePercentage}%) = ${amountAfterFees.toFixed(6)} ${token}`);
    }
    
    const amountLamports = BigInt(Math.floor(amountAfterFees * 1_000_000));

    // Check balances and account existence
    const intermediateSolBalance = await connection.getBalance(intermediatePubkey);
    
    let userBalanceExists = false;
    try {
      const info = await connection.getAccountInfo(userBalancePDA);
      if (info && info.owner.equals(VOID402_PROGRAM_ID)) userBalanceExists = true;
    } catch {}
    
    let poolExists = false;
    try {
      const info = await connection.getAccountInfo(poolPDA);
      if (info && info.owner.equals(VOID402_PROGRAM_ID)) poolExists = true;
    } catch {}
    
    const SYSTEM_ACCOUNT_RENT = await connection.getMinimumBalanceForRentExemption(0);
    const ASSOCIATED_TOKEN_ACCOUNT_RENT = await connection.getMinimumBalanceForRentExemption(165);
    
    let intermediateAccountExists = false;
    try {
      await connection.getTokenAccountBalance(intermediateTokenAccount);
      intermediateAccountExists = true;
    } catch {}
    
    // Check source wallet balance
    const sourceBalance = await connection.getBalance(sourcePubkey);
    const MIN_SOURCE_BALANCE_NEEDED = 50_000 + (intermediateAccountExists ? 0 : ASSOCIATED_TOKEN_ACCOUNT_RENT) + (SYSTEM_ACCOUNT_RENT * 2);
    
    if (sourceBalance < MIN_SOURCE_BALANCE_NEEDED) {
      return res.status(400).json({ 
        error: `${sourceWalletName} has insufficient SOL`,
        details: {
          currentBalance: sourceBalance / 1e9,
          required: MIN_SOURCE_BALANCE_NEEDED / 1e9,
        }
      });
    }
    
    // Check if we can close source account
    let shouldCloseSourceAccount = false;
    try {
      const sourceAccount = await getAccount(connection, sourceTokenAccount);
      if (sourceAccount.amount === amountLamports) {
        shouldCloseSourceAccount = true;
      }
    } catch {}

    // Build transaction
    const instructions: TransactionInstruction[] = [];

    if (!intermediateAccountExists) {
      instructions.push(
        createAssociatedTokenAccountInstruction(sourcePubkey, intermediateTokenAccount, intermediatePubkey, tokenMint)
      );
    }

    instructions.push(
      createTransferInstruction(sourceTokenAccount, intermediateTokenAccount, sourcePubkey, amountLamports)
    );

    if (shouldCloseSourceAccount) {
      instructions.push(
        createCloseAccountInstruction(sourceTokenAccount, sourcePubkey, sourcePubkey, [])
      );
    }

    try {
      await connection.getTokenAccountBalance(poolTokenAccount);
    } catch {
      instructions.push(
        createAssociatedTokenAccountInstruction(sourcePubkey, poolTokenAccount, poolPDA, tokenMint)
      );
    }

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

    // Return excess SOL from intermediate wallet
    const MIN_BUFFER = SYSTEM_ACCOUNT_RENT + 150_000;
    if (intermediateSolBalance > MIN_BUFFER) {
      const solToReturn = intermediateSolBalance - MIN_BUFFER;
      if (solToReturn > 0) {
        instructions.push(
          SystemProgram.transfer({
            fromPubkey: intermediatePubkey,
            toPubkey: sourcePubkey,
            lamports: solToReturn,
          })
        );
      }
    }

    // Build and sign transaction
    console.log(`📝 Building transaction: ${instructions.length} instructions`);
    
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
    const txMessage = new TransactionMessage({
      payerKey: sourcePubkey,
      recentBlockhash: blockhash,
      instructions: instructions,
    }).compileToLegacyMessage();

    const transaction = new VersionedTransaction(txMessage);
    transaction.sign([sourceKeypair, intermediateKeypair]);

    // Send transaction
    console.log(`📤 Sending transaction...`);
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });
    console.log(`✅ Transaction sent: ${signature}`);

    // Wait for confirmation
    try {
      await Promise.race([
        connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 90000))
      ]);
      console.log(`✅ Transaction confirmed: ${signature}`);
    } catch (confirmError: any) {
      if (confirmError.message?.includes('Timeout')) {
        const status = await connection.getSignatureStatus(signature);
        if (status.value && !status.value.err) {
          console.log(`✅ Transaction confirmed (after timeout check): ${signature}`);
        } else {
          throw confirmError;
        }
      } else {
        throw confirmError;
      }
    }

    // Log transaction to database
    try {
      // Try with all columns first
      const { error: insertError } = await supabase.from('zk_transactions').insert({
        sender_wallet: wallet,
        recipient_wallet: wallet,
        amount: originalDepositAmount,
        fee_percentage: feePercentage,
        token_symbol: token,
        tx_hash: signature,
        status: 'completed',
        privacy_level: 'full',
        transaction_type: 'deposit',
      });
      if (insertError) {
        console.warn(`⚠️ Full insert failed (${insertError.message}), trying minimal insert...`);
        const { error: minimalError } = await supabase.from('zk_transactions').insert({
          sender_wallet: wallet,
          recipient_wallet: wallet,
          amount: originalDepositAmount,
          token_symbol: token,
          tx_hash: signature,
          status: 'completed',
          privacy_level: 'full',
          transaction_type: 'deposit',
        });
        if (minimalError) {
          console.error('❌ Minimal insert also failed:', minimalError.message);
        } else {
          console.log(`✅ Deposit logged (minimal) to database: ${originalDepositAmount} ${token}`);
        }
      } else {
        console.log(`✅ Deposit logged to database: ${originalDepositAmount} ${token} (fee: ${feePercentage}%, after fees: ${amountAfterFees})`);
      }
    } catch (logError: any) {
      console.error('❌ Error logging deposit:', logError);
    }

    return res.status(200).json({
      success: true,
      signature: signature,
      message: 'Deposit processed successfully',
      amount: originalDepositAmount,
      amount_received: amountAfterFees,
      fee: feeAmount,
      fee_percentage: feePercentage,
    });
  } catch (error: any) {
    console.error('❌ Error processing deposit:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to process deposit', 
      message: error?.message || 'Unknown error',
    });
  }
}
