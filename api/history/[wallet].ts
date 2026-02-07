/**
 * Void402 Transaction History API
 * GET /api/history/:wallet
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getAllowedOrigin(req.headers.origin as string | undefined);
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const wallet = req.query.wallet as string;
    const limit = parseInt(req.query.limit as string) || 100;

    if (!wallet || wallet.length < 32) {
      return res.status(400).json({ success: false, error: "Invalid wallet address" });
    }

    if (!supabase) {
      return res.status(500).json({ success: false, error: "Database not configured" });
    }

    // Fetch transaction history from Supabase
    const { data: transactions, error } = await supabase
      .from("zk_transactions")
      .select("*")
      .or(`sender_wallet.eq.${wallet},recipient_wallet.eq.${wallet}`)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching transactions:", error);
      // Return empty array instead of error for missing table
      return res.status(200).json({ 
        success: true, 
        transactions: [],
        total: 0
      });
    }

    // Format transactions for frontend
    const formattedTransactions = (transactions || []).map((tx: any) => {
      // Determine transaction type from database or infer from wallets
      // IMPORTANT: Check withdraw BEFORE deposit, because both have sender == recipient == wallet
      let type = "transfer";
      if (tx.transaction_type === "withdraw") {
        type = "withdraw";
      } else if (tx.transaction_type === "deposit" || (tx.sender_wallet === wallet && tx.recipient_wallet === wallet)) {
        type = "deposit";
      } else if (tx.sender_wallet === wallet) {
        type = "sent";
      } else {
        type = "received";
      }

      return {
        id: tx.id,
        type,
        amount: tx.amount,
        token: tx.token_symbol || "USDC",
        from: tx.sender_wallet,
        to: tx.recipient_wallet,
        counterparty: tx.sender_wallet === wallet ? tx.recipient_wallet : tx.sender_wallet,
        status: tx.status === "completed" ? "success" : tx.status,
        timestamp: tx.created_at,
        signature: tx.tx_hash,
        txHash: tx.tx_hash,
        privacyLevel: tx.privacy_level || "full",
      };
    });

    return res.status(200).json({
      success: true,
      transactions: formattedTransactions,
      total: formattedTransactions.length,
    });
  } catch (error: any) {
    console.error("Error in history API:", error);
    return res.status(500).json({ success: false, error: error.message || "Internal error" });
  }
}
