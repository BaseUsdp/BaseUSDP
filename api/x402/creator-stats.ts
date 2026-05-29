/**
 * GET /api/x402/creator-stats?handle=<handle>
 *
 * x402-gated premium endpoint. Returns enriched analytics for a BASEUSDP
 * creator: total received, tip count, unique tippers, top tippers, and
 * first/last tip timestamps. Costs $0.01 USDC per call, settled via the
 * Coinbase x402 facilitator on Base.
 *
 * Payment flow (x402 / EIP-3009 exact scheme):
 *   1. No X-PAYMENT header → 402 with payment requirements.
 *   2. Client signs a USDC transferWithAuthorization and re-requests with
 *      the X-PAYMENT header.
 *   3. We verify the payment, run the query, settle on-chain, and return
 *      the data plus an X-PAYMENT-RESPONSE header.
 *
 * Payments go to the BASEUSDP main wallet. The creator's handle must have
 * opted into MCP/AI access (mcp_enabled) — same gate as the free tools.
 *
 * Requires env: CDP_API_KEY_ID, CDP_API_KEY_SECRET (Coinbase facilitator).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { useFacilitator } from "x402/verify";
import { facilitator } from "@coinbase/x402";
import { processPriceToAtomicAmount } from "x402/shared";
import { exact } from "x402/schemes";
import { settleResponseHeader } from "x402/types";
import { extractBearerToken } from "../lib/bearer-auth.js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const PRICE = "$0.01";
const NETWORK = "base";
const PAY_TO = "0x0000000000000000000000000000000000000000";
const X402_VERSION = 1;

// `facilitator` (from @coinbase/x402 v2 → @x402/core) and `useFacilitator`
// (from x402 v1) share the same runtime shape but have distinct nominal
// types across the two packages, so cast to bridge them.
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
      "BASEUSDP creator analytics: totals, tip count, unique + top tippers.",
    mimeType: "application/json",
    payTo: PAY_TO,
    maxTimeoutSeconds: 60,
    asset: asset.address,
    extra: (asset as any).eip712,
  };
}

async function resolveProfile(
  handle: string,
): Promise<{ wallet: string; username: string } | null> {
  if (!supabaseUrl || !supabaseKey) throw new Error("Database not configured");
  const supabase = createClient(supabaseUrl, supabaseKey);
  const clean = handle.trim().replace(/^@/, "");
  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select("wallet_address, username, mcp_enabled")
    .ilike("username", clean)
    .maybeSingle();
  if (error || !profile?.wallet_address || !profile.mcp_enabled) return null;
  return {
    wallet: (profile.wallet_address as string).toLowerCase(),
    username: profile.username as string,
  };
}

/**
 * Returns the session wallet for a bearer token, or null. Used to grant the
 * authenticated creator free access to their own analytics.
 */
async function walletForToken(token: string | null): Promise<string | null> {
  if (!token || !supabaseUrl || !supabaseKey) return null;
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: session } = await supabase
    .from("auth_sessions")
    .select("user_wallet")
    .eq("session_token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return session?.user_wallet
    ? (session.user_wallet as string).toLowerCase()
    : null;
}

async function computeStats(wallet: string, username: string) {
  if (!supabaseUrl || !supabaseKey) throw new Error("Database not configured");
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: txs } = await supabase
    .from("zk_transactions")
    .select("*")
    .eq("recipient_wallet", wallet)
    .neq("sender_wallet", wallet)
    .order("created_at", { ascending: false })
    .limit(1000);

  const incoming = (txs ?? []).filter(
    (t: any) =>
      (t.transaction_type ?? "transfer") !== "withdraw" &&
      (t.transaction_type ?? "transfer") !== "deposit",
  );

  let total = 0;
  const bySender: Record<string, { total: number; count: number }> = {};
  let first: string | null = null;
  let last: string | null = null;
  for (const t of incoming) {
    const amt =
      typeof t.amount === "string" ? Number(t.amount) : (t.amount as number) || 0;
    total += amt;
    const sw = (t.sender_wallet as string | null)?.toLowerCase();
    if (sw) {
      bySender[sw] = bySender[sw] || { total: 0, count: 0 };
      bySender[sw].total += amt;
      bySender[sw].count += 1;
    }
    const ts = t.created_at as string;
    if (!last || ts > last) last = ts;
    if (!first || ts < first) first = ts;
  }

  const senderWallets = Object.keys(bySender);
  const walletToUsername: Record<string, string> = {};
  if (senderWallets.length > 0) {
    const { data: senders } = await supabase
      .from("user_profiles")
      .select("wallet_address, username")
      .in("wallet_address", senderWallets);
    for (const s of senders ?? []) {
      if (s?.wallet_address && s?.username) {
        walletToUsername[(s.wallet_address as string).toLowerCase()] =
          s.username as string;
      }
    }
  }

  const topTippers = Object.entries(bySender)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5)
    .map(([addr, v]) => ({
      handle: walletToUsername[addr] ? `@${walletToUsername[addr]}` : null,
      address: addr,
      total: Number(v.total.toFixed(2)),
      count: v.count,
    }));

  return {
    handle: `@${username}`,
    total_received: Number(total.toFixed(2)),
    tip_count: incoming.length,
    unique_tippers: senderWallets.length,
    top_tippers: topTippers,
    first_tip_at: first,
    last_tip_at: last,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-PAYMENT, Access-Control-Expose-Headers",
  );
  res.setHeader("Access-Control-Expose-Headers", "X-PAYMENT-RESPONSE");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const handle = (req.query.handle as string | undefined)?.trim();
  if (!handle) {
    return res.status(400).json({ error: "handle query parameter is required" });
  }

  // Resolve the creator first. 404 immediately if not found / not opted in,
  // so nobody pays for a nonexistent creator.
  let profile;
  try {
    profile = await resolveProfile(handle);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Lookup failed" });
  }
  if (!profile) {
    return res
      .status(404)
      .json({ error: "Creator not found or has not enabled AI access" });
  }

  // Free access for the authenticated creator viewing their own analytics.
  // (Also sidesteps the facilitator's self_send_not_allowed when payer ==
  // payout wallet.)
  const requesterWallet = await walletForToken(extractBearerToken(req));
  if (requesterWallet && requesterWallet === profile.wallet) {
    const stats = await computeStats(profile.wallet, profile.username);
    return res.status(200).json({ success: true, stats, free: true });
  }

  const host = req.headers.host || "baseusdp.com";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const resource =
    `${proto}://${host}/api/x402/creator-stats?handle=${encodeURIComponent(handle)}` as const;

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

  // Decode + verify the payment.
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

    // Payment is valid — produce the resource (creator already resolved above).
    const stats = await computeStats(profile.wallet, profile.username);

    // Settle on-chain, then return the data + settlement header.
    const settlement = await settle(decoded as any, requirements as any);
    res.setHeader(
      "X-PAYMENT-RESPONSE",
      settleResponseHeader(settlement as any),
    );

    return res.status(200).json({ success: true, stats });
  } catch (err: any) {
    console.error("[x402/creator-stats] error:", err?.message || err);
    return res.status(402).json({
      x402Version: X402_VERSION,
      accepts: [requirements],
      error: "Payment processing error",
    });
  }
}
