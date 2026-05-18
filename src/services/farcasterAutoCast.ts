import { getApiUrl } from "@/utils/apiConfig";
import { authService } from "@/services/authService";

export interface AutoCastSettings {
  has_farcaster: boolean;
  farcaster_username: string | null;
  enabled: boolean;
  on_deposit: boolean;
  on_withdraw: boolean;
  include_amount: boolean;
}

export async function getAutoCastSettings(
  wallet: string
): Promise<{ success: boolean; settings?: AutoCastSettings; error?: string }> {
  const apiUrl = getApiUrl();
  const res = await fetch(
    `${apiUrl}/api/farcaster/auto-cast-settings?wallet=${encodeURIComponent(wallet)}`
  );
  const data = await res.json();
  if (!res.ok) return { success: false, error: data.error };
  return data;
}

export async function updateAutoCastSettings(
  wallet: string,
  updates: Partial<Omit<AutoCastSettings, "has_farcaster" | "farcaster_username">>
): Promise<{ success: boolean; error?: string }> {
  const apiUrl = getApiUrl();
  const token = authService.getSessionToken();
  if (!token) return { success: false, error: "Not authenticated" };
  const res = await fetch(`${apiUrl}/api/farcaster/auto-cast-settings`, {
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

/**
 * Fire-and-forget — call after a successful deposit or withdrawal.
 * Server checks the user's opt-in state; cast only publishes if all toggles align.
 * Never throws.
 */
export async function fireAutoCast(
  wallet: string,
  event_type: "deposit" | "withdraw",
  amount: number,
  token: "USDC" | "USDT"
): Promise<void> {
  try {
    const apiUrl = getApiUrl();
    await fetch(`${apiUrl}/api/farcaster/auto-cast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet, event_type, amount, token }),
    });
  } catch (err) {
    console.warn("[AutoCast] fire failed:", err);
  }
}
