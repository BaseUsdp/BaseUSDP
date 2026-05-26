/**
 * GET /api/auth/base-mcp/callback
 *
 * OAuth redirect target. Exchanges the authorization code for an access +
 * refresh token using the verifier stashed in the pending-tx cookie, then
 * persists both as HTTP-only cookies and bounces the user back to wherever
 * they came from (default `/dashboard`).
 *
 * Failure surfaces as a redirect to /dashboard?base_mcp=error so the UI
 * can show a toast — keeps this endpoint behind a single button click.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  exchangeCodeForToken,
  getClientId,
  readPendingTxCookie,
  setTokenCookies,
} from "../../lib/base-mcp-oauth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const redirectUri = process.env.BASE_MCP_REDIRECT_URI;
  if (!redirectUri) {
    return res.status(500).json({ error: "BASE_MCP_REDIRECT_URI is not configured" });
  }

  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const errorParam = typeof req.query.error === "string" ? req.query.error : "";

  if (errorParam || !code || !state) {
    const reason = errorParam || (!code ? "no_code" : "no_state");
    res.setHeader("Location", `/dashboard?base_mcp=error&reason=${encodeURIComponent(reason)}`);
    return res.status(302).end();
  }

  const pending = readPendingTxCookie(req);
  if (!pending || pending.state !== state) {
    res.setHeader("Location", "/dashboard?base_mcp=error&reason=state_mismatch");
    return res.status(302).end();
  }

  try {
    const clientId = await getClientId();
    const tokens = await exchangeCodeForToken({
      clientId,
      code,
      verifier: pending.verifier,
      redirectUri,
    });
    setTokenCookies(req, res, tokens);
    const returnTo = pending.returnTo || "/dashboard";
    const sep = returnTo.includes("?") ? "&" : "?";
    res.setHeader("Location", `${returnTo}${sep}base_mcp=connected`);
    return res.status(302).end();
  } catch (err: any) {
    console.error("[base-mcp/callback] exchange failed:", err?.message || err);
    res.setHeader("Location", "/dashboard?base_mcp=error&reason=exchange_failed");
    return res.status(302).end();
  }
}
