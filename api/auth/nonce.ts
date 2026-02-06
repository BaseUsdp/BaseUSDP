/**
 * Void402 Generate Nonce API (1:1 with Nolvipay - uses Supabase)
 * POST /api/auth/nonce
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const NONCE_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes

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
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { walletAddress } = req.body || {};
    if (!walletAddress || typeof walletAddress !== "string" || walletAddress.length < 32) {
      return res.status(400).json({ success: false, error: "walletAddress is required" });
    }

    const nonce = crypto.randomBytes(32).toString("hex").slice(0, 32);
    const expiresAt = new Date(Date.now() + NONCE_EXPIRATION_MS);

    // Store nonce in Supabase (like Nolvipay)
    if (supabase) {
      // Delete any existing nonces for this wallet first
      await supabase.from("auth_nonces").delete().eq("user_wallet", walletAddress);

      const { error } = await supabase.from("auth_nonces").insert({
        user_wallet: walletAddress,
        nonce: nonce,
        expires_at: expiresAt.toISOString(),
      });

      if (error) {
        console.error("Error storing nonce:", error);
        // Continue anyway - will use message-based verification
      }
    }

    const message = `Sign this message to authenticate with Void402.\n\nNonce: ${nonce}\n\nThis signature will not trigger any blockchain transaction.`;

    console.log(`✅ Generated nonce for wallet ${walletAddress.slice(0, 8)}...`);

    return res.status(200).json({ success: true, nonce, message });
  } catch (error: any) {
    console.error("Error in nonce API:", error);
    return res.status(500).json({ success: false, error: error.message || "Internal error" });
  }
}
