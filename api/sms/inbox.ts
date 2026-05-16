/**
 * GET /api/sms/inbox
 *
 * Local-dev only: returns the console-mode SMS inbox so the dashboard can
 * show what would have been texted. Disabled when the gateway is in twilio
 * mode (no point — real messages went out over the carrier).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getGatewayMode, readInbox } from "../lib/sms/gateway.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const mode = getGatewayMode();
  const messages = await readInbox();
  return res.status(200).json({ mode, messages });
}
