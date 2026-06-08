/**
 * Telegram bot webhook.
 * POST /api/telegram/webhook
 *
 * Telegram → BASEUSDP. Handles:
 *   /start <code>  — completes a link by matching <code> to a row with
 *                    a non-expired linking_code, then stamps chat_id +
 *                    telegram_username + linked_at and clears the code.
 *   /unlink        — clears the chat_id from whichever wallet this chat
 *                    is currently linked to.
 *   /help, /start  — friendly response if no code provided.
 *
 * Bot setup (one-time):
 *   1. Create the bot with @BotFather → save TELEGRAM_BOT_TOKEN to Vercel env.
 *   2. Set TELEGRAM_WEBHOOK_SECRET to a random 32+ char string on Vercel env.
 *   3. Register webhook:
 *      curl "https://api.telegram.org/bot$TOKEN/setWebhook?\
 *      url=https://baseusdp.com/api/telegram/webhook&\
 *      secret_token=$SECRET"
 *
 * Telegram includes the secret in the X-Telegram-Bot-Api-Secret-Token header
 * on each delivery so we can authenticate the source.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || "";
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

interface InlineButton {
  text: string;
  url: string;
}

async function reply(
  chatId: number,
  text: string,
  inlineButtons?: InlineButton[],
): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN) return;
  const body: any = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  };
  if (inlineButtons && inlineButtons.length > 0) {
    body.reply_markup = {
      inline_keyboard: [inlineButtons.map((b) => ({ text: b.text, url: b.url }))],
    };
  }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => undefined);
}

/**
 * Parse a `/tip` command. Accepts:
 *   /tip @handle 5
 *   /tip handle 5
 *   /tip @handle 5 USDC
 *   /tip @handle $5
 *   /tip @handle 5.50 USDT
 */
function parseTipCommand(text: string): {
  handle?: string;
  amount?: number;
  token?: "USDC" | "USDT";
  error?: string;
} {
  const parts = text.trim().split(/\s+/);
  // parts[0] = "/tip" or "/tip@botname"
  if (parts.length < 3) {
    return { error: "Format: /tip @handle <amount> [USDC|USDT]" };
  }
  const rawHandle = parts[1].replace(/^@/, "");
  if (!rawHandle || !/^[A-Za-z0-9_-]{2,30}$/.test(rawHandle)) {
    return { error: "Handle must look like @yourhandle." };
  }
  const rawAmount = parts[2].replace(/^\$/, "");
  const amount = parseFloat(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 999999.99) {
    return { error: "Amount must be a positive number ≤ 999,999.99." };
  }
  let token: "USDC" | "USDT" = "USDC";
  if (parts[3]) {
    const t = parts[3].toUpperCase();
    if (t === "USDC" || t === "USDT") token = t;
    else return { error: "Token must be USDC or USDT." };
  }
  return { handle: rawHandle, amount, token };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: "DB not configured" });

  // Verify Telegram is the caller.
  if (TELEGRAM_WEBHOOK_SECRET) {
    const secret = req.headers["x-telegram-bot-api-secret-token"];
    if (secret !== TELEGRAM_WEBHOOK_SECRET) {
      console.warn("[TelegramWebhook] bad secret header");
      return res.status(401).end();
    }
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const update = req.body ?? {};
  const message = update?.message;
  if (!message?.chat?.id || typeof message.text !== "string") {
    return res.status(200).json({ ok: true });
  }

  const chatId: number = message.chat.id;
  const text: string = (message.text || "").trim();
  const username: string | null = message.from?.username ?? null;

  if (text === "/help") {
    await reply(
      chatId,
      "BASEUSDP bot 🛡️\n\n" +
        "/tip @handle <amount> [USDC|USDT] — tip a BASEUSDP creator. Returns a tap-to-pay link.\n" +
        "/start <code> — link this chat to your wallet (get the code in BASEUSDP → Settings → Telegram).\n" +
        "/unlink — disconnect this chat."
    );
    return res.status(200).json({ ok: true });
  }

  // /tip @handle <amount> [USDC|USDT]
  if (text === "/tip" || text.startsWith("/tip ") || text.startsWith("/tip@")) {
    // Normalize "/tip@baseusdp_bot ..." → "/tip ..."
    const normalized = text.replace(/^\/tip@\S+/, "/tip");
    const parsed = parseTipCommand(normalized);
    if (parsed.error || !parsed.handle || !parsed.amount) {
      await reply(
        chatId,
        parsed.error ?? "Format: /tip @handle <amount> [USDC|USDT]\nExample: /tip @GeorgesK 5",
      );
      return res.status(200).json({ ok: true });
    }

    // Verify the handle exists. ILIKE so we tolerate casing.
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("username")
      .ilike("username", parsed.handle)
      .maybeSingle();

    if (!profile?.username) {
      await reply(
        chatId,
        `@${parsed.handle} isn't a registered BASEUSDP handle. Double-check the spelling, or ask them to claim it at baseusdp.com.`,
      );
      return res.status(200).json({ ok: true });
    }

    const handleOnPlatform = profile.username as string;
    const amountStr = parsed.amount % 1 === 0
      ? parsed.amount.toFixed(0)
      : parsed.amount.toString();
    const tipUrl =
      `https://baseusdp.com/tip/@${encodeURIComponent(handleOnPlatform)}` +
      `?amount=${encodeURIComponent(amountStr)}` +
      `&token=${parsed.token ?? "USDC"}`;

    await reply(
      chatId,
      `💸 Tap below to tip $${amountStr} ${parsed.token ?? "USDC"} to @${handleOnPlatform}.`,
      [
        {
          text: `Tip $${amountStr} ${parsed.token ?? "USDC"} to @${handleOnPlatform}`,
          url: tipUrl,
        },
      ],
    );
    return res.status(200).json({ ok: true });
  }

  if (text === "/unlink") {
    const { data } = await supabase
      .from("telegram_links")
      .update({
        chat_id: null,
        telegram_username: null,
        linked_at: null,
      })
      .eq("chat_id", chatId)
      .select("user_wallet")
      .maybeSingle();
    if (data) {
      await reply(chatId, "Unlinked. Notifications stopped. Re-link anytime from Settings.");
    } else {
      await reply(chatId, "No wallet linked to this chat.");
    }
    return res.status(200).json({ ok: true });
  }

  // Handle /start with optional code.
  if (text === "/start" || text.startsWith("/start ")) {
    const code = text === "/start" ? "" : text.slice("/start ".length).trim().toUpperCase();
    if (!code) {
      await reply(
        chatId,
        "Welcome to BASEUSDP 🛡️\n\n" +
          "To link this chat, generate a code in BASEUSDP → Settings → Telegram, then send it back here as /start <code>."
      );
      return res.status(200).json({ ok: true });
    }

    const { data: row } = await supabase
      .from("telegram_links")
      .select("user_wallet,linking_code_expires_at")
      .eq("linking_code", code)
      .maybeSingle();

    if (!row) {
      await reply(chatId, "That code isn't recognised. Generate a fresh one in BASEUSDP → Settings → Telegram.");
      return res.status(200).json({ ok: true });
    }
    if (
      !row.linking_code_expires_at ||
      new Date(row.linking_code_expires_at).getTime() < Date.now()
    ) {
      await reply(chatId, "That code expired. Generate a fresh one in BASEUSDP → Settings → Telegram.");
      return res.status(200).json({ ok: true });
    }

    await supabase
      .from("telegram_links")
      .update({
        chat_id: chatId,
        telegram_username: username,
        linked_at: new Date().toISOString(),
        linking_code: null,
        linking_code_expires_at: null,
      })
      .eq("user_wallet", row.user_wallet);

    await reply(
      chatId,
      "✅ Linked to your BASEUSDP wallet.\n\n" +
        "You'll get a DM here for incoming private payments. Manage notifications in Settings → Telegram."
    );
    return res.status(200).json({ ok: true });
  }

  // Anything else — soft prompt.
  await reply(chatId, "Send /help to see what this bot can do.");
  return res.status(200).json({ ok: true });
}
