/**
 * Farcaster auto-cast publish
 * POST /api/farcaster/auto-cast
 *
 * Fired by the dashboard right after a successful deposit or withdrawal.
 * Looks up the user's auto_cast settings; if enabled for that event,
 * publishes a cast from the @baseusdp bot account mentioning the user.
 *
 * Privacy: amount is included ONLY if auto_cast_include_amount=true.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { publishCast } from "../lib/neynar-cast.js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const ALLOWED_ORIGINS = [
  "https://baseusdp.com",
  "https://www.baseusdp.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

function getAllowedOrigin(origin: string | undefined): string {
  if (!origin) return "https://www.baseusdp.com";
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (origin.match(/^https:\/\/code-whisperer-33[\w-]*\.vercel\.app/)) return origin;
  if (origin.match(/^https:\/\/baseusdp[\w-]*\.vercel\.app/)) return origin;
  return "https://www.baseusdp.com";
}

const RATE_LIMIT_MS = 60_000;
const SUPPORTED_EVENTS = ["deposit", "withdraw"] as const;
type EventType = (typeof SUPPORTED_EVENTS)[number];

function buildCastText(
  username: string,
  eventType: EventType,
  amount: number | null,
  token: string | null
): string {
  const amountStr =
    amount != null && token != null && Number.isFinite(amount) && amount > 0
      ? ` $${amount.toFixed(2)} ${token}`
      : "";
  if (eventType === "deposit") {
    return `@${username} just shielded${amountStr} a private deposit on Base via @baseusdp 🛡️\n\nhttps://baseusdp.com`;
  }
  return `@${username} just withdrew${amountStr} privately from @baseusdp on Base 🛡️\n\nhttps://baseusdp.com`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getAllowedOrigin(req.headers.origin as string | undefined);
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Database not configured" });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { wallet, event_type, amount, token } = req.body ?? {};
    if (!wallet || typeof wallet !== "string") {
      return res.status(400).json({ error: "wallet is required" });
    }
    if (!SUPPORTED_EVENTS.includes(event_type)) {
      return res.status(400).json({ error: "event_type must be 'deposit' or 'withdraw'" });
    }
    const eventType = event_type as EventType;

    const { data: user } = await supabase
      .from("farcaster_users")
      .select(
        "farcaster_username,auto_cast_enabled,auto_cast_on_deposit,auto_cast_on_withdraw,auto_cast_include_amount,last_auto_cast_deposit_at,last_auto_cast_withdraw_at"
      )
      .eq("wallet_address", wallet.toLowerCase())
      .maybeSingle();

    if (!user) {
      return res.status(200).json({ success: false, skipped: "no_farcaster_account" });
    }
    if (!user.farcaster_username) {
      return res.status(200).json({ success: false, skipped: "no_username" });
    }
    if (!user.auto_cast_enabled) {
      return res.status(200).json({ success: false, skipped: "not_enabled" });
    }
    if (eventType === "deposit" && !user.auto_cast_on_deposit) {
      return res.status(200).json({ success: false, skipped: "deposit_disabled" });
    }
    if (eventType === "withdraw" && !user.auto_cast_on_withdraw) {
      return res.status(200).json({ success: false, skipped: "withdraw_disabled" });
    }

    // Rate limit: 1 cast per event type per wallet per RATE_LIMIT_MS.
    const lastAt =
      eventType === "deposit"
        ? user.last_auto_cast_deposit_at
        : user.last_auto_cast_withdraw_at;
    if (lastAt) {
      const lastMs = new Date(lastAt).getTime();
      if (Date.now() - lastMs < RATE_LIMIT_MS) {
        return res.status(200).json({ success: false, skipped: "rate_limited" });
      }
    }

    // Build cast text — include amount only if the user opted in.
    const showAmount = !!user.auto_cast_include_amount;
    const numericAmount =
      showAmount && typeof amount === "number" && Number.isFinite(amount) && amount > 0
        ? amount
        : null;
    const tokenStr =
      showAmount && (token === "USDC" || token === "USDT") ? token : null;

    const castText = buildCastText(
      user.farcaster_username,
      eventType,
      numericAmount,
      tokenStr
    );

    const castHash = await publishCast(castText);
    if (!castHash) {
      return res.status(500).json({ success: false, error: "Failed to publish cast" });
    }

    const lastColumn =
      eventType === "deposit" ? "last_auto_cast_deposit_at" : "last_auto_cast_withdraw_at";
    await supabase
      .from("farcaster_users")
      .update({ [lastColumn]: new Date().toISOString() })
      .eq("wallet_address", wallet.toLowerCase());

    console.log(`[AutoCast] published ${eventType} cast for @${user.farcaster_username} (${castHash})`);
    return res.status(200).json({ success: true, cast_hash: castHash });
  } catch (error: any) {
    console.error("[AutoCast] error:", error);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}
