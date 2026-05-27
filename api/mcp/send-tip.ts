/**
 * POST /api/mcp/send-tip
 *
 * Base MCP plugin tx-builder. Given a BASEUSDP handle (or raw 0x address)
 * plus an amount and token, returns the unsigned ERC-20 transfer calldata
 * shaped for mcp.base.org's `send_calls` tool. The user's wallet — via
 * Base MCP — signs and broadcasts; this endpoint never moves money.
 *
 * Request body:
 *   {
 *     recipient: "@jesse" | "0x...",
 *     amount:    "5.50",     // decimal string in token units
 *     token:     "USDC" | "USDT"   // optional, defaults to USDC
 *   }
 *
 * Response (success):
 *   {
 *     success: true,
 *     chain:   "base",
 *     calls:   [{ to: "0x..." (token), value: "0x0", data: "0x..." (transfer calldata) }],
 *     recipient: { handle: "@jesse"|null, address: "0x..." },
 *     amountWei: "5500000",
 *   }
 *
 * No auth required: the response is unsigned calldata. Only the user's
 * wallet can broadcast it.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { encodeFunctionData, isAddress, parseUnits, type Address } from "viem";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const TOKEN_ADDRESSES = {
  USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address,
  USDT: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2" as Address,
} as const;

const TOKEN_DECIMALS = { USDC: 6, USDT: 6 } as const;
type Token = keyof typeof TOKEN_ADDRESSES;

const ERC20_TRANSFER_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

async function resolveRecipient(
  recipient: string,
): Promise<{ address: Address; handle: string | null }> {
  const trimmed = recipient.trim();
  if (isAddress(trimmed)) {
    return { address: trimmed as Address, handle: null };
  }
  const handle = trimmed.replace(/^@/, "");
  if (!handle) throw new Error("recipient is empty");
  if (!supabaseUrl || !supabaseKey) throw new Error("Database not configured");
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase
    .from("user_profiles")
    .select("wallet_address, username, mcp_enabled")
    .ilike("username", handle)
    .single();
  if (error || !data) throw new Error(`Handle @${handle} not found`);
  if (!data.mcp_enabled) throw new Error(`Handle @${handle} not found`);
  return { address: data.wallet_address as Address, handle: `@${data.username}` };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const body = (req.body ?? {}) as {
    recipient?: unknown;
    amount?: unknown;
    token?: unknown;
  };
  const recipient = typeof body.recipient === "string" ? body.recipient : "";
  const amount = typeof body.amount === "string" ? body.amount : "";
  const tokenRaw =
    typeof body.token === "string" ? body.token.toUpperCase() : "USDC";

  if (!recipient) {
    return res
      .status(400)
      .json({ success: false, error: "recipient is required (handle or 0x address)" });
  }
  const amountNum = Number(amount);
  if (!amount || !Number.isFinite(amountNum) || amountNum <= 0) {
    return res
      .status(400)
      .json({ success: false, error: "amount must be a positive decimal string" });
  }
  if (tokenRaw !== "USDC" && tokenRaw !== "USDT") {
    return res
      .status(400)
      .json({ success: false, error: "token must be USDC or USDT" });
  }
  const token = tokenRaw as Token;

  try {
    const resolved = await resolveRecipient(recipient);
    const amountWei = parseUnits(amount, TOKEN_DECIMALS[token]);
    const data = encodeFunctionData({
      abi: ERC20_TRANSFER_ABI,
      functionName: "transfer",
      args: [resolved.address, amountWei],
    });

    return res.status(200).json({
      success: true,
      chain: "base",
      calls: [
        {
          to: TOKEN_ADDRESSES[token],
          value: "0x0",
          data,
        },
      ],
      recipient: resolved,
      amountWei: amountWei.toString(),
      token,
    });
  } catch (err: any) {
    console.error("[mcp/send-tip] error:", err?.message || err);
    const message = err?.message || "Internal server error";
    const status = message.includes("not found") ? 404 : 400;
    return res.status(status).json({ success: false, error: message });
  }
}
