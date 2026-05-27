/**
 * GET /api/mcp/resolve-handle?handle=jesse
 *
 * Public lookup used by the BASEUSDP Base MCP plugin. Takes a BASEUSDP
 * @username and returns the on-chain wallet address behind it so an AI
 * agent can use it to construct a tip or payment.
 *
 * No auth: this endpoint exists specifically for the public plugin. The
 * address it returns is already discoverable on-chain via the user's
 * transaction history; this just removes the need to know the address up
 * front when the user knows the handle.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  if (!supabaseUrl || !supabaseKey) {
    return res
      .status(500)
      .json({ success: false, error: "Database not configured" });
  }

  const { handle } = req.query;
  if (!handle || typeof handle !== "string") {
    return res
      .status(400)
      .json({ success: false, error: "handle query parameter is required" });
  }
  const cleanHandle = handle.trim().replace(/^@/, "");
  if (!cleanHandle) {
    return res
      .status(400)
      .json({ success: false, error: "handle is empty" });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: profile, error } = await supabase
      .from("user_profiles")
      .select("wallet_address, username, profile_picture")
      .ilike("username", cleanHandle)
      .single();

    if (error || !profile) {
      return res
        .status(404)
        .json({ success: false, error: "Handle not found" });
    }

    return res.status(200).json({
      success: true,
      handle: `@${profile.username}`,
      address: profile.wallet_address,
      profilePicture: profile.profile_picture ?? null,
    });
  } catch (err: any) {
    console.error("[mcp/resolve-handle] error:", err?.message || err);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
}
