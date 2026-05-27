/**
 * /api/user/mcp-settings
 *
 * Authenticated GET + POST for the user's BASEUSDP Base MCP plugin
 * opt-in flag (`user_profiles.mcp_enabled`).
 *
 * - `GET`  → { success, enabled }
 * - `POST` → body `{ enabled: boolean }` → { success, enabled }
 *
 * Auth: bearer session token (same model as the rest of the dashboard).
 * The session row's `user_wallet` is the user we update — there's no
 * cross-account write path.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { extractBearerToken } from "../lib/bearer-auth.js";

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
  if (origin.match(/^https:\/\/baseusdp[\w-]*\.vercel\.app/)) return origin;
  return "https://www.baseusdp.com";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getAllowedOrigin(req.headers.origin as string | undefined);
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.status(204).end();

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
    .single();
  if (!session?.user_wallet) {
    return res
      .status(401)
      .json({ success: false, error: "Invalid or expired session" });
  }
  const userWallet = session.user_wallet as string;

  if (req.method === "GET") {
    const { data: profile, error } = await supabase
      .from("user_profiles")
      .select("mcp_enabled")
      .ilike("wallet_address", userWallet)
      .maybeSingle();
    if (error) {
      console.error("[user/mcp-settings GET] error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Lookup failed" });
    }
    return res.status(200).json({
      success: true,
      enabled: !!profile?.mcp_enabled,
    });
  }

  if (req.method === "POST") {
    const body = (req.body ?? {}) as { enabled?: unknown };
    if (typeof body.enabled !== "boolean") {
      return res
        .status(400)
        .json({ success: false, error: "enabled (boolean) is required" });
    }
    const { error } = await supabase
      .from("user_profiles")
      .update({ mcp_enabled: body.enabled })
      .ilike("wallet_address", userWallet);
    if (error) {
      console.error("[user/mcp-settings POST] update error:", error);
      return res
        .status(500)
        .json({ success: false, error: "Update failed" });
    }
    return res.status(200).json({ success: true, enabled: body.enabled });
  }

  return res
    .status(405)
    .json({ success: false, error: "Method not allowed" });
}
