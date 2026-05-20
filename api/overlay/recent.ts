/**
 * Recent incoming tips for the streamer overlay widget.
 *
 * GET /api/overlay/recent?username=<handle>&since=<iso-ts>
 *  - resolves @handle (or accepts a raw 0x address)
 *  - returns up to 20 incoming transactions newer than `since`
 *  - lightweight shape: id, sender (username or short address), amount, token, memo, ts
 *
 * Public (no auth) — overlay is meant to be loaded inside OBS as a Browser
 * Source. Recipient address is resolved from the public username so we
 * never echo a raw wallet back unless the caller asked with one.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const ALLOWED_ORIGINS = [
  "https://baseusdp.com",
  "https://www.baseusdp.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

function getAllowedOrigin(origin: string | undefined): string {
  if (!origin) return "https://www.baseusdp.com";
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (origin.match(/^https:\/\/code-whisperer-33[\w-]*\.vercel\.app/)) return origin;
  if (origin.match(/^https:\/\/baseusdp[\w-]*\.vercel\.app/)) return origin;
  return "https://www.baseusdp.com";
}

const MAX_RESULTS = 20;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getAllowedOrigin(req.headers.origin as string | undefined);
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Database not configured" });
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  const usernameRaw = (req.query.username as string | undefined)?.trim() ?? "";
  const sinceRaw = (req.query.since as string | undefined)?.trim() ?? "";
  if (!usernameRaw) {
    return res.status(400).json({ error: "username is required" });
  }

  // Accept either @handle or a raw 0x address.
  const cleanHandle = usernameRaw.startsWith("@") ? usernameRaw.slice(1) : usernameRaw;

  let wallet: string | null = null;
  let displayHandle: string | null = null;

  if (ADDRESS_RE.test(cleanHandle)) {
    wallet = cleanHandle.toLowerCase();
  } else {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("wallet_address, username")
      .ilike("username", cleanHandle)
      .maybeSingle();
    if (error) {
      console.error("[overlay/recent] lookup error:", error);
      return res.status(500).json({ error: "Lookup failed" });
    }
    if (!data?.wallet_address) {
      return res.status(404).json({ error: "Unknown handle" });
    }
    wallet = (data.wallet_address as string).toLowerCase();
    displayHandle = (data.username as string) ?? cleanHandle;
  }

  // Parse since — fall back to "last 5 minutes" if missing or invalid so the
  // overlay shows recent activity on first load.
  let since = new Date(Date.now() - 5 * 60 * 1000);
  if (sinceRaw) {
    const parsed = new Date(sinceRaw);
    if (!Number.isNaN(parsed.getTime())) since = parsed;
  }

  const { data: txs, error: txErr } = await supabase
    .from("zk_transactions")
    .select("id, sender_wallet, amount, token, memo, created_at, transaction_type")
    .eq("recipient_wallet", wallet)
    .neq("sender_wallet", wallet) // exclude self-sends (deposits / withdraws)
    .gt("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(MAX_RESULTS);

  if (txErr) {
    console.error("[overlay/recent] tx query error:", txErr);
    return res.status(200).json({ success: true, tips: [], handle: displayHandle });
  }

  const incoming = (txs ?? []).filter(
    (t: any) => (t.transaction_type ?? "transfer") !== "withdraw" && (t.transaction_type ?? "transfer") !== "deposit"
  );

  // Resolve sender usernames in one batch.
  const senderWallets = Array.from(
    new Set(
      incoming
        .map((t: any) => (t.sender_wallet as string | null)?.toLowerCase())
        .filter((s): s is string => !!s)
    )
  );

  const walletToUsername: Record<string, string> = {};
  if (senderWallets.length > 0) {
    const { data: senders } = await supabase
      .from("user_profiles")
      .select("wallet_address, username")
      .in("wallet_address", senderWallets);
    for (const s of senders ?? []) {
      if (s?.wallet_address && s?.username) {
        walletToUsername[(s.wallet_address as string).toLowerCase()] = s.username as string;
      }
    }
  }

  const tips = incoming.map((t: any) => {
    const sw = (t.sender_wallet as string | null)?.toLowerCase() ?? null;
    const senderUsername = sw ? walletToUsername[sw] ?? null : null;
    return {
      id: t.id as string,
      sender_username: senderUsername,
      sender_address: sw,
      amount: typeof t.amount === "string" ? Number(t.amount) : (t.amount as number | null),
      token: (t.token as string | null) ?? "USDC",
      memo: (t.memo as string | null) ?? null,
      created_at: t.created_at as string,
    };
  });

  return res.status(200).json({ success: true, tips, handle: displayHandle });
}
