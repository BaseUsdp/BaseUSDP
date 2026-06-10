/**
 * GET /api/x402/leaderboard?window=week&limit=100
 *
 * x402-gated platform creator leaderboard. Returns the top creators
 * ranked by total received in the requested window. Useful for AI
 * agents, dashboards, and discovery tools.
 *
 * Window options:
 *   day | week | month | all   (default: week)
 *
 * Price: $0.10 USDC per call. Free for the platform owner
 * (authenticated bearer-token wallet === PAY_TO) so the dashboard can
 * embed this without paying itself.
 *
 * Privacy: creators with mcp_enabled=true show their @handle + address.
 * Opted-out creators show as "anonymous" with no address — their volume
 * still counts toward the platform total but they don't leak identity.
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

const PRICE = "$0.10";
const NETWORK = "base";
const PAY_TO = "0x0000000000000000000000000000000000000000";
const X402_VERSION = 1;
const MAX_LIMIT = 100;

const { verify, settle } = useFacilitator(facilitator as any);

type Window = "day" | "week" | "month" | "all";

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
      "BASEUSDP platform leaderboard: top creators ranked by total received in the requested window.",
    mimeType: "application/json",
    payTo: PAY_TO,
    maxTimeoutSeconds: 60,
    asset: asset.address,
    extra: (asset as any).eip712,
  };
}

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

function windowToSince(window: Window): string | null {
  const now = Date.now();
  switch (window) {
    case "day":
      return new Date(now - 24 * 60 * 60 * 1000).toISOString();
    case "week":
      return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    case "month":
      return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    case "all":
    default:
      return null;
  }
}

async function computeLeaderboard(window: Window, limit: number) {
  if (!supabaseUrl || !supabaseKey) throw new Error("Database not configured");
  const supabase = createClient(supabaseUrl, supabaseKey);

  let query = supabase
    .from("zk_transactions")
    .select("sender_wallet, recipient_wallet, amount, transaction_type")
    .order("created_at", { ascending: false })
    .limit(50_000);
  const since = windowToSince(window);
  if (since) query = query.gt("created_at", since);
  const { data: txs, error } = await query;
  if (error) throw new Error("Failed to load transactions");

  const incoming = (txs ?? []).filter(
    (t: any) =>
      (t.transaction_type ?? "transfer") !== "withdraw" &&
      (t.transaction_type ?? "transfer") !== "deposit" &&
      t.sender_wallet &&
      t.recipient_wallet &&
      (t.sender_wallet as string).toLowerCase() !==
        (t.recipient_wallet as string).toLowerCase(),
  );

  interface Agg {
    received: number;
    tip_count: number;
    tipper_set: Set<string>;
  }
  const byRecipient = new Map<string, Agg>();
  let totalVolume = 0;
  const allTippers = new Set<string>();

  for (const t of incoming) {
    const r = (t.recipient_wallet as string).toLowerCase();
    const s = (t.sender_wallet as string).toLowerCase();
    const amt =
      typeof t.amount === "string"
        ? Number(t.amount)
        : (t.amount as number) || 0;
    totalVolume += amt;
    allTippers.add(s);
    const agg = byRecipient.get(r) ?? {
      received: 0,
      tip_count: 0,
      tipper_set: new Set<string>(),
    };
    agg.received += amt;
    agg.tip_count += 1;
    agg.tipper_set.add(s);
    byRecipient.set(r, agg);
  }

  const ranked = Array.from(byRecipient.entries())
    .sort((a, b) => b[1].received - a[1].received)
    .slice(0, limit);

  // Look up profiles for the displayed top-N only.
  const wallets = ranked.map(([w]) => w);
  const walletToProfile = new Map<
    string,
    { username: string; mcp_enabled: boolean }
  >();
  if (wallets.length > 0) {
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("wallet_address, username, mcp_enabled")
      .in("wallet_address", wallets);
    for (const p of profiles ?? []) {
      if (p?.wallet_address && p?.username) {
        walletToProfile.set((p.wallet_address as string).toLowerCase(), {
          username: p.username as string,
          mcp_enabled: !!p.mcp_enabled,
        });
      }
    }
  }

  const leaderboard = ranked.map(([addr, agg], i) => {
    const prof = walletToProfile.get(addr);
    if (prof?.mcp_enabled) {
      return {
        rank: i + 1,
        handle: `@${prof.username}`,
        address: addr,
        received: Number(agg.received.toFixed(2)),
        tip_count: agg.tip_count,
        unique_tippers: agg.tipper_set.size,
      };
    }
    // Opted-out / anonymous — preserve the rank + volume but strip identity.
    return {
      rank: i + 1,
      handle: null,
      address: null,
      received: Number(agg.received.toFixed(2)),
      tip_count: agg.tip_count,
      unique_tippers: agg.tipper_set.size,
    };
  });

  return {
    window,
    total_creators: byRecipient.size,
    total_volume: Number(totalVolume.toFixed(2)),
    total_tippers: allTippers.size,
    leaderboard,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-PAYMENT, Authorization, Access-Control-Expose-Headers",
  );
  res.setHeader("Access-Control-Expose-Headers", "X-PAYMENT-RESPONSE");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const windowRaw = ((req.query.window as string) ?? "week").toLowerCase();
  const window: Window =
    windowRaw === "day" || windowRaw === "week" || windowRaw === "month" || windowRaw === "all"
      ? (windowRaw as Window)
      : "week";
  const limitRaw = Number(req.query.limit ?? 100);
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(MAX_LIMIT, Math.floor(limitRaw)))
    : 100;

  const host = req.headers.host || "baseusdp.com";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const resource =
    `${proto}://${host}/api/x402/leaderboard?window=${window}&limit=${limit}` as const;

  let requirements;
  try {
    requirements = buildRequirements(resource);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Config error" });
  }

  // Free-for-owner: bearer-authenticated wallet matching PAY_TO bypasses x402.
  const requesterWallet = await walletForToken(extractBearerToken(req));
  if (requesterWallet && requesterWallet === PAY_TO.toLowerCase()) {
    const data = await computeLeaderboard(window, limit);
    return res.status(200).json({ success: true, free: true, ...data });
  }

  const paymentHeader = req.headers["x-payment"];
  const paymentB64 = Array.isArray(paymentHeader)
    ? paymentHeader[0]
    : paymentHeader;

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

    const data = await computeLeaderboard(window, limit);
    const settlement = await settle(decoded as any, requirements as any);
    res.setHeader(
      "X-PAYMENT-RESPONSE",
      settleResponseHeader(settlement as any),
    );
    return res.status(200).json({ success: true, ...data });
  } catch (err: any) {
    console.error("[x402/leaderboard] error:", err?.message || err);
    return res.status(402).json({
      x402Version: X402_VERSION,
      accepts: [requirements],
      error: "Payment processing error",
    });
  }
}
