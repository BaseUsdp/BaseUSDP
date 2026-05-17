/**
 * Local-only recipient address book (v1, localStorage).
 *
 * Stores frequently-used send targets (0x address or @username) with a
 * human label and optional emoji. Used by the Settings "Saved contacts"
 * card and the Send form's quick-pick pills.
 *
 * No cross-device sync; migrate to Supabase if the feature outgrows v1.
 */

const STORAGE_KEY = "baseusdp_address_book_v1";
const MAX_ENTRIES = 100;

export type AddressBookEntryType = "address" | "username";

export interface AddressBookEntry {
  id: string;
  label: string;
  value: string;
  type: AddressBookEntryType;
  emoji?: string;
  createdAt: number;
}

function detectType(value: string): AddressBookEntryType | null {
  const v = value.trim();
  if (/^0x[a-fA-F0-9]{40}$/.test(v)) return "address";
  if (/^@?[a-zA-Z0-9][a-zA-Z0-9_-]{2,19}$/.test(v)) return "username";
  return null;
}

export function listEntries(): AddressBookEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is AddressBookEntry =>
        e && typeof e.id === "string" && typeof e.value === "string"
    );
  } catch {
    return [];
  }
}

function persist(entries: AddressBookEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    // Same-tab notify so other components can re-read without a reload.
    window.dispatchEvent(new CustomEvent("address-book:changed"));
  } catch {
    // localStorage full / unavailable — silent fail is fine for v1.
  }
}

export interface AddEntryInput {
  label: string;
  value: string;
  emoji?: string;
}

export interface AddEntryResult {
  ok: boolean;
  entry?: AddressBookEntry;
  error?: string;
}

export function addEntry(input: AddEntryInput): AddEntryResult {
  const label = input.label.trim().slice(0, 32);
  const rawValue = input.value.trim();
  const emoji = input.emoji?.trim().slice(0, 4);

  if (!label) return { ok: false, error: "Label is required" };

  const type = detectType(rawValue);
  if (!type) {
    return {
      ok: false,
      error: "Enter a 0x address or @username",
    };
  }
  const normalizedValue =
    type === "username" ? rawValue.replace(/^@/, "") : rawValue;

  const existing = listEntries();
  if (existing.length >= MAX_ENTRIES) {
    return { ok: false, error: `Cap of ${MAX_ENTRIES} contacts reached` };
  }

  const dup = existing.find(
    (e) =>
      e.type === type &&
      e.value.toLowerCase() === normalizedValue.toLowerCase()
  );
  if (dup) {
    return { ok: false, error: `Already saved as "${dup.label}"` };
  }

  const entry: AddressBookEntry = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label,
    value: normalizedValue,
    type,
    emoji,
    createdAt: Date.now(),
  };

  persist([entry, ...existing]);
  return { ok: true, entry };
}

export function removeEntry(id: string): void {
  const remaining = listEntries().filter((e) => e.id !== id);
  persist(remaining);
}

export function clearEntries(): void {
  persist([]);
}

export const ADDRESS_BOOK_MAX = MAX_ENTRIES;
