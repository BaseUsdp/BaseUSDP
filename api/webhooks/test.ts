/**
 * Fire a one-off test ping at a single webhook so the user can verify
 * their endpoint is reachable and the signature scheme is wired up.
 *
 * POST /api/webhooks/test
 * Body: { wallet, id }
 *
 * Sends a payload with event="test". Updates the row's last_status /
 * last_error fields so the UI can show the result inline.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";
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

const TIMEOUT_MS = 5_000;

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

  const { wallet, id } = req.body ?? {};
  if (!wallet || typeof wallet !== "string") {
    return res.status(400).json({ error: "wallet is required" });
  }
  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "id is required" });
  }

  const verification = await verifyBearerToken(bearer, wallet);
  if (!verification.valid) return res.status(403).json({ error: "Invalid authentication" });

  const { data: row } = await supabase
    .from("user_webhooks")
    .select("id,url,secret")
    .eq("id", id)
    .eq("user_wallet", wallet.toLowerCase())
    .maybeSingle();

  if (!row) return res.status(404).json({ error: "Webhook not found" });

  const safety = isWebhookUrlSafe(row.url);
  if (!safety.ok) return res.status(400).json({ error: safety.reason });

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = JSON.stringify({
    event: "test",
    timestamp: Number(timestamp),
    delivery_id: row.id,
    payload: { message: "This is a BASEUSDP webhook test." },
  });
  const signature = createHmac("sha256", row.secret).update(`${timestamp}.${body}`).digest("hex");

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  let status: number | null = null;
  let errorMsg: string | null = null;
  try {
    const r = await fetch(row.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "BASEUSDP-Webhook/1.0",
        "X-BaseUSDP-Event": "test",
        "X-BaseUSDP-Timestamp": timestamp,
        "X-BaseUSDP-Signature": `sha256=${signature}`,
      },
      body,
      signal: ctl.signal,
      redirect: "manual",
    });
    status = r.status;
    if (!(r.status >= 200 && r.status < 300)) errorMsg = `HTTP ${r.status}`;
  } catch (err: any) {
    errorMsg = err?.name === "AbortError" ? "Timeout (5s)" : err?.message || "Network error";
  } finally {
    clearTimeout(timer);
  }

  await supabase
    .from("user_webhooks")
    .update({
      last_fired_at: new Date().toISOString(),
      last_status: status,
      last_error: errorMsg,
      ...(errorMsg ? {} : { consecutive_failures: 0 }),
    })
    .eq("id", row.id);

  if (errorMsg) {
    return res.status(200).json({ success: false, status, error: errorMsg });
  }
  return res.status(200).json({ success: true, status });
}
