/**
 * GET /api/auth/base-mcp/status
 *
 * Returns whether the current browser has a usable Base MCP access token.
 * Transparently refreshes the access token if it's expired and a refresh
 * token is available. Used by the AI Terminal UI to render the
 * Connect/Disconnect button.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { hasAccessTokenCookie, readAccessToken } from "../../lib/base-mcp-oauth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!hasAccessTokenCookie(req)) {
    return res.status(200).json({ connected: false });
  }

  try {
    const token = await readAccessToken(req, res);
    return res.status(200).json({ connected: !!token });
  } catch {
    return res.status(200).json({ connected: false });
  }
}
