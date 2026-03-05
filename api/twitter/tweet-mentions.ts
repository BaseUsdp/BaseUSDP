/**
 * Twitter Tweet Mentions API
 * GET /api/twitter/tweet-mentions
 *
 * Returns recent @orb402 tweet payments from the tweet_payments table.
 * Used by the dashboard to show Twitter/X payment activity.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { extractBearerToken } from "../lib/bearer-auth.js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const ALLOWED_ORIGINS = [
  "https://void402.com",
  "https://www.void402.com",
  "https://baseusdp.com",
  "https://www.baseusdp.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

function getAllowedOrigin(origin: string | undefined): string {
  if (!origin) return "https://www.baseusdp.com";
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (origin.match(/^https:\/\/code-whisperer-33[\w-]*\.vercel\.app/))
    return origin;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getAllowedOrigin(req.headers.origin as string | undefined);
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Database not configured" });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Auth check
  const bearerToken = extractBearerToken(req);
  if (!bearerToken) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const { data: session } = await supabase
    .from("auth_sessions")
    .select("user_wallet")
    .eq("session_token", bearerToken)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (!session) {
    return res.status(401).json({ error: "Invalid session" });
  }

  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

  // Fetch recent tweet payments
  const { data: mentions, error } = await supabase
    .from("tweet_payments")
    .select(
      "id, tweet_id, sender_x_user_id, recipient_username, amount, token, status, error_message, created_at, completed_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[TweetMentions] Query error:", error.message);
    return res.status(500).json({ error: "Failed to fetch mentions" });
  }

  // Get this month's stats
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { data: monthlyData } = await supabase
    .from("tweet_payments")
    .select("status, amount")
    .gte("created_at", monthStart.toISOString());

  const monthlyStats = {
    total: monthlyData?.length || 0,
    completed:
      monthlyData?.filter((m: any) => m.status === "completed").length || 0,
    failed:
      monthlyData?.filter((m: any) => m.status === "failed").length || 0,
    pending:
      monthlyData?.filter(
        (m: any) => m.status === "pending" || m.status === "processing"
      ).length || 0,
    volume:
      monthlyData
        ?.filter((m: any) => m.status === "completed")
        .reduce((sum: number, m: any) => sum + parseFloat(m.amount), 0) || 0,
  };

  // Look up sender usernames from x_users
  const senderIds = [
    ...new Set(mentions?.map((m: any) => m.sender_x_user_id) || []),
  ];
  let senderMap: Record<string, string> = {};
  if (senderIds.length > 0) {
    const { data: senders } = await supabase
      .from("x_users")
      .select("x_user_id, x_username")
      .in("x_user_id", senderIds);
    if (senders) {
      senderMap = Object.fromEntries(
        senders.map((s: any) => [s.x_user_id, s.x_username])
      );
    }
  }

  // Privacy-safe: enrich mentions with sender username, hide wallet info
  const enrichedMentions = (mentions || []).map((m: any) => ({
    id: m.id,
    tweetId: m.tweet_id,
    senderUsername: senderMap[m.sender_x_user_id] || `x:${m.sender_x_user_id}`,
    recipientUsername: m.recipient_username,
    status: m.status,
    errorMessage: m.error_message,
    createdAt: m.created_at,
    completedAt: m.completed_at,
  }));

  return res.status(200).json({
    success: true,
    mentions: enrichedMentions,
    stats: monthlyStats,
  });
}
