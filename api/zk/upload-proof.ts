/**
 * Void402 Upload Proof API (1:1 with Nolvipay)
 * POST /api/zk/upload-proof
 * 
 * Creates transaction to upload zero-knowledge proof for withdrawals.
 * This creates an on-chain proof account that authorizes the withdrawal.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  SystemProgram,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  Keypair,
} from '@solana/web3.js';
import {
  getSolanaConnection,
  deriveProofPDA,
  isValidSolanaAddress,
  VOID402_PROGRAM_ID,
} from '../lib/void402-solana.js';
import { isBaseChain } from '../lib/chain-config.js';
import { isValidBaseAddress, getBaseSigner, getPrivacyPoolContract, getUsdcAddress, parseUsdc } from '../lib/void402-base.js';
import { generatePrivacyNonce, getProofId, generateMockProof } from '../lib/privacy-utils-base.js';
import { getPrivacyUsdWalletPool } from '../lib/intermediate-wallet-pool.js';
import { extractBearerToken, verifyBearerToken } from '../lib/bearer-auth.js';
import { createClient } from '@supabase/supabase-js';
import bs58 from 'bs58';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// USDC and USDT mint addresses on Solana
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const USDT_MINT = new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB');

// Instruction discriminator for upload_proof: [57, 235, 171, 213, 237, 91, 79, 2]
const UPLOAD_PROOF_DISCRIMINATOR = Buffer.from([57, 235, 171, 213, 237, 91, 79, 2]);

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

function buildUploadProofInstruction({
  sender,
  proof,
  tokenMint,
  nonce,
  amount,
  proofBytes,
  commitmentBytes,
  blindingFactorBytes,
}: {
  sender: PublicKey;
  proof: PublicKey;
  tokenMint: PublicKey;
  nonce: number;
  amount: number;
  proofBytes: Buffer;
  commitmentBytes: Buffer;
  blindingFactorBytes: Buffer;
}) {
  // Encode nonce (u64, 8 bytes)
  const nonceBuffer = Buffer.allocUnsafe(8);
  const nonceBigInt = BigInt(nonce);
  for (let i = 0; i < 8; i++) {
    nonceBuffer[i] = Number((nonceBigInt >> BigInt(i * 8)) & BigInt(0xff));
  }

  // Encode amount (u64, 8 bytes)
  const amountBuffer = Buffer.allocUnsafe(8);
  const amountBigInt = BigInt(amount);
  for (let i = 0; i < 8; i++) {
    amountBuffer[i] = Number((amountBigInt >> BigInt(i * 8)) & BigInt(0xff));
  }

  // Encode Vec<u8> fields (4 bytes length + data)
  const proofLengthBuffer = Buffer.allocUnsafe(4);
  proofLengthBuffer.writeUInt32LE(proofBytes.length, 0);

  const commitmentLengthBuffer = Buffer.allocUnsafe(4);
  commitmentLengthBuffer.writeUInt32LE(commitmentBytes.length, 0);

  const blindingLengthBuffer = Buffer.allocUnsafe(4);
  blindingLengthBuffer.writeUInt32LE(blindingFactorBytes.length, 0);

  // Combine all data
  const instructionData = Buffer.concat([
    UPLOAD_PROOF_DISCRIMINATOR,
    nonceBuffer,
    amountBuffer,
    proofLengthBuffer,
    proofBytes,
    commitmentLengthBuffer,
    commitmentBytes,
    blindingLengthBuffer,
    blindingFactorBytes,
  ]);

  return {
    programId: VOID402_PROGRAM_ID,
    keys: [
      { pubkey: sender, isSigner: true, isWritable: true },
      { pubkey: proof, isSigner: false, isWritable: true },
      { pubkey: tokenMint, isSigner: false, isWritable: false },
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
    const { sender_wallet, token, amount, nonce, server_sign } = req.body;

    if (!sender_wallet || !token || !amount || nonce === undefined) {
      return res.status(400).json({ 
        error: 'sender_wallet, token, amount, and nonce are required' 
      });
    }

    const nonceNumber = typeof nonce === 'string' ? parseInt(nonce, 10) : Number(nonce);
    if (isNaN(nonceNumber) || !Number.isInteger(nonceNumber) || nonceNumber < 0) {
      return res.status(400).json({ 
        error: 'nonce must be a valid positive integer' 
      });
    }

    // Validate address based on chain
    if (isBaseChain()) {
      if (!isValidBaseAddress(sender_wallet)) {
        return res.status(400).json({ error: 'Invalid wallet address' });
      }
    } else {
      if (!isValidSolanaAddress(sender_wallet)) {
        return res.status(400).json({ error: 'Invalid sender wallet address' });
      }
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than zero' });
    }

    if (!['USDC', 'USDT'].includes(token)) {
      return res.status(400).json({ error: 'Token must be USDC or USDT' });
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

    // ========== BASE CHAIN: Upload proof to smart contract ==========
    if (isBaseChain()) {
      const usdcAddress = getUsdcAddress();
      const amountInUnits = parseUsdc(amount.toString());
      const nonceBigInt = BigInt(nonceNumber);

      // Generate mock proof (production would use real ZK system)
      const { proofBytes, commitmentBytes, blindingFactorBytes } = generateMockProof(
        sender_wallet,
        amountInUnits,
        nonceBigInt
      );

      // Get user's intermediate wallet (which holds the pool balance)
      const { data: walletMapping, error: baseDbError } = await supabase
        .from('zk_user_wallets')
        .select('intermediate_wallet')
        .eq('user_wallet', sender_wallet)
        .maybeSingle();

      if (baseDbError || !walletMapping?.intermediate_wallet) {
        return res.status(400).json({ error: 'No deposit found. You must deposit funds first before withdrawing.' });
      }

      const { getBaseIntermediateWalletPool } = await import('../lib/intermediate-wallet-pool-base.js');
      const basePool = getBaseIntermediateWalletPool();
      await basePool.initialize();
      const intWalletData = await basePool.getWalletByAddress(walletMapping.intermediate_wallet);

      if (!intWalletData) {
        return res.status(400).json({ error: 'Intermediate wallet not found in pool' });
      }

      // Fund intermediate with ETH for gas if needed
      const { ethers: ethersLib } = await import('ethers');
      const { getBaseProvider } = await import('../lib/void402-base.js');
      const provider = getBaseProvider();
      const intEthBalance = await provider.getBalance(intWalletData.address);
      const ethNeeded = ethersLib.parseEther("0.001");
      if (intEthBalance < ethNeeded) {
        const collectionKey = process.env.COLLECTION_WALLET_PRIVATE_KEY_BASE;
        if (collectionKey) {
          const funder = getBaseSigner(collectionKey);
          const fundTx = await funder.sendTransaction({ to: intWalletData.address, value: ethNeeded });
          await fundTx.wait();
          console.log(`⚡ Funded intermediate with ETH for uploadProof: ${fundTx.hash}`);
        }
      }

      // Intermediate wallet submits the proof (it has the pool balance)
      const intSigner = new ethersLib.Wallet(intWalletData.privateKey, provider);
      const poolContract = getPrivacyPoolContract(intSigner);

      const tx = await poolContract.uploadProof(
        nonceBigInt,
        amountInUnits,
        usdcAddress,
        proofBytes,
        commitmentBytes,
        blindingFactorBytes
      );
      const receipt = await tx.wait();

      const proofId = getProofId(nonceBigInt);

      console.log(`Proof uploaded (Base): nonce=${nonceNumber}, amount=${amount} ${token}, tx=${receipt.hash}`);

      return res.status(200).json({
        success: true,
        signature: receipt.hash,
        nonce: nonceNumber,
        proofId: proofId,
        chain: 'base',
      });
    }

    // ========== SOLANA CHAIN: Upload proof on-chain ==========
    const connection = getSolanaConnection();
    const tokenMint = token === 'USDC' ? USDC_MINT : USDT_MINT;

    // Get user's intermediate wallet from database
    // NOTE: Don't filter by token - intermediate wallet is shared across all tokens for a user
    const { data: walletMapping, error: dbError } = await supabase
      .from('zk_user_wallets')
      .select('intermediate_wallet')
      .eq('user_wallet', sender_wallet)
      .maybeSingle();

    if (dbError || !walletMapping || !walletMapping.intermediate_wallet) {
      return res.status(400).json({ 
        error: 'No deposit found. You must deposit funds first before withdrawing.' 
      });
    }

    // For server_sign mode (user doesn't need to sign), use intermediate wallet to sign
    if (server_sign) {
      const intermediatePool = getPrivacyUsdWalletPool();
      await intermediatePool.initialize();
      const intermediateWallet = await intermediatePool.getWalletByPublicKey(walletMapping.intermediate_wallet);
      
      if (!intermediateWallet) {
        return res.status(400).json({ error: 'Intermediate wallet not found in pool' });
      }

      const intermediateKeypair = Keypair.fromSecretKey(Uint8Array.from(intermediateWallet.privateKey));
      const intermediatePubkey = intermediateKeypair.publicKey;

      // Derive proof PDA
      const proofPDA = await deriveProofPDA(nonceNumber);

      // Convert amount to lamports
      const amountLamports = Math.floor(amount * 1_000_000);

      // Generate placeholder proof bytes (in production, this would be a real ZK proof)
      const proofBytes = Buffer.alloc(32, 0);
      const commitmentBytes = Buffer.alloc(32, 0);
      const blindingFactorBytes = Buffer.alloc(32, 0);

      // Build instruction
      const instruction = buildUploadProofInstruction({
        sender: intermediatePubkey,
        proof: proofPDA,
        tokenMint: tokenMint,
        nonce: nonceNumber,
        amount: amountLamports,
        proofBytes: proofBytes,
        commitmentBytes: commitmentBytes,
        blindingFactorBytes: blindingFactorBytes,
      });

      // CRITICAL: Check if intermediate wallet has enough SOL for proof account rent
      // (1:1 with NolviPay - fund from main wallet if needed)
      const intermediateBalance = await connection.getBalance(intermediatePubkey);
      const PROOF_ACCOUNT_RENT = 9_396_000; // ~0.009396 SOL
      const TRANSACTION_FEE = 5_000;
      const MIN_REQUIRED_BALANCE = PROOF_ACCOUNT_RENT + TRANSACTION_FEE + 1_000_000; // buffer

      if (intermediateBalance < MIN_REQUIRED_BALANCE) {
        console.log(`[UploadProof] Intermediate wallet needs SOL. Balance: ${intermediateBalance}, Required: ${MIN_REQUIRED_BALANCE}`);
        
        // Fund from main wallet (MAIN_WALLET_PRIVATE_KEY or COLLECTION_WALLET_PRIVATE_KEY)
        const mainWalletKey = process.env.MAIN_WALLET_PRIVATE_KEY || process.env.COLLECTION_WALLET_PRIVATE_KEY;
        if (!mainWalletKey) {
          return res.status(500).json({ error: 'No funding wallet configured for proof account rent' });
        }

        let mainKeypair: Keypair;
        try {
          const keyArray = JSON.parse(mainWalletKey);
          mainKeypair = Keypair.fromSecretKey(Uint8Array.from(keyArray));
        } catch {
          const bs58Module = (await import('bs58')).default;
          mainKeypair = Keypair.fromSecretKey(bs58Module.decode(mainWalletKey) as Uint8Array);
        }

        const solToSend = MIN_REQUIRED_BALANCE - intermediateBalance;
        
        const { blockhash: fundBlockhash } = await connection.getLatestBlockhash('finalized');
        const fundTx = new VersionedTransaction(
          new TransactionMessage({
            payerKey: mainKeypair.publicKey,
            recentBlockhash: fundBlockhash,
            instructions: [
              SystemProgram.transfer({
                fromPubkey: mainKeypair.publicKey,
                toPubkey: intermediatePubkey,
                lamports: solToSend,
              })
            ],
          }).compileToLegacyMessage()
        );
        fundTx.sign([mainKeypair]);

        const fundSig = await connection.sendRawTransaction(fundTx.serialize(), {
          skipPreflight: false,
          maxRetries: 3,
        });

        // Wait for funding to confirm
        try {
          await connection.confirmTransaction(fundSig, 'confirmed');
          console.log(`[UploadProof] Funded intermediate wallet: ${fundSig}`);
        } catch (confirmErr: any) {
          const status = await connection.getSignatureStatus(fundSig);
          if (status.value?.confirmationStatus === 'confirmed' || status.value?.confirmationStatus === 'finalized') {
            console.log(`[UploadProof] Funding confirmed despite timeout: ${fundSig}`);
          } else {
            throw new Error(`Failed to fund intermediate wallet for proof: ${confirmErr.message}`);
          }
        }
        
        await new Promise(r => setTimeout(r, 1000));
      }

      // Build transaction with fresh blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
      const txMessage = new TransactionMessage({
        payerKey: intermediatePubkey,
        recentBlockhash: blockhash,
        instructions: [instruction],
      }).compileToLegacyMessage();

      const transaction = new VersionedTransaction(txMessage);
      transaction.sign([intermediateKeypair]);

      // Send and confirm
      const signature = await connection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });

      try {
        await connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight,
        }, 'confirmed');
      } catch (confirmErr: any) {
        const status = await connection.getSignatureStatus(signature);
        if (status.value?.confirmationStatus === 'confirmed' || status.value?.confirmationStatus === 'finalized') {
          console.log(`[UploadProof] Proof upload confirmed despite timeout: ${signature}`);
        } else {
          throw new Error(`Proof upload not confirmed: ${confirmErr.message}`);
        }
      }

      console.log(`✅ Proof uploaded: nonce=${nonceNumber}, amount=${amount} ${token}, tx=${signature}`);

      return res.status(200).json({
        success: true,
        signature: signature,
        nonce: nonceNumber,
        proofPDA: proofPDA.toString(),
      });
    } else {
      // Client-side signing mode - return transaction for user to sign
      const walletPubkey = new PublicKey(sender_wallet);
      const proofPDA = await deriveProofPDA(nonceNumber);
      const amountLamports = Math.floor(amount * 1_000_000);

      const proofBytes = Buffer.alloc(32, 0);
      const commitmentBytes = Buffer.alloc(32, 0);
      const blindingFactorBytes = Buffer.alloc(32, 0);

      const instruction = buildUploadProofInstruction({
        sender: walletPubkey,
        proof: proofPDA,
        tokenMint: tokenMint,
        nonce: nonceNumber,
        amount: amountLamports,
        proofBytes: proofBytes,
        commitmentBytes: commitmentBytes,
        blindingFactorBytes: blindingFactorBytes,
      });

      const { blockhash } = await connection.getLatestBlockhash('finalized');
      const txMessage = new TransactionMessage({
        payerKey: walletPubkey,
        recentBlockhash: blockhash,
        instructions: [instruction],
      }).compileToLegacyMessage();

      const transaction = new VersionedTransaction(txMessage);
      const serializedTx = Buffer.from(transaction.serialize()).toString('base64');

      return res.status(200).json({
        success: true,
        transaction: serializedTx,
        nonce: nonceNumber,
        proofPDA: proofPDA.toString(),
      });
    }
  } catch (error: any) {
    console.error('❌ Error uploading proof:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to upload proof', 
      message: error?.message || 'Unknown error',
    });
  }
}
