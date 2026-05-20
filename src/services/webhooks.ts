import { getApiUrl } from "@/utils/apiConfig";
import { authService } from "@/services/authService";

export interface Webhook {
  id: string;
  url: string;
  secret: string;
  label: string | null;
  enabled: boolean;
  notify_incoming: boolean;
  notify_outgoing: boolean;
  notify_x402: boolean;
  notify_deposit: boolean;
  notify_withdraw: boolean;
  notify_scheduled: boolean;
  last_fired_at: string | null;
  last_status: number | null;
  last_error: string | null;
  consecutive_failures: number;
  created_at: string;
}

export type WebhookToggleField =
  | "enabled"
  | "notify_incoming"
  | "notify_outgoing"
  | "notify_x402"
  | "notify_deposit"
  | "notify_withdraw"
  | "notify_scheduled";

export async function listWebhooks(
  wallet: string
): Promise<{ success: boolean; webhooks?: Webhook[]; error?: string }> {
  const apiUrl = getApiUrl();
  const res = await fetch(
    `${apiUrl}/api/webhooks/list?wallet=${encodeURIComponent(wallet)}`
  );
  const data = await res.json();
  if (!res.ok) return { success: false, error: data.error };
  return data;
}

export async function createWebhook(
  wallet: string,
  url: string,
  label?: string
): Promise<{ success: boolean; webhook?: Webhook; error?: string }> {
  const token = authService.getSessionToken();
  if (!token) return { success: false, error: "Not authenticated" };
  const apiUrl = getApiUrl();
  const res = await fetch(`${apiUrl}/api/webhooks/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ wallet, url, label }),
  });
  const data = await res.json();
  if (!res.ok) return { success: false, error: data.error };
  return data;
}

export async function updateWebhook(
  wallet: string,
  id: string,
  updates: Partial<Pick<
    Webhook,
    | "enabled"
    | "notify_incoming"
    | "notify_outgoing"
    | "notify_x402"
    | "notify_deposit"
    | "notify_withdraw"
    | "notify_scheduled"
    | "url"
    | "label"
  >>
): Promise<{ success: boolean; error?: string }> {
  const token = authService.getSessionToken();
  if (!token) return { success: false, error: "Not authenticated" };
  const apiUrl = getApiUrl();
  const res = await fetch(`${apiUrl}/api/webhooks/update`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ wallet, id, ...updates }),
  });
  const data = await res.json();
  if (!res.ok) return { success: false, error: data.error };
  return data;
}

export async function deleteWebhook(
  wallet: string,
  id: string
): Promise<{ success: boolean; error?: string }> {
  const token = authService.getSessionToken();
  if (!token) return { success: false, error: "Not authenticated" };
  const apiUrl = getApiUrl();
  const res = await fetch(`${apiUrl}/api/webhooks/delete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ wallet, id }),
  });
  const data = await res.json();
  if (!res.ok) return { success: false, error: data.error };
  return data;
}

/**
 * Fire a client-side webhook event. Use for events whose tx is signed in
 * the browser (Veil deposit/withdraw). Server-driven events fire on the
 * server directly.
 */
export async function fireClientWebhook(
  wallet: string,
  eventType: "deposit" | "withdraw",
  payload: Record<string, unknown>
): Promise<void> {
  const token = authService.getSessionToken();
  if (!token) return;
  const apiUrl = getApiUrl();
  try {
    await fetch(`${apiUrl}/api/webhooks/fire`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ wallet, event_type: eventType, payload }),
    });
  } catch {
    // Best-effort — webhooks are non-critical.
  }
}

export async function testWebhook(
  wallet: string,
  id: string
): Promise<{ success: boolean; status?: number | null; error?: string }> {
  const token = authService.getSessionToken();
  if (!token) return { success: false, error: "Not authenticated" };
  const apiUrl = getApiUrl();
  const res = await fetch(`${apiUrl}/api/webhooks/test`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ wallet, id }),
  });
  const data = await res.json();
  if (!res.ok) return { success: false, error: data.error };
  return data;
}
