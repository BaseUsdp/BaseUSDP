/**
 * POST /api/auth/base-mcp/disconnect
 *
 * Clears the Base MCP cookies on this browser. Doesn't revoke the token
 * server-side at mcp.base.org — that requires an explicit revocation
 * endpoint we don't currently call. Users who want a hard revocation can
 * remove the app from their Base Account dashboard.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { clearTokenCookies } from "../../lib/base-mcp-oauth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  clearTokenCookies(req, res);
  return res.status(200).json({ disconnected: true });
}
