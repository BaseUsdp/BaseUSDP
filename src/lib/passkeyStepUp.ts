/**
 * Passkey step-up threshold (localStorage, v1).
 *
 * When a Send equals or exceeds this USD threshold AND the user has at
 * least one passkey registered, the send flow prompts for a fresh
 * biometric assertion before signing the transfer. Set to 0 to disable.
 *
 * This is an additive UX safety net — the user's wallet signature is
 * still the primary authorization. The passkey gate just adds a fresh
 * "is this actually you?" check for higher-value sends.
 */

const STORAGE_KEY = "baseusdp_passkey_stepup_threshold_v1";
export const DEFAULT_PASSKEY_STEPUP_THRESHOLD = 0; // 0 = disabled

export function getPasskeyStepUpThreshold(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null) return DEFAULT_PASSKEY_STEPUP_THRESHOLD;
    const parsed = parseFloat(raw);
    if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_PASSKEY_STEPUP_THRESHOLD;
    return parsed;
  } catch {
    return DEFAULT_PASSKEY_STEPUP_THRESHOLD;
  }
}

export function setPasskeyStepUpThreshold(value: number): void {
  try {
    const sanitized =
      Number.isFinite(value) && value >= 0 ? value : DEFAULT_PASSKEY_STEPUP_THRESHOLD;
    localStorage.setItem(STORAGE_KEY, String(sanitized));
    window.dispatchEvent(new CustomEvent("passkey-stepup-threshold:changed"));
  } catch {
    // localStorage full / unavailable — silent fail.
  }
}
