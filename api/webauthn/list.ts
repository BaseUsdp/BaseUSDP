/**
 * List a wallet's registered biometric devices.
 * GET /api/webauthn/list?wallet=<addr>
 *
 * Returns id, device_label, transports, created_at, last_used_at — never
 * the public key or credential_id (those are deliberately opaque).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { setCors } from "../lib/webauthn-config.js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Database not configured" });
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  const wallet = (req.query.wallet as string | undefined)?.trim();
  if (!wallet) return res.status(400).json({ error: "wallet is required" });

  const { data, error } = await supabase
    .from("webauthn_credentials")
    .select("id,device_label,transports,created_at,last_used_at")
    .eq("user_wallet", wallet.toLowerCase())
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[WebAuthn/list] error:", error);
    return res.status(500).json({ error: "Failed to list devices" });
  }

  return res.status(200).json({ success: true, devices: data ?? [] });
}
