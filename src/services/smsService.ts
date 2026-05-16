/**
 * Frontend API client for /api/sms/*.
 *
 * All write flows (send, claim, refund) assume the caller has already done
 * the wallet-side signing. This module only marshals JSON.
 */

import type {
  EscrowPublic,
  InboxEntry,
  SmsSendResult,
} from "@/lib/sms/types";

const BASE = "/api/sms";

async function jsonFetch<T>(
  url: string,
  init?: RequestInit & { signal?: AbortSignal }
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const ct = res.headers.get("content-type") ?? "";
  const payload = ct.includes("application/json")
    ? await res.json().catch(() => ({}))
    : await res.text();
  if (!res.ok) {
    const msg =
      typeof payload === "object" && payload && "error" in (payload as any)
        ? (payload as any).error
        : `request failed (${res.status})`;
    throw new Error(msg);
  }
  return payload as T;
}

export interface SmsSendPayload {
  phoneHash: `0x${string}`;
  amount: string;
  sender: `0x${string}`;
  senderSig: `0x${string}`;
  phoneE164: string;
  claimToken: string;
  note?: string | null;
}

export async function postSmsSend(
  payload: SmsSendPayload,
  signal?: AbortSignal
): Promise<SmsSendResult> {
  return jsonFetch<SmsSendResult>(`${BASE}/send`, {
    method: "POST",
    body: JSON.stringify(payload),
    signal,
  });
}

export interface SmsClaimPayload {
  recipient: `0x${string}`;
  recipientSig: `0x${string}`;
}

export async function postSmsClaim(
  token: string,
  payload: SmsClaimPayload,
  signal?: AbortSignal
): Promise<{ escrow: EscrowPublic }> {
  return jsonFetch(`${BASE}/claim/${encodeURIComponent(token)}`, {
    method: "POST",
    body: JSON.stringify(payload),
    signal,
  });
}

export async function postSmsRefund(
  token: string,
  signal?: AbortSignal
): Promise<{ escrow: EscrowPublic }> {
  return jsonFetch(`${BASE}/refund/${encodeURIComponent(token)}`, {
    method: "POST",
    signal,
  });
}

export async function getSmsStatus(
  token: string,
  signal?: AbortSignal
): Promise<EscrowPublic> {
  return jsonFetch<EscrowPublic>(
    `${BASE}/status/${encodeURIComponent(token)}`,
    { signal }
  );
}

export async function getSmsInbox(
  signal?: AbortSignal
): Promise<{ mode: "console" | "twilio"; messages: InboxEntry[] }> {
  return jsonFetch(`${BASE}/inbox`, { signal });
}
