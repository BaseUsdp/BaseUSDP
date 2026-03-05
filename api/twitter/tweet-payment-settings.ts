/**
 * Tweet Payment Settings API
 * GET/POST /api/twitter/tweet-payment-settings
 *
 * Allows authenticated users to link their X account, enable/disable tweet payments,
 * and configure their daily limit.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { extractBearerToken, verifyBearerToken } from "../lib/bearer-auth.js";
import { lookupXUser } from "../lib/x-api.js";

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
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, DELETE, OPTIONS");
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
      .from("x_users")
      .select("x_username, tweet_payments_enabled, tweet_payment_daily_limit")
      .eq("wallet_address", session.user_wallet.toLowerCase())
      .single();

    return res.status(200).json({
      success: true,
      linked: !!user,
      x_username: user?.x_username || null,
      enabled: user?.tweet_payments_enabled || false,
      daily_limit: parseFloat(user?.tweet_payment_daily_limit || "100"),
    });
  }

  // DELETE — unlink X account
  if (req.method === "DELETE") {
    const { wallet } = req.body;
    if (!wallet) {
      return res.status(400).json({ error: "wallet is required" });
    }

    const tokenVerification = await verifyBearerToken(bearerToken, wallet);
    if (!tokenVerification.valid) {
      return res.status(403).json({ error: "Invalid authentication" });
    }

    const { error: deleteError } = await supabase
      .from("x_users")
      .delete()
      .eq("wallet_address", wallet.toLowerCase());

    if (deleteError) {
      console.error("[TweetPaymentSettings] Delete error:", deleteError.message);
      return res.status(500).json({ error: "Failed to unlink account" });
    }

    console.log(`[TweetPaymentSettings] Unlinked X account for ${wallet.slice(0, 8)}...`);
    return res.status(200).json({ success: true });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { wallet, x_username, enabled, daily_limit } = req.body;

  if (!wallet) {
    return res.status(400).json({ error: "wallet is required" });
  }

  // Verify bearer token matches wallet
  const tokenVerification = await verifyBearerToken(bearerToken, wallet);
  if (!tokenVerification.valid) {
    return res.status(403).json({ error: "Invalid authentication" });
  }

  // If x_username is provided, link the X account
  if (x_username) {
    const xUser = await lookupXUser(x_username);
    if (!xUser) {
      return res.status(400).json({ error: `X user @${x_username} not found` });
    }

    // Upsert into x_users
    const { error: upsertError } = await supabase.from("x_users").upsert(
      {
        x_user_id: xUser.id,
        x_username: xUser.username,
        wallet_address: wallet.toLowerCase(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "x_user_id" }
    );

    if (upsertError) {
      console.error("[TweetPaymentSettings] Upsert error:", upsertError.message);
      return res.status(500).json({ error: "Failed to link X account" });
    }

    console.log(
      `[TweetPaymentSettings] Linked @${xUser.username} (${xUser.id}) to ${wallet.slice(0, 8)}...`
    );
  }

  // Build update object for toggle/limit changes
  const updates: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof enabled === "boolean") {
    updates.tweet_payments_enabled = enabled;
    if (enabled) {
      updates.tweet_payments_enabled_at = new Date().toISOString();
    }
  }

  if (typeof daily_limit === "number" && daily_limit > 0 && daily_limit <= 10000) {
    updates.tweet_payment_daily_limit = daily_limit;
  }

  if (Object.keys(updates).length > 1) {
    const { error: updateError } = await supabase
      .from("x_users")
      .update(updates)
      .eq("wallet_address", wallet.toLowerCase());

    if (updateError) {
      console.error("[TweetPaymentSettings] Update error:", updateError.message);
      return res.status(500).json({ error: "Failed to update settings" });
    }
  }

  console.log(
    `[TweetPaymentSettings] Updated for ${wallet.slice(0, 8)}...: enabled=${enabled}, limit=${daily_limit}`
  );

  return res.status(200).json({ success: true });
}
