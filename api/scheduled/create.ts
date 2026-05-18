import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import {
  recoverScheduledPaymentAuthSigner,
  SCHEDULED_PAYMENT_AUTH_SCOPE,
} from "../lib/scheduled-auth.js";

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

type Frequency = "daily" | "weekly" | "monthly";

function isValidFrequency(value: unknown): value is Frequency {
  return value === "daily" || value === "weekly" || value === "monthly";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getAllowedOrigin(req.headers.origin as string | undefined);
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Database not configured" });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const {
      schedule_id,
      user_wallet,
      recipient_type,
      recipient_value,
      token,
      amount,
      memo,
      is_recurring,
      frequency,
      scheduled_for,
      auto_execute,
      auth_signature,
      auth_max_per_tx,
      auth_expires_at,
    } = req.body ?? {};

    if (!user_wallet || typeof user_wallet !== "string") {
      return res.status(400).json({ error: "user_wallet is required" });
    }
    if (recipient_type !== "address" && recipient_type !== "username") {
      return res.status(400).json({ error: "recipient_type must be 'address' or 'username'" });
    }
    if (!recipient_value || typeof recipient_value !== "string") {
      return res.status(400).json({ error: "recipient_value is required" });
    }
    if (recipient_type === "address" && !/^0x[a-fA-F0-9]{40}$/.test(recipient_value)) {
      return res.status(400).json({ error: "Invalid Base address" });
    }
    if (recipient_type === "username" && !/^@?[a-zA-Z0-9_-]{2,30}$/.test(recipient_value)) {
      return res.status(400).json({ error: "Invalid username" });
    }
    if (token !== "USDC" && token !== "USDT") {
      return res.status(400).json({ error: "token must be USDC or USDT" });
    }
    const parsedAmount = parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > 999999.99) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const recurringFlag = Boolean(is_recurring);
    let normalizedFrequency: Frequency | null = null;
    if (recurringFlag) {
      if (!isValidFrequency(frequency)) {
        return res.status(400).json({ error: "frequency required for recurring schedules" });
      }
      normalizedFrequency = frequency;
    } else if (frequency != null) {
      return res.status(400).json({ error: "frequency must be omitted for one-shot schedules" });
    }

    const scheduledAt = scheduled_for ? new Date(scheduled_for) : null;
    if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
      return res.status(400).json({ error: "scheduled_for must be a valid ISO timestamp" });
    }
    if (scheduledAt.getTime() < Date.now() - 60_000) {
      return res.status(400).json({ error: "scheduled_for must be in the future" });
    }

    const normalizedRecipient =
      recipient_type === "username" ? recipient_value.replace(/^@/, "") : recipient_value;

    const trimmedMemo = typeof memo === "string" ? memo.slice(0, 120).replace(/[\x00-\x1F\x7F]/g, "") : null;

    // Auto-execute path: verify the client-signed EIP-712 auth before insert.
    const autoExecuteFlag = Boolean(auto_execute);
    let authMaxPerTxNumeric: number | null = null;
    let authExpiresAtIso: string | null = null;
    let authSignatureClean: string | null = null;
    let scheduleIdToUse: string | null = null;

    if (autoExecuteFlag) {
      if (!schedule_id || typeof schedule_id !== "string" || !/^[0-9a-f-]{36}$/i.test(schedule_id)) {
        return res.status(400).json({ error: "schedule_id (uuid) required when auto_execute is true" });
      }
      if (!auth_signature || typeof auth_signature !== "string") {
        return res.status(400).json({ error: "auth_signature required when auto_execute is true" });
      }
      const parsedMax = parseFloat(auth_max_per_tx);
      if (!Number.isFinite(parsedMax) || parsedMax <= 0 || parsedMax > 999999.99) {
        return res.status(400).json({ error: "auth_max_per_tx must be a positive number under 999999.99" });
      }
      if (parsedMax < parsedAmount) {
        return res.status(400).json({ error: "auth_max_per_tx must be >= scheduled amount" });
      }
      const expiresAtDate = auth_expires_at ? new Date(auth_expires_at) : null;
      if (!expiresAtDate || Number.isNaN(expiresAtDate.getTime())) {
        return res.status(400).json({ error: "auth_expires_at must be a valid ISO timestamp" });
      }
      if (expiresAtDate.getTime() < Date.now() + 60_000) {
        return res.status(400).json({ error: "auth_expires_at must be in the future" });
      }
      if (expiresAtDate.getTime() > Date.now() + 2 * 365 * 24 * 60 * 60 * 1000) {
        return res.status(400).json({ error: "auth_expires_at cannot be more than 2 years out" });
      }

      const expiresAtUnix = BigInt(Math.floor(expiresAtDate.getTime() / 1000));
      const maxPerTxUnits = BigInt(Math.round(parsedMax * 1_000_000));

      const recovered = recoverScheduledPaymentAuthSigner(
        {
          scope: SCHEDULED_PAYMENT_AUTH_SCOPE,
          scheduleId: schedule_id,
          userWallet: user_wallet,
          recipientType: recipient_type,
          recipientValue: normalizedRecipient,
          token,
          maxPerTx: maxPerTxUnits,
          expiresAt: expiresAtUnix,
        },
        auth_signature
      );

      if (!recovered || recovered !== user_wallet.toLowerCase()) {
        console.warn(
          `[Scheduled] auth signature does not match user_wallet (recovered=${recovered}, expected=${user_wallet.toLowerCase()})`
        );
        return res.status(400).json({ error: "Authorization signature does not match user wallet" });
      }

      authMaxPerTxNumeric = parsedMax;
      authExpiresAtIso = expiresAtDate.toISOString();
      authSignatureClean = auth_signature;
      scheduleIdToUse = schedule_id;
    }

    const insertPayload: Record<string, unknown> = {
      user_wallet,
      recipient_type,
      recipient_value: normalizedRecipient,
      token,
      amount: parsedAmount,
      memo: trimmedMemo,
      is_recurring: recurringFlag,
      frequency: normalizedFrequency,
      scheduled_for: scheduledAt.toISOString(),
      auto_execute: autoExecuteFlag,
    };
    if (autoExecuteFlag) {
      insertPayload.id = scheduleIdToUse;
      insertPayload.auth_signature = authSignatureClean;
      insertPayload.auth_max_per_tx = authMaxPerTxNumeric;
      insertPayload.auth_expires_at = authExpiresAtIso;
    }

    const { data, error } = await supabase
      .from("scheduled_payments")
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.error("[Scheduled] Insert error:", error);
      return res.status(500).json({ error: "Failed to create schedule" });
    }

    return res.status(200).json({ success: true, schedule: data });
  } catch (error: any) {
    console.error("[Scheduled] Error:", error);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}
