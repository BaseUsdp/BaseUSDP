/**
 * List a wallet's registered webhooks.
 * GET /api/webhooks/list?wallet=<addr>
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

  const wallet = (req.query.wallet as string | undefined)?.trim();
  if (!wallet) return res.status(400).json({ error: "wallet is required" });

  const { data, error } = await supabase
    .from("user_webhooks")
    .select(
      "id,url,secret,label,enabled,notify_incoming,notify_outgoing,notify_x402,notify_deposit,notify_withdraw,notify_scheduled,last_fired_at,last_status,last_error,consecutive_failures,created_at"
    )
    .eq("user_wallet", wallet.toLowerCase())
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[Webhooks/list] error:", error);
    return res.status(500).json({ error: "Failed to list webhooks" });
  }

  return res.status(200).json({ success: true, webhooks: data ?? [] });
}
