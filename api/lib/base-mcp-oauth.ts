/**
 * OAuth 2.1 + PKCE + Dynamic Client Registration for the Base MCP server
 * (`mcp.base.org`). Implements the MCP-specified auth flow so the in-app AI
 * Terminal can drive a user's Base Account via Claude's `mcp_servers` API.
 *
 * Public client (no client_secret). PKCE is mandatory; tokens are stored as
 * HTTP-only cookies on the BASEUSDP domain so they're sent automatically with
 * every chat request but unreadable from JS.
 *
 * Environment:
 *   BASE_MCP_CLIENT_ID  (optional) pre-registered client_id. If unset, we
 *                       register dynamically and cache the id in module
 *                       state — fine for low-volume serverless deployments
 *                       but you should set this in prod to skip the
 *                       roundtrip and survive cold starts.
 *   BASE_MCP_REDIRECT_URI (required) absolute URL for the callback, e.g.
 *                       https://baseusdp.com/api/auth/base-mcp/callback
 */

import crypto from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export const BASE_MCP_ISSUER = "https://mcp.base.org";
export const BASE_MCP_AUTHORIZE = `${BASE_MCP_ISSUER}/authorize`;
export const BASE_MCP_TOKEN = `${BASE_MCP_ISSUER}/token`;
export const BASE_MCP_REGISTER = `${BASE_MCP_ISSUER}/register`;
export const BASE_MCP_SCOPES = "agent_wallet:transact";

const ACCESS_COOKIE = "basemcp_at";
const REFRESH_COOKIE = "basemcp_rt";
const EXPIRY_COOKIE = "basemcp_exp";
const TX_COOKIE = "basemcp_tx";

interface TokenSet {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
}

interface PendingTx {
  verifier: string;
  state: string;
  returnTo: string;
}

let cachedClientId: string | null = null;

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function generatePkce(): { verifier: string; challenge: string } {
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export function generateState(): string {
  return base64url(crypto.randomBytes(24));
}

export async function getClientId(): Promise<string> {
  if (process.env.BASE_MCP_CLIENT_ID) return process.env.BASE_MCP_CLIENT_ID;
  if (cachedClientId) return cachedClientId;

  const redirectUri = process.env.BASE_MCP_REDIRECT_URI;
  if (!redirectUri) {
    throw new Error("BASE_MCP_REDIRECT_URI is not set");
  }

  const res = await fetch(BASE_MCP_REGISTER, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_name: "BASEUSDP AI Terminal",
      redirect_uris: [redirectUri],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: BASE_MCP_SCOPES,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Base MCP DCR failed: ${res.status} ${body}`);
  }
  const data = (await res.json()) as { client_id: string };
  cachedClientId = data.client_id;
  return cachedClientId;
}

export function buildAuthorizeUrl(args: {
  clientId: string;
  redirectUri: string;
  state: string;
  challenge: string;
}): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: args.clientId,
    redirect_uri: args.redirectUri,
    scope: BASE_MCP_SCOPES,
    state: args.state,
    code_challenge: args.challenge,
    code_challenge_method: "S256",
  });
  return `${BASE_MCP_AUTHORIZE}?${params.toString()}`;
}

export async function exchangeCodeForToken(args: {
  clientId: string;
  code: string;
  verifier: string;
  redirectUri: string;
}): Promise<TokenSet> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: args.code,
    redirect_uri: args.redirectUri,
    client_id: args.clientId,
    code_verifier: args.verifier,
  });
  const res = await fetch(BASE_MCP_TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Base MCP token exchange failed: ${res.status} ${text}`);
  }
  return parseTokenResponse(await res.json());
}

export async function refreshAccessToken(args: {
  clientId: string;
  refreshToken: string;
}): Promise<TokenSet> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: args.refreshToken,
    client_id: args.clientId,
  });
  const res = await fetch(BASE_MCP_TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Base MCP refresh failed: ${res.status} ${text}`);
  }
  return parseTokenResponse(await res.json());
}

function parseTokenResponse(json: any): TokenSet {
  const expiresIn = Number(json.expires_in ?? 3600);
  return {
    accessToken: String(json.access_token),
    refreshToken: json.refresh_token ? String(json.refresh_token) : null,
    expiresAt: Date.now() + Math.max(60, expiresIn - 30) * 1000,
  };
}

// ---------- Cookies ----------

function readCookies(req: VercelRequest): Record<string, string> {
  const raw = req.headers.cookie;
  if (!raw) return {};
  const out: Record<string, string> = {};
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join("="));
  }
  return out;
}

function isProd(req: VercelRequest): boolean {
  const host = req.headers.host || "";
  return !host.startsWith("localhost");
}

function cookieAttrs(req: VercelRequest, opts: { maxAge?: number } = {}): string {
  // SameSite=None+Secure rather than Lax because the OAuth callback redirect
  // from mcp.base.org back to baseusdp.com counts as cross-site under stricter
  // privacy modes (Safari ITP, Firefox total cookie protection). Lax should
  // work for top-level navigations per the spec, but in practice many
  // browsers drop the cookie. None+Secure is the explicit "this can travel
  // across sites" setting — safe here because cookies are HttpOnly and the
  // state cookie expires in 10 minutes.
  const parts = [
    "Path=/",
    "HttpOnly",
    isProd(req) ? "SameSite=None" : "SameSite=Lax",
  ];
  if (isProd(req)) parts.push("Secure");
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${Math.max(0, opts.maxAge)}`);
  return parts.join("; ");
}

export function setTokenCookies(req: VercelRequest, res: VercelResponse, tokens: TokenSet): void {
  const accessMaxAge = Math.max(60, Math.floor((tokens.expiresAt - Date.now()) / 1000));
  const refreshMaxAge = 60 * 60 * 24 * 30; // 30d
  const cookies: string[] = [
    `${ACCESS_COOKIE}=${encodeURIComponent(tokens.accessToken)}; ${cookieAttrs(req, { maxAge: refreshMaxAge })}`,
    `${EXPIRY_COOKIE}=${tokens.expiresAt}; ${cookieAttrs(req, { maxAge: refreshMaxAge })}`,
  ];
  if (tokens.refreshToken) {
    cookies.push(
      `${REFRESH_COOKIE}=${encodeURIComponent(tokens.refreshToken)}; ${cookieAttrs(req, { maxAge: refreshMaxAge })}`,
    );
  }
  void accessMaxAge;
  res.setHeader("Set-Cookie", cookies);
}

export function clearTokenCookies(req: VercelRequest, res: VercelResponse): void {
  const expired = `${cookieAttrs(req, { maxAge: 0 })}`;
  res.setHeader("Set-Cookie", [
    `${ACCESS_COOKIE}=; ${expired}`,
    `${REFRESH_COOKIE}=; ${expired}`,
    `${EXPIRY_COOKIE}=; ${expired}`,
    `${TX_COOKIE}=; ${expired}`,
  ]);
}

export function setPendingTxCookie(req: VercelRequest, res: VercelResponse, tx: PendingTx): void {
  const cookie = `${TX_COOKIE}=${encodeURIComponent(JSON.stringify(tx))}; ${cookieAttrs(req, { maxAge: 600 })}`;
  res.setHeader("Set-Cookie", cookie);
}

export function readPendingTxCookie(req: VercelRequest): PendingTx | null {
  const raw = readCookies(req)[TX_COOKIE];
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingTx;
  } catch {
    return null;
  }
}

/**
 * Reads the access token from cookies. Refreshes it transparently if it's
 * about to expire and a refresh token is available. Returns null when no
 * valid token can be obtained — caller should treat that as "user not
 * connected" and skip the Base MCP integration.
 */
export async function readAccessToken(req: VercelRequest, res: VercelResponse): Promise<string | null> {
  const cookies = readCookies(req);
  const accessToken = cookies[ACCESS_COOKIE];
  const refreshToken = cookies[REFRESH_COOKIE];
  const expiresAt = Number(cookies[EXPIRY_COOKIE] ?? 0);

  if (accessToken && expiresAt > Date.now()) return accessToken;

  if (!refreshToken) return null;

  try {
    const clientId = await getClientId();
    const refreshed = await refreshAccessToken({ clientId, refreshToken });
    setTokenCookies(req, res, refreshed);
    return refreshed.accessToken;
  } catch (err) {
    console.warn("[base-mcp-oauth] refresh failed:", err);
    clearTokenCookies(req, res);
    return null;
  }
}

export function hasAccessTokenCookie(req: VercelRequest): boolean {
  const cookies = readCookies(req);
  return !!cookies[ACCESS_COOKIE] || !!cookies[REFRESH_COOKIE];
}
