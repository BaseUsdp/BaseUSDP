/**
 * GET /api/mcp/list-recent-tips?handle=jesse&limit=10
 *
 * Base MCP plugin read tool. Returns the most recent incoming tips to a
 * BASEUSDP @handle. Useful for AI prompts like "who tipped me today?" or
 * "what's been streaming in for this creator?".
 *
 * Public, no auth — same exposure level as the OBS overlay endpoint that
 * already publishes this data.
 *
 * Query:
 *   handle: "@jesse" | "jesse" | "0x..."
 *   limit:  default 10, max 50
 *
 * Response (success):
 *   {
 *     success: true,
 *     handle:  "@jesse" | null,
 *     tips: [
 *       { sender_handle, sender_address, amount, token, memo, created_at }
 *     ]
 *   }
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 10;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  if (!supabaseUrl || !supabaseKey) {
    return res
      .status(500)
      .json({ success: false, error: "Database not configured" });
  }

  const handleRaw = ((req.query.handle as string | undefined) ?? "").trim();
  if (!handleRaw) {
    return res
      .status(400)
      .json({ success: false, error: "handle is required" });
  }

  const limitRaw = Number(req.query.limit ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(MAX_LIMIT, Math.floor(limitRaw)))
    : DEFAULT_LIMIT;

  const cleanHandle = handleRaw.startsWith("@") ? handleRaw.slice(1) : handleRaw;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    let wallet: string;
    let displayHandle: string | null = null;
    if (ADDRESS_RE.test(cleanHandle)) {
      wallet = cleanHandle.toLowerCase();
    } else {
      const { data: profile, error } = await supabase
        .from("user_profiles")
        .select("wallet_address, username")
        .ilike("username", cleanHandle)
        .maybeSingle();
      if (error || !profile?.wallet_address) {
        return res
          .status(404)
          .json({ success: false, error: "Handle not found" });
      }
      wallet = (profile.wallet_address as string).toLowerCase();
      displayHandle = `@${profile.username}`;
    }

    // zk_transactions has no `token` column in prod; default to USDC for now.
    const { data: txs, error: txErr } = await supabase
      .from("zk_transactions")
      .select("id, sender_wallet, amount, memo, created_at, transaction_type")
      .eq("recipient_wallet", wallet)
      .neq("sender_wallet", wallet)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (txErr) {
      console.error("[mcp/list-recent-tips] tx query error:", txErr);
      return res
        .status(500)
        .json({ success: false, error: "Failed to load tips" });
    }

    const incoming = (txs ?? []).filter(
      (t: any) =>
        (t.transaction_type ?? "transfer") !== "withdraw" &&
        (t.transaction_type ?? "transfer") !== "deposit",
    );

    const senderWallets = Array.from(
      new Set(
        incoming
          .map((t: any) => (t.sender_wallet as string | null)?.toLowerCase())
          .filter((s): s is string => !!s),
      ),
    );
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

    const tips = incoming.map((t: any) => {
      const sw = (t.sender_wallet as string | null)?.toLowerCase() ?? null;
      const senderUsername = sw ? walletToUsername[sw] ?? null : null;
      return {
        sender_handle: senderUsername ? `@${senderUsername}` : null,
        sender_address: sw,
        amount:
          typeof t.amount === "string"
            ? Number(t.amount)
            : (t.amount as number | null),
        token: "USDC",
        memo: (t.memo as string | null) ?? null,
        created_at: t.created_at as string,
      };
    });

    return res.status(200).json({
      success: true,
      handle: displayHandle,
      tips,
    });
  } catch (err: any) {
    console.error("[mcp/list-recent-tips] error:", err?.message || err);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
}
