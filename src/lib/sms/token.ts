/**
 * 32-byte (64 hex char) claim token, matched to the on-chain `bytes32`
 * type expected by SMSEscrow. Returned as a 0x-prefixed hex string so it
 * can be passed straight into viem encoders.
 */

export function generateClaimToken(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return ("0x" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")) as `0x${string}`;
}

/** Accepts the on-chain `0x...` form (66 chars) used everywhere now. */
export function isValidClaimToken(value: string): boolean {
  return /^0x[a-f0-9]{64}$/i.test(value);
}
