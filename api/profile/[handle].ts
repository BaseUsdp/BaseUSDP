/**
 * GET /api/profile/:handle
 *
 * Public, no-auth endpoint powering the /@handle profile page. Returns
 * basic profile info plus light aggregate stats and the most recent
 * incoming tips. Heavier analytics (top tippers, trends) live behind
 * the paid x402 creator-stats endpoint.
 *
 * Response:
 *   {
 *     success: true,
 *     handle: "@georgesk",
 *     displayName: "GeorgesK",
 *     profilePicture: string | null,
 *     walletAddress: "0x...",
 *     totalReceived: number,
 *     tipCount: number,
 *     uniqueTippers: number,
 *     recentTips: [{ sender_handle, sender_address, amount, token, memo, created_at }]
 *   }
 *
 * 404 when the handle is not registered or hasn't set a custom username.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const RECENT_LIMIT = 10;

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

  const raw = req.query.handle;
  const handleParam = Array.isArray(raw) ? raw[0] : raw;
  const clean = (handleParam ?? "").trim().replace(/^@/, "");
  if (!clean) {
    return res
      .status(400)
      .json({ success: false, error: "handle is required" });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: profile, error } = await supabase
      .from("user_profiles")
      .select(
        "wallet_address, username, profile_picture, bio, banner_url, twitter_handle, farcaster_handle, website_url",
      )
      .ilike("username", clean)
      .maybeSingle();
    if (error || !profile?.wallet_address) {
      return res
        .status(404)
        .json({ success: false, error: "Profile not found" });
    }
    const wallet = (profile.wallet_address as string).toLowerCase();
    const username = profile.username as string;

    // Pull last 200 incoming tx and aggregate client-side. Caps the work
    // we do here; deeper analytics live behind the paid x402 endpoint.
    const { data: txs } = await supabase
      .from("zk_transactions")
      .select("*")
      .eq("recipient_wallet", wallet)
      .neq("sender_wallet", wallet)
      .order("created_at", { ascending: false })
      .limit(200);

    const incoming = (txs ?? []).filter(
      (t: any) =>
        (t.transaction_type ?? "transfer") !== "withdraw" &&
        (t.transaction_type ?? "transfer") !== "deposit",
    );

    let total = 0;
    const tippers = new Set<string>();
    for (const t of incoming) {
      const amt =
        typeof t.amount === "string"
          ? Number(t.amount)
          : (t.amount as number) || 0;
      total += amt;
      const sw = (t.sender_wallet as string | null)?.toLowerCase();
      if (sw) tippers.add(sw);
    }

    // Resolve usernames for the most recent N senders to render @handles.
    const recent = incoming.slice(0, RECENT_LIMIT);
    const recentSenders = Array.from(
      new Set(
        recent
          .map((t: any) => (t.sender_wallet as string | null)?.toLowerCase())
          .filter((s): s is string => !!s),
      ),
    );
    const walletToUsername: Record<string, string> = {};
    if (recentSenders.length > 0) {
      const { data: senders } = await supabase
        .from("user_profiles")
        .select("wallet_address, username")
        .in("wallet_address", recentSenders);
      for (const s of senders ?? []) {
        if (s?.wallet_address && s?.username) {
          walletToUsername[(s.wallet_address as string).toLowerCase()] =
            s.username as string;
        }
      }
    }

    const recentTips = recent.map((t: any) => {
      const sw = (t.sender_wallet as string | null)?.toLowerCase() ?? null;
      const senderUsername = sw ? walletToUsername[sw] ?? null : null;
      return {
        sender_handle: senderUsername ? `@${senderUsername}` : null,
        sender_address: sw,
        amount:
          typeof t.amount === "string"
            ? Number(t.amount)
            : (t.amount as number | null),
        token: (t.token_symbol as string | null) ?? "USDC",
        memo: (t.memo as string | null) ?? null,
        created_at: t.created_at as string,
      };
    });

    return res.status(200).json({
      success: true,
      handle: `@${username}`,
      displayName: username,
      profilePicture: (profile.profile_picture as string | null) ?? null,
      walletAddress: profile.wallet_address as string,
      bio: (profile.bio as string | null) ?? null,
      bannerUrl: (profile.banner_url as string | null) ?? null,
      twitterHandle: (profile.twitter_handle as string | null) ?? null,
      farcasterHandle: (profile.farcaster_handle as string | null) ?? null,
      websiteUrl: (profile.website_url as string | null) ?? null,
      totalReceived: Number(total.toFixed(2)),
      tipCount: incoming.length,
      uniqueTippers: tippers.size,
      recentTips,
    });
  } catch (err: any) {
    console.error("[profile/handle] error:", err?.message || err);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
}
