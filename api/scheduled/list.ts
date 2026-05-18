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

  try {
    const wallet = (req.query.wallet as string | undefined) ?? "";
    const dueOnly = req.query.due === "1" || req.query.due === "true";

    if (!wallet) {
      return res.status(400).json({ error: "wallet query param is required" });
    }

    let query = supabase
      .from("scheduled_payments")
      .select("*")
      .eq("user_wallet", wallet)
      .order("scheduled_for", { ascending: true });

    if (dueOnly) {
      query = query.eq("status", "active").eq("is_due", true);
    } else {
      query = query.in("status", ["active", "completed"]);
    }

    const { data, error } = await query.limit(200);

    if (error) {
      console.error("[Scheduled] List error:", error);
      return res.status(500).json({ error: "Failed to fetch schedules" });
    }

    return res.status(200).json({ success: true, schedules: data ?? [] });
  } catch (error: any) {
    console.error("[Scheduled] Error:", error);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}
