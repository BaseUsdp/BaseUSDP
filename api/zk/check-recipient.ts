/**
 * Void402 Check Recipient API (1:1 with Nolvipay)
 * GET /api/zk/check-recipient?recipient=...
 * Checks if recipient has deposited funds and can receive internal transfers
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { PublicKey } from "@solana/web3.js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const ALLOWED_ORIGINS = [
  "https://void402.com",
  "https://www.void402.com",
  "https://orb402.com",
  "https://www.orb402.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

function getAllowedOrigin(origin: string | undefined): string {
  if (!origin) return "https://www.void402.com";
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (origin.match(/^https:\/\/code-whisperer-33[\w-]*\.vercel\.app/)) return origin;
  return "https://www.void402.com";
}

// Simple Solana address validation
function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getAllowedOrigin(req.headers.origin as string | undefined);
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  if (!supabase) {
    return res.status(500).json({ success: false, error: "Database not configured" });
  }

  try {
    const { recipient } = req.query;

    if (!recipient) {
      return res.status(400).json({ error: "Recipient address is required" });
    }

    if (!isValidSolanaAddress(recipient as string)) {
      return res.status(400).json({ error: "Invalid Solana wallet address" });
    }

    // Check if recipient has deposited before
    // First try zk_user_wallets table
    let walletMapping = null;

    try {
      const result = await supabase
        .from("zk_user_wallets")
        .select("intermediate_wallet, user_wallet")
        .eq("user_wallet", recipient as string)
        .maybeSingle();

      walletMapping = result.data;

      // If found in zk_user_wallets, return success
      if (walletMapping && walletMapping.intermediate_wallet) {
        return res.status(200).json({
          exists: true,
          intermediate_wallet: walletMapping.intermediate_wallet,
          user_wallet: walletMapping.user_wallet,
        });
      }
    } catch (tableError: any) {
      // Table might not exist, check transactions as fallback
      console.warn("zk_user_wallets table check failed, trying transactions:", tableError.message);
    }

    // Fallback: Check transactions table for deposits
    try {
      const { data: transactions, error: txError } = await supabase
        .from("zk_transactions")
        .select("sender_wallet, recipient_wallet, status")
        .or(`sender_wallet.eq.${recipient},recipient_wallet.eq.${recipient}`)
        .in("status", ["confirmed", "completed"])
        .limit(1);

      if (txError) {
        console.error("Error checking transactions table:", txError);
        // If both tables fail, return exists: false
        return res.status(200).json({
          exists: false,
          message: "Recipient has not deposited funds on Void402 yet. They must make a deposit first to receive internal transfers.",
        });
      }

      if (transactions && transactions.length > 0) {
        // User has transacted, return exists: true
        return res.status(200).json({
          exists: true,
          user_wallet: recipient as string,
          message: "Recipient has deposited funds.",
        });
      }
    } catch (txTableError: any) {
      console.error("Error checking transactions table:", txTableError);
    }

    // If we get here, recipient hasn't deposited
    return res.status(200).json({
      exists: false,
      message: "Recipient has not deposited funds on Void402 yet. They must make a deposit first to receive internal transfers.",
    });
  } catch (error: any) {
    console.error("Error checking recipient:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
