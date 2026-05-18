/**
 * EIP-712 typed-data authorization for auto-execute scheduled payments.
 *
 * The user signs one ScheduledPaymentAuth at schedule-creation time. The
 * cron later verifies that signature recovers to the schedule owner before
 * executing the transfer — no per-tx signature required.
 */

import { ethers } from "ethers";

export const SCHEDULED_PAYMENT_AUTH_DOMAIN = {
  name: "BASEUSDP",
  version: "1",
  chainId: 8453,
} as const;

export const SCHEDULED_PAYMENT_AUTH_TYPES = {
  ScheduledPaymentAuth: [
    { name: "scope", type: "string" },
    { name: "scheduleId", type: "string" },
    { name: "userWallet", type: "address" },
    { name: "recipientType", type: "string" },
    { name: "recipientValue", type: "string" },
    { name: "token", type: "string" },
    { name: "maxPerTx", type: "uint256" },
    { name: "expiresAt", type: "uint256" },
  ],
} as const;

export const SCHEDULED_PAYMENT_AUTH_SCOPE = "scheduled-payment-auto-execute";

export interface ScheduledPaymentAuthValue {
  scope: string;
  scheduleId: string;
  userWallet: string;
  recipientType: "address" | "username";
  recipientValue: string;
  token: "USDC" | "USDT";
  maxPerTx: bigint;
  expiresAt: bigint;
}

/**
 * Recover the signer address from an EIP-712 ScheduledPaymentAuth signature.
 * Returns the lowercased address, or null if verification fails.
 */
export function recoverScheduledPaymentAuthSigner(
  value: ScheduledPaymentAuthValue,
  signature: string
): string | null {
  try {
    const recovered = ethers.verifyTypedData(
      SCHEDULED_PAYMENT_AUTH_DOMAIN,
      SCHEDULED_PAYMENT_AUTH_TYPES,
      value,
      signature
    );
    return recovered.toLowerCase();
  } catch (err: any) {
    console.warn("[ScheduledAuth] verifyTypedData failed:", err?.message);
    return null;
  }
}
