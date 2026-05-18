import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Database not configured" });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
      .from("scheduled_payments")
      .update({ is_due: true })
      .eq("status", "active")
      .eq("is_due", false)
      .lte("scheduled_for", nowIso)
      .select("id");

    if (error) {
      console.error("[CronScheduled] Update error:", error);
      return res.status(500).json({ error: "Failed to flag due schedules" });
    }

    const flagged = data?.length ?? 0;
    console.log(`[CronScheduled] Flagged ${flagged} schedule(s) as due`);

    return res.status(200).json({ success: true, flagged });
  } catch (error: any) {
    console.error("[CronScheduled] Error:", error);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}
