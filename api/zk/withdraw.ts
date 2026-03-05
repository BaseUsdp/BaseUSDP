/**
 * Void402 Withdraw API (1:1 with Nolvipay's external_transfer)
 * POST /api/zk/withdraw
 * 
 * Relayer service that submits external transfer transactions.
 * Moves funds from the private pool to an external wallet (withdrawal).
 * This hides the sender's wallet address from the blockchain.
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
} from '@solana/spl-token';
import { 
  getSolanaConnection,
  deriveProofPDA,
  deriveUserBalancePDA,
  derivePoolPDA,
  isValidSolanaAddress,
  VOID402_PROGRAM_ID,
} from '../lib/void402-solana.js';
import { getPrivacyUsdWalletPool } from '../lib/intermediate-wallet-pool.js';
import { extractBearerToken, verifyBearerToken } from '../lib/bearer-auth.js';
import { createClient } from '@supabase/supabase-js';
import { getUSDPHolderTier, calculateFeePercentage } from '../lib/tier-service.js';
import bs58 from 'bs58';
import { isBaseChain } from '../lib/chain-config.js';
import { isValidBaseAddress, getPrivacyPoolContract, getUsdcAddress, getTokenAddress, parseUsdc } from '../lib/void402-base.js';
import { generatePrivacyNonce, getProofId, generateMockProof } from '../lib/privacy-utils-base.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// Token mint addresses
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const USDT_MINT = new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB');

// Instruction discriminator for external_transfer: [11, 179, 85, 190, 61, 53, 105, 169]
const EXTERNAL_TRANSFER_DISCRIMINATOR = Buffer.from([11, 179, 85, 190, 61, 53, 105, 169]);

const ALLOWED_ORIGINS = [
  "https://void402.com",
  "https://www.void402.com",
  "https://baseusdp.com",
  "https://www.baseusdp.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

function getAllowedOrigin(origin: string | undefined): string {
  if (!origin) return "https://www.baseusdp.com";
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (origin.match(/^https:\/\/code-whisperer-33[\w-]*\.vercel\.app/)) return origin;
  return "https://www.baseusdp.com";
}

function buildExternalTransferInstruction({
  sender,
  proof,
  senderBalance,
  pool,
  tokenMint,
  poolTokenAccount,
  recipientTokenAccount,
  tokenProgram,
  relayerFee,
}: {
  sender: PublicKey;
  proof: PublicKey;
  senderBalance: PublicKey;
  pool: PublicKey;
  tokenMint: PublicKey;
  poolTokenAccount: PublicKey;
  recipientTokenAccount: PublicKey;
  tokenProgram: PublicKey;
  relayerFee: number;
}) {
  // Encode relayer_fee (u64, 8 bytes) ONLY
  // Note: external_transfer does NOT take nonce as an argument - it reads it from the proof account
  const feeBuffer = Buffer.allocUnsafe(8);
  const feeBigInt = BigInt(relayerFee);
  for (let i = 0; i < 8; i++) {
    feeBuffer[i] = Number((feeBigInt >> BigInt(i * 8)) & BigInt(0xff));
  }

  const instructionData = Buffer.concat([
    EXTERNAL_TRANSFER_DISCRIMINATOR,
    feeBuffer,
  ]);

  return {
    programId: VOID402_PROGRAM_ID,
    keys: [
      { pubkey: sender, isSigner: true, isWritable: true },
      { pubkey: proof, isSigner: false, isWritable: true },
      { pubkey: senderBalance, isSigner: false, isWritable: true },
      { pubkey: pool, isSigner: false, isWritable: true },
      { pubkey: tokenMint, isSigner: false, isWritable: false },
      { pubkey: poolTokenAccount, isSigner: false, isWritable: true },
      { pubkey: recipientTokenAccount, isSigner: false, isWritable: true },
      { pubkey: tokenProgram, isSigner: false, isWritable: false },
    ],
    data: instructionData,
  };
}

// Get relayer keypair from environment
function getRelayerKeypair(): Keypair {
  const relayerPrivateKey = process.env.RELAYER_PRIVATE_KEY;
  if (!relayerPrivateKey) {
    throw new Error('RELAYER_PRIVATE_KEY environment variable not set');
  }
  
  try {
    const privateKeyArray = JSON.parse(relayerPrivateKey);
    return Keypair.fromSecretKey(Uint8Array.from(privateKeyArray));
  } catch {
    return Keypair.fromSecretKey(bs58.decode(relayerPrivateKey));
  }
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
    const { 
      nonce,
      recipient,
      sender_wallet,
      token,
      amount,
    } = req.body;

    if (!nonce || nonce === undefined) {
      return res.status(400).json({ error: 'Nonce is required' });
    }

    if (!recipient) {
      return res.status(400).json({ error: 'Recipient is required' });
    }

    if (!sender_wallet) {
      return res.status(400).json({ error: 'sender_wallet is required' });
    }

    if (!['USDC', 'USDT'].includes(token)) {
      return res.status(400).json({ error: 'Token must be USDC or USDT' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    // Require authentication
    const bearerToken = extractBearerToken(req);
    if (!bearerToken) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const tokenVerification = await verifyBearerToken(bearerToken, sender_wallet);
    if (!tokenVerification.valid) {
      return res.status(403).json({ error: 'Invalid authentication' });
    }

    // ================================================================
    // BASE CHAIN: Withdraw via X402PrivacyPool contract
    // ================================================================
    if (isBaseChain()) {
      if (!isValidBaseAddress(sender_wallet)) {
        return res.status(400).json({ error: 'Invalid sender Base address' });
      }
      if (!isValidBaseAddress(recipient)) {
        return res.status(400).json({ error: 'Invalid recipient Base address' });
      }

      const tokenAddress = getTokenAddress(token);

      // Check ALL intermediate wallets in the pool for sufficient on-chain balance
      const { getBaseIntermediateWalletPool } = await import('../lib/intermediate-wallet-pool-base.js');
      const { ethers: ethersLib } = await import('ethers');
      const { getBaseProvider } = await import('../lib/void402-base.js');
      const provider = getBaseProvider();

      const basePool = getBaseIntermediateWalletPool();
      await basePool.initialize();

      const amountInUnits = parseUsdc(amount.toString());
      let intWalletData: any = null;
      const readonlyPool = getPrivacyPoolContract(provider as any);
      const allWallets = basePool.getAllWallets();
      for (const candidate of allWallets) {
        try {
          const [available] = await readonlyPool.getUserBalance(candidate.address, tokenAddress);
          console.log(`[Base Withdraw] Intermediate ${candidate.address.slice(0,10)}... pool balance: ${available.toString()}`);
          if (available >= amountInUnits) {
            intWalletData = candidate;
            break;
          }
        } catch (e: any) {
          console.warn(`[Base Withdraw] Balance check failed for ${candidate.address}: ${e.message}`);
        }
      }

      if (!intWalletData) {
        return res.status(400).json({ error: 'Insufficient pool balance. No intermediate wallet has enough funds.' });
      }

      // Fund intermediate with ETH for gas if needed
      const intEthBalance = await provider.getBalance(intWalletData.address);
      const ethNeeded = ethersLib.parseEther("0.002");
      if (intEthBalance < ethNeeded) {
        const fundAmount = ethNeeded - intEthBalance;
        let funded = false;
        const funderKeys = [
          { name: 'collection', key: process.env.COLLECTION_WALLET_PRIVATE_KEY_BASE },
          { name: 'mixer', key: process.env.MIXER_WITHDRAWAL_WALLET_PRIVATE_KEY_BASE },
        ];
        for (const { name, key } of funderKeys) {
          if (!key || funded) continue;
          try {
            const funder = new ethersLib.Wallet(key, provider);
            const funderBalance = await provider.getBalance(funder.address);
            const estimatedGas = ethersLib.parseEther("0.00015");
            if (funderBalance < fundAmount + estimatedGas) {
              console.warn(`[Base Withdraw] ⚠️ ${name} wallet (${funder.address.slice(0, 10)}...) insufficient ETH: ${ethersLib.formatEther(funderBalance)}`);
              continue;
            }
            const fundTx = await funder.sendTransaction({ to: intWalletData.address, value: fundAmount });
            await fundTx.wait();
            console.log(`[Base Withdraw] Funded intermediate with ${ethersLib.formatEther(fundAmount)} ETH from ${name} wallet: ${fundTx.hash}`);
            funded = true;
          } catch (fundErr: any) {
            console.warn(`[Base Withdraw] ⚠️ Failed to fund from ${name} wallet: ${fundErr.message}`);
          }
        }
        if (!funded) {
          console.error('[Base Withdraw] Cannot fund intermediate with ETH - all funder wallets depleted');
        }
      }

      // Use intermediate wallet as signer (it has the pool balance)
      const intSigner = new ethersLib.Wallet(intWalletData.privateKey, provider);
      const privacyPoolContract = getPrivacyPoolContract(intSigner);

      // Calculate fees: 1% withdraw + 0.5% pool + relayer fee
      const withdrawFeePercent = 1.0;
      const poolFeePercent = 0.5;
      const totalFeePercent = withdrawFeePercent + poolFeePercent;
      const feeAmount = amount * (totalFeePercent / 100);
      const amountAfterFees = amount - feeAmount;
      const relayerFeeInUnits = parseUsdc(feeAmount.toString());

      // Generate nonce and proof
      const privacyNonce = generatePrivacyNonce(sender_wallet);
      const proofId = getProofId(privacyNonce);
      const { proofBytes, commitmentBytes, blindingFactorBytes } = generateMockProof(
        sender_wallet,
        amountInUnits,
        privacyNonce,
      );

      // STEP 1: Upload proof (from intermediate wallet which has pool balance)
      console.log(`[Base Withdraw] Uploading proof for nonce ${privacyNonce}...`);
      const uploadTx = await privacyPoolContract.uploadProof(
        privacyNonce,
        amountInUnits,
        tokenAddress,
        proofBytes,
        commitmentBytes,
        blindingFactorBytes,
      );
      const uploadReceipt = await uploadTx.wait();
      console.log(`[Base Withdraw] Proof uploaded: ${uploadReceipt.hash}`);

      // STEP 2: External transfer (withdrawal)
      console.log(`[Base Withdraw] Executing external transfer...`);
      const withdrawTx = await privacyPoolContract.externalTransfer(
        proofId,
        recipient,
        relayerFeeInUnits,
      );
      const withdrawReceipt = await withdrawTx.wait();
      const signature = withdrawReceipt.hash;
      console.log(`[Base Withdraw] Withdrawal complete: ${signature}`);

      // Log to database
      const isWithdrawal = sender_wallet.toLowerCase() === recipient.toLowerCase();
      const transactionType = isWithdrawal ? 'withdraw' : 'transfer';

      try {
        await supabase!.from('zk_transactions').insert({
          sender_wallet: sender_wallet,
          recipient_wallet: recipient,
          amount: amount,
          fee_percentage: totalFeePercent,
          token_symbol: token,
          tx_hash: signature,
          status: 'completed',
          privacy_level: 'full',
          transaction_type: transactionType,
        });
      } catch (logErr: any) {
        console.warn(`Failed to log Base withdrawal:`, logErr.message);
      }

      console.log(`Base ${transactionType}: ${sender_wallet.slice(0, 8)}... -> ${recipient.slice(0, 8)}... | ${amountAfterFees} ${token} | tx: ${signature}`);

      return res.status(200).json({
        success: true,
        signature: signature,
        amount: amount,
        amount_received: amountAfterFees,
        fee: feeAmount,
        fee_percentage: totalFeePercent,
      });
    }

    // ================================================================
    // SOLANA CHAIN: Existing Solana withdrawal logic below
    // ================================================================
    if (!isValidSolanaAddress(sender_wallet)) {
      return res.status(400).json({ error: 'Valid sender_wallet is required' });
    }

    if (!isValidSolanaAddress(recipient)) {
      return res.status(400).json({ error: 'Invalid recipient wallet address' });
    }

    const connection = getSolanaConnection();
    const tokenMint = token === 'USDC' ? USDC_MINT : USDT_MINT;
    const recipientPubkey = new PublicKey(recipient);

    // Get relayer keypair
    const relayerKeypair = getRelayerKeypair();
    const relayerPubkey = relayerKeypair.publicKey;

    // Check relayer balance
    const MIN_RELAYER_BALANCE = 200_000; // 0.0002 SOL minimum
    const relayerBalance = await connection.getBalance(relayerPubkey);
    
    if (relayerBalance < MIN_RELAYER_BALANCE) {
      console.error(`❌ CRITICAL: Relayer wallet balance too low!`);
      return res.status(500).json({ 
        error: 'Relayer wallet balance too low',
        details: {
          currentBalance: relayerBalance / 1e9,
          minimumRequired: MIN_RELAYER_BALANCE / 1e9,
        }
      });
    }

    // Get user's intermediate wallet
    const { data: walletMapping, error: dbError } = await supabase
      .from('zk_user_wallets')
      .select('intermediate_wallet')
      .eq('user_wallet', sender_wallet)
      .maybeSingle();

    if (dbError || !walletMapping || !walletMapping.intermediate_wallet) {
      return res.status(400).json({ error: 'No deposit found. You must deposit funds first.' });
    }

    // Get intermediate wallet keypair
    const intermediatePool = getPrivacyUsdWalletPool();
    await intermediatePool.initialize();
    const intermediateWallet = await intermediatePool.getWalletByPublicKey(walletMapping.intermediate_wallet);
    
    if (!intermediateWallet) {
      return res.status(400).json({ error: 'Intermediate wallet not found in pool' });
    }

    const intermediateKeypair = Keypair.fromSecretKey(Uint8Array.from(intermediateWallet.privateKey));
    const intermediatePubkey = intermediateKeypair.publicKey;

    // Derive PDAs
    const nonceNumber = typeof nonce === 'string' ? parseInt(nonce, 10) : Number(nonce);
    const proofPDA = await deriveProofPDA(nonceNumber);
    const poolPDA = await derivePoolPDA(tokenMint.toString());
    const senderBalancePDA = await deriveUserBalancePDA(walletMapping.intermediate_wallet, tokenMint.toString());

    // Get token accounts
    const poolTokenAccount = await getAssociatedTokenAddress(tokenMint, poolPDA, true);
    const recipientTokenAccount = await getAssociatedTokenAddress(tokenMint, recipientPubkey);

    // Calculate fees
    const tierInfo = await getUSDPHolderTier(sender_wallet);
    const feePercentage = calculateFeePercentage(5.0, tierInfo.tier, 'withdraw');
    const feeAmount = amount * (feePercentage / 100);
    const amountAfterFees = amount - feeAmount;

    // Check if recipient token account exists
    let recipientAccountExists = false;
    try {
      await connection.getTokenAccountBalance(recipientTokenAccount);
      recipientAccountExists = true;
    } catch {}

    // Build instructions
    const instructions: TransactionInstruction[] = [];

    // Create recipient ATA if needed
    if (!recipientAccountExists) {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          relayerPubkey,
          recipientTokenAccount,
          recipientPubkey,
          tokenMint
        )
      );
    }

    // Build external transfer instruction
    const externalTransferIx = buildExternalTransferInstruction({
      sender: intermediatePubkey,
      proof: proofPDA,
      senderBalance: senderBalancePDA,
      pool: poolPDA,
      tokenMint: tokenMint,
      poolTokenAccount: poolTokenAccount,
      recipientTokenAccount: recipientTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
      relayerFee: 0,
    });

    instructions.push(new TransactionInstruction(externalTransferIx));

    // Build and sign transaction
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
    const txMessage = new TransactionMessage({
      payerKey: relayerPubkey,
      recentBlockhash: blockhash,
      instructions: instructions,
    }).compileToV0Message();

    const transaction = new VersionedTransaction(txMessage);
    transaction.sign([relayerKeypair, intermediateKeypair]);

    // Send transaction
    const signature = await connection.sendTransaction(transaction, {
      skipPreflight: false,
      maxRetries: 3,
    });

    // Wait for confirmation
    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');

    // Log transaction
    const isWithdrawal = sender_wallet === recipient;
    const transactionType = isWithdrawal ? 'withdraw' : 'transfer';

    try {
      const { error: insertError } = await supabase.from('zk_transactions').insert({
        sender_wallet: sender_wallet,
        recipient_wallet: recipient,
        amount: amount,
        fee_percentage: feePercentage,
        token_symbol: token,
        tx_hash: signature,
        status: 'completed',
        privacy_level: 'full',
        transaction_type: transactionType,
      });
      if (insertError) {
        console.warn(`⚠️ Full insert failed (${insertError.message}), trying minimal insert...`);
        const { error: minimalError } = await supabase.from('zk_transactions').insert({
          sender_wallet: sender_wallet,
          recipient_wallet: recipient,
          amount: amount,
          token_symbol: token,
          tx_hash: signature,
          status: 'completed',
          privacy_level: 'full',
          transaction_type: transactionType,
        });
        if (minimalError) {
          console.error('❌ Minimal insert also failed:', minimalError.message);
        } else {
          console.log(`✅ Withdrawal logged (minimal) to database`);
        }
      }
    } catch (logError: any) {
      console.error('❌ Error logging withdrawal:', logError);
    }

    console.log(`✅ ${transactionType}: ${sender_wallet.slice(0, 8)}... → ${recipient.slice(0, 8)}... | ${amountAfterFees} ${token} | tx: ${signature}`);

    return res.status(200).json({
      success: true,
      signature: signature,
      amount: amount,
      amount_received: amountAfterFees,
      fee: feeAmount,
      fee_percentage: feePercentage,
    });
  } catch (error: any) {
    console.error('❌ Error processing withdrawal:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Withdrawal failed', 
      message: error?.message || 'Unknown error',
    });
  }
}
