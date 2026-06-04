/**
 * GET /api/cron/push-tips
 *
 * Vercel cron job — runs every minute. Detects new incoming tips in
 * zk_transactions, and for each one, looks up the recipient's web push
 * subscriptions and fires a notification.
 *
 * State is tracked in the `push_state` table under key="push_last_tip_ts".
 * Each run only considers tips with `created_at > last_ts`. Tips authored
 * before the first run are ignored (no retroactive blast).
 *
 * Failed subscriptions (410 Gone) are removed from the table so we don't
 * keep retrying dead endpoints.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:baseusdp@proton.me";

const STATE_KEY = "push_last_tip_ts";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  if (!supabaseUrl || !supabaseKey) {
    return res.status(200).json({ ok: false, error: "Database not configured" });
  }
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return res.status(200).json({ ok: false, error: "VAPID keys not configured" });
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Load the cursor. If absent, seed it to "now" so we never blast historic
  // tips on first run.
  const { data: cursorRow } = await supabase
    .from("push_state")
    .select("value")
    .eq("key", STATE_KEY)
    .maybeSingle();

  let lastTs: string;
  if (cursorRow?.value) {
    lastTs = cursorRow.value as string;
  } else {
    lastTs = new Date().toISOString();
    await supabase
      .from("push_state")
      .upsert({ key: STATE_KEY, value: lastTs, updated_at: lastTs });
    return res.status(200).json({ ok: true, seeded: true, lastTs });
  }

  // Fetch new tips since the cursor. Cap at 100 per run.
  const { data: txs, error } = await supabase
    .from("zk_transactions")
    .select("id, sender_wallet, recipient_wallet, amount, memo, created_at, transaction_type")
    .gt("created_at", lastTs)
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) {
    console.error("[push-tips] tx query error:", error);
    return res.status(200).json({ ok: false, error: error.message });
  }

  const incoming = (txs ?? []).filter(
    (t: any) =>
      (t.transaction_type ?? "transfer") !== "withdraw" &&
      (t.transaction_type ?? "transfer") !== "deposit" &&
      t.sender_wallet &&
      t.recipient_wallet &&
      (t.sender_wallet as string).toLowerCase() !==
        (t.recipient_wallet as string).toLowerCase(),
  );

  if (incoming.length === 0) {
    return res.status(200).json({ ok: true, processed: 0, lastTs });
  }

  // Collect unique recipient wallets + a sender-handle lookup table.
  const recipientWallets = Array.from(
    new Set(
      incoming.map((t: any) => (t.recipient_wallet as string).toLowerCase()),
    ),
  );
  const senderWallets = Array.from(
    new Set(
      incoming.map((t: any) => (t.sender_wallet as string).toLowerCase()),
    ),
  );

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, user_wallet, endpoint, p256dh, auth")
    .in("user_wallet", recipientWallets);

  const subsByWallet = new Map<string, typeof subs>();
  for (const s of subs ?? []) {
    const w = (s.user_wallet as string).toLowerCase();
    const list = subsByWallet.get(w) ?? [];
    list.push(s);
    subsByWallet.set(w, list);
  }

  // Resolve sender usernames (best-effort) for nicer notification body.
  const { data: senderProfiles } = await supabase
    .from("user_profiles")
    .select("wallet_address, username")
    .in("wallet_address", senderWallets);
  const senderUsername = new Map<string, string>();
  for (const p of senderProfiles ?? []) {
    if (p?.wallet_address && p?.username) {
      senderUsername.set(
        (p.wallet_address as string).toLowerCase(),
        p.username as string,
      );
    }
  }

  let sent = 0;
  let removed = 0;
  let newestTs = lastTs;

  for (const t of incoming) {
    const created = t.created_at as string;
    if (created > newestTs) newestTs = created;

    const recipient = (t.recipient_wallet as string).toLowerCase();
    const targets = subsByWallet.get(recipient) ?? [];
    if (targets.length === 0) continue;

    const sender = (t.sender_wallet as string).toLowerCase();
    const senderLabel = senderUsername.get(sender)
      ? `@${senderUsername.get(sender)}`
      : `${sender.slice(0, 6)}…${sender.slice(-4)}`;
    const amount =
      typeof t.amount === "string"
        ? Number(t.amount)
        : (t.amount as number | null) ?? 0;
    const amountStr =
      typeof amount === "number" && Number.isFinite(amount)
        ? `$${amount.toFixed(2)} USDC`
        : "USDC";

    const payload = JSON.stringify({
      title: `${amountStr} from ${senderLabel}`,
      body: t.memo
        ? `"${(t.memo as string).slice(0, 100)}"`
        : "You just got tipped on BASEUSDP",
      url: "/dashboard?tab=history",
      tag: `tip-${t.id}`,
    });

    for (const sub of targets) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint as string,
            keys: {
              p256dh: sub.p256dh as string,
              auth: sub.auth as string,
            },
          },
          payload,
        );
        sent += 1;
      } catch (err: any) {
        const status = err?.statusCode ?? 0;
        if (status === 404 || status === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          removed += 1;
        } else {
          console.warn("[push-tips] send failed:", status, err?.body || err?.message);
        }
      }
    }
  }

  // Advance the cursor.
  await supabase
    .from("push_state")
    .upsert({
      key: STATE_KEY,
      value: newestTs,
      updated_at: new Date().toISOString(),
    });

  return res
    .status(200)
    .json({ ok: true, processed: incoming.length, sent, removed, lastTs: newestTs });
}
