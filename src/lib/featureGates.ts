/**
 * Wallet allowlists for dashboard features still in private preview.
 *
 * Lists are sourced from build-time env vars so the repo stays free of
 * specific addresses:
 *   VITE_SMS_WHITELIST   — comma-separated EVM addresses allowed to use SMS Pay
 *   VITE_VEIL_WHITELIST  — comma-separated EVM addresses allowed to use Veil Pool
 *
 * Empty or unset → feature is hidden / disabled for every wallet, which is
 * the safe default for a public clone.
 *
 * Vite inlines these at build time, so the addresses *will* appear in the
 * shipped JS bundle. That is fine here because this gate is UI-only —
 * the SMS API endpoints rely on per-request wallet signatures for their
 * own authentication.
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

const SMS_ALLOWED = parseList(import.meta.env.VITE_SMS_WHITELIST);
const VEIL_ALLOWED = parseList(import.meta.env.VITE_VEIL_WHITELIST);

export function isSmsWhitelisted(address: string | null | undefined): boolean {
  if (!address) return false;
  return SMS_ALLOWED.has(address.toLowerCase());
}

export function isVeilWhitelisted(address: string | null | undefined): boolean {
  if (!address) return false;
  return VEIL_ALLOWED.has(address.toLowerCase());
}
