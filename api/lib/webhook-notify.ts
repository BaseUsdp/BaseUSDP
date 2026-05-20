/**
 * Outgoing webhook dispatcher.
 *
 * Fetches a wallet's registered webhooks, POSTs an HMAC-signed JSON payload
 * to each enabled URL whose per-event toggle is on. Never throws — failures
 * are logged and recorded on the row so the UI can surface them.
 *
 * Security:
 *   - https:// only.
 *   - Rejects obvious private/loopback/link-local hostnames at fire time.
 *   - 5s timeout per delivery, redirects disabled.
 *   - Response body discarded.
 *
 * Reliability:
 *   - 10 consecutive failures → row auto-disabled (enabled=false).
 *   - last_fired_at / last_status / last_error / consecutive_failures
 *     persisted per delivery so the UI can show health per webhook.
 */

import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

export type WebhookEventType =
  | "incoming"
  | "outgoing"
  | "x402"
  | "deposit"
  | "withdraw"
  | "scheduled";

export interface WebhookPayload {
  [key: string]: unknown;
}

const TOGGLE_COLUMN: Record<WebhookEventType, string> = {
  incoming: "notify_incoming",
  outgoing: "notify_outgoing",
  x402: "notify_x402",
  deposit: "notify_deposit",
  withdraw: "notify_withdraw",
  scheduled: "notify_scheduled",
};

const TIMEOUT_MS = 5_000;
const AUTO_DISABLE_AFTER = 10;

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Cheap, sync-only SSRF guard. Rejects http://, localhost, RFC1918
 * IPv4, link-local, and obvious IPv6 loopback/link-local by hostname
 * string match. NOTE: does not resolve DNS — DNS rebinding can still
 * land on a private IP at request time. Acceptable for v1.
 */
export function isWebhookUrlSafe(rawUrl: string): { ok: true } | { ok: false; reason: string } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "Invalid URL" };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, reason: "URL must use https://" };
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "ip6-localhost" ||
    host === "ip6-loopback" ||
    host.endsWith(".localhost")
  ) {
    return { ok: false, reason: "Loopback hosts not allowed" };
  }
  // IPv4
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const o = m.slice(1, 5).map((x) => Number(x));
    if (o.some((x) => x < 0 || x > 255)) return { ok: false, reason: "Invalid IPv4" };
    if (o[0] === 10) return { ok: false, reason: "Private IPv4 not allowed" };
    if (o[0] === 127) return { ok: false, reason: "Loopback IPv4 not allowed" };
    if (o[0] === 0) return { ok: false, reason: "Reserved IPv4 not allowed" };
    if (o[0] === 169 && o[1] === 254) return { ok: false, reason: "Link-local IPv4 not allowed" };
    if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) return { ok: false, reason: "Private IPv4 not allowed" };
    if (o[0] === 192 && o[1] === 168) return { ok: false, reason: "Private IPv4 not allowed" };
    if (o[0] >= 224) return { ok: false, reason: "Multicast/reserved IPv4 not allowed" };
  }
  // IPv6 — bracketed in URL, hostname strips the brackets
  if (host.includes(":")) {
    if (host === "::1" || host === "::") return { ok: false, reason: "Loopback IPv6 not allowed" };
    if (host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) {
      return { ok: false, reason: "Link-local or unique-local IPv6 not allowed" };
    }
  }
  return { ok: true };
}

function signPayload(secret: string, body: string, timestamp: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

interface WebhookRow {
  id: string;
  url: string;
  secret: string;
  consecutive_failures: number;
}

async function deliverOne(
  row: WebhookRow,
  eventType: WebhookEventType,
  payload: WebhookPayload
): Promise<{ ok: boolean; status: number | null; error: string | null }> {
  const safety = isWebhookUrlSafe(row.url);
  if (!safety.ok) {
    return { ok: false, status: null, error: safety.reason };
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = JSON.stringify({
    event: eventType,
    timestamp: Number(timestamp),
    delivery_id: row.id,
    payload,
  });
  const signature = signPayload(row.secret, body, timestamp);

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(row.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "BASEUSDP-Webhook/1.0",
        "X-BaseUSDP-Event": eventType,
        "X-BaseUSDP-Timestamp": timestamp,
        "X-BaseUSDP-Signature": `sha256=${signature}`,
      },
      body,
      signal: ctl.signal,
      redirect: "manual",
    });
    // Don't read the body — webhook receivers don't owe us one.
    if (res.status >= 200 && res.status < 300) {
      return { ok: true, status: res.status, error: null };
    }
    return { ok: false, status: res.status, error: `HTTP ${res.status}` };
  } catch (err: any) {
    const msg = err?.name === "AbortError" ? "Timeout (5s)" : err?.message || "Network error";
    return { ok: false, status: null, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fire all webhooks registered to `wallet` whose per-event toggle for
 * `eventType` is enabled. Never throws.
 */
export async function fireWebhooks(
  wallet: string,
  eventType: WebhookEventType,
  payload: WebhookPayload
): Promise<{ delivered: number; failed: number }> {
  const supabase = getSupabase();
  if (!supabase) return { delivered: 0, failed: 0 };

  try {
    const toggle = TOGGLE_COLUMN[eventType];
    const { data: rows } = await supabase
      .from("user_webhooks")
      .select("id,url,secret,consecutive_failures")
      .eq("user_wallet", wallet.toLowerCase())
      .eq("enabled", true)
      .eq(toggle, true);

    const list = (rows as WebhookRow[] | null) ?? [];
    if (list.length === 0) return { delivered: 0, failed: 0 };

    let delivered = 0;
    let failed = 0;

    await Promise.all(
      list.map(async (row) => {
        const result = await deliverOne(row, eventType, payload);

        if (result.ok) {
          delivered += 1;
          await supabase
            .from("user_webhooks")
            .update({
              last_fired_at: new Date().toISOString(),
              last_status: result.status,
              last_error: null,
              consecutive_failures: 0,
            })
            .eq("id", row.id);
        } else {
          failed += 1;
          const nextFailures = (row.consecutive_failures ?? 0) + 1;
          const update: Record<string, unknown> = {
            last_fired_at: new Date().toISOString(),
            last_status: result.status,
            last_error: result.error,
            consecutive_failures: nextFailures,
          };
          if (nextFailures >= AUTO_DISABLE_AFTER) {
            update.enabled = false;
          }
          await supabase.from("user_webhooks").update(update).eq("id", row.id);
        }
      })
    );

    return { delivered, failed };
  } catch (err: any) {
    console.warn("[Webhooks] dispatcher error:", err?.message);
    return { delivered: 0, failed: 0 };
  }
}
