/**
 * Void402 Internal Transfer API (1:1 with Nolvipay)
 * POST /api/zk/transfer
 * 
 * Transfers funds between Void402 users internally (balance-to-balance)
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PublicKey } from "@solana/web3.js";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

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

// Base fee percentage (can be tier-based like Nolvipay)
const BASE_FEE_PERCENTAGE = 5.0;

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
    const { sender_wallet, recipient_wallet, amount, token } = req.body;

    if (!sender_wallet || !recipient_wallet || !amount || !token) {
      return res.status(400).json({ error: "All fields are required (sender_wallet, recipient_wallet, amount, token)" });
    }

    if (!["USDC", "USDT"].includes(token)) {
      return res.status(400).json({ error: "Token must be USDC or USDT" });
    }

    if (!isValidSolanaAddress(sender_wallet) || !isValidSolanaAddress(recipient_wallet)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }

    // CRITICAL SECURITY: Prevent self-transfers
    if (sender_wallet.toLowerCase() === recipient_wallet.toLowerCase()) {
      console.error(`❌ SECURITY: User ${sender_wallet} attempted to transfer to themselves.`);
      return res.status(400).json({
        error: "Self-transfers are not allowed",
        message: "You cannot transfer funds to yourself.",
      });
    }

    const transferAmount = parseFloat(amount);
    if (transferAmount <= 0) {
      return res.status(400).json({ error: "Amount must be greater than zero" });
    }

    // Check sender's balance
    const { data: senderBalance, error: balanceError } = await supabase
      .from("zk_balances")
      .select("balance")
      .eq("wallet_address", sender_wallet)
      .eq("token", token)
      .single();

    if (balanceError || !senderBalance) {
      return res.status(400).json({ error: "Sender has no balance or has not deposited" });
    }

    if (parseFloat(senderBalance.balance) < transferAmount) {
      return res.status(400).json({
        error: "Insufficient balance",
        available: senderBalance.balance,
        requested: transferAmount,
      });
    }

    // Check recipient exists (has deposited before)
    const { data: recipientBalance } = await supabase
      .from("zk_balances")
      .select("balance")
      .eq("wallet_address", recipient_wallet)
      .eq("token", token)
      .maybeSingle();

    // If recipient doesn't have a balance record, create one with 0
    if (!recipientBalance) {
      // Check if recipient has a user profile (registered on Void402)
      const { data: recipientProfile } = await supabase
        .from("user_profiles")
        .select("wallet_address")
        .eq("wallet_address", recipient_wallet)
        .maybeSingle();

      if (!recipientProfile) {
        return res.status(400).json({
          error: "Recipient has not registered on Void402 yet",
          message: "The recipient must create an account on Void402 before receiving transfers.",
        });
      }

      // Create zero balance for recipient
      await supabase.from("zk_balances").insert({
        wallet_address: recipient_wallet,
        token: token,
        balance: "0",
      });
    }

    // Calculate fees
    const feePercentage = BASE_FEE_PERCENTAGE;
    const feeAmount = transferAmount * (feePercentage / 100);
    const amountAfterFees = transferAmount - feeAmount;

    // Perform the transfer (update balances)
    // Deduct from sender
    const newSenderBalance = parseFloat(senderBalance.balance) - transferAmount;
    const { error: senderUpdateError } = await supabase
      .from("zk_balances")
      .update({ balance: newSenderBalance.toString(), updated_at: new Date().toISOString() })
      .eq("wallet_address", sender_wallet)
      .eq("token", token);

    if (senderUpdateError) {
      console.error("Error updating sender balance:", senderUpdateError);
      return res.status(500).json({ error: "Failed to update sender balance" });
    }

    // Add to recipient
    const currentRecipientBalance = recipientBalance ? parseFloat(recipientBalance.balance) : 0;
    const newRecipientBalance = currentRecipientBalance + amountAfterFees;
    const { error: recipientUpdateError } = await supabase
      .from("zk_balances")
      .upsert(
        {
          wallet_address: recipient_wallet,
          token: token,
          balance: newRecipientBalance.toString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "wallet_address,token" }
      );

    if (recipientUpdateError) {
      // Rollback sender's balance
      await supabase
        .from("zk_balances")
        .update({ balance: senderBalance.balance, updated_at: new Date().toISOString() })
        .eq("wallet_address", sender_wallet)
        .eq("token", token);

      console.error("Error updating recipient balance:", recipientUpdateError);
      return res.status(500).json({ error: "Failed to update recipient balance" });
    }

    // Generate a unique transaction ID
    const txId = `void402_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Log transaction
    await supabase.from("zk_transactions").insert({
      sender_wallet: sender_wallet,
      recipient_wallet: recipient_wallet,
      amount: transferAmount,
      amount_received: amountAfterFees,
      fee_percentage: feePercentage,
      token_symbol: token,
      status: "completed",
      tx_hash: txId,
      privacy_level: "full",
    });

    console.log(`✅ Internal transfer: ${sender_wallet.slice(0, 8)}... → ${recipient_wallet.slice(0, 8)}... | ${amountAfterFees} ${token}`);

    return res.status(200).json({
      success: true,
      signature: txId,
      amount: amountAfterFees,
      fee: feeAmount,
      fee_percentage: feePercentage,
    });
  } catch (error: any) {
    console.error("Error processing internal transfer:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
