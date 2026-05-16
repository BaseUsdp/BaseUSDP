/**
 * Wallet allowlists for dashboard features still in private preview.
 *
 *   VITE_VEIL_WHITELIST — comma-separated EVM addresses allowed to use Veil Pool
 *
 * SMS Pay is currently open to every connected wallet.
 *
 * Vite inlines these at build time, so the addresses *will* appear in the
 * shipped JS bundle. That's fine here because the gate is UI-only — the
 * contract enforces its own authentication via signatures.
 */

function parseList(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => /^0x[a-f0-9]{40}$/.test(s))
  );
}

const VEIL_ALLOWED = parseList(import.meta.env.VITE_VEIL_WHITELIST);

/**
 * SMS Pay is open to everyone — the section handles its own "connect a
 * wallet" empty state. Kept as a function so re-gating later is a
 * one-line change here without touching the sidebar or main content.
 */
export function isSmsWhitelisted(_address: string | null | undefined): boolean {
  return true;
}

export function isVeilWhitelisted(address: string | null | undefined): boolean {
  if (!address) return false;
  return VEIL_ALLOWED.has(address.toLowerCase());
}
