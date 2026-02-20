/**
 * Void402 Deposit API (1:1 with Nolvipay)
 * POST /api/zk/deposit
 *
 * Creates deposit transaction - user deposits USDC/USDT into Void402 protocol
 *
 * Solana flow: User Wallet -> Collection Wallet -> (process-deposit handles rest)
 *   Returns a serialized VersionedTransaction for the user to sign.
 *
 * Base flow: User Wallet -> X402PrivacyPool contract (approve + deposit)
 *   Returns two EVM transaction objects ({ to, data, value }) for the user to sign.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
} from '@solana/spl-token';
import {
  isValidSolanaAddress,
  getSolanaConnection,
} from '../lib/void402-solana.js';
import {
  isValidBaseAddress,
  getUsdcAddress,
  parseUsdc,
  ERC20_ABI,
} from '../lib/void402-base.js';
import { isBaseChain } from '../lib/chain-config.js';
import { getPrivacyUsdWalletPool } from '../lib/intermediate-wallet-pool.js';
import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// USDC and USDT mint addresses on Solana
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const USDT_MINT = new PublicKey('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB');

const ALLOWED_ORIGINS = [
  "https://void402.com",
  "https://www.void402.com",
  "https://orb402.com",
  "https://www.orb402.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

function getAllowedOrigin(origin: string | undefined): string {
  if (!origin) return "https://www.orb402.com";
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (origin.match(/^https:\/\/code-whisperer-33[\w-]*\.vercel\.app/)) return origin;
  return "https://www.orb402.com";
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
    const { wallet, amount, token } = req.body;

    if (!wallet || !amount || !token) {
      return res.status(400).json({ error: 'Wallet, amount, and token are required' });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than zero' });
    }

    if (!['USDC', 'USDT'].includes(token)) {
      return res.status(400).json({ error: 'Token must be USDC or USDT' });
    }

    // ========== BASE CHAIN: Simple USDC transfer to collection wallet ==========
    // This is a fallback/simple path. The main flow uses create-holding-wallet.
    if (isBaseChain()) {
      if (!isValidBaseAddress(wallet)) {
        return res.status(400).json({ error: 'Invalid Base wallet address' });
      }

      const collectionWallet = process.env.COLLECTION_WALLET_ADDRESS_BASE;
      if (!collectionWallet) {
        return res.status(500).json({ error: 'COLLECTION_WALLET_ADDRESS_BASE not configured' });
      }

      const usdcAddress = getUsdcAddress();
      const amountBigInt = parseUsdc(amount.toString());

      // Encode USDC.transfer(collectionWallet, amount)
      const erc20Interface = new ethers.Interface(ERC20_ABI);
      const transferData = erc20Interface.encodeFunctionData('transfer', [
        collectionWallet,
        amountBigInt,
      ]);

      console.log(`[base] Deposit prepared (transfer to collection): ${wallet.slice(0, 8)}... | ${amount} ${token}`);

      return res.status(200).json({
        success: true,
        chain: 'base',
        transactions: [
          {
            label: 'transfer',
            to: usdcAddress,
            data: transferData,
            value: '0x0',
          },
        ],
        amount: amount,
        token: token,
      });
    }

    // ========== SOLANA CHAIN: SPL token transfer to collection wallet ==========
    if (!isValidSolanaAddress(wallet)) {
      return res.status(400).json({ error: 'Invalid Solana wallet address' });
    }

    const connection = getSolanaConnection();
    const walletPubkey = new PublicKey(wallet);
    const tokenMint = token === 'USDC' ? USDC_MINT : USDT_MINT;

    // Get collection wallet (shared by all users)
    const collectionWalletAddress = process.env.COLLECTION_WALLET_ADDRESS || process.env.COLLECTION_WALLET;
    if (!collectionWalletAddress) {
      throw new Error('COLLECTION_WALLET_ADDRESS environment variable not set');
    }
    const collectionWalletPubkey = new PublicKey(collectionWalletAddress);

    // Get or assign intermediate wallet for this user (privacy layer)
    const { data: existingMapping } = await supabase
      .from('zk_user_wallets')
      .select('intermediate_wallet')
      .eq('user_wallet', wallet)
      .eq('token', token)
      .single();

    let intermediateWalletPublicKey: string;

    if (existingMapping) {
      intermediateWalletPublicKey = existingMapping.intermediate_wallet;
    } else {
      const intermediatePool = getPrivacyUsdWalletPool();
      await intermediatePool.initialize();
      const intermediateWallet = await intermediatePool.getAvailableWallet();
      intermediateWalletPublicKey = intermediateWallet.publicKey;

      await supabase
        .from('zk_user_wallets')
        .insert({
          user_wallet: wallet,
          intermediate_wallet: intermediateWalletPublicKey,
          token: token,
        });
    }

    // Get token accounts
    const userTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      walletPubkey
    );

    const collectionTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      collectionWalletPubkey
    );

    // Convert amount to lamports (USDC/USDT have 6 decimals)
    const amountLamports = BigInt(Math.floor(amount * 1_000_000));

    const instructions = [];

    // Check if collection wallet's token account exists
    let collectionAccountExists = false;
    try {
      const collectionAccountInfo = await connection.getAccountInfo(collectionTokenAccount);
      if (collectionAccountInfo) {
        try {
          await connection.getTokenAccountBalance(collectionTokenAccount);
          collectionAccountExists = true;
        } catch {
          collectionAccountExists = false;
        }
      }
    } catch {
      collectionAccountExists = false;
    }

    if (!collectionAccountExists) {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          walletPubkey,
          collectionTokenAccount,
          collectionWalletPubkey,
          tokenMint
        )
      );
    }

    // Transfer tokens from user to collection wallet (Layer 1 of privacy stack)
    instructions.push(
      createTransferInstruction(
        userTokenAccount,
        collectionTokenAccount,
        walletPubkey,
        amountLamports
      )
    );

    const { blockhash } = await connection.getLatestBlockhash();
    const txMessage = new TransactionMessage({
      payerKey: walletPubkey,
      recentBlockhash: blockhash,
      instructions: instructions,
    }).compileToLegacyMessage();

    const transaction = new VersionedTransaction(txMessage);
    const serializedTx = Buffer.from(transaction.serialize()).toString('base64');

    console.log(`[solana] Deposit prepared: ${wallet.slice(0, 8)}... | ${amount} ${token}`);

    return res.status(200).json({
      success: true,
      chain: 'solana',
      transaction: serializedTx,
      amount: amount,
      token: token,
    });
  } catch (error: any) {
    console.error('Error creating deposit:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create deposit transaction',
      message: error?.message || 'Unknown error occurred',
    });
  }
}
