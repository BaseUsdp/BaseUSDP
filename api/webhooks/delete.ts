/**
 * Delete a webhook.
 * POST /api/webhooks/delete
 * Body: { wallet, id }
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { extractBearerToken, verifyBearerToken } from "../lib/bearer-auth.js";

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
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Database not configured" });
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  const bearer = extractBearerToken(req);
  if (!bearer) return res.status(401).json({ error: "Authentication required" });

  const { wallet, id } = req.body ?? {};
  if (!wallet || typeof wallet !== "string") {
    return res.status(400).json({ error: "wallet is required" });
  }
  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "id is required" });
  }

  const verification = await verifyBearerToken(bearer, wallet);
  if (!verification.valid) return res.status(403).json({ error: "Invalid authentication" });

  const { error } = await supabase
    .from("user_webhooks")
    .delete()
    .eq("id", id)
    .eq("user_wallet", wallet.toLowerCase());

  if (error) {
    console.error("[Webhooks/delete] error:", error);
    return res.status(500).json({ error: "Failed to delete webhook" });
  }

  return res.status(200).json({ success: true });
}
