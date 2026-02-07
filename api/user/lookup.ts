/**
 * Void402 Username Lookup API (1:1 with Nolvipay)
 * GET /api/user/lookup?username=...
 * Returns wallet address for a given username
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

  if (!supabase) {
    return res.status(500).json({ success: false, error: "Database not configured" });
  }

  try {
    const { username } = req.query;

    if (!username) {
      return res.status(400).json({ success: false, error: "Username is required" });
    }

    // Normalize username - remove @ if present
    const inputUsername = (username as string).trim();
    const cleanUsername = inputUsername.startsWith("@") ? inputUsername.substring(1) : inputUsername;

    // Look up wallet address from username (case-insensitive)
    const { data, error } = await supabase
      .from("user_profiles")
      .select("wallet_address, username, profile_picture")
      .ilike("username", cleanUsername)
      .maybeSingle();

    if (error) {
      console.error("Error looking up username:", error);
      return res.status(500).json({ success: false, error: "Failed to lookup username" });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: "Username not found",
      });
    }

    // Check if recipient has deposited (has an intermediate wallet or completed transactions)
    // This is required for internal transfers to work
    let hasDeposited = false;
    
    // Check zk_user_wallets first
    const { data: walletMapping } = await supabase
      .from("zk_user_wallets")
      .select("id")
      .eq("user_wallet", data.wallet_address)
      .maybeSingle();
    
    if (walletMapping) {
      hasDeposited = true;
    } else {
      // Fallback: check if they have any completed transactions
      const { data: txHistory } = await supabase
        .from("zk_transactions")
        .select("id")
        .or(`sender_wallet.eq.${data.wallet_address},recipient_wallet.eq.${data.wallet_address}`)
        .in("status", ["confirmed", "completed"])
        .limit(1);
      
      hasDeposited = !!(txHistory && txHistory.length > 0);
    }

    // PRIVACY: Do NOT return ANY wallet address information in the lookup response.
    // Anyone can call this endpoint — even a masked hint leaks info.
    // The transfer API resolves usernames to wallet addresses internally.
    return res.status(200).json({
      success: true,
      username: data.username,
      profile_picture: data.profile_picture || null,
      has_deposited: hasDeposited,
    });
  } catch (error: any) {
    console.error("Error in username lookup:", error);
    return res.status(500).json({ success: false, error: error.message || "Internal error" });
  }
}
