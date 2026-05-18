/**
 * Telegram bot notification helper.
 *
 * Sends privacy-safe DM messages via the Telegram Bot API. Looks up the
 * recipient's chat_id from telegram_links and respects their per-event
 * toggles. Privacy default: no amounts, no counterparty handles in the
 * message — just the verb + a deep link back to the dashboard.
 */

import { createClient } from "@supabase/supabase-js";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

export type TelegramEventType = "incoming" | "outgoing" | "x402";

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

const TEMPLATES: Record<TelegramEventType, string> = {
  incoming: "🛡️ You received a private payment on BASEUSDP.\n\nOpen your dashboard: https://baseusdp.com/dashboard",
  outgoing: "📤 Your payment was sent privately via BASEUSDP.\n\nView history: https://baseusdp.com/dashboard",
  x402: "💳 An x402 payment request was settled.\n\nDetails: https://baseusdp.com/dashboard",
};

const TOGGLE_COLUMN: Record<TelegramEventType, string> = {
  incoming: "notify_incoming",
  outgoing: "notify_outgoing",
  x402: "notify_x402",
};

/**
 * Send a Telegram message to a wallet's linked chat, gated by their toggles.
 * Returns true if a message was actually sent, false otherwise. Never throws.
 */
export async function sendTelegramNotification(
  wallet: string,
  eventType: TelegramEventType
): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn("[Telegram] TELEGRAM_BOT_TOKEN not configured, skipping");
    return false;
  }
  const supabase = getSupabase();
  if (!supabase) return false;

  try {
    const { data: link } = await supabase
      .from("telegram_links")
      .select("chat_id,enabled," + TOGGLE_COLUMN[eventType])
      .eq("user_wallet", wallet.toLowerCase())
      .maybeSingle();

    if (!link || !link.chat_id || !link.enabled) return false;
    if (!(link as any)[TOGGLE_COLUMN[eventType]]) return false;

    const res = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: link.chat_id,
          text: TEMPLATES[eventType],
          disable_web_page_preview: true,
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.warn(
        `[Telegram] sendMessage failed (${res.status}) for chat ${link.chat_id}: ${errText}`
      );
      // If Telegram tells us the chat was blocked or deleted, clear the link.
      if (res.status === 403 || res.status === 400) {
        await supabase
          .from("telegram_links")
          .update({ chat_id: null, linked_at: null })
          .eq("user_wallet", wallet.toLowerCase());
      }
      return false;
    }

    return true;
  } catch (err: any) {
    console.warn("[Telegram] notify error:", err?.message);
    return false;
  }
}
