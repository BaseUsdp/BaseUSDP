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
      user_wallet,
      recipient_type,
      recipient_value,
      token,
      amount,
      memo,
      is_recurring,
      frequency,
      scheduled_for,
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

    const { data, error } = await supabase
      .from("scheduled_payments")
      .insert({
        user_wallet,
        recipient_type,
        recipient_value: normalizedRecipient,
        token,
        amount: parsedAmount,
        memo: trimmedMemo,
        is_recurring: recurringFlag,
        frequency: normalizedFrequency,
        scheduled_for: scheduledAt.toISOString(),
      })
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
