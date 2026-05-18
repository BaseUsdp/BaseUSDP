import { getApiUrl } from "@/utils/apiConfig";
import { authService } from "@/services/authService";

export interface TelegramLinkStatus {
  linked: boolean;
  telegram_username: string | null;
  linking_code: string | null;
  linking_code_expires_at: string | null;
  enabled: boolean;
  notify_incoming: boolean;
  notify_outgoing: boolean;
  notify_x402: boolean;
}

export async function getTelegramStatus(
  wallet: string
): Promise<{ success: boolean; status?: TelegramLinkStatus; error?: string }> {
  const apiUrl = getApiUrl();
  const res = await fetch(
    `${apiUrl}/api/telegram/link-status?wallet=${encodeURIComponent(wallet)}`
  );
  const data = await res.json();
  if (!res.ok) return { success: false, error: data.error };
  return data;
}

export async function initTelegramLink(
  wallet: string
): Promise<{ success: boolean; code?: string; expires_at?: string; error?: string }> {
  const token = authService.getSessionToken();
  if (!token) return { success: false, error: "Not authenticated" };
  const apiUrl = getApiUrl();
  const res = await fetch(`${apiUrl}/api/telegram/link-init`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ wallet }),
  });
  const data = await res.json();
  if (!res.ok) return { success: false, error: data.error };
  return data;
}

export async function updateTelegramSettings(
  wallet: string,
  updates: Partial<{
    enabled: boolean;
    notify_incoming: boolean;
    notify_outgoing: boolean;
    notify_x402: boolean;
  }>
): Promise<{ success: boolean; error?: string }> {
  const token = authService.getSessionToken();
  if (!token) return { success: false, error: "Not authenticated" };
  const apiUrl = getApiUrl();
  const res = await fetch(`${apiUrl}/api/telegram/settings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ wallet, ...updates }),
  });
  const data = await res.json();
  if (!res.ok) return { success: false, error: data.error };
  return data;
}

export async function unlinkTelegram(
  wallet: string
): Promise<{ success: boolean; error?: string }> {
  const token = authService.getSessionToken();
  if (!token) return { success: false, error: "Not authenticated" };
  const apiUrl = getApiUrl();
  const res = await fetch(`${apiUrl}/api/telegram/unlink`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ wallet }),
  });
  const data = await res.json();
  if (!res.ok) return { success: false, error: data.error };
  return data;
}
