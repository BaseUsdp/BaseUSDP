/**
 * Bot Cron — Proactive @orb402 casts
 * GET /api/farcaster/bot-cron
 *
 * Runs every 4 hours via Vercel cron. Each handler checks dedup
 * before publishing so duplicate casts never appear.
 *
 * All casts are privacy-safe: no amounts, no wallets, no financial details.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import {
  recordBotCast,
  wasCastToday,
  wasCastThisWeek,
} from "../lib/bot-cast-helpers.js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// ── Cast content arrays ──

const PRIVACY_TIPS = [
  "Privacy tip: ORB402 payments never reveal amounts on-chain. Your financial data stays yours.",
  "Privacy tip: When you send via @orb402, only sender and receiver know the details. No public ledger trail.",
  "Privacy tip: Traditional payments expose your balance and history. ORB402 doesn't. That's the point.",
  "Privacy tip: Every @orb402 payment is shielded by default. No opt-in required, privacy is the standard.",
  "Privacy tip: Your spending patterns are valuable data. ORB402 ensures no one can harvest them.",
  "Privacy tip: On ORB402, payment confirmations never include amounts. Privacy isn't a feature, it's the architecture.",
  "Privacy tip: Financial surveillance starts with transparent transactions. ORB402 ends it with private ones.",
];

const FEATURE_ANNOUNCEMENTS = [
  "Did you know? You can send private payments right from a Farcaster cast. Just tag @orb402 with the amount and recipient.",
  "ORB402 runs on Base with confidential transfers. Fast, cheap, private. The way payments should be.",
  "Send payments to any Farcaster user — even if they haven't signed up yet. They'll claim it when they join ORB402.",
  "ORB402 supports USDC payments via cast. More tokens coming soon. Privacy for every payment.",
];

const ENGAGEMENT_PROMPTS = [
  "What's the #1 reason you care about financial privacy? Reply below 👇",
  "Tag a friend who should try private payments on Farcaster. @orb402 makes it easy.",
  "If every payment you've ever made was public, would you change your behavior? That's why privacy matters.",
];

// ── Handlers ──

async function handleDailyStats(supabase: any): Promise<string | null> {
  if (await wasCastToday(supabase, "daily_stats")) return null;

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const { count } = await supabase
    .from("zk_transactions")
    .select("*", { count: "exact", head: true })
    .eq("status", "completed")
    .gte("created_at", yesterday.toISOString());

  const txCount = count || 0;
  const content = `24h on ORB402: ${txCount} private payments processed. Privacy is the standard.`;
  return recordBotCast(supabase, "daily_stats", content, { count: txCount });
}

async function handleMilestones(supabase: any): Promise<string | null> {
  const thresholds = [50, 100, 250, 500, 1000, 2500, 5000, 10000];

  const { count } = await supabase
    .from("zk_transactions")
    .select("*", { count: "exact", head: true })
    .eq("status", "completed");

  const total = count || 0;

  // Find the highest threshold we've crossed
  const crossed = thresholds.filter((t) => total >= t);
  if (crossed.length === 0) return null;
  const milestone = crossed[crossed.length - 1];

  // Check if we already cast this milestone
  const { data: existing } = await supabase
    .from("bot_casts")
    .select("id")
    .eq("cast_type", "milestone")
    .eq("status", "published")
    .contains("metadata", { milestone })
    .limit(1);

  if (existing && existing.length > 0) return null;

  const content = `Milestone: ${milestone} private transactions completed on ORB402. Privacy scales.`;
  return recordBotCast(supabase, "milestone", content, { milestone });
}

async function handlePrivacyTip(supabase: any): Promise<string | null> {
  if (await wasCastToday(supabase, "privacy_tip")) return null;

  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getUTCFullYear(), 0, 0).getTime()) /
      (24 * 60 * 60 * 1000)
  );
  const index = dayOfYear % PRIVACY_TIPS.length;
  const content = PRIVACY_TIPS[index];
  return recordBotCast(supabase, "privacy_tip", content, { tip_index: index });
}

async function handleUptime(supabase: any): Promise<string | null> {
  if (await wasCastToday(supabase, "uptime")) return null;

  const content =
    "ORB402 is live and processing private payments on Base. Status: operational.";
  return recordBotCast(supabase, "uptime", content);
}

async function handleFeatureAnnouncement(supabase: any): Promise<string | null> {
  if (await wasCastToday(supabase, "feature")) return null;

  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getUTCFullYear(), 0, 0).getTime()) /
      (24 * 60 * 60 * 1000)
  );
  const index = dayOfYear % FEATURE_ANNOUNCEMENTS.length;
  const content = FEATURE_ANNOUNCEMENTS[index];
  return recordBotCast(supabase, "feature", content, { feature_index: index });
}

async function handleWeeklyRecap(supabase: any): Promise<string | null> {
  const now = new Date();
  if (now.getUTCDay() !== 1) return null; // Monday only
  if (await wasCastThisWeek(supabase, "weekly_recap")) return null;

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const { count: txCount } = await supabase
    .from("zk_transactions")
    .select("*", { count: "exact", head: true })
    .eq("status", "completed")
    .gte("created_at", weekAgo.toISOString());

  const { count: userCount } = await supabase
    .from("user_profiles")
    .select("*", { count: "exact", head: true })
    .gte("created_at", weekAgo.toISOString());

  const content = `This week on ORB402: ${userCount || 0} users sent ${txCount || 0} private payments via cast. Privacy is growing.`;
  return recordBotCast(supabase, "weekly_recap", content, {
    userCount: userCount || 0,
    txCount: txCount || 0,
  });
}

async function handleEngagementPrompt(supabase: any): Promise<string | null> {
  if (await wasCastToday(supabase, "engagement")) return null;

  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getUTCFullYear(), 0, 0).getTime()) /
      (24 * 60 * 60 * 1000)
  );
  const index = dayOfYear % ENGAGEMENT_PROMPTS.length;
  const content = ENGAGEMENT_PROMPTS[index];
  return recordBotCast(supabase, "engagement", content, {
    prompt_index: index,
  });
}

async function handleLeaderboard(supabase: any): Promise<string | null> {
  const now = new Date();
  if (now.getUTCDay() !== 5) return null; // Friday only
  if (await wasCastThisWeek(supabase, "leaderboard")) return null;

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Get top 3 senders by transaction count this week (usernames only, no amounts)
  const { data: topSenders } = await supabase
    .from("zk_transactions")
    .select("sender_wallet")
    .eq("status", "completed")
    .eq("transaction_type", "send")
    .gte("created_at", weekAgo.toISOString());

  if (!topSenders || topSenders.length === 0) return null;

  // Count per wallet
  const counts: Record<string, number> = {};
  for (const tx of topSenders) {
    counts[tx.sender_wallet] = (counts[tx.sender_wallet] || 0) + 1;
  }

  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  if (sorted.length === 0) return null;

  // Resolve wallets to usernames
  const wallets = sorted.map(([w]) => w);
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("wallet_address, username")
    .in("wallet_address", wallets);

  const profileMap: Record<string, string> = {};
  for (const p of profiles || []) {
    profileMap[p.wallet_address] = p.username;
  }

  const names = sorted
    .map(([w]) => {
      const name = profileMap[w];
      return name ? `@${name}` : null;
    })
    .filter(Boolean);

  if (names.length === 0) return null;

  const content = `Top cast payment users this week: ${names.join(", ")}`;
  return recordBotCast(supabase, "leaderboard", content, {
    users: names,
  });
}

// ── Main handler ──

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: "Database not configured" });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const results: Record<string, string> = {};

  const handlers: Array<[string, () => Promise<string | null>]> = [
    ["daily_stats", () => handleDailyStats(supabase)],
    ["milestone", () => handleMilestones(supabase)],
    ["privacy_tip", () => handlePrivacyTip(supabase)],
    ["uptime", () => handleUptime(supabase)],
    ["feature", () => handleFeatureAnnouncement(supabase)],
    ["weekly_recap", () => handleWeeklyRecap(supabase)],
    ["engagement", () => handleEngagementPrompt(supabase)],
    ["leaderboard", () => handleLeaderboard(supabase)],
  ];

  for (const [name, fn] of handlers) {
    try {
      const hash = await fn();
      results[name] = hash ? `published (${hash})` : "skipped";
    } catch (error: any) {
      console.error(`[BotCron] Error in ${name}:`, error.message);
      results[name] = `error: ${error.message}`;
    }
  }

  console.log("[BotCron] Results:", results);
  return res.status(200).json({ success: true, results });
}
