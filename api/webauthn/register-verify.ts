/**
 * Finalize biometric registration.
 * POST /api/webauthn/register-verify
 * Body: { wallet, response, deviceLabel? }
 *
 * Looks up the stored challenge, verifies the attestation, and saves the
 * new credential to webauthn_credentials. Idempotent on credential_id —
 * re-submitting the same response just updates the row.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { extractBearerToken, verifyBearerToken } from "../lib/bearer-auth.js";
import { getRpContext, setCors } from "../lib/webauthn-config.js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const DEVICE_LABEL_MAX_LEN = 60;

function bytesToBase64url(bytes: Uint8Array): string {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

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

  const { wallet, response, deviceLabel } = req.body ?? {};
  if (!wallet || typeof wallet !== "string") {
    return res.status(400).json({ error: "wallet is required" });
  }
  if (!response || typeof response !== "object") {
    return res.status(400).json({ error: "response is required" });
  }
  if (deviceLabel && (typeof deviceLabel !== "string" || deviceLabel.length > DEVICE_LABEL_MAX_LEN)) {
    return res.status(400).json({ error: `deviceLabel must be ≤ ${DEVICE_LABEL_MAX_LEN} chars` });
  }

  const verification = await verifyBearerToken(bearer, wallet);
  if (!verification.valid) return res.status(403).json({ error: "Invalid authentication" });

  const walletLc = wallet.toLowerCase();

  const { data: challengeRow } = await supabase
    .from("webauthn_challenges")
    .select("challenge,expires_at")
    .eq("user_wallet", walletLc)
    .eq("type", "registration")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!challengeRow) {
    return res.status(400).json({ error: "No active registration challenge — re-init" });
  }
  if (new Date(challengeRow.expires_at) < new Date()) {
    return res.status(400).json({ error: "Challenge expired — re-init" });
  }

  const { rpID, expectedOrigin } = getRpContext(req);

  let result;
  try {
    result = await verifyRegistrationResponse({
      response,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });
  } catch (err: any) {
    console.warn("[WebAuthn/register-verify] verify error:", err?.message);
    return res.status(400).json({ error: err?.message || "Verification failed" });
  }

  if (!result.verified || !result.registrationInfo) {
    return res.status(400).json({ error: "Registration not verified" });
  }

  const info = result.registrationInfo;
  // @simplewebauthn v13 nests these under `credential`.
  const credentialId: string =
    typeof (info as any).credential?.id === "string"
      ? (info as any).credential.id
      : bytesToBase64url((info as any).credential?.id ?? new Uint8Array());
  const publicKeyBytes: Uint8Array =
    (info as any).credential?.publicKey ?? (info as any).credentialPublicKey ?? new Uint8Array();
  const counter: number = (info as any).credential?.counter ?? (info as any).counter ?? 0;
  const transports: string[] | undefined =
    (info as any).credential?.transports ?? (response as any).response?.transports;

  // Burn the challenge so it can't be replayed.
  await supabase
    .from("webauthn_challenges")
    .delete()
    .eq("user_wallet", walletLc)
    .eq("type", "registration");

  const publicKeyB64 = bytesToBase64url(publicKeyBytes);

  const { error: upsertErr } = await supabase
    .from("webauthn_credentials")
    .upsert(
      {
        user_wallet: walletLc,
        credential_id: credentialId,
        public_key: publicKeyB64,
        counter,
        transports: transports ?? null,
        device_label: deviceLabel || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "credential_id" }
    );

  if (upsertErr) {
    console.error("[WebAuthn/register-verify] upsert error:", upsertErr);
    return res.status(500).json({ error: "Failed to save credential" });
  }

  return res.status(200).json({ success: true });
}
