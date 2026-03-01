/**
 * Farcaster Auth Bridge
 * POST /api/farcaster/auth
 *
 * Verifies Farcaster Quick Auth JWT, resolves FID → wallet via Neynar,
 * creates an ORB402 session (same auth_sessions table as SIWE flow).
 *
 * After this, all existing /api/zk/*, /api/payments/* endpoints work
 * unchanged via Bearer token.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { verifyFarcasterJwt } from "../lib/farcaster-auth.js";
import { resolveFidToWallet } from "../lib/farcaster-neynar.js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

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
  if (origin.match(/^https:\/\/code-whisperer-33[\w-]*\.vercel\.app/))
    return origin;
  return "https://www.orb402.com";
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const origin = getAllowedOrigin(req.headers.origin as string | undefined);
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Database not configured" });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { farcasterJwt } = req.body || {};

    if (!farcasterJwt) {
      return res
        .status(400)
        .json({ success: false, error: "farcasterJwt is required" });
    }

    // 1. Verify JWT
    const domain = process.env.FARCASTER_DOMAIN || "orb402.com";
    const { fid } = await verifyFarcasterJwt(farcasterJwt, domain);

    // 2. Resolve FID → wallet via Neynar
    const { walletAddress, username } = await resolveFidToWallet(fid);

    // 3. Find or create user_profiles row (same pattern as SIWE auth)
    const { data: existingProfile } = await supabase
      .from("user_profiles")
      .select("username")
      .eq("wallet_address", walletAddress)
      .single();

    if (!existingProfile) {
      // Create profile for new users
      await supabase.from("user_profiles").insert({
        wallet_address: walletAddress,
        username: username || `fc_${fid}`,
        chain: "base",
      });
    }

    // 4. Create session token (same as SIWE flow)
    const sessionToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    await supabase.from("auth_sessions").upsert({
      session_token: sessionToken,
      user_wallet: walletAddress,
      expires_at: expiresAt.toISOString(),
    });

    // 5. Upsert farcaster_users linking FID ↔ wallet
    await supabase.from("farcaster_users").upsert(
      {
        fid,
        farcaster_username: username,
        wallet_address: walletAddress,
        orb402_username: existingProfile?.username || username || `fc_${fid}`,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "fid" }
    );

    console.log(
      `[Farcaster Auth] Authenticated FID ${fid} (@${username}) → ${walletAddress.slice(0, 10)}...`
    );

    return res.status(200).json({
      success: true,
      sessionToken,
      walletAddress,
      username: existingProfile?.username || username,
      fid,
    });
  } catch (error: any) {
    console.error("[Farcaster Auth] Error:", error.message);
    return res
      .status(401)
      .json({ success: false, error: error.message || "Authentication failed" });
  }
}
