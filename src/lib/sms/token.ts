/**
 * Client-side claim token generation.
 *
 * 16 bytes from crypto.getRandomValues, hex-encoded. The token doubles as
 * the URL slug for the recipient claim page and the key in the escrow
 * store, so it must be unguessable.
 */

export function generateClaimToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function isValidClaimToken(value: string): boolean {
  return /^[a-f0-9]{32}$/.test(value);
}
