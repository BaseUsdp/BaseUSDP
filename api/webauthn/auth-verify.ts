/**
 * Finalize biometric authentication.
 * POST /api/webauthn/auth-verify
 * Body: { wallet, response }
 *
 * Public (no bearer): unlocks a session that may have expired. On success,
 * issues a fresh session token in the auth_sessions table the same way the
 * normal wallet-signed login does, and returns it so authService can store it.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { randomBytes } from "crypto";
import { getRpContext, setCors } from "../lib/webauthn-config.js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const SESSION_TTL_SECONDS = 24 * 60 * 60; // 24h

function base64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Database not configured" });
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { wallet, response } = req.body ?? {};
  if (!wallet || typeof wallet !== "string") {
    return res.status(400).json({ error: "wallet is required" });
  }
  if (!response || typeof response !== "object") {
    return res.status(400).json({ error: "response is required" });
  }

  const walletLc = wallet.toLowerCase();
  const credentialId = (response as any).id;
  if (typeof credentialId !== "string") {
    return res.status(400).json({ error: "Invalid response shape" });
  }

  const { data: credRow } = await supabase
    .from("webauthn_credentials")
    .select("credential_id,public_key,counter,transports")
    .eq("user_wallet", walletLc)
    .eq("credential_id", credentialId)
    .maybeSingle();

  if (!credRow) {
    return res.status(400).json({ error: "Unknown credential for this wallet" });
  }

  const { data: challengeRow } = await supabase
    .from("webauthn_challenges")
    .select("challenge,expires_at")
    .eq("user_wallet", walletLc)
    .eq("type", "authentication")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!challengeRow) {
    return res.status(400).json({ error: "No active auth challenge — re-init" });
  }
  if (new Date(challengeRow.expires_at) < new Date()) {
    return res.status(400).json({ error: "Challenge expired — re-init" });
  }

  const { rpID, expectedOrigin } = getRpContext(req);

  let result;
  try {
    result = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin,
      expectedRPID: rpID,
      credential: {
        id: credRow.credential_id,
        publicKey: base64urlToBytes(credRow.public_key),
        counter: Number(credRow.counter ?? 0),
        transports: (credRow.transports as AuthenticatorTransport[] | null) ?? undefined,
      },
      requireUserVerification: false,
    } as any);
  } catch (err: any) {
    console.warn("[WebAuthn/auth-verify] verify error:", err?.message);
    return res.status(400).json({ error: err?.message || "Verification failed" });
  }

  if (!result.verified) {
    return res.status(400).json({ error: "Authentication not verified" });
  }

  // Burn the challenge.
  await supabase
    .from("webauthn_challenges")
    .delete()
    .eq("user_wallet", walletLc)
    .eq("type", "authentication");

  // Update counter + last_used_at.
  const newCounter = (result.authenticationInfo as any).newCounter ?? credRow.counter;
  await supabase
    .from("webauthn_credentials")
    .update({
      counter: newCounter,
      last_used_at: new Date().toISOString(),
    })
    .eq("credential_id", credentialId);

  // Mint a fresh session token mirroring the wallet-auth flow.
  const sessionToken = `wha_${randomBytes(32).toString("hex")}`;
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();

  const { error: sessionErr } = await supabase.from("auth_sessions").insert({
    session_token: sessionToken,
    user_wallet: walletLc,
    expires_at: expiresAt,
  });

  if (sessionErr) {
    console.error("[WebAuthn/auth-verify] session insert error:", sessionErr);
    return res.status(500).json({ error: "Failed to issue session" });
  }

  return res.status(200).json({
    success: true,
    sessionToken,
    expiresIn: SESSION_TTL_SECONDS,
  });
}
