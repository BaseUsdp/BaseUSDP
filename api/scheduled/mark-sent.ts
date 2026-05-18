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

function nextRunAt(from: Date, frequency: "daily" | "weekly" | "monthly"): Date {
  const next = new Date(from.getTime());
  if (frequency === "daily") next.setUTCDate(next.getUTCDate() + 1);
  else if (frequency === "weekly") next.setUTCDate(next.getUTCDate() + 7);
  else if (frequency === "monthly") next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
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
    const { id, wallet, tx_hash } = req.body ?? {};
    if (!id || typeof id !== "string") return res.status(400).json({ error: "id is required" });
    if (!wallet || typeof wallet !== "string") return res.status(400).json({ error: "wallet is required" });

    const { data: row, error: readErr } = await supabase
      .from("scheduled_payments")
      .select("*")
      .eq("id", id)
      .eq("user_wallet", wallet)
      .single();

    if (readErr || !row) {
      return res.status(404).json({ error: "Schedule not found" });
    }

    if (row.status !== "active") {
      return res.status(200).json({ success: true, schedule: row });
    }

    const now = new Date();
    const updates: Record<string, unknown> = {
      last_sent_at: now.toISOString(),
      last_tx_hash: typeof tx_hash === "string" ? tx_hash : null,
      is_due: false,
    };

    if (row.is_recurring && row.frequency) {
      updates.scheduled_for = nextRunAt(now, row.frequency).toISOString();
    } else {
      updates.status = "completed";
    }

    const { data: updated, error: updateErr } = await supabase
      .from("scheduled_payments")
      .update(updates)
      .eq("id", id)
      .eq("user_wallet", wallet)
      .select()
      .single();

    if (updateErr) {
      console.error("[Scheduled] mark-sent error:", updateErr);
      return res.status(500).json({ error: "Failed to mark schedule sent" });
    }

    return res.status(200).json({ success: true, schedule: updated });
  } catch (error: any) {
    console.error("[Scheduled] Error:", error);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}
