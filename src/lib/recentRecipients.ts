/**
 * Recent recipients (localStorage, v1).
 *
 * Tracks the last N people you sent to so the Send form can offer them
 * as one-tap quick-pick pills above the Saved Contacts row. Dedup'd by
 * value (case-insensitive), most recent first.
 *
 * Per-browser, not per-wallet (matches the address book's v1 trade-off).
 */

const STORAGE_KEY = "baseusdp_recent_recipients_v1";
const MAX_STORED = 10;
export const RECENT_RECIPIENTS_DISPLAY = 5;

export type RecentRecipientType = "address" | "username";

export interface RecentRecipient {
  value: string;
  type: RecentRecipientType;
  lastUsedAt: number;
}

function isValid(value: string, type: RecentRecipientType): boolean {
  const v = value.trim();
  if (type === "address") return /^0x[a-fA-F0-9]{40}$/.test(v);
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,19}$/.test(v.replace(/^@/, ""));
}

export function listRecent(): RecentRecipient[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is RecentRecipient =>
        e &&
        typeof e.value === "string" &&
        (e.type === "address" || e.type === "username") &&
        typeof e.lastUsedAt === "number"
    );
  } catch {
    return [];
  }
}

function persist(entries: RecentRecipient[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    window.dispatchEvent(new CustomEvent("recent-recipients:changed"));
  } catch {
    // localStorage full / unavailable — silent fail, same as addressBook.
  }
}

export interface PushRecentInput {
  value: string;
  type: RecentRecipientType;
}

export function pushRecent(input: PushRecentInput): void {
  const normalizedValue =
    input.type === "username"
      ? input.value.trim().replace(/^@/, "")
      : input.value.trim();
  if (!isValid(normalizedValue, input.type)) return;

  const existing = listRecent();
  const filtered = existing.filter(
    (e) =>
      !(e.type === input.type && e.value.toLowerCase() === normalizedValue.toLowerCase())
  );
  const next: RecentRecipient[] = [
    { value: normalizedValue, type: input.type, lastUsedAt: Date.now() },
    ...filtered,
  ].slice(0, MAX_STORED);

  persist(next);
}

export function clearRecent(): void {
  persist([]);
}
