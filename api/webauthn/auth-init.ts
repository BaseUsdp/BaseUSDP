/**
 * Begin biometric authentication.
 * POST /api/webauthn/auth-init
 * Body: { wallet }
 *
 * Public (no bearer): the whole point is to unlock when the session token
 * is gone. Returns auth options for navigator.credentials.get() restricted
 * to the wallet's registered credentials (by credential_id).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { getRpContext, setCors } from "../lib/webauthn-config.js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const TTL_MS = 5 * 60 * 1000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Database not configured" });
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { wallet } = req.body ?? {};
  if (!wallet || typeof wallet !== "string") {
    return res.status(400).json({ error: "wallet is required" });
  }

  const walletLc = wallet.toLowerCase();

  const { data: creds } = await supabase
    .from("webauthn_credentials")
    .select("credential_id,transports")
    .eq("user_wallet", walletLc);

  if (!creds || creds.length === 0) {
    return res.status(400).json({ error: "No biometric devices registered for this wallet" });
  }

  const { rpID } = getRpContext(req);

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: creds.map((c) => ({
      id: c.credential_id,
      type: "public-key" as const,
      transports: (c.transports as AuthenticatorTransport[] | null) ?? undefined,
    })),
    userVerification: "preferred",
  });

  // Persist the challenge.
  const expiresAt = new Date(Date.now() + TTL_MS).toISOString();

  await supabase
    .from("webauthn_challenges")
    .delete()
    .eq("user_wallet", walletLc)
    .eq("type", "authentication");

  const { error: insertErr } = await supabase.from("webauthn_challenges").insert({
    user_wallet: walletLc,
    challenge: options.challenge,
    type: "authentication",
    expires_at: expiresAt,
  });

  if (insertErr) {
    console.error("[WebAuthn/auth-init] challenge insert error:", insertErr);
    return res.status(500).json({ error: "Failed to start authentication" });
  }

  return res.status(200).json({ success: true, options });
}
