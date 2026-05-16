/**
 * POST /api/sms/refund/:token
 *
 * Permissionless refund — anyone can trigger this once the escrow has
 * expired. Matches the on-chain SMSEscrow.refund() semantics described in
 * the whitepaper, so no relay or admin key can hold funds hostage.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getEscrow,
  isExpired,
  markRefunded,
  publicProjection,
} from "../../lib/sms/store.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
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
  if (record.status !== "pending") {
    return res
      .status(409)
      .json({ error: `escrow is ${record.status}`, escrow: publicProjection(record) });
  }
  if (!isExpired(record)) {
    const remainingMs =
      new Date(record.expiresAt).getTime() - Date.now();
    return res
      .status(425)
      .json({
        error: "escrow has not yet expired",
        expiresAt: record.expiresAt,
        remainingMs,
      });
  }

  const updated = await markRefunded(token);
  return res.status(200).json({ escrow: publicProjection(updated) });
}
