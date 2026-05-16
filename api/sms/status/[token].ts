/**
 * GET /api/sms/status/:token
 *
 * Public read of an escrow record by claim token. Returns the projection
 * (no senderSig, no phoneHash) so a recipient hitting the claim page can
 * see amount, sender, and expiry without revealing the underlying hash.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getEscrow, isExpired, publicProjection } from "../../lib/sms/store.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (!/^[a-f0-9]{32}$/.test(token)) {
    return res.status(400).json({ error: "invalid claim token format" });
  }

  const record = await getEscrow(token);
  if (!record) {
    return res.status(404).json({ error: "claim not found" });
  }

  const projection = publicProjection(record);
  if (projection.status === "pending" && isExpired(record)) {
    projection.status = "expired";
  }
  return res.status(200).json(projection);
}
