/**
 * POST /api/mcp/create-payment-request
 *
 * Base MCP plugin endpoint for creating a shareable BASEUSDP payment
 * request. AI agents call this to spawn a public /pay/:id URL the user
 * can share so anyone can pay them in USDC/USDT on Base.
 *
 * Request body:
 *   {
 *     amount:           "5.00",         // decimal string
 *     recipient:        "@jesse" | "0x...",
 *     token?:           "USDC" | "USDT",  // default USDC
 *     service_name?:    string,           // shown on the pay page
 *     description?:     string
 *   }
 *
 * Response (success):
 *   {
 *     success:        true,
 *     paymentId:      "x402_abcd1234",
 *     shareableUrl:   "https://baseusdp.com/pay/x402_abcd1234",
 *     recipient:      { handle: "@jesse"|null, address: "0x..." }
 *   }
 *
 * No auth: anyone can create a payment request to any wallet they
 * specify. Same trust model as /pay (a public link-driven flow).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { isAddress, type Address } from "viem";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

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
    .select("wallet_address, username")
    .ilike("username", handle)
    .single();
  if (error || !data) throw new Error(`Handle @${handle} not found`);
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

  if (!supabaseUrl || !supabaseKey) {
    return res
      .status(500)
      .json({ success: false, error: "Database not configured" });
  }

  const body = (req.body ?? {}) as {
    amount?: unknown;
    recipient?: unknown;
    token?: unknown;
    service_name?: unknown;
    description?: unknown;
  };
  const recipient = typeof body.recipient === "string" ? body.recipient : "";
  const amountRaw = typeof body.amount === "string" ? body.amount : "";
  const tokenRaw =
    typeof body.token === "string" ? body.token.toUpperCase() : "USDC";
  const serviceName =
    typeof body.service_name === "string" && body.service_name.trim()
      ? body.service_name.trim()
      : "BASEUSDP payment request";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";

  if (!recipient) {
    return res
      .status(400)
      .json({ success: false, error: "recipient is required" });
  }
  const amount = parseFloat(amountRaw);
  if (!amountRaw || !Number.isFinite(amount) || amount <= 0) {
    return res
      .status(400)
      .json({ success: false, error: "amount must be a positive decimal" });
  }
  if (amount > 999999.99) {
    return res
      .status(400)
      .json({ success: false, error: "amount exceeds maximum (999,999.99)" });
  }
  if (tokenRaw !== "USDC" && tokenRaw !== "USDT") {
    return res
      .status(400)
      .json({ success: false, error: "token must be USDC or USDT" });
  }

  try {
    const resolved = await resolveRecipient(recipient);
    const paymentId = `x402_${Math.random().toString(36).slice(2, 11)}`;
    const paymentHash = createHash("sha256")
      .update(paymentId + amount.toString() + resolved.address + Date.now().toString())
      .digest("hex");

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { error: err1 } = await supabase.from("payment_requests").insert({
      payment_id: paymentId,
      user_wallet: resolved.address,
      recipient: resolved.address,
      amount,
      token: tokenRaw,
      nonce: Date.now(),
      payment_hash: paymentHash,
      status: "pending",
      service_name: serviceName,
      description,
    });

    if (err1) {
      // Fallback to schema without service_name/description columns.
      const { error: err2 } = await supabase.from("payment_requests").insert({
        payment_id: paymentId,
        user_wallet: resolved.address,
        recipient: resolved.address,
        amount,
        token: tokenRaw,
        nonce: Date.now(),
        payment_hash: paymentHash,
        status: "pending",
      });
      if (err2) {
        console.error("[mcp/create-payment-request] insert failed:", err2);
        return res
          .status(500)
          .json({ success: false, error: "Failed to create payment request" });
      }
    }

    const host = req.headers.host || "baseusdp.com";
    const proto = host.startsWith("localhost") ? "http" : "https";
    const shareableUrl = `${proto}://${host}/pay/${paymentId}`;

    return res.status(200).json({
      success: true,
      paymentId,
      shareableUrl,
      recipient: resolved,
      amount,
      token: tokenRaw,
    });
  } catch (err: any) {
    console.error("[mcp/create-payment-request] error:", err?.message || err);
    const message = err?.message || "Internal server error";
    const status = message.includes("not found") ? 404 : 500;
    return res.status(status).json({ success: false, error: message });
  }
}
