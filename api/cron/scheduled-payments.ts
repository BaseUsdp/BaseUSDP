import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { executeBaseTransfer } from "../lib/transfer-base.js";
import {
  recoverScheduledPaymentAuthSigner,
  SCHEDULED_PAYMENT_AUTH_SCOPE,
} from "../lib/scheduled-auth.js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const MAX_RETRIES_BEFORE_FALLBACK = 2;

interface ScheduledRow {
  id: string;
  user_wallet: string;
  recipient_type: "address" | "username";
  recipient_value: string;
  token: "USDC" | "USDT";
  amount: string | number;
  is_recurring: boolean;
  frequency: "daily" | "weekly" | "monthly" | null;
  scheduled_for: string;
  auto_execute: boolean;
  auth_signature: string | null;
  auth_max_per_tx: string | number | null;
  auth_expires_at: string | null;
  auth_revoked: boolean;
  retry_count: number;
}

function nextRunAt(from: Date, frequency: "daily" | "weekly" | "monthly"): Date {
  const next = new Date(from.getTime());
  if (frequency === "daily") next.setUTCDate(next.getUTCDate() + 1);
  else if (frequency === "weekly") next.setUTCDate(next.getUTCDate() + 7);
  else if (frequency === "monthly") next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

async function resolveRecipientWallet(
  supabase: ReturnType<typeof createClient>,
  row: ScheduledRow
): Promise<string | null> {
  if (row.recipient_type === "address") return row.recipient_value;
  const cleanUsername = row.recipient_value.replace(/^@/, "");
  const { data } = await supabase
    .from("user_profiles")
    .select("wallet_address")
    .ilike("username", cleanUsername)
    .maybeSingle();
  return data?.wallet_address ?? null;
}

async function executeOne(
  supabase: ReturnType<typeof createClient>,
  row: ScheduledRow
): Promise<{ ok: boolean; error?: string; txHash?: string }> {
  // Validate the stored authorization before doing anything on-chain.
  if (!row.auth_signature || !row.auth_max_per_tx || !row.auth_expires_at) {
    return { ok: false, error: "missing authorization" };
  }
  if (row.auth_revoked) return { ok: false, error: "authorization revoked" };

  const expiresAtMs = new Date(row.auth_expires_at).getTime();
  if (Number.isNaN(expiresAtMs) || expiresAtMs <= Date.now()) {
    return { ok: false, error: "authorization expired" };
  }

  const amount = Number(row.amount);
  const maxPerTx = Number(row.auth_max_per_tx);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "invalid amount" };
  if (!Number.isFinite(maxPerTx) || amount > maxPerTx) {
    return { ok: false, error: "amount exceeds max_per_tx" };
  }

  // Recover the signer and confirm it matches the schedule owner.
  const maxPerTxUnits = BigInt(Math.round(maxPerTx * 1_000_000));
  const expiresAtUnix = BigInt(Math.floor(expiresAtMs / 1000));
  const recovered = recoverScheduledPaymentAuthSigner(
    {
      scope: SCHEDULED_PAYMENT_AUTH_SCOPE,
      scheduleId: row.id,
      userWallet: row.user_wallet,
      recipientType: row.recipient_type,
      recipientValue: row.recipient_value,
      token: row.token,
      maxPerTx: maxPerTxUnits,
      expiresAt: expiresAtUnix,
    },
    row.auth_signature
  );
  if (!recovered || recovered !== row.user_wallet.toLowerCase()) {
    return { ok: false, error: "authorization signature mismatch" };
  }

  const recipientWallet = await resolveRecipientWallet(supabase, row);
  if (!recipientWallet) return { ok: false, error: "recipient could not be resolved" };

  const result = await executeBaseTransfer({
    senderWallet: row.user_wallet,
    recipientWallet,
    amount,
    token: row.token,
    forceExternal: row.recipient_type === "address",
  });

  if (!result.success) return { ok: false, error: result.error ?? "transfer failed" };
  return { ok: true, txHash: result.txHash };
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Database not configured" });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const nowIso = new Date().toISOString();
  const summary = { flagged: 0, executed: 0, failed: 0, fellBack: 0 };

  try {
    // 1) Notify-only path: flag past-due notify rows as is_due so the banner shows.
    const { data: flaggedRows, error: flagError } = await supabase
      .from("scheduled_payments")
      .update({ is_due: true })
      .eq("status", "active")
      .eq("auto_execute", false)
      .eq("is_due", false)
      .lte("scheduled_for", nowIso)
      .select("id");
    if (flagError) console.error("[CronScheduled] flag error:", flagError);
    summary.flagged = flaggedRows?.length ?? 0;

    // 2) Auto-execute path: fetch due rows where auto_execute=true and execute.
    const { data: autoRows, error: autoError } = await supabase
      .from("scheduled_payments")
      .select(
        "id,user_wallet,recipient_type,recipient_value,token,amount,is_recurring,frequency,scheduled_for,auto_execute,auth_signature,auth_max_per_tx,auth_expires_at,auth_revoked,retry_count"
      )
      .eq("status", "active")
      .eq("auto_execute", true)
      .eq("auth_revoked", false)
      .lte("scheduled_for", nowIso)
      .limit(50);

    if (autoError) {
      console.error("[CronScheduled] auto fetch error:", autoError);
    }

    for (const row of (autoRows ?? []) as ScheduledRow[]) {
      const execResult = await executeOne(supabase, row);
      const now = new Date();

      if (execResult.ok) {
        summary.executed += 1;
        const updates: Record<string, unknown> = {
          last_sent_at: now.toISOString(),
          last_tx_hash: execResult.txHash ?? null,
          last_error: null,
          retry_count: 0,
          is_due: false,
        };
        if (row.is_recurring && row.frequency) {
          updates.scheduled_for = nextRunAt(now, row.frequency).toISOString();
        } else {
          updates.status = "completed";
        }
        await supabase.from("scheduled_payments").update(updates).eq("id", row.id);
        console.log(
          `[CronScheduled] executed ${row.id}: $${row.amount} ${row.token} tx=${execResult.txHash}`
        );
      } else {
        summary.failed += 1;
        const newRetryCount = (row.retry_count ?? 0) + 1;
        const shouldFallBack = newRetryCount >= MAX_RETRIES_BEFORE_FALLBACK;
        const updates: Record<string, unknown> = {
          last_error: execResult.error ?? "unknown error",
          retry_count: newRetryCount,
        };
        if (shouldFallBack) {
          updates.auto_execute = false;
          updates.is_due = true;
          summary.fellBack += 1;
          console.warn(
            `[CronScheduled] ${row.id} fell back to notify-only after ${newRetryCount} failures: ${execResult.error}`
          );
        } else {
          console.warn(
            `[CronScheduled] ${row.id} failed attempt ${newRetryCount}: ${execResult.error}`
          );
        }
        await supabase.from("scheduled_payments").update(updates).eq("id", row.id);
      }
    }

    console.log(
      `[CronScheduled] flagged=${summary.flagged} executed=${summary.executed} failed=${summary.failed} fellBack=${summary.fellBack}`
    );
    return res.status(200).json({ success: true, ...summary });
  } catch (error: any) {
    console.error("[CronScheduled] Error:", error);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}
