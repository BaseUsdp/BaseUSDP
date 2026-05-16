/**
 * POST /api/sms/dispatch
 *
 * Called by the frontend after escrow.depositFor confirms on-chain.
 * The server is no longer the source of truth for the escrow — the
 * contract is — so this endpoint only:
 *   1. Verifies a Pending escrow with the supplied claimToken exists on-chain
 *   2. Idempotently dispatches the Twilio SMS (or logs to console-mode inbox)
 *   3. Records the inbox row for the dashboard's "Local SMS inbox" card
 *
 * No on-chain state is mutated here. No private key is held server-side
 * for this path.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { readEscrow } from "../lib/sms/chain.js";
import { sendSms, getGatewayMode, readInbox } from "../lib/sms/gateway.js";

function isHex32(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x[a-fA-F0-9]{64}$/.test(value);
}

function isE164(value: unknown): value is string {
  return typeof value === "string" && /^\+[1-9]\d{7,14}$/.test(value);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = (req.body ?? {}) as {
    claimToken?: string;
    phoneE164?: string;
    note?: string | null;
  };

  if (!isHex32(body.claimToken)) {
    return res
      .status(400)
      .json({ error: "claimToken must be a 32-byte 0x-prefixed hex" });
  }
  if (!isE164(body.phoneE164)) {
    return res.status(400).json({ error: "phoneE164 must be in E.164 format" });
  }

  // 1. Verify the on-chain escrow exists and is pending.
  let escrow;
  try {
    escrow = await readEscrow(body.claimToken);
  } catch (err) {
    return res.status(500).json({
      error: "chain read failed",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
  if (!escrow) {
    return res
      .status(404)
      .json({ error: "no on-chain escrow for this claimToken" });
  }
  if (escrow.status !== "pending") {
    return res
      .status(409)
      .json({ error: `escrow status is ${escrow.status}` });
  }

  // 2. Idempotency — if we've already dispatched for this claimToken, return
  //    the prior result instead of texting twice. The inbox is the simplest
  //    place to check (every dispatch writes an inbox row).
  const inbox = await readInbox();
  const already = inbox.find((m) => m.claimToken === body.claimToken);
  const proto = (req.headers["x-forwarded-proto"] as string) ?? "https";
  const host = (req.headers["x-forwarded-host"] as string) ?? req.headers.host ?? "baseusdp.com";
  const baseUrl = process.env.PUBLIC_APP_URL ?? `${proto}://${host}`;
  const claimUrl = `${baseUrl}/claim/${body.claimToken}`;

  if (already) {
    return res.status(200).json({
      claimUrl,
      consoleMode: getGatewayMode() === "console",
      alreadyDispatched: true,
    });
  }

  // 3. Dispatch the SMS.
  const note =
    typeof body.note === "string" && body.note.trim().length > 0
      ? body.note.trim().slice(0, 140)
      : null;

  let consoleMode = false;
  try {
    const result = await sendSms({
      to: body.phoneE164,
      amount: escrow.amountUsdc,
      claimToken: body.claimToken,
      claimUrl,
      note,
    });
    consoleMode = result.consoleMode;
  } catch (err) {
    return res.status(502).json({
      error: "sms gateway failed",
      detail: err instanceof Error ? err.message : String(err),
      claimUrl,
    });
  }

  return res.status(201).json({
    claimUrl,
    consoleMode,
  });
}
