/**
 * POST /api/sms/send
 *
 * Creates an SMS escrow record and dispatches the claim SMS.
 *
 * The sender must sign a commitment over (phoneHash, amount, claimToken).
 * The server verifies the signature recovers to `sender`, checks the
 * claimed phoneHash matches the supplied phone (the only point at which
 * the raw phone exists server-side, in memory), then writes the escrow
 * and triggers the gateway.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyMessage } from "viem";
import {
  createEscrow,
  getEscrow,
  publicProjection,
} from "../lib/sms/store.js";
import { sendSms } from "../lib/sms/gateway.js";
import { verifyPhoneHash } from "../lib/sms/hash.js";
import { buildSendCommitment } from "../lib/sms/messages.js";
import type {
  SmsSendRequest,
  SmsSendResponse,
} from "../lib/sms/types.js";

function isEvmAddress(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function isHexHash(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x[a-fA-F0-9]{64}$/.test(value);
}

function isHexSig(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x[a-fA-F0-9]{130}$/.test(value);
}

function isPositiveAmount(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (!/^\d+(\.\d{1,6})?$/.test(value)) return false;
  return Number(value) > 0;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = (req.body ?? {}) as Partial<SmsSendRequest> & {
    claimToken?: string;
  };

  if (!isHexHash(body.phoneHash)) {
    return res.status(400).json({ error: "phoneHash must be a 32-byte hex" });
  }
  if (!isPositiveAmount(body.amount)) {
    return res
      .status(400)
      .json({ error: "amount must be a positive decimal string" });
  }
  if (!isEvmAddress(body.sender)) {
    return res.status(400).json({ error: "sender must be an EVM address" });
  }
  if (!isHexSig(body.senderSig)) {
    return res.status(400).json({ error: "senderSig must be a 65-byte hex" });
  }
  if (typeof body.phoneE164 !== "string" || body.phoneE164.length === 0) {
    return res.status(400).json({ error: "phoneE164 is required" });
  }
  if (typeof body.claimToken !== "string" || !/^[a-f0-9]{32}$/.test(body.claimToken)) {
    return res
      .status(400)
      .json({ error: "claimToken must be a 32-char hex string" });
  }

  // The phoneE164 the client sent for SMS delivery must hash to the
  // phoneHash they signed. This prevents a client from signing one hash but
  // texting a different number.
  if (!verifyPhoneHash(body.phoneE164, body.phoneHash)) {
    return res
      .status(400)
      .json({ error: "phoneE164 does not match phoneHash" });
  }

  const commitment = buildSendCommitment({
    phoneHash: body.phoneHash,
    amount: body.amount,
    claimToken: body.claimToken,
  });

  let valid = false;
  try {
    valid = await verifyMessage({
      address: body.sender,
      message: commitment,
      signature: body.senderSig,
    });
  } catch {
    valid = false;
  }
  if (!valid) {
    return res.status(401).json({ error: "senderSig does not recover sender" });
  }

  // Reject duplicate claim tokens.
  const existing = await getEscrow(body.claimToken);
  if (existing) {
    return res.status(409).json({ error: "claimToken already in use" });
  }

  const note =
    typeof body.note === "string" && body.note.trim().length > 0
      ? body.note.trim().slice(0, 140)
      : null;

  const record = await createEscrow({
    claimToken: body.claimToken,
    phoneHash: body.phoneHash,
    amount: body.amount,
    sender: body.sender,
    senderSig: body.senderSig,
    note,
  });
  const finalToken = record.claimToken;

  const baseUrl =
    process.env.PUBLIC_APP_URL ??
    (req.headers["x-forwarded-proto"] && req.headers["x-forwarded-host"]
      ? `${req.headers["x-forwarded-proto"]}://${req.headers["x-forwarded-host"]}`
      : `http://${req.headers.host ?? "localhost:8080"}`);
  const claimUrl = `${baseUrl}/claim/${finalToken}`;

  let consoleMode = false;
  try {
    const result = await sendSms({
      to: body.phoneE164,
      amount: body.amount,
      claimToken: finalToken,
      claimUrl,
      note,
    });
    consoleMode = result.consoleMode;
  } catch (err) {
    return res
      .status(502)
      .json({
        error: "sms gateway failed",
        detail: err instanceof Error ? err.message : String(err),
        claimToken: finalToken,
        escrow: publicProjection(record),
      });
  }

  const response: SmsSendResponse = {
    claimToken: finalToken,
    expiresAt: record.expiresAt,
    claimUrl,
    consoleMode,
  };
  return res.status(201).json(response);
}
