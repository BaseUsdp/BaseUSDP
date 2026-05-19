/**
 * Send safeguard threshold (localStorage, v1).
 *
 * Stores a per-browser USD threshold. When a Send / Scheduled create
 * exceeds this number, the form shows an extra confirmation dialog
 * before signing. Set to 0 to disable the safeguard entirely.
 */

const STORAGE_KEY = "baseusdp_send_threshold_v1";
export const DEFAULT_SEND_THRESHOLD = 500;

export function getSendThreshold(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null) return DEFAULT_SEND_THRESHOLD;
    const parsed = parseFloat(raw);
    if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_SEND_THRESHOLD;
    return parsed;
  } catch {
    return DEFAULT_SEND_THRESHOLD;
  }
}

export function setSendThreshold(value: number): void {
  try {
    const sanitized = Number.isFinite(value) && value >= 0 ? value : DEFAULT_SEND_THRESHOLD;
    localStorage.setItem(STORAGE_KEY, String(sanitized));
    window.dispatchEvent(new CustomEvent("send-threshold:changed"));
  } catch {
    // localStorage full / unavailable — silent fail, same as other v1 utils.
  }
}
