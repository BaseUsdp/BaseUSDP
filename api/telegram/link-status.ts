/**
 * Telegram link status
 * GET /api/telegram/link-status?wallet=0x...
 *
 * Returns the current link state + toggles for the wallet. No auth — the
 * data is non-sensitive (just on/off flags and the user's own chat_id is
 * never returned).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

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

const DEFAULT_STATUS = {
  linked: false,
  telegram_username: null,
  linking_code: null,
  linking_code_expires_at: null,
  enabled: true,
  notify_incoming: true,
  notify_outgoing: false,
  notify_x402: true,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getAllowedOrigin(req.headers.origin as string | undefined);
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Database not configured" });
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  const wallet = (req.query.wallet as string | undefined) ?? "";
  if (!wallet) return res.status(400).json({ error: "wallet query param is required" });

  const { data } = await supabase
    .from("telegram_links")
    .select(
      "chat_id,telegram_username,linking_code,linking_code_expires_at,enabled,notify_incoming,notify_outgoing,notify_x402"
    )
    .eq("user_wallet", wallet.toLowerCase())
    .maybeSingle();

  if (!data) {
    return res.status(200).json({ success: true, status: DEFAULT_STATUS });
  }

  const codeExpired =
    !data.linking_code_expires_at ||
    new Date(data.linking_code_expires_at).getTime() < Date.now();

  return res.status(200).json({
    success: true,
    status: {
      linked: !!data.chat_id,
      telegram_username: data.telegram_username ?? null,
      linking_code: codeExpired ? null : data.linking_code,
      linking_code_expires_at: codeExpired ? null : data.linking_code_expires_at,
      enabled: !!data.enabled,
      notify_incoming: !!data.notify_incoming,
      notify_outgoing: !!data.notify_outgoing,
      notify_x402: !!data.notify_x402,
    },
  });
}
