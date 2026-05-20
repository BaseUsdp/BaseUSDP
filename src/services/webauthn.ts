import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { getApiUrl } from "@/utils/apiConfig";
import { authService } from "@/services/authService";

export interface WebAuthnDevice {
  id: string;
  device_label: string | null;
  transports: string[] | null;
  created_at: string;
  last_used_at: string | null;
}

export async function listDevices(
  wallet: string
): Promise<{ success: boolean; devices?: WebAuthnDevice[]; error?: string }> {
  const apiUrl = getApiUrl();
  const res = await fetch(
    `${apiUrl}/api/webauthn/list?wallet=${encodeURIComponent(wallet)}`
  );
  const data = await res.json();
  if (!res.ok) return { success: false, error: data.error };
  return data;
}

export async function registerDevice(
  wallet: string,
  deviceLabel?: string
): Promise<{ success: boolean; error?: string }> {
  const token = authService.getSessionToken();
  if (!token) return { success: false, error: "Not authenticated" };
  const apiUrl = getApiUrl();

  const initRes = await fetch(`${apiUrl}/api/webauthn/register-init`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ wallet }),
  });
  const initData = await initRes.json();
  if (!initRes.ok || !initData.success) {
    return { success: false, error: initData.error || "Failed to start registration" };
  }

  let attestation;
  try {
    attestation = await startRegistration({ optionsJSON: initData.options });
  } catch (err: any) {
    if (err?.name === "NotAllowedError") {
      return { success: false, error: "Cancelled or denied" };
    }
    return { success: false, error: err?.message || "Browser registration failed" };
  }

  const verifyRes = await fetch(`${apiUrl}/api/webauthn/register-verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ wallet, response: attestation, deviceLabel }),
  });
  const verifyData = await verifyRes.json();
  if (!verifyRes.ok || !verifyData.success) {
    return { success: false, error: verifyData.error || "Registration verification failed" };
  }

  return { success: true };
}

export async function authenticateWithBiometric(
  wallet: string
): Promise<{ success: boolean; error?: string }> {
  const apiUrl = getApiUrl();

  const initRes = await fetch(`${apiUrl}/api/webauthn/auth-init`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet }),
  });
  const initData = await initRes.json();
  if (!initRes.ok || !initData.success) {
    return { success: false, error: initData.error || "Failed to start authentication" };
  }

  let assertion;
  try {
    assertion = await startAuthentication({ optionsJSON: initData.options });
  } catch (err: any) {
    if (err?.name === "NotAllowedError") {
      return { success: false, error: "Cancelled or denied" };
    }
    return { success: false, error: err?.message || "Browser authentication failed" };
  }

  const verifyRes = await fetch(`${apiUrl}/api/webauthn/auth-verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet, response: assertion }),
  });
  const verifyData = await verifyRes.json();
  if (!verifyRes.ok || !verifyData.success) {
    return { success: false, error: verifyData.error || "Authentication verification failed" };
  }

  if (verifyData.sessionToken && verifyData.expiresIn) {
    authService.setSessionFromBiometric(verifyData.sessionToken, verifyData.expiresIn);
  }
  return { success: true };
}

export async function deleteDevice(
  wallet: string,
  id: string
): Promise<{ success: boolean; error?: string }> {
  const token = authService.getSessionToken();
  if (!token) return { success: false, error: "Not authenticated" };
  const apiUrl = getApiUrl();

  const res = await fetch(`${apiUrl}/api/webauthn/delete`, {
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
