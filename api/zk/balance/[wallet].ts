/**
 * Void402 Balance API (1:1 pattern with Nolvipay)
 * GET /api/zk/balance/:wallet
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
    if (!wallet) {
      return res.status(400).json({ success: false, error: "wallet param required" });
    }

    let balances = { sol: 0, usdc: 0, usdt: 0 };

    if (supabase) {
      // Fetch from DB
      const { data: txs } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_wallet", wallet)
        .eq("status", "completed");

      if (txs) {
        for (const tx of txs) {
          const token = (tx.token || "USDC").toUpperCase();
          const amount = parseFloat(tx.amount_received || tx.amount || 0);
          if (tx.transaction_type === "deposit") {
            if (token === "SOL") balances.sol += amount;
            else if (token === "USDC") balances.usdc += amount;
            else if (token === "USDT") balances.usdt += amount;
          } else if (["transfer", "withdraw"].includes(tx.transaction_type)) {
            const amt = parseFloat(tx.amount || 0);
            if (token === "SOL") balances.sol -= amt;
            else if (token === "USDC") balances.usdc -= amt;
            else if (token === "USDT") balances.usdt -= amt;
          }
        }
      }
      balances.sol = Math.max(0, balances.sol);
      balances.usdc = Math.max(0, balances.usdc);
      balances.usdt = Math.max(0, balances.usdt);
    }

    return res.status(200).json({ success: true, balances });
  } catch (error: any) {
    console.error("Balance error:", error);
    return res.status(500).json({ success: false, error: error.message || "Internal error" });
  }
}
