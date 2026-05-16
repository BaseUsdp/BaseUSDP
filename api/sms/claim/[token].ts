/**
 * POST /api/sms/claim/:token
 *
 * Recipient claims an SMS escrow. Recipient signs a commitment over
 * (claimToken, recipient) and submits the signature. We verify the
 * signature and flip the escrow status to "claimed".
 *
 * In the on-chain version this is the call that triggers the ZK transfer
 * from the escrow contract into the recipient's pool commitment.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyMessage } from "viem";
import {
  getEscrow,
  isExpired,
  markClaimed,
  publicProjection,
} from "../../lib/sms/store.js";
import { buildClaimCommitment } from "../../lib/sms/messages.js";
import type { SmsClaimRequest } from "../../lib/sms/types.js";

function isEvmAddress(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function isHexSig(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x[a-fA-F0-9]{130}$/.test(value);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (!/^[a-f0-9]{32}$/.test(token)) {
    return res.status(400).json({ error: "invalid claim token format" });
  }

  const body = (req.body ?? {}) as Partial<SmsClaimRequest>;
  if (!isEvmAddress(body.recipient)) {
    return res.status(400).json({ error: "recipient must be an EVM address" });
  }
  if (!isHexSig(body.recipientSig)) {
    return res
      .status(400)
      .json({ error: "recipientSig must be a 65-byte hex" });
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
  if (isExpired(record)) {
    return res
      .status(410)
      .json({ error: "escrow expired — refund is now available", escrow: publicProjection(record) });
  }

  const commitment = buildClaimCommitment({
    claimToken: token,
    recipient: body.recipient,
  });
  let valid = false;
  try {
    valid = await verifyMessage({
      address: body.recipient,
      message: commitment,
      signature: body.recipientSig,
    });
  } catch {
    valid = false;
  }
  if (!valid) {
    return res
      .status(401)
      .json({ error: "recipientSig does not recover recipient" });
  }

  const updated = await markClaimed(token, body.recipient);
  return res.status(200).json({ escrow: publicProjection(updated) });
}
