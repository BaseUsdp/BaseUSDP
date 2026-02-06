/**
 * Void402 Deposit API (1:1 with Nolvipay)
 * POST /api/zk/deposit
 * 
 * Creates deposit transaction - user deposits USDC/USDT into Void402 protocol
 * Flow: User Wallet → Collection Wallet → (process-deposit handles rest)
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { 
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  Connection,
} from "@solana/web3.js";
import { 
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
} from "@solana/spl-token";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// USDC and USDT mint addresses on Solana
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const USDT_MINT = new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB");

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

function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

function getSolanaConnection(): Connection {
  const rpcUrl = process.env.SOLANA_RPC_URL || process.env.VITE_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  return new Connection(rpcUrl, "confirmed");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getAllowedOrigin(req.headers.origin as string | undefined);
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { wallet, amount, token } = req.body;

    if (!wallet || !amount || !token) {
      return res.status(400).json({ error: "Wallet, amount, and token are required" });
    }

    if (!isValidSolanaAddress(wallet)) {
      return res.status(400).json({ error: "Invalid Solana wallet address" });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: "Amount must be greater than zero" });
    }

    if (!["USDC", "USDT"].includes(token)) {
      return res.status(400).json({ error: "Token must be USDC or USDT" });
    }

    const connection = getSolanaConnection();
    const walletPubkey = new PublicKey(wallet);
    const tokenMint = token === "USDC" ? USDC_MINT : USDT_MINT;

    // Get collection wallet (shared by all users)
    const collectionWalletAddress = process.env.COLLECTION_WALLET_ADDRESS;
    if (!collectionWalletAddress) {
      return res.status(500).json({ error: "Collection wallet not configured" });
    }
    const collectionWalletPubkey = new PublicKey(collectionWalletAddress);

    // Get or assign intermediate wallet for this user (privacy layer)
    let intermediateWalletPublicKey: string | null = null;

    if (supabase) {
      const { data: existingMapping } = await supabase
        .from("zk_user_wallets")
        .select("intermediate_wallet")
        .eq("user_wallet", wallet)
        .eq("token", token)
        .single();

      if (existingMapping) {
        intermediateWalletPublicKey = existingMapping.intermediate_wallet;
      }
      // Note: If no existing mapping, process-deposit will assign one
    }

    // Get token accounts
    const userTokenAccount = await getAssociatedTokenAddress(tokenMint, walletPubkey);
    const collectionTokenAccount = await getAssociatedTokenAddress(tokenMint, collectionWalletPubkey);

    // Convert amount to lamports (USDC/USDT have 6 decimals)
    const amountLamports = BigInt(Math.floor(amount * 1_000_000));

    // Build transaction
    const instructions = [];

    // Check if collection wallet's token account exists
    let collectionAccountExists = false;
    try {
      const collectionAccountInfo = await connection.getAccountInfo(collectionTokenAccount);
      if (collectionAccountInfo) {
        collectionAccountExists = true;
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

    // Transfer tokens from user to collection wallet
    instructions.push(
      createTransferInstruction(
        userTokenAccount,
        collectionTokenAccount,
        walletPubkey,
        amountLamports
      )
    );

    // Build transaction
    const { blockhash } = await connection.getLatestBlockhash();
    const txMessage = new TransactionMessage({
      payerKey: walletPubkey,
      recentBlockhash: blockhash,
      instructions: instructions,
    }).compileToLegacyMessage();

    const transaction = new VersionedTransaction(txMessage);
    const serializedTx = Buffer.from(transaction.serialize()).toString("base64");

    console.log(`✅ Created deposit transaction for wallet ${wallet.slice(0, 8)}... amount: ${amount} ${token}`);

    return res.status(200).json({
      success: true,
      transaction: serializedTx,
      amount: amount,
      token: token,
    });
  } catch (error: any) {
    console.error("❌ Error creating deposit:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to create deposit transaction",
      message: error?.message || "Unknown error occurred",
    });
  }
}
