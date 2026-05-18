import { getApiUrl } from "@/utils/apiConfig";

export type ScheduledPaymentFrequency = "daily" | "weekly" | "monthly";

export interface ScheduledPayment {
  id: string;
  user_wallet: string;
  recipient_type: "address" | "username";
  recipient_value: string;
  token: "USDC" | "USDT";
  amount: number | string;
  memo: string | null;
  is_recurring: boolean;
  frequency: ScheduledPaymentFrequency | null;
  scheduled_for: string;
  is_due: boolean;
  status: "active" | "cancelled" | "completed";
  last_sent_at: string | null;
  last_tx_hash: string | null;
  auto_execute: boolean;
  auth_expires_at: string | null;
  auth_max_per_tx: number | string | null;
  auth_revoked: boolean;
  last_error: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateScheduledPaymentInput {
  schedule_id?: string;
  user_wallet: string;
  recipient_type: "address" | "username";
  recipient_value: string;
  token: "USDC" | "USDT";
  amount: number;
  memo?: string | null;
  is_recurring: boolean;
  frequency?: ScheduledPaymentFrequency | null;
  scheduled_for: string;
  auto_execute?: boolean;
  auth_signature?: string;
  auth_max_per_tx?: number;
  auth_expires_at?: string;
}

export const SCHEDULED_PAYMENT_AUTH_DOMAIN = {
  name: "BASEUSDP",
  version: "1",
  chainId: 8453,
} as const;

export const SCHEDULED_PAYMENT_AUTH_TYPES = {
  ScheduledPaymentAuth: [
    { name: "scope", type: "string" },
    { name: "scheduleId", type: "string" },
    { name: "userWallet", type: "address" },
    { name: "recipientType", type: "string" },
    { name: "recipientValue", type: "string" },
    { name: "token", type: "string" },
    { name: "maxPerTx", type: "uint256" },
    { name: "expiresAt", type: "uint256" },
  ],
} as const;

export const SCHEDULED_PAYMENT_AUTH_SCOPE = "scheduled-payment-auto-execute";

export async function createScheduledPayment(
  input: CreateScheduledPaymentInput
): Promise<{ success: boolean; schedule?: ScheduledPayment; error?: string }> {
  const apiUrl = getApiUrl();
  const res = await fetch(`${apiUrl}/api/scheduled/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) return { success: false, error: data.error ?? "Failed to create schedule" };
  return data;
}

export async function listScheduledPayments(
  wallet: string,
  options: { dueOnly?: boolean } = {}
): Promise<{ success: boolean; schedules: ScheduledPayment[]; error?: string }> {
  const apiUrl = getApiUrl();
  const params = new URLSearchParams({ wallet });
  if (options.dueOnly) params.set("due", "1");
  const res = await fetch(`${apiUrl}/api/scheduled/list?${params.toString()}`);
  const data = await res.json();
  if (!res.ok) return { success: false, schedules: [], error: data.error };
  return data;
}

export async function cancelScheduledPayment(
  id: string,
  wallet: string
): Promise<{ success: boolean; error?: string }> {
  const apiUrl = getApiUrl();
  const res = await fetch(
    `${apiUrl}/api/scheduled/${encodeURIComponent(id)}?wallet=${encodeURIComponent(wallet)}`,
    { method: "DELETE" }
  );
  const data = await res.json();
  if (!res.ok) return { success: false, error: data.error };
  return data;
}

export async function markScheduledPaymentSent(
  id: string,
  wallet: string,
  txHash: string | null
): Promise<{ success: boolean; schedule?: ScheduledPayment; error?: string }> {
  const apiUrl = getApiUrl();
  const res = await fetch(`${apiUrl}/api/scheduled/mark-sent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, wallet, tx_hash: txHash }),
  });
  const data = await res.json();
  if (!res.ok) return { success: false, error: data.error };
  return data;
}
