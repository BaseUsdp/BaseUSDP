/**
 * GET /api/auth/base-mcp/start
 *
 * Kicks off the Base MCP OAuth flow. Generates PKCE + state, stashes them
 * in a short-lived cookie keyed to this user's browser, then 302s to the
 * authorization endpoint. The user is redirected to Base Account to sign
 * in and approve the `agent_wallet:transact` scope, then bounced back to
 * /api/auth/base-mcp/callback.
 *
 * Optional `?return_to=/dashboard?tab=ai` controls the final redirect after
 * a successful token exchange. Defaults to /dashboard.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  buildAuthorizeUrl,
  generatePkce,
  generateState,
  getClientId,
  setPendingTxCookie,
} from "../../lib/base-mcp-oauth.js";

function safeReturnTo(raw: unknown): string {
  if (typeof raw !== "string" || !raw) return "/dashboard";
  // Only accept same-origin paths to avoid open redirects.
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const redirectUri = process.env.BASE_MCP_REDIRECT_URI;
  if (!redirectUri) {
    return res.status(500).json({ error: "BASE_MCP_REDIRECT_URI is not configured" });
  }

  try {
    const clientId = await getClientId();
    const { verifier, challenge } = generatePkce();
    const state = generateState();
    const returnTo = safeReturnTo(req.query.return_to);

    setPendingTxCookie(req, res, { verifier, state, returnTo });

    const url = buildAuthorizeUrl({ clientId, redirectUri, state, challenge });
    res.setHeader("Location", url);
    return res.status(302).end();
  } catch (err: any) {
    console.error("[base-mcp/start] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to start Base MCP auth" });
  }
}
