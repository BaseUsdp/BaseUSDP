/**
 * GET /api/veil/balance/:wallet
 *
 * Returns the queue balance (USDC + ETH) for the given wallet address.
 *
 * Queue is public on-chain state.  Private (shielded) balance requires
 * the user's Veil keypair, which is only available client-side and is not
 * part of Phase 1.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getQueueBalanceSafe } from "../../lib/veil/client.js";
import type { VeilQueueBalanceResponse } from "../../lib/veil/types.js";

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

  const wallet = req.query.wallet;
  if (!isEvmAddress(wallet)) {
    return res.status(400).json({ error: "Invalid wallet address" });
  }

  const [usdc, eth] = await Promise.all([
    getQueueBalanceSafe(wallet, "usdc"),
    getQueueBalanceSafe(wallet, "eth"),
  ]);

  const response: VeilQueueBalanceResponse = {
    wallet,
    usdc,
    eth,
  };

  return res.status(200).json(response);
}
