/**
 * Server-side phone normalization and hashing helpers.
 *
 * The frontend computes the keccak256 hash client-side and we never accept a
 * raw phone number for storage — but the /send endpoint does see the phone
 * once, in memory, to dispatch the SMS. These helpers let the server verify
 * the hash the client claims matches the phone it asked us to text.
 */

import { keccak256, stringToBytes } from "viem";

const E164_RE = /^\+[1-9]\d{7,14}$/;

export function normalizeE164(input: string): string {
  if (typeof input !== "string") throw new Error("phone must be a string");
  const trimmed = input.trim();
  // Strip everything except leading + and digits.
  const cleaned = trimmed.replace(/[^\d+]/g, "");
  const withPlus = cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
  if (!E164_RE.test(withPlus)) {
    throw new Error("phone must be in E.164 format (e.g. +14155550123)");
  }
  return withPlus;
}

export function hashPhone(e164: string): `0x${string}` {
  return keccak256(stringToBytes(normalizeE164(e164)));
}

export function verifyPhoneHash(e164: string, claimedHash: string): boolean {
  try {
    return hashPhone(e164).toLowerCase() === claimedHash.toLowerCase();
  } catch {
    return false;
  }
}
