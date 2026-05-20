/**
 * Begin biometric / passkey registration.
 * POST /api/webauthn/register-init
 * Body: { wallet }
 *
 * Bearer-authed: only an already-signed-in wallet can register a new device.
 * Returns the registration options the browser passes to navigator.credentials.create().
 * Stores the challenge in webauthn_challenges with a 5-minute TTL so register-verify
 * can match against it.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { extractBearerToken, verifyBearerToken } from "../lib/bearer-auth.js";
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

  const bearer = extractBearerToken(req);
  if (!bearer) return res.status(401).json({ error: "Authentication required" });

  const { wallet } = req.body ?? {};
  if (!wallet || typeof wallet !== "string") {
    return res.status(400).json({ error: "wallet is required" });
  }
  const verification = await verifyBearerToken(bearer, wallet);
  if (!verification.valid) return res.status(403).json({ error: "Invalid authentication" });

  const walletLc = wallet.toLowerCase();

  // Look up already-registered credentials so the browser can avoid registering
  // the same key twice on the same device.
  const { data: existing } = await supabase
    .from("webauthn_credentials")
    .select("credential_id,transports")
    .eq("user_wallet", walletLc);

  const excludeCredentials = (existing ?? []).map((c) => ({
    id: c.credential_id,
    type: "public-key" as const,
    transports: (c.transports as AuthenticatorTransport[] | null) ?? undefined,
  }));

  const { rpID, rpName } = getRpContext(req);

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: new TextEncoder().encode(walletLc),
    userName: walletLc,
    userDisplayName: walletLc.slice(0, 6) + "…" + walletLc.slice(-4),
    attestationType: "none",
    excludeCredentials,
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  // Persist the challenge so register-verify can match it.
  const expiresAt = new Date(Date.now() + TTL_MS).toISOString();

  // Clean out any stale challenges for this wallet+type first to keep the
  // table small. Best-effort; failure isn't fatal.
  await supabase
    .from("webauthn_challenges")
    .delete()
    .eq("user_wallet", walletLc)
    .eq("type", "registration");

  const { error: insertError } = await supabase.from("webauthn_challenges").insert({
    user_wallet: walletLc,
    challenge: options.challenge,
    type: "registration",
    expires_at: expiresAt,
  });

  if (insertError) {
    console.error("[WebAuthn/register-init] challenge insert error:", insertError);
    return res.status(500).json({ error: "Failed to start registration" });
  }

  return res.status(200).json({ success: true, options });
}
