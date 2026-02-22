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

    // Collect all unique wallet addresses and agent IDs from transactions
    const allWallets = new Set<string>();
    const allAgentIds = new Set<string>();
    (transactions || []).forEach((tx: any) => {
      if (tx.sender_wallet && tx.sender_wallet !== wallet) allWallets.add(tx.sender_wallet);
      if (tx.recipient_wallet && tx.recipient_wallet !== wallet) allWallets.add(tx.recipient_wallet);
      if (tx.agent_id) allAgentIds.add(tx.agent_id);
    });

    // Look up usernames for all counterparty wallets (Void402 users)
    const walletToUsername: Record<string, string> = {};
    if (allWallets.size > 0) {
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("wallet_address, username")
        .in("wallet_address", [...allWallets]);

      if (profiles) {
        for (const p of profiles) {
          if (p.wallet_address && p.username) {
            walletToUsername[p.wallet_address] = p.username;
          }
        }
      }
    }

    // Look up agent names for bot transactions
    const agentIdToName: Record<string, string> = {};
    if (allAgentIds.size > 0) {
      const { data: agents } = await supabase
        .from("agent_profiles")
        .select("id, name")
        .in("id", [...allAgentIds]);

      if (agents) {
        for (const a of agents) {
          agentIdToName[a.id] = a.name;
        }
      }
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

      // For internal (Void402 user) transfers, return username instead of address
      const counterpartyWallet = tx.sender_wallet === wallet ? tx.recipient_wallet : tx.sender_wallet;
      const counterpartyUsername = counterpartyWallet ? walletToUsername[counterpartyWallet] : null;
      const isInternal = !!counterpartyUsername;

      return {
        id: tx.id,
        type,
        amount: tx.amount,
        token: tx.token_symbol || "USDC",
        // Hide wallet addresses for internal transfers (privacy)
        from: tx.sender_wallet === wallet ? wallet : (counterpartyUsername ? undefined : tx.sender_wallet),
        to: tx.recipient_wallet === wallet ? wallet : (counterpartyUsername ? undefined : tx.recipient_wallet),
        counterparty: counterpartyUsername ? `@${counterpartyUsername}` : (counterpartyWallet || "Unknown"),
        counterpartyUsername: counterpartyUsername || null,
        isInternal,
        status: tx.status === "completed" ? "success" : tx.status,
        timestamp: tx.created_at,
        signature: tx.tx_hash,
        txHash: tx.tx_hash,
        privacyLevel: tx.privacy_level || "full",
        agentId: tx.agent_id || null,
        agentName: tx.agent_id ? (agentIdToName[tx.agent_id] || "Bot") : null,
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
