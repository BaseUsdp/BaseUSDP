/**
 * Farcaster User Resolution
 * GET /api/farcaster/resolve-fid?username={farcaster_username}
 *
 * Privacy-safe: returns only { found, orb402Username, hasDeposited }
 * NEVER returns wallet addresses.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { resolveFarcasterUsername } from "../lib/farcaster-neynar.js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const ALLOWED_ORIGINS = [
  "https://void402.com",
  "https://www.void402.com",
  "https://baseusdp.com",
  "https://www.baseusdp.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

function getAllowedOrigin(origin: string | undefined): string {
  if (!origin) return "https://www.baseusdp.com";
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (origin.match(/^https:\/\/code-whisperer-33[\w-]*\.vercel\.app/))
    return origin;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const origin = getAllowedOrigin(req.headers.origin as string | undefined);
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

  const username = req.query.username as string;
  if (!username) {
    return res.status(400).json({ error: "username query parameter required" });
  }

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Database not configured" });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Resolve Farcaster username → FID → wallet
    const { walletAddress } = await resolveFarcasterUsername(username);

    // Check if this wallet exists in user_profiles (has ORB402 account)
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("username")
      .eq("wallet_address", walletAddress)
      .single();

    // Check if wallet has any ZK balance (has deposited)
    const { data: balance } = await supabase
      .from("zk_transactions")
      .select("id")
      .eq("user_wallet", walletAddress)
      .eq("type", "deposit")
      .eq("status", "completed")
      .limit(1);

    const hasDeposited = (balance?.length || 0) > 0;

    // Privacy-safe response: NO wallet address
    return res.status(200).json({
      found: true,
      orb402Username: profile?.username || null,
      hasDeposited,
    });
  } catch (error: any) {
    // User not found on Farcaster or no verified address
    return res.status(200).json({
      found: false,
      orb402Username: null,
      hasDeposited: false,
    });
  }
}
