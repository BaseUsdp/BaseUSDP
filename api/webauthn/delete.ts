/**
 * Remove a registered biometric device.
 * POST /api/webauthn/delete
 * Body: { wallet, id }
 *
 * Bearer-authed. Deletes the row scoped by both id AND user_wallet so a
 * stranger can't remove someone else's device even with a guessed id.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { extractBearerToken, verifyBearerToken } from "../lib/bearer-auth.js";
import { setCors } from "../lib/webauthn-config.js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res);
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

  const { error } = await supabase
    .from("webauthn_credentials")
    .delete()
    .eq("id", id)
    .eq("user_wallet", wallet.toLowerCase());

  if (error) {
    console.error("[WebAuthn/delete] error:", error);
    return res.status(500).json({ error: "Failed to remove device" });
  }

  return res.status(200).json({ success: true });
}
