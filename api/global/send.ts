/**
 * POST /api/global/send
 * Send a message to the global chat.
 * Requires Bearer auth (must have a profile/username).
 * Future: will require $ORB token holding.
 * Body: { wallet: string, message: string }
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { extractBearerToken, verifyBearerToken } from "../lib/bearer-auth.js";
import { checkProfanity } from "../lib/profanity.js";

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

// Simple in-memory rate limiter (per Vercel invocation)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, maxPerMinute: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= maxPerMinute) return false;
  entry.count++;
  return true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getAllowedOrigin(req.headers.origin as string);
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  // Rate limit by IP
  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    "unknown";
  if (!checkRateLimit(`global-send:${ip}`, 10)) {
    return res
      .status(429)
      .json({ error: "Slow down — max 10 messages per minute" });
  }

  // Auth
  const bearerToken = extractBearerToken(req);
  if (!bearerToken)
    return res.status(401).json({ error: "Authentication required" });

  const { wallet, message } = req.body || {};
  if (!wallet || typeof wallet !== "string") {
    return res.status(400).json({ error: "Wallet address required" });
  }
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return res.status(400).json({ error: "Message is required" });
  }
  if (message.length > 500) {
    return res.status(400).json({ error: "Message too long (max 500 chars)" });
  }

  const tokenVerification = await verifyBearerToken(bearerToken, wallet);
  if (!tokenVerification.valid) {
    return res.status(403).json({ error: "Invalid authentication" });
  }

  // Profanity check
  const profCheck = checkProfanity(message);
  if (!profCheck.clean) {
    return res.status(400).json({ error: profCheck.reason });
  }

  if (!supabase)
    return res.status(500).json({ error: "Database not configured" });

  try {
    // Look up username from user_profiles (column is "username", wallet stored as-is)
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("username")
      .eq("wallet_address", wallet)
      .maybeSingle();

    // Default profiles have "..." in the username (e.g. "0x59...7b7b")
    if (!profile?.username || profile.username.includes("...")) {
      return res
        .status(403)
        .json({ error: "You need a username to chat. Set one in Settings." });
    }

    // TODO: Future $ORB token gate
    // const balance = await checkOrbBalance(wallet);
    // if (balance <= 0) return res.status(403).json({ error: "Must hold $ORB to chat" });

    const content = message.trim();

    const { data, error } = await supabase
      .from("global_chat_messages")
      .insert({
        wallet_address: wallet.toLowerCase(),
        username: profile.username,
        content,
      })
      .select("id, wallet_address, username, content, created_at")
      .single();

    if (error) {
      console.error("[global/send] insert error:", error);
      return res.status(500).json({ error: "Failed to send message" });
    }

    return res.status(200).json({ success: true, message: data });
  } catch (err: any) {
    console.error("[global/send] error:", err.message);
    return res.status(500).json({ error: "Internal error" });
  }
}
