/**
 * Register a new outgoing webhook.
 * POST /api/webhooks/create
 * Body: { wallet, url, label? }
 *
 * Caps at 5 webhooks per wallet. URL must be https:// and not point at
 * loopback / private / link-local space. Secret is generated server-side.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { extractBearerToken, verifyBearerToken } from "../lib/bearer-auth.js";
import { isWebhookUrlSafe } from "../lib/webhook-notify.js";

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

const MAX_WEBHOOKS_PER_WALLET = 5;
const URL_MAX_LEN = 2048;
const LABEL_MAX_LEN = 60;

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

  const bearer = extractBearerToken(req);
  if (!bearer) return res.status(401).json({ error: "Authentication required" });

  const { wallet, url, label } = req.body ?? {};
  if (!wallet || typeof wallet !== "string") {
    return res.status(400).json({ error: "wallet is required" });
  }
  if (!url || typeof url !== "string" || url.length > URL_MAX_LEN) {
    return res.status(400).json({ error: "url is required (max 2048 chars)" });
  }
  if (label && (typeof label !== "string" || label.length > LABEL_MAX_LEN)) {
    return res.status(400).json({ error: "label must be ≤ 60 chars" });
  }

  const safety = isWebhookUrlSafe(url);
  if (!safety.ok) return res.status(400).json({ error: safety.reason });

  const verification = await verifyBearerToken(bearer, wallet);
  if (!verification.valid) return res.status(403).json({ error: "Invalid authentication" });

  const { count, error: countError } = await supabase
    .from("user_webhooks")
    .select("id", { head: true, count: "exact" })
    .eq("user_wallet", wallet.toLowerCase());

  if (countError) {
    console.error("[Webhooks/create] count error:", countError);
    return res.status(500).json({ error: "Failed to check webhook count" });
  }
  if ((count ?? 0) >= MAX_WEBHOOKS_PER_WALLET) {
    return res.status(400).json({
      error: `Cap reached — max ${MAX_WEBHOOKS_PER_WALLET} webhooks per wallet`,
    });
  }

  const secret = `whsec_${randomBytes(32).toString("hex")}`;

  const { data, error } = await supabase
    .from("user_webhooks")
    .insert({
      user_wallet: wallet.toLowerCase(),
      url,
      secret,
      label: label || null,
    })
    .select(
      "id,url,secret,label,enabled,notify_incoming,notify_outgoing,notify_x402,notify_deposit,notify_withdraw,notify_scheduled,last_fired_at,last_status,last_error,consecutive_failures,created_at"
    )
    .single();

  if (error) {
    console.error("[Webhooks/create] insert error:", error);
    return res.status(500).json({ error: "Failed to register webhook" });
  }

  return res.status(200).json({ success: true, webhook: data });
}
