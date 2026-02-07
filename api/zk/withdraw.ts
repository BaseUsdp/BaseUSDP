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
  "http://localhost:5173",
  "http://localhost:3000",
];

function getAllowedOrigin(origin: string | undefined): string {
  if (!origin) return "https://www.void402.com";
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (origin.match(/^https:\/\/code-whisperer-33[\w-]*\.vercel\.app/)) return origin;
  return "https://www.void402.com";
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

    if (!sender_wallet || !isValidSolanaAddress(sender_wallet)) {
      return res.status(400).json({ error: 'Valid sender_wallet is required' });
    }

    if (!isValidSolanaAddress(recipient)) {
      return res.status(400).json({ error: 'Invalid recipient wallet address' });
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
