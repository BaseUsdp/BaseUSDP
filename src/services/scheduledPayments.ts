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
  created_at: string;
  updated_at: string;
}

export interface CreateScheduledPaymentInput {
  user_wallet: string;
  recipient_type: "address" | "username";
  recipient_value: string;
  token: "USDC" | "USDT";
  amount: number;
  memo?: string | null;
  is_recurring: boolean;
  frequency?: ScheduledPaymentFrequency | null;
  scheduled_for: string;
}

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
