/**
 * Void402 Internal Transfer API (1:1 with Nolvipay)
 * POST /api/zk/transfer
 * 
 * Transfers funds between Void402 users internally (on-chain via Solana program)
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { 
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  Keypair,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';
import { 
  derivePoolPDA, 
  deriveUserBalancePDA,
  deriveProofPDA,
  getSolanaConnection,
  VOID402_PROGRAM_ID,
  isValidSolanaAddress,
} from '../lib/void402-solana.js';
import { getPrivacyUsdWalletPool } from '../lib/intermediate-wallet-pool.js';
import { createClient } from '@supabase/supabase-js';
import { getUSDPHolderTier, calculateFeePercentage } from '../lib/tier-service.js';
import bs58 from 'bs58';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// USDC and USDT mint addresses on Solana
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const USDT_MINT = new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB');

// Instruction discriminator for internal_transfer: [56, 217, 60, 137, 252, 221, 185, 114]
const INTERNAL_TRANSFER_DISCRIMINATOR = Buffer.from([56, 217, 60, 137, 252, 221, 185, 114]);

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

function buildInternalTransferInstruction({
  relayer,
  proof,
  senderBalance,
  recipient,
  recipientBalance,
  systemProgram,
  relayerFee,
}: {
  relayer: PublicKey;
  proof: PublicKey;
  senderBalance: PublicKey;
  recipient: PublicKey;
  recipientBalance: PublicKey;
  systemProgram: PublicKey;
  relayerFee: number;
}) {
  const feeBuffer = Buffer.allocUnsafe(8);
  const feeBigInt = BigInt(relayerFee);
  for (let i = 0; i < 8; i++) {
    feeBuffer[i] = Number((feeBigInt >> BigInt(i * 8)) & BigInt(0xff));
  }

  const instructionData = Buffer.concat([
    INTERNAL_TRANSFER_DISCRIMINATOR,
    feeBuffer,
  ]);

  return {
    programId: VOID402_PROGRAM_ID,
    keys: [
      { pubkey: relayer, isSigner: true, isWritable: true },
      { pubkey: proof, isSigner: false, isWritable: true },
      { pubkey: senderBalance, isSigner: false, isWritable: true },
      { pubkey: recipient, isSigner: false, isWritable: false },
      { pubkey: recipientBalance, isSigner: false, isWritable: true },
      { pubkey: systemProgram, isSigner: false, isWritable: false },
    ],
    data: instructionData,
  };
}

// Relayer wallet - should be stored securely in environment variable
function getRelayerKeypair(): Keypair {
  const relayerPrivateKey = process.env.RELAYER_PRIVATE_KEY;
  if (!relayerPrivateKey) {
    throw new Error('RELAYER_PRIVATE_KEY environment variable not set');
  }
  
  try {
    const privateKeyArray = JSON.parse(relayerPrivateKey);
    return Keypair.fromSecretKey(Uint8Array.from(privateKeyArray));
  } catch {
    // Try as base58 string
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
      sender_wallet,
      recipient_wallet,
      amount,
      token,
      nonce,
    } = req.body;

    if (!sender_wallet || !recipient_wallet || !amount || !token || !nonce) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (!['USDC', 'USDT'].includes(token)) {
      return res.status(400).json({ error: 'Token must be USDC or USDT' });
    }

    // CRITICAL SECURITY: Prevent self-transfers
    if (sender_wallet.toLowerCase() === recipient_wallet.toLowerCase()) {
      console.error(`❌ SECURITY: User ${sender_wallet} attempted to transfer to themselves. Blocking self-transfer.`);
      return res.status(400).json({ 
        error: 'Self-transfers are not allowed',
        message: 'You cannot transfer funds to yourself. Please use a different recipient address.'
      });
    }

    // Verify recipient exists (has deposited before)
    let recipientMapping = null;
    let recipientError = null;
    
    try {
      const result = await supabase
        .from('zk_user_wallets')
        .select('intermediate_wallet, user_wallet')
        .eq('user_wallet', recipient_wallet)
        .maybeSingle();
      
      recipientMapping = result.data;
      recipientError = result.error;
    } catch (tableError: any) {
      console.warn('zk_user_wallets table check failed, trying transactions:', tableError.message);
    }
    
    // If not found in zk_user_wallets, check transactions table as fallback
    if (!recipientMapping || recipientError) {
      try {
        const { data: transactions, error: txError } = await supabase
          .from('zk_transactions')
          .select('sender_wallet, recipient_wallet, status')
          .or(`sender_wallet.eq.${recipient_wallet},recipient_wallet.eq.${recipient_wallet}`)
          .in('status', ['confirmed', 'completed'])
          .limit(1);

        if (txError) {
          console.error('Error checking transactions table:', txError);
          return res.status(400).json({ 
            error: 'Recipient has not deposited funds on Void402 yet. They must make a deposit first to receive internal transfers.',
            exists: false,
          });
        }

        if (transactions && transactions.length > 0) {
          // Recipient has deposited but no intermediate wallet assigned
          console.warn(`⚠️ Recipient ${recipient_wallet} has deposited but no intermediate wallet assigned. Attempting to assign one...`);
          
          try {
            // First, get sender's intermediate wallet to exclude it
            const { data: senderMapping } = await supabase
              .from('zk_user_wallets')
              .select('intermediate_wallet')
              .eq('user_wallet', sender_wallet)
              .eq('token', token)
              .maybeSingle();
            
            const senderIntermediateWallet = senderMapping?.intermediate_wallet;
            
            // Get all already-assigned intermediate wallets for this token
            const { data: assignedWallets } = await supabase
              .from('zk_user_wallets')
              .select('intermediate_wallet')
              .eq('token', token);
            
            const excludedWallets = new Set<string>();
            if (senderIntermediateWallet) {
              excludedWallets.add(senderIntermediateWallet.toLowerCase());
            }
            if (assignedWallets) {
              assignedWallets.forEach((w: any) => {
                if (w.intermediate_wallet) {
                  excludedWallets.add(w.intermediate_wallet.toLowerCase());
                }
              });
            }
            
            const intermediatePool = getPrivacyUsdWalletPool();
            await intermediatePool.initialize();
            
            // Try to get an available wallet that's not already assigned
            let availableWallet = null;
            const maxAttempts = 20;
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
              const candidate = await intermediatePool.getAvailableWallet();
              if (!excludedWallets.has(candidate.publicKey.toLowerCase())) {
                availableWallet = candidate;
                break;
              }
            }
            
            if (!availableWallet) {
              console.error('Failed to find an unassigned intermediate wallet for recipient');
              return res.status(400).json({ 
                error: 'No available intermediate wallets. Please contact support.',
                exists: false,
              });
            }
            
            // Store the mapping in database
            const { data: newMapping, error: upsertError } = await supabase
              .from('zk_user_wallets')
              .upsert({
                user_wallet: recipient_wallet,
                intermediate_wallet: availableWallet.publicKey,
                token: token,
              }, {
                onConflict: 'user_wallet,token'
              })
              .select('intermediate_wallet, user_wallet')
              .single();
            
            if (upsertError || !newMapping) {
              console.error('Failed to assign intermediate wallet to recipient:', upsertError);
              return res.status(400).json({ 
                error: 'Recipient has deposited but intermediate wallet assignment failed. Please contact support.',
                exists: false,
              });
            }
            
            recipientMapping = newMapping;
            console.log(`✅ Assigned intermediate wallet ${availableWallet.publicKey} to recipient ${recipient_wallet}`);
          } catch (poolError: any) {
            console.error('Error assigning intermediate wallet from pool:', poolError);
            return res.status(400).json({ 
              error: 'Recipient has deposited but intermediate wallet assignment failed. Please contact support.',
              exists: false,
            });
          }
        } else {
          // No deposit found
          return res.status(400).json({ 
            error: 'Recipient has not deposited funds on Void402 yet. They must make a deposit first to receive internal transfers.',
            exists: false,
          });
        }
      } catch (txTableError: any) {
        console.error('Error checking transactions table:', txTableError);
        return res.status(400).json({ 
          error: 'Recipient has not deposited funds on Void402 yet. They must make a deposit first to receive internal transfers.',
          exists: false,
        });
      }
    }
    
    if (!recipientMapping || !recipientMapping.intermediate_wallet) {
      return res.status(400).json({ 
        error: 'Recipient has not deposited funds on Void402 yet. They must make a deposit first to receive internal transfers.',
        exists: false,
      });
    }

    // Get sender's intermediate wallet
    const { data: senderMapping, error: senderError } = await supabase
      .from('zk_user_wallets')
      .select('intermediate_wallet')
      .eq('user_wallet', sender_wallet)
      .eq('token', token)
      .maybeSingle();

    if (senderError || !senderMapping || !senderMapping.intermediate_wallet) {
      return res.status(400).json({ error: 'Sender has not deposited funds yet' });
    }

    // CRITICAL: If recipient has the same intermediate wallet as sender, reassign recipient a different one
    if (recipientMapping.intermediate_wallet.toLowerCase() === senderMapping.intermediate_wallet.toLowerCase()) {
      console.warn(`⚠️ Recipient ${recipient_wallet} has same intermediate wallet as sender ${sender_wallet}. Reassigning recipient...`);
      
      try {
        const { data: assignedWallets } = await supabase
          .from('zk_user_wallets')
          .select('intermediate_wallet')
          .eq('token', token);
        
        const excludedWallets = new Set<string>();
        excludedWallets.add(senderMapping.intermediate_wallet.toLowerCase());
        if (assignedWallets) {
          assignedWallets.forEach((w: any) => {
            if (w.intermediate_wallet) {
              excludedWallets.add(w.intermediate_wallet.toLowerCase());
            }
          });
        }
        
        const intermediatePool = getPrivacyUsdWalletPool();
        await intermediatePool.initialize();
        
        let availableWallet = null;
        const maxAttempts = 20;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          const candidate = await intermediatePool.getAvailableWallet();
          if (!excludedWallets.has(candidate.publicKey.toLowerCase())) {
            availableWallet = candidate;
            break;
          }
        }
        
        if (!availableWallet) {
          console.error('Failed to find an unassigned intermediate wallet for recipient reassignment');
          return res.status(400).json({ 
            error: 'No available intermediate wallets. Please contact support.',
          });
        }
        
        const { data: updatedMapping, error: updateError } = await supabase
          .from('zk_user_wallets')
          .update({
            intermediate_wallet: availableWallet.publicKey,
            updated_at: new Date().toISOString(),
          })
          .eq('user_wallet', recipient_wallet)
          .eq('token', token)
          .select('intermediate_wallet, user_wallet')
          .single();
        
        if (updateError || !updatedMapping) {
          console.error('Failed to reassign intermediate wallet to recipient:', updateError);
          return res.status(400).json({ 
            error: 'Failed to reassign intermediate wallet. Please contact support.',
          });
        }
        
        recipientMapping = updatedMapping;
        console.log(`✅ Reassigned intermediate wallet ${availableWallet.publicKey} to recipient ${recipient_wallet}`);
      } catch (reassignError: any) {
        console.error('Error reassigning intermediate wallet:', reassignError);
        return res.status(400).json({ 
          error: 'Failed to reassign intermediate wallet. Please contact support.',
        });
      }
    }

    const connection = getSolanaConnection();
    const tokenMint = token === 'USDC' ? USDC_MINT : USDT_MINT;
    const relayerKeypair = getRelayerKeypair();
    const relayerPubkey = relayerKeypair.publicKey;

    // Derive PDAs
    const poolPDA = await derivePoolPDA(tokenMint.toString());
    const recipientBalancePDA = await deriveUserBalancePDA(recipientMapping.intermediate_wallet, tokenMint.toString());
    const recipientIntermediatePubkey = new PublicKey(recipientMapping.intermediate_wallet);
    
    // Derive proof PDA and sender balance PDA
    const proofPDA = await deriveProofPDA(nonce);
    const senderBalancePDA = await deriveUserBalancePDA(senderMapping.intermediate_wallet, tokenMint.toString());

    // CRITICAL SECURITY: Prevent transfers where sender and recipient use the same intermediate wallet
    if (senderMapping.intermediate_wallet.toLowerCase() === recipientMapping.intermediate_wallet.toLowerCase()) {
      console.error(`❌ SECURITY: Sender ${sender_wallet} and recipient ${recipient_wallet} share the same intermediate wallet ${senderMapping.intermediate_wallet}. Blocking transfer.`);
      return res.status(400).json({ 
        error: 'Invalid transfer',
        message: 'Sender and recipient cannot use the same intermediate wallet. This transfer is not allowed.'
      });
    }

    // Verify recipient's intermediate wallet exists
    const intermediatePool = getPrivacyUsdWalletPool();
    await intermediatePool.initialize();
    const recipientIntermediateWallet = await intermediatePool.getWalletByPublicKey(recipientMapping.intermediate_wallet);
    
    if (!recipientIntermediateWallet) {
      return res.status(400).json({ 
        error: 'Recipient intermediate wallet not found in pool',
        exists: false,
      });
    }

    // Check if sender is verified (2FA + email)
    const { data: senderProfile } = await supabase
      .from('user_profiles')
      .select('two_factor_enabled, email_verified')
      .eq('wallet_address', sender_wallet)
      .maybeSingle();
    
    const isVerified = !!(senderProfile?.two_factor_enabled && senderProfile?.email_verified);

    // Calculate amount after fees (tier-based fee + verified discount)
    const tierInfo = await getUSDPHolderTier(sender_wallet);
    const feePercentage = calculateFeePercentage(5.0, tierInfo.tier, 'transfer', isVerified);
    const transferAmount = parseFloat(amount);
    const feeAmount = transferAmount * (feePercentage / 100);
    const amountAfterFees = transferAmount - feeAmount;

    // Build internal_transfer instruction
    const internalTransferIx = buildInternalTransferInstruction({
      relayer: relayerPubkey,
      proof: proofPDA,
      senderBalance: senderBalancePDA,
      recipient: recipientIntermediatePubkey,
      recipientBalance: recipientBalancePDA,
      systemProgram: SystemProgram.programId,
      relayerFee: 0,
    });

    // Build transaction
    const instructions: any[] = [];
    instructions.push(new TransactionInstruction(internalTransferIx));

    // Get latest blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');

    // Build transaction message
    const messageV0 = new TransactionMessage({
      payerKey: relayerPubkey,
      recentBlockhash: blockhash,
      instructions: instructions,
    }).compileToV0Message();

    const transaction = new VersionedTransaction(messageV0);

    // Sign with relayer
    transaction.sign([relayerKeypair]);

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
    await supabase.from('zk_transactions').insert({
      sender_wallet: sender_wallet,
      recipient_wallet: recipient_wallet,
      amount: transferAmount,
      amount_received: amountAfterFees,
      fee_percentage: feePercentage,
      token_symbol: token,
      tx_hash: signature,
      status: 'completed',
      privacy_level: 'full',
    });

    console.log(`✅ Internal transfer: ${sender_wallet.slice(0, 8)}... → ${recipient_wallet.slice(0, 8)}... | ${amountAfterFees} ${token} | tx: ${signature}`);

    return res.status(200).json({
      success: true,
      signature: signature,
      amount: amountAfterFees,
      fee: feeAmount,
      fee_percentage: feePercentage,
    });
  } catch (error: any) {
    console.error('Error processing internal transfer:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
