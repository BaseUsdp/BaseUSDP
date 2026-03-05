/**
 * GET /api/global/messages?limit=50&before=<iso-timestamp>
 * Fetch recent global chat messages.
 * Read access is open to all authenticated users.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const ALLOWED_ORIGINS = [
  "https://void402.com",
  "https://www.void402.com",
  "https://baseusdp.com",
  "https://www.baseusdp.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

function getAllowedOrigin(origin: string | undefined): string {
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (origin.match(/^https:\/\/code-whisperer-33[\w-]*\.vercel\.app/))
    return origin;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getAllowedOrigin(req.headers.origin as string);
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

  if (!supabase)
    return res.status(500).json({ error: "Database not configured" });

  const limit = Math.min(
    Math.max(parseInt(String(req.query.limit || "50"), 10) || 50, 1),
    100
  );
  const before = req.query.before as string | undefined;

  try {
    let query = supabase
      .from("global_chat_messages")
      .select("id, wallet_address, username, content, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lt("created_at", before);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[global/messages] query error:", error);
      return res.status(500).json({ error: "Failed to fetch messages" });
    }

    // Reverse to chronological order
    const messages = (data || []).reverse();

    return res.status(200).json({ success: true, messages });
  } catch (err: any) {
    console.error("[global/messages] error:", err.message);
    return res.status(500).json({ error: "Internal error" });
  }
}
