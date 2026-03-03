/**
 * Twitter/X Mention Payment Cron Handler
 * GET /api/twitter/tweet-payment-cron
 *
 * Triggered by Vercel cron every 1 minute. Polls X API for new @orb402 mentions,
 * parses payment commands, executes ZK transfers, and replies with confirmations.
 *
 * PRIVACY: Reply tweets never reveal amounts, wallets, or financial details.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { parseTweetPayment } from "../lib/tweet-payment-parser.js";
import { fetchMentions, replyTweet } from "../lib/x-api.js";
import { executeBaseTransfer } from "../lib/transfer-base.js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const ORB402_X_USER_ID = process.env.ORB402_X_USER_ID || "";

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(500).json({ error: "Database not configured" });
  }

  try {
    // 1. Read since_id watermark
    const { data: pollingState } = await supabase
      .from("x_polling_state")
      .select("since_id")
      .eq("id", 1)
      .single();

    const sinceId = pollingState?.since_id || undefined;
    console.log(`[TweetPaymentCron] Polling mentions since_id=${sinceId || "none"}`);

    // 2. Fetch new mentions
    const { mentions, users, newestId } = await fetchMentions(sinceId);

    if (mentions.length === 0) {
      console.log("[TweetPaymentCron] No new mentions");
      return res.status(200).json({ ok: true, processed: 0 });
    }

    console.log(`[TweetPaymentCron] Found ${mentions.length} new mentions`);

    // 3. Update since_id immediately to avoid reprocessing on next run
    if (newestId) {
      await supabase
        .from("x_polling_state")
        .update({ since_id: newestId, updated_at: new Date().toISOString() })
        .eq("id", 1);
    }

    // 4. Process each mention
    let processed = 0;
    let skipped = 0;

    for (const mention of mentions) {
      try {
        const result = await processMention(supabase, mention, users);
        if (result === "processed") processed++;
        else skipped++;
      } catch (err: any) {
        console.error(`[TweetPaymentCron] Error processing tweet ${mention.id}:`, err.message);
        skipped++;
      }
    }

    console.log(`[TweetPaymentCron] Done: ${processed} processed, ${skipped} skipped`);
    return res.status(200).json({ ok: true, processed, skipped });
  } catch (error: any) {
    console.error("[TweetPaymentCron] Unexpected error:", error.message);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function processMention(
  supabase: any,
  mention: { id: string; text: string; author_id: string },
  users: Record<string, { id: string; username: string; name: string }>
): Promise<"processed" | "skipped"> {
  const tweetId = mention.id;
  const tweetText = mention.text || "";
  const authorId = mention.author_id;
  const authorUsername = users[authorId]?.username || "";

  console.log(`[TweetPaymentCron] Tweet ${tweetId}: "${tweetText}" from @${authorUsername} (${authorId})`);

  // Skip bot's own tweets
  if (ORB402_X_USER_ID && authorId === ORB402_X_USER_ID) {
    console.log("[TweetPaymentCron] Bot's own tweet, skipping");
    return "skipped";
  }

  // Parse payment command
  const parsed = parseTweetPayment(tweetText);
  if (!parsed) {
    console.log(`[TweetPaymentCron] Not a payment command: "${tweetText}"`);
    return "skipped";
  }

  console.log(
    `[TweetPaymentCron] Payment command from @${authorUsername}: ${parsed.amount} ${parsed.token} to @${parsed.recipientUsername}`
  );

  // Dedup insert
  const { error: dedupError } = await supabase.from("tweet_payments").insert({
    tweet_id: tweetId,
    sender_x_user_id: authorId,
    sender_wallet: "",
    recipient_username: parsed.recipientUsername,
    amount: parsed.amount,
    token: parsed.token,
    status: "pending",
  });

  if (dedupError) {
    if (dedupError.code === "23505") {
      console.log(`[TweetPaymentCron] Duplicate tweet ${tweetId}, ignoring`);
      return "skipped";
    }
    console.error("[TweetPaymentCron] Insert error:", dedupError.message);
    return "skipped";
  }

  // Look up sender in x_users
  const { data: senderUser } = await supabase
    .from("x_users")
    .select(
      "wallet_address, tweet_payments_enabled, tweet_payment_daily_limit, x_username"
    )
    .eq("x_user_id", authorId)
    .single();

  if (!senderUser || !senderUser.tweet_payments_enabled) {
    const replyId = await replyTweet(
      tweetId,
      `@${authorUsername} Tweet payments aren't enabled. Enable them at orb402.com/dashboard.`
    );
    await updateTweetPayment(supabase, tweetId, {
      status: "failed",
      error_message: "tweet_payments_not_enabled",
      reply_tweet_id: replyId,
    });
    return "processed";
  }

  const senderWallet = senderUser.wallet_address;

  // Update sender_wallet
  await supabase
    .from("tweet_payments")
    .update({ sender_wallet: senderWallet })
    .eq("tweet_id", tweetId);

  // Self-send prevention
  if (
    parsed.recipientUsername.toLowerCase() ===
    (senderUser.x_username || "").toLowerCase()
  ) {
    const replyId = await replyTweet(
      tweetId,
      `@${authorUsername} You can't send a payment to yourself.`
    );
    await updateTweetPayment(supabase, tweetId, {
      status: "failed",
      error_message: "self_send",
      reply_tweet_id: replyId,
    });
    return "processed";
  }

  // Check daily spend limit
  const dailyLimit = parseFloat(senderUser.tweet_payment_daily_limit || "100");
  const twentyFourHoursAgo = new Date(
    Date.now() - 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: recentPayments } = await supabase
    .from("tweet_payments")
    .select("amount")
    .eq("sender_x_user_id", authorId)
    .in("status", ["completed", "processing"])
    .gte("created_at", twentyFourHoursAgo);

  const dailySpend = (recentPayments || []).reduce(
    (sum: number, p: any) => sum + parseFloat(p.amount),
    0
  );

  if (dailySpend + parsed.amount > dailyLimit) {
    const replyId = await replyTweet(
      tweetId,
      `@${authorUsername} Daily tweet payment limit reached.`
    );
    await updateTweetPayment(supabase, tweetId, {
      status: "failed",
      error_message: "daily_limit_exceeded",
      reply_tweet_id: replyId,
    });
    return "processed";
  }

  // Resolve recipient — try ORB402 username first, then x_users by username
  let recipientWallet: string | null = null;

  // Try ORB402 user_profiles first
  const { data: orb402Profile } = await supabase
    .from("user_profiles")
    .select("wallet_address, username")
    .ilike("username", parsed.recipientUsername)
    .maybeSingle();

  if (orb402Profile?.wallet_address) {
    recipientWallet = orb402Profile.wallet_address;
    console.log(
      `[TweetPaymentCron] Resolved as ORB402 user: ${orb402Profile.username} → ${recipientWallet!.slice(0, 10)}...`
    );
  } else {
    // Fall back to x_users by username
    const { data: xRecipient } = await supabase
      .from("x_users")
      .select("wallet_address, x_username")
      .ilike("x_username", parsed.recipientUsername)
      .maybeSingle();

    if (xRecipient?.wallet_address) {
      recipientWallet = xRecipient.wallet_address;
      console.log(
        `[TweetPaymentCron] Resolved via x_users: @${xRecipient.x_username} → ${recipientWallet!.slice(0, 10)}...`
      );
    } else {
      const replyId = await replyTweet(
        tweetId,
        `@${authorUsername} @${parsed.recipientUsername} doesn't have an ORB402 account yet. They need to sign up at orb402.com first.`
      );
      await updateTweetPayment(supabase, tweetId, {
        status: "failed",
        error_message: "recipient_not_found",
        reply_tweet_id: replyId,
      });
      return "processed";
    }
  }

  // Update tweet_payments with recipient info
  await supabase
    .from("tweet_payments")
    .update({
      recipient_wallet: recipientWallet,
      status: "processing",
    })
    .eq("tweet_id", tweetId);

  // Execute ZK transfer
  const transferResult = await executeBaseTransfer({
    senderWallet: senderWallet,
    recipientWallet: recipientWallet!,
    amount: parsed.amount,
    token: parsed.token,
  });

  if (!transferResult.success) {
    const errorMsg = transferResult.error || "Transfer failed";
    const isBalance =
      errorMsg.toLowerCase().includes("insufficient") ||
      errorMsg.toLowerCase().includes("balance");
    const replyText = isBalance
      ? `@${authorUsername} Unable to process — check your ORB402 balance.`
      : `@${authorUsername} Unable to process your payment. Please try again later.`;

    const replyId = await replyTweet(tweetId, replyText);
    await updateTweetPayment(supabase, tweetId, {
      status: "failed",
      error_message: errorMsg,
      reply_tweet_id: replyId,
    });
    return "processed";
  }

  // Reply with privacy-safe confirmation
  const replyId = await replyTweet(
    tweetId,
    `@${parsed.recipientUsername} received a private payment from @${authorUsername} via ORB402`
  );

  await updateTweetPayment(supabase, tweetId, {
    status: "completed",
    tx_hash: transferResult.txHash,
    reply_tweet_id: replyId,
    completed_at: new Date().toISOString(),
  });

  console.log(
    `[TweetPaymentCron] Success: @${authorUsername} -> @${parsed.recipientUsername} | tweet ${tweetId} | tx ${transferResult.txHash}`
  );

  return "processed";
}

async function updateTweetPayment(
  supabase: any,
  tweetId: string,
  updates: Record<string, any>
) {
  try {
    await supabase
      .from("tweet_payments")
      .update(updates)
      .eq("tweet_id", tweetId);
  } catch (err: any) {
    console.error(`[TweetPaymentCron] Failed to update tweet_payments:`, err.message);
  }
}
