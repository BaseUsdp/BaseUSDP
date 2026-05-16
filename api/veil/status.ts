/**
 * GET /api/veil/status
 *
 * Public Veil status: relay health, contract addresses, and optionally
 * the registration state of a query-string wallet address.
 *
 * Read-only.  No funds move, no proofs are produced.
 *
 * Optional query: ?wallet=0x...
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  VEIL_ADDRESSES,
  getEligibilitySafe,
  getRegistrationSafe,
  getRelayHealthSafe,
} from "../lib/veil/client.js";
import type { VeilStatusResponse } from "../lib/veil/types.js";

function isEvmAddress(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const wallet =
    typeof req.query.wallet === "string" ? req.query.wallet : undefined;

  let registration: VeilStatusResponse["registration"] | undefined;
  let eligibility: VeilStatusResponse["eligibility"] | undefined;

  if (wallet && !isEvmAddress(wallet)) {
    return res.status(400).json({ error: "Invalid wallet address" });
  }

  const [relay, regResult, eligResult] = await Promise.all([
    getRelayHealthSafe(),
    wallet ? getRegistrationSafe(wallet as `0x${string}`) : Promise.resolve(null),
    wallet ? getEligibilitySafe(wallet as `0x${string}`) : Promise.resolve(null),
  ]);

  if (regResult) {
    registration = {
      isRegistered: regResult.isRegistered,
      depositKey: regResult.depositKey,
    };
  }
  if (eligResult) {
    eligibility = {
      isAllowed: eligResult.isAllowed,
      error: "error" in eligResult ? eligResult.error : undefined,
    };
  }

  const response: VeilStatusResponse = {
    relay,
    addresses: VEIL_ADDRESSES,
    registration,
    eligibility,
  };

  return res.status(200).json(response);
}
