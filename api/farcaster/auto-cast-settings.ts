/**
 * Farcaster auto-cast settings
 * GET  /api/farcaster/auto-cast-settings?wallet=0x... — current toggles
 * POST /api/farcaster/auto-cast-settings — update toggles (bearer auth)
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { extractBearerToken, verifyBearerToken } from "../lib/bearer-auth.js";

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

interface Settings {
  has_farcaster: boolean;
  farcaster_username: string | null;
  enabled: boolean;
  on_deposit: boolean;
  on_withdraw: boolean;
  include_amount: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  has_farcaster: false,
  farcaster_username: null,
  enabled: false,
  on_deposit: true,
  on_withdraw: true,
  include_amount: false,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getAllowedOrigin(req.headers.origin as string | undefined);
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Database not configured" });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  if (req.method === "GET") {
    const wallet = (req.query.wallet as string | undefined) ?? "";
    if (!wallet) return res.status(400).json({ error: "wallet query param is required" });

    const { data, error } = await supabase
      .from("farcaster_users")
      .select(
        "farcaster_username,auto_cast_enabled,auto_cast_on_deposit,auto_cast_on_withdraw,auto_cast_include_amount"
      )
      .eq("wallet_address", wallet.toLowerCase())
      .maybeSingle();

    if (error) {
      console.error("[AutoCastSettings] read error:", error);
      return res.status(500).json({ error: "Failed to read settings" });
    }

    if (!data) {
      return res.status(200).json({ success: true, settings: DEFAULT_SETTINGS });
    }

    const settings: Settings = {
      has_farcaster: !!data.farcaster_username,
      farcaster_username: data.farcaster_username ?? null,
      enabled: !!data.auto_cast_enabled,
      on_deposit: data.auto_cast_on_deposit ?? true,
      on_withdraw: data.auto_cast_on_withdraw ?? true,
      include_amount: !!data.auto_cast_include_amount,
    };
    return res.status(200).json({ success: true, settings });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const bearerToken = extractBearerToken(req);
  if (!bearerToken) return res.status(401).json({ error: "Authentication required" });

  const { wallet, enabled, on_deposit, on_withdraw, include_amount } = req.body ?? {};
  if (!wallet || typeof wallet !== "string") {
    return res.status(400).json({ error: "wallet is required" });
  }

  const tokenVerification = await verifyBearerToken(bearerToken, wallet);
  if (!tokenVerification.valid) {
    return res.status(403).json({ error: "Invalid authentication" });
  }

  // The user must already have a farcaster_users row (i.e. they've at least
  // installed the mini-app or used cast-payments). We don't auto-provision
  // here — if there's no row, tell the client to surface a "Connect
  // Farcaster" affordance.
  const { data: existing } = await supabase
    .from("farcaster_users")
    .select("wallet_address")
    .eq("wallet_address", wallet.toLowerCase())
    .maybeSingle();

  if (!existing) {
    return res.status(400).json({
      error:
        "No Farcaster account linked to this wallet. Open the BASEUSDP mini-app in Warpcast first to link your FID.",
    });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof enabled === "boolean") updates.auto_cast_enabled = enabled;
  if (typeof on_deposit === "boolean") updates.auto_cast_on_deposit = on_deposit;
  if (typeof on_withdraw === "boolean") updates.auto_cast_on_withdraw = on_withdraw;
  if (typeof include_amount === "boolean") updates.auto_cast_include_amount = include_amount;

  const { error: updateError } = await supabase
    .from("farcaster_users")
    .update(updates)
    .eq("wallet_address", wallet.toLowerCase());

  if (updateError) {
    console.error("[AutoCastSettings] update error:", updateError);
    return res.status(500).json({ error: "Failed to update settings" });
  }

  return res.status(200).json({ success: true });
}
