/**
 * X OAuth 2.0 Start
 * POST /api/twitter/oauth-start
 *
 * Generates PKCE challenge + state, stores in DB, returns X authorize URL.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { randomBytes, createHash } from "crypto";
import { extractBearerToken } from "../lib/bearer-auth.js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const X_OAUTH_CLIENT_ID = process.env.X_OAUTH_CLIENT_ID || "";
const REDIRECT_URI =
  process.env.X_OAUTH_REDIRECT_URI ||
  "https://baseusdp.com/api/twitter/oauth-callback";

const ALLOWED_ORIGINS = [
  "https://void402.com",
  "https://www.void402.com",
  "https://baseusdp.com",
  "https://www.baseusdp.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

function getAllowedOrigin(origin: string | undefined): string {
  if (!origin) return "https://www.baseusdp.com";
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (origin.match(/^https:\/\/code-whisperer-33[\w-]*\.vercel\.app/))
    return origin;
  return "https://www.baseusdp.com";
}

function base64URLEncode(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getAllowedOrigin(req.headers.origin as string | undefined);
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Database not configured" });
  }

  if (!X_OAUTH_CLIENT_ID) {
    return res.status(500).json({ error: "X OAuth not configured" });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Authenticate user
  const bearerToken = extractBearerToken(req);
  if (!bearerToken) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const { data: session } = await supabase
    .from("auth_sessions")
    .select("user_wallet")
    .eq("session_token", bearerToken)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (!session) {
    return res.status(401).json({ error: "Invalid session" });
  }

  // Generate PKCE code_verifier and code_challenge
  const codeVerifier = base64URLEncode(randomBytes(32));
  const codeChallenge = base64URLEncode(
    createHash("sha256").update(codeVerifier).digest()
  );
  const state = randomBytes(16).toString("hex");

  // Store OAuth state (expires in 10 minutes)
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { error: insertError } = await supabase.from("x_oauth_state").insert({
    state,
    code_verifier: codeVerifier,
    wallet_address: session.user_wallet.toLowerCase(),
    session_token: bearerToken,
    expires_at: expiresAt,
  });

  if (insertError) {
    console.error("[OAuthStart] Insert error:", insertError.message);
    return res.status(500).json({ error: "Failed to initiate OAuth" });
  }

  // Clean up expired states
  await supabase
    .from("x_oauth_state")
    .delete()
    .lt("expires_at", new Date().toISOString());

  const authorizeUrl =
    `https://x.com/i/oauth2/authorize?` +
    `response_type=code&` +
    `client_id=${X_OAUTH_CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
    `scope=tweet.read%20users.read&` +
    `state=${state}&` +
    `code_challenge=${codeChallenge}&` +
    `code_challenge_method=S256`;

  console.log(
    `[OAuthStart] Started OAuth for wallet ${session.user_wallet.slice(0, 8)}...`
  );

  return res.status(200).json({ authorize_url: authorizeUrl });
}
