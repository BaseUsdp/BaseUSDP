/**
 * POST /api/push/subscribe
 *
 * Stores a Web Push subscription for the authenticated wallet. Body is
 * the result of `PushManager.subscribe()` serialized via `subscription.toJSON()`:
 *
 *   { endpoint, keys: { p256dh, auth } }
 *
 * Upserts on the endpoint (browsers can re-issue the same endpoint when
 * the user re-enables notifications). Auth required so we know which
 * wallet owns the subscription.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { extractBearerToken } from "../lib/bearer-auth.js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }
  if (!supabaseUrl || !supabaseKey) {
    return res
      .status(500)
      .json({ success: false, error: "Database not configured" });
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  const token = extractBearerToken(req);
  if (!token) {
    return res
      .status(401)
      .json({ success: false, error: "Authentication required" });
  }
  const { data: session } = await supabase
    .from("auth_sessions")
    .select("user_wallet")
    .eq("session_token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!session?.user_wallet) {
    return res
      .status(401)
      .json({ success: false, error: "Invalid or expired session" });
  }

  const body = (req.body ?? {}) as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  const endpoint = body.endpoint;
  const p256dh = body.keys?.p256dh;
  const auth = body.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return res
      .status(400)
      .json({ success: false, error: "endpoint + keys.p256dh + keys.auth required" });
  }

  const userAgent = (req.headers["user-agent"] as string | undefined) ?? null;
  const wallet = (session.user_wallet as string).toLowerCase();

  // Upsert on endpoint — re-subscribing on the same browser shouldn't
  // create dupes.
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_wallet: wallet,
        endpoint,
        p256dh,
        auth,
        user_agent: userAgent,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );

  if (error) {
    console.error("[push/subscribe] upsert error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to store subscription" });
  }

  return res.status(200).json({ success: true });
}
