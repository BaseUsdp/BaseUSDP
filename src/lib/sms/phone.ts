/**
 * Client-side phone number normalization and hashing.
 *
 * Raw phone numbers are keccak256-hashed in the browser before they touch
 * the network. The unhashed E.164 string is only passed to the API so the
 * server can dispatch the SMS — it is never persisted.
 */

import { keccak256, stringToBytes } from "viem";

const E164_RE = /^\+[1-9]\d{7,14}$/;

export function normalizeE164(input: string): string {
  if (typeof input !== "string") throw new Error("phone must be a string");
  const trimmed = input.trim();
  const cleaned = trimmed.replace(/[^\d+]/g, "");
  const withPlus = cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
  if (!E164_RE.test(withPlus)) {
    throw new Error("Phone must be in E.164 format, e.g. +14155550123");
  }
  return withPlus;
}

export function isValidE164(input: string): boolean {
  try {
    normalizeE164(input);
    return true;
  } catch {
    return false;
  }
}

export function hashPhone(e164: string): `0x${string}` {
  return keccak256(stringToBytes(normalizeE164(e164)));
}
