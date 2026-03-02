/**
 * Bot Cast Helpers
 * Shared utilities for proactive @orb402 bot casts:
 * publishing + logging to bot_casts, and dedup/rate-limit checks.
 */

import { publishCast } from "./neynar-cast.js";

/**
 * Publish a bot cast and log it to the bot_casts table.
 * Returns the cast hash on success, or null on failure.
 */
export async function recordBotCast(
  supabase: any,
  castType: string,
  content: string,
  metadata: Record<string, any> = {}
): Promise<string | null> {
  const prefixedContent = `🤖 ${content}`;
  console.log(`[BotCast] Publishing (${castType}): ${prefixedContent.slice(0, 80)}...`);
  const castHash = await publishCast(prefixedContent);
  console.log(`[BotCast] Result (${castType}): ${castHash ? `hash=${castHash}` : "FAILED"}`);

  const row: Record<string, any> = {
    cast_type: castType,
    content,
    metadata,
    status: castHash ? "published" : "failed",
    cast_hash: castHash,
  };

  if (!castHash) {
    row.error_message = "publishCast returned null";
  }

  const { error } = await supabase.from("bot_casts").insert(row);
  if (error) {
    console.error(`[BotCast] Failed to log cast (${castType}):`, error.message);
  }

  return castHash;
}

/**
 * Check if a cast of this type was already published today (UTC).
 */
export async function wasCastToday(
  supabase: any,
  castType: string
): Promise<boolean> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { data } = await supabase
    .from("bot_casts")
    .select("id")
    .eq("cast_type", castType)
    .eq("status", "published")
    .gte("created_at", todayStart.toISOString())
    .limit(1);

  return !!(data && data.length > 0);
}

/**
 * Check if a cast of this type was already published this week (since Monday UTC).
 */
export async function wasCastThisWeek(
  supabase: any,
  castType: string
): Promise<boolean> {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun
  const diff = day === 0 ? 6 : day - 1; // days since Monday
  const monday = new Date(now);
  monday.setUTCDate(monday.getUTCDate() - diff);
  monday.setUTCHours(0, 0, 0, 0);

  const { data } = await supabase
    .from("bot_casts")
    .select("id")
    .eq("cast_type", castType)
    .eq("status", "published")
    .gte("created_at", monday.toISOString())
    .limit(1);

  return !!(data && data.length > 0);
}

/**
 * Check if a cast of this type was published within the last N minutes.
 */
export async function wasCastRecently(
  supabase: any,
  castType: string,
  minutes: number
): Promise<boolean> {
  const cutoff = new Date(Date.now() - minutes * 60 * 1000);

  const { data } = await supabase
    .from("bot_casts")
    .select("id")
    .eq("cast_type", castType)
    .eq("status", "published")
    .gte("created_at", cutoff.toISOString())
    .limit(1);

  return !!(data && data.length > 0);
}
