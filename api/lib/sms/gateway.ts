/**
 * SMS gateway adapter.
 *
 * - "console" mode (default for local dev): writes the SMS to stdout AND to
 *   the inbox store so the dashboard's inbox card can show what would have
 *   been texted.
 * - "twilio" mode: ready when SMS_PROVIDER=twilio and TWILIO_* env vars are
 *   set. Uses the REST API directly (no SDK dependency); A2P 10DLC brand
 *   and campaign registration still required on Twilio's side.
 *
 * Inbox persistence mirrors the escrow store: Supabase in production,
 * JSON file for local dev.
 */

import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import type { SmsInboxEntry } from "./types.js";
import { getSupabase, hasSupabase } from "./supabase.js";

const FILE_INBOX = process.env.VERCEL
  ? "/tmp/sms-inbox.json"
  : join(process.cwd(), "data", "sms-inbox.json");
const MAX_INBOX_ENTRIES = 100;
const TABLE = "sms_inbox";

export type GatewayMode = "console" | "twilio";

export function getGatewayMode(): GatewayMode {
  return (process.env.SMS_PROVIDER ?? "console") === "twilio"
    ? "twilio"
    : "console";
}

export interface SendArgs {
  to: string;
  amount: string;
  claimToken: string;
  claimUrl: string;
  note?: string | null;
}

function buildBody(args: SendArgs): string {
  const note = args.note ? ` — "${args.note}"` : "";
  return `You've received $${args.amount} USDC privately via BASEUSDP${note}. Claim within 24h: ${args.claimUrl}`;
}

// ---------- inbox: file backend ----------

async function fileAppendInbox(entry: SmsInboxEntry): Promise<void> {
  try {
    await fs.mkdir(dirname(FILE_INBOX), { recursive: true });
    let inbox: SmsInboxEntry[] = [];
    try {
      const raw = await fs.readFile(FILE_INBOX, "utf-8");
      inbox = JSON.parse(raw) as SmsInboxEntry[];
      if (!Array.isArray(inbox)) inbox = [];
    } catch {
      inbox = [];
    }
    inbox.unshift(entry);
    if (inbox.length > MAX_INBOX_ENTRIES) inbox.length = MAX_INBOX_ENTRIES;
    await fs.writeFile(FILE_INBOX, JSON.stringify(inbox, null, 2));
  } catch (err) {
    console.warn("[sms] inbox write failed:", err);
  }
}

async function fileReadInbox(): Promise<SmsInboxEntry[]> {
  try {
    const raw = await fs.readFile(FILE_INBOX, "utf-8");
    const parsed = JSON.parse(raw) as SmsInboxEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ---------- inbox: supabase backend ----------

async function dbAppendInbox(entry: SmsInboxEntry): Promise<void> {
  const supa = getSupabase()!;
  const { error } = await supa.from(TABLE).insert({
    claim_token: entry.claimToken,
    recipient: entry.to,
    body: entry.body,
    sent_at: entry.sentAt,
  });
  if (error) console.warn("[sms] supabase inbox write failed:", error.message);
}

async function dbReadInbox(): Promise<SmsInboxEntry[]> {
  const supa = getSupabase()!;
  const { data, error } = await supa
    .from(TABLE)
    .select("claim_token, recipient, body, sent_at")
    .order("sent_at", { ascending: false })
    .limit(MAX_INBOX_ENTRIES);
  if (error) {
    console.warn("[sms] supabase inbox read failed:", error.message);
    return [];
  }
  return (data ?? []).map((row: any) => ({
    to: row.recipient,
    body: row.body,
    sentAt: row.sent_at,
    claimToken: row.claim_token,
  }));
}

export async function readInbox(): Promise<SmsInboxEntry[]> {
  return hasSupabase() ? dbReadInbox() : fileReadInbox();
}

async function appendInbox(entry: SmsInboxEntry): Promise<void> {
  return hasSupabase() ? dbAppendInbox(entry) : fileAppendInbox(entry);
}

// ---------- twilio ----------

async function sendViaTwilio(args: SendArgs): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    throw new Error(
      "Twilio mode requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER"
    );
  }
  const body = buildBody(args);
  const form = new URLSearchParams({ To: args.to, From: from, Body: body });
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Twilio send failed (${res.status}): ${text}`);
  }
}

export async function sendSms(args: SendArgs): Promise<{ consoleMode: boolean }> {
  const mode = getGatewayMode();
  const body = buildBody(args);

  if (mode === "twilio") {
    await sendViaTwilio(args);
    // Mirror to inbox for visibility (handy when debugging webhook gaps).
    await appendInbox({
      to: args.to,
      body,
      sentAt: new Date().toISOString(),
      claimToken: args.claimToken,
    });
    return { consoleMode: false };
  }

  // Console mode: stdout + inbox store.
  console.log(`\n[sms:console] -> ${args.to}\n${body}\n`);
  await appendInbox({
    to: args.to,
    body,
    sentAt: new Date().toISOString(),
    claimToken: args.claimToken,
  });
  return { consoleMode: true };
}
