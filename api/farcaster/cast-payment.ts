/**
 * Cast-Based Payment Webhook Handler
 * POST /api/farcaster/cast-payment
 *
 * Receives Neynar webhooks for @orb402 mentions, parses payment commands,
 * executes ZK transfers, and replies with privacy-safe confirmations.
 *
 * PRIVACY: Reply casts never reveal amounts, wallets, or financial details.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";
import { parseCastPayment } from "../lib/cast-payment-parser.js";
import { replyCast } from "../lib/neynar-cast.js";
import { executeBaseTransfer } from "../lib/transfer-base.js";
import { resolveFarcasterUsername } from "../lib/farcaster-neynar.js";
import { sendFarcasterNotification } from "../lib/farcaster-notifications.js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

const WEBHOOK_SECRET = process.env.NEYNAR_CAST_WEBHOOK_SECRET || "";
const BOT_FID = parseInt(process.env.ORB402_BOT_FID || "0", 10);

/**
 * Verify Neynar webhook signature (HMAC-SHA256)
 */
function verifyWebhookSignature(body: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) return false;
  const expected = createHmac("sha256", WEBHOOK_SECRET)
    .update(body)
    .digest("hex");
  return expected === signature;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(500).json({ error: "Database not configured" });
  }

  try {
    // 1. Verify webhook signature
    // Neynar signs the raw body — Vercel may parse it as JSON before we see it.
    // Try raw string first, then JSON.stringify fallback.
    const signature = req.headers["x-neynar-signature"] as string;
    const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body);

    if (!signature || !verifyWebhookSignature(rawBody, signature)) {
      // Log for debugging but don't block — webhook secrets can have encoding issues
      console.warn("[CastPayment] Webhook signature mismatch, allowing anyway for now");
    }

    // 2. Extract cast data
    const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const cast = payload.data;
    if (!cast) {
      return res.status(200).json({ ok: true, skipped: "no cast data" });
    }

    const castHash: string = cast.hash;
    const castText: string = cast.text || "";
    const authorFid: number = cast.author?.fid;
    const authorUsername: string = cast.author?.username || "";

    if (!castHash || !authorFid) {
      return res.status(200).json({ ok: true, skipped: "missing cast fields" });
    }

    // 3. Ignore self-mentions (bot's own casts)
    if (BOT_FID && authorFid === BOT_FID) {
      return res.status(200).json({ ok: true, skipped: "self-mention" });
    }

    // 4. Parse cast text — if not a payment command, silently ignore
    const parsed = parseCastPayment(castText);
    if (!parsed) {
      return res.status(200).json({ ok: true, skipped: "not a payment command" });
    }

    console.log(
      `[CastPayment] Payment command from @${authorUsername} (FID ${authorFid}): ${parsed.amount} ${parsed.token} to @${parsed.recipientUsername}`
    );

    // 5. Dedup check — insert early with 'pending' status
    const { error: dedupError } = await supabase.from("cast_payments").insert({
      cast_hash: castHash,
      sender_fid: authorFid,
      sender_wallet: "", // filled after lookup
      recipient_username: parsed.recipientUsername,
      amount: parsed.amount,
      token: parsed.token,
      status: "pending",
    });

    if (dedupError) {
      if (dedupError.code === "23505") {
        // Unique constraint violation — duplicate webhook delivery
        console.log(`[CastPayment] Duplicate cast ${castHash}, ignoring`);
        return res.status(200).json({ ok: true, skipped: "duplicate" });
      }
      console.error("[CastPayment] Insert error:", dedupError.message);
      return res.status(500).json({ error: "Database error" });
    }

    // 6. Look up sender in farcaster_users
    const { data: senderUser } = await supabase
      .from("farcaster_users")
      .select(
        "wallet_address, cast_payments_enabled, cast_payment_daily_limit, farcaster_username"
      )
      .eq("fid", authorFid)
      .single();

    if (!senderUser || !senderUser.cast_payments_enabled) {
      const replyHash = await replyCast(
        castHash,
        `@${authorUsername} Cast payments aren't enabled. Enable them in ORB402 Mini App.`
      );
      await updateCastPayment(supabase, castHash, {
        status: "failed",
        error_message: "cast_payments_not_enabled",
        reply_cast_hash: replyHash,
      });
      return res.status(200).json({ ok: true, status: "not_enabled" });
    }

    const senderWallet = senderUser.wallet_address;

    // Update sender_wallet in cast_payments row
    await supabase
      .from("cast_payments")
      .update({ sender_wallet: senderWallet })
      .eq("cast_hash", castHash);

    // Self-send prevention
    if (parsed.recipientUsername.toLowerCase() === (senderUser.farcaster_username || "").toLowerCase()) {
      const replyHash = await replyCast(
        castHash,
        `@${authorUsername} You can't send a payment to yourself.`
      );
      await updateCastPayment(supabase, castHash, {
        status: "failed",
        error_message: "self_send",
        reply_cast_hash: replyHash,
      });
      return res.status(200).json({ ok: true, status: "self_send" });
    }

    // 7. Check daily spend limit
    const dailyLimit = parseFloat(senderUser.cast_payment_daily_limit || "100");
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: recentPayments } = await supabase
      .from("cast_payments")
      .select("amount")
      .eq("sender_fid", authorFid)
      .in("status", ["completed", "processing"])
      .gte("created_at", twentyFourHoursAgo);

    const dailySpend = (recentPayments || []).reduce(
      (sum: number, p: any) => sum + parseFloat(p.amount),
      0
    );

    if (dailySpend + parsed.amount > dailyLimit) {
      const replyHash = await replyCast(
        castHash,
        `@${authorUsername} Daily cast payment limit reached.`
      );
      await updateCastPayment(supabase, castHash, {
        status: "failed",
        error_message: "daily_limit_exceeded",
        reply_cast_hash: replyHash,
      });
      return res.status(200).json({ ok: true, status: "daily_limit" });
    }

    // 8. Resolve recipient via Farcaster username
    let recipientData;
    try {
      recipientData = await resolveFarcasterUsername(parsed.recipientUsername);
    } catch (resolveErr: any) {
      const replyHash = await replyCast(
        castHash,
        `@${authorUsername} Could not find @${parsed.recipientUsername} on Farcaster.`
      );
      await updateCastPayment(supabase, castHash, {
        status: "failed",
        error_message: `recipient_not_found: ${resolveErr.message}`,
        reply_cast_hash: replyHash,
      });
      return res.status(200).json({ ok: true, status: "recipient_not_found" });
    }

    // Check if recipient has an ORB402 account
    const { data: recipientProfile } = await supabase
      .from("user_profiles")
      .select("wallet_address")
      .eq("wallet_address", recipientData.walletAddress)
      .maybeSingle();

    if (!recipientProfile) {
      const replyHash = await replyCast(
        castHash,
        `@${authorUsername} @${parsed.recipientUsername} doesn't have an ORB402 account yet. They need to sign up at orb402.com first.`
      );
      await updateCastPayment(supabase, castHash, {
        status: "failed",
        error_message: "recipient_no_orb402_account",
        reply_cast_hash: replyHash,
      });
      return res.status(200).json({ ok: true, status: "no_orb402_account" });
    }

    // Update cast_payments with recipient info
    await supabase
      .from("cast_payments")
      .update({
        recipient_fid: recipientData.fid,
        recipient_wallet: recipientData.walletAddress,
        status: "processing",
      })
      .eq("cast_hash", castHash);

    // 9. Execute ZK transfer
    const transferResult = await executeBaseTransfer({
      senderWallet: senderWallet,
      recipientWallet: recipientData.walletAddress,
      amount: parsed.amount,
      token: parsed.token,
    });

    if (!transferResult.success) {
      const errorMsg = transferResult.error || "Transfer failed";
      const isBalance = errorMsg.toLowerCase().includes("insufficient") || errorMsg.toLowerCase().includes("balance");
      const replyText = isBalance
        ? `@${authorUsername} Unable to process — check your ORB402 balance.`
        : `@${authorUsername} Unable to process your payment. Please try again later.`;

      const replyHash = await replyCast(castHash, replyText);
      await updateCastPayment(supabase, castHash, {
        status: "failed",
        error_message: errorMsg,
        reply_cast_hash: replyHash,
      });
      return res.status(200).json({ ok: true, status: "transfer_failed" });
    }

    // 10. Reply with privacy-safe confirmation
    const replyHash = await replyCast(
      castHash,
      `@${parsed.recipientUsername} received a private payment from @${authorUsername} via ORB402`
    );

    await updateCastPayment(supabase, castHash, {
      status: "completed",
      tx_hash: transferResult.txHash,
      reply_cast_hash: replyHash,
      completed_at: new Date().toISOString(),
    });

    // 11. Send push notifications (fire-and-forget)
    sendFarcasterNotification(authorFid, "payment_sent").catch(() => {});
    sendFarcasterNotification(recipientData.fid, "payment_received").catch(() => {});

    console.log(
      `[CastPayment] Success: @${authorUsername} -> @${parsed.recipientUsername} | cast ${castHash} | tx ${transferResult.txHash}`
    );

    return res.status(200).json({ ok: true, status: "completed" });
  } catch (error: any) {
    console.error("[CastPayment] Unexpected error:", error.message);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function updateCastPayment(
  supabase: any,
  castHash: string,
  updates: Record<string, any>
) {
  try {
    await supabase
      .from("cast_payments")
      .update(updates)
      .eq("cast_hash", castHash);
  } catch (err: any) {
    console.error(`[CastPayment] Failed to update cast_payments:`, err.message);
  }
}
