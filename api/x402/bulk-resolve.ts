/**
 * POST /api/x402/bulk-resolve
 *
 * x402-gated bulk handle resolution. Body `{ handles: ["a","b","c"] }`
 * returns an array of `{ handle, address }` for opted-in users (any
 * handle that isn't registered / hasn't enabled MCP returns
 * `{ handle, error: "not_found" }` so the caller knows which dropped).
 *
 * Price: $0.05 USDC per call. Max 50 handles per request — pay once,
 * resolve a whole roster. Useful for AI agents / dashboards that need
 * many addresses in one shot.
 *
 * Reuses the creator-stats x402 plumbing (Coinbase facilitator, EIP-3009
 * exact scheme on Base, payments to the BASEUSDP main wallet).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { useFacilitator } from "x402/verify";
import { facilitator } from "@coinbase/x402";
import { processPriceToAtomicAmount } from "x402/shared";
import { exact } from "x402/schemes";
import { settleResponseHeader } from "x402/types";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const PRICE = "$0.05";
const NETWORK = "base";
const PAY_TO = "0x0000000000000000000000000000000000000000";
const X402_VERSION = 1;
const MAX_HANDLES = 50;

const { verify, settle } = useFacilitator(facilitator as any);

function buildRequirements(resource: string): any {
  const atomic = processPriceToAtomicAmount(PRICE, NETWORK);
  if ("error" in atomic) throw new Error(atomic.error as string);
  const { maxAmountRequired, asset } = atomic;
  return {
    scheme: "exact",
    network: NETWORK,
    maxAmountRequired,
    resource,
    description:
      "BASEUSDP bulk handle resolution: up to 50 @handles → wallet addresses in one paid call.",
    mimeType: "application/json",
    payTo: PAY_TO,
    maxTimeoutSeconds: 60,
    asset: asset.address,
    extra: (asset as any).eip712,
  };
}

interface ResolveResult {
  handle: string;
  address?: string;
  error?: "not_found";
}

async function resolveMany(handles: string[]): Promise<ResolveResult[]> {
  if (!supabaseUrl || !supabaseKey) throw new Error("Database not configured");
  const supabase = createClient(supabaseUrl, supabaseKey);

  const cleaned = handles
    .map((h) => (typeof h === "string" ? h.trim().replace(/^@/, "") : ""))
    .filter((h) => h.length > 0);
  if (cleaned.length === 0) return [];

  // Single query with ILIKE ANY is awkward across Supabase clients; the
  // simplest reliable path is one query with `.in('username', ...)` using
  // a lowercase-on-both-sides match. Since usernames are stored
  // case-insensitively via citext-or-similar (the resolve-handle endpoint
  // uses ILIKE), we mirror that here by fetching matches case-insensitively
  // through a small batched approach: get the candidate set with `.in()`
  // on case-folded values, then re-filter in JS.
  const { data: rows } = await supabase
    .from("user_profiles")
    .select("wallet_address, username, mcp_enabled")
    .in("username", cleaned);

  // Build a case-insensitive map of found rows.
  const found = new Map<
    string,
    { wallet: string; username: string; enabled: boolean }
  >();
  for (const r of rows ?? []) {
    if (!r?.username) continue;
    found.set((r.username as string).toLowerCase(), {
      wallet: (r.wallet_address as string).toLowerCase(),
      username: r.username as string,
      enabled: !!r.mcp_enabled,
    });
  }

  return cleaned.map<ResolveResult>((h) => {
    const hit = found.get(h.toLowerCase());
    if (!hit || !hit.enabled) {
      return { handle: `@${h}`, error: "not_found" };
    }
    return { handle: `@${hit.username}`, address: hit.wallet };
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-PAYMENT, Access-Control-Expose-Headers",
  );
  res.setHeader("Access-Control-Expose-Headers", "X-PAYMENT-RESPONSE");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = (req.body ?? {}) as { handles?: unknown };
  const raw = Array.isArray(body.handles) ? body.handles : null;
  if (!raw) {
    return res
      .status(400)
      .json({ error: "Body must be { handles: string[] }" });
  }
  if (raw.length === 0) {
    return res.status(400).json({ error: "handles array is empty" });
  }
  if (raw.length > MAX_HANDLES) {
    return res
      .status(400)
      .json({ error: `Too many handles (max ${MAX_HANDLES})` });
  }
  const handles = raw.filter((h): h is string => typeof h === "string");
  if (handles.length === 0) {
    return res
      .status(400)
      .json({ error: "handles must be an array of strings" });
  }

  const host = req.headers.host || "baseusdp.com";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const resource = `${proto}://${host}/api/x402/bulk-resolve` as const;

  let requirements;
  try {
    requirements = buildRequirements(resource);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Config error" });
  }

  const paymentHeader = req.headers["x-payment"];
  const paymentB64 = Array.isArray(paymentHeader)
    ? paymentHeader[0]
    : paymentHeader;

  // No payment → ask for one.
  if (!paymentB64) {
    return res.status(402).json({
      x402Version: X402_VERSION,
      accepts: [requirements],
      error: "X-PAYMENT header is required",
    });
  }

  let decoded;
  try {
    decoded = exact.evm.decodePayment(paymentB64);
  } catch {
    return res.status(402).json({
      x402Version: X402_VERSION,
      accepts: [requirements],
      error: "Malformed X-PAYMENT header",
    });
  }

  try {
    const verification = await verify(decoded as any, requirements as any);
    if (!verification.isValid) {
      return res.status(402).json({
        x402Version: X402_VERSION,
        accepts: [requirements],
        error: verification.invalidReason || "Payment verification failed",
      });
    }

    const results = await resolveMany(handles);

    const settlement = await settle(decoded as any, requirements as any);
    res.setHeader(
      "X-PAYMENT-RESPONSE",
      settleResponseHeader(settlement as any),
    );
    return res
      .status(200)
      .json({ success: true, results, requested: handles.length });
  } catch (err: any) {
    console.error("[x402/bulk-resolve] error:", err?.message || err);
    return res.status(402).json({
      x402Version: X402_VERSION,
      accepts: [requirements],
      error: "Payment processing error",
    });
  }
}
