/**
 * Cast Payment Settings API
 * POST /api/farcaster/cast-payment-settings
 *
 * Allows authenticated users to enable/disable cast payments
 * and configure their daily limit.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { extractBearerToken, verifyBearerToken } from "../lib/bearer-auth.js";

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
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (origin.match(/^https:\/\/code-whisperer-33[\w-]*\.vercel\.app/))
    return origin;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getAllowedOrigin(req.headers.origin as string | undefined);
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Database not configured" });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Authenticate
  const bearerToken = extractBearerToken(req);
  if (!bearerToken) {
    return res.status(401).json({ error: "Authentication required" });
  }

  // GET — fetch current settings
  if (req.method === "GET") {
    // We need to find the wallet from the session token
    const { data: session } = await supabase
      .from("auth_sessions")
      .select("user_wallet")
      .eq("session_token", bearerToken)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (!session) {
      return res.status(401).json({ error: "Invalid session" });
    }

    const { data: user } = await supabase
      .from("farcaster_users")
      .select("cast_payments_enabled, cast_payment_daily_limit")
      .eq("wallet_address", session.user_wallet.toLowerCase())
      .single();

    return res.status(200).json({
      success: true,
      enabled: user?.cast_payments_enabled || false,
      daily_limit: parseFloat(user?.cast_payment_daily_limit || "100"),
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { enabled, daily_limit, wallet } = req.body;

  if (!wallet) {
    return res.status(400).json({ error: "wallet is required" });
  }

  // Verify bearer token matches wallet
  const tokenVerification = await verifyBearerToken(bearerToken, wallet);
  if (!tokenVerification.valid) {
    return res.status(403).json({ error: "Invalid authentication" });
  }

  // Build update object
  const updates: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof enabled === "boolean") {
    updates.cast_payments_enabled = enabled;
    if (enabled) {
      updates.cast_payments_enabled_at = new Date().toISOString();
    }
  }

  if (typeof daily_limit === "number" && daily_limit > 0 && daily_limit <= 10000) {
    updates.cast_payment_daily_limit = daily_limit;
  }

  const { error: updateError } = await supabase
    .from("farcaster_users")
    .update(updates)
    .eq("wallet_address", wallet.toLowerCase());

  if (updateError) {
    console.error("[CastPaymentSettings] Update error:", updateError.message);
    return res.status(500).json({ error: "Failed to update settings" });
  }

  console.log(
    `[CastPaymentSettings] Updated for ${wallet.slice(0, 8)}...: enabled=${enabled}, limit=${daily_limit}`
  );

  return res.status(200).json({ success: true });
}
