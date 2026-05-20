/**
 * Per-browser preferences for biometric / WebAuthn unlock.
 *
 * Stored in localStorage so each browser instance can have its own setting
 * (matches the per-device nature of WebAuthn). Server-side state is just
 * which credentials exist for the wallet; whether to actually USE them is
 * a client preference.
 */

const ENABLED_KEY = "baseusdp_biometric_unlock_enabled_v1";
const IDLE_MIN_KEY = "baseusdp_biometric_idle_minutes_v1";

const DEFAULT_IDLE_MINUTES = 15;
export const IDLE_MIN_BOUND = 1;
export const IDLE_MAX_BOUND = 1440; // 24h

export const BIOMETRIC_PREFS_EVENT = "biometric-prefs:changed";

export function isBiometricEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === "true";
  } catch {
    return false;
  }
}

export function setBiometricEnabled(value: boolean): void {
  try {
    if (value) localStorage.setItem(ENABLED_KEY, "true");
    else localStorage.removeItem(ENABLED_KEY);
    window.dispatchEvent(new CustomEvent(BIOMETRIC_PREFS_EVENT));
  } catch {
    /* localStorage unavailable */
  }
}

export function getIdleMinutes(): number {
  try {
    const raw = localStorage.getItem(IDLE_MIN_KEY);
    if (!raw) return DEFAULT_IDLE_MINUTES;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) return DEFAULT_IDLE_MINUTES;
    return Math.max(IDLE_MIN_BOUND, Math.min(IDLE_MAX_BOUND, n));
  } catch {
    return DEFAULT_IDLE_MINUTES;
  }
}

export function setIdleMinutes(minutes: number): void {
  try {
    const clamped = Math.max(IDLE_MIN_BOUND, Math.min(IDLE_MAX_BOUND, Math.floor(minutes)));
    localStorage.setItem(IDLE_MIN_KEY, String(clamped));
    window.dispatchEvent(new CustomEvent(BIOMETRIC_PREFS_EVENT));
  } catch {
    /* localStorage unavailable */
  }
}

export function isBrowserWebAuthnSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    typeof window.PublicKeyCredential === "function" &&
    !!navigator.credentials &&
    typeof navigator.credentials.create === "function" &&
    typeof navigator.credentials.get === "function"
  );
}
