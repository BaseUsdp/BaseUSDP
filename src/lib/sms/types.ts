/**
 * Shared frontend SMS types. Kept compatible with api/lib/sms/types.ts so
 * service/component code can use a single import surface.
 */

export type EscrowStatus = "pending" | "claimed" | "refunded" | "expired";

export interface EscrowPublic {
  claimToken: string;
  status: EscrowStatus;
  amount: string;
  sender: `0x${string}`;
  recipient: `0x${string}` | null;
  note: string | null;
  createdAt: string;
  expiresAt: string;
  settledAt: string | null;
}

export interface SmsSendResult {
  claimToken: string;
  expiresAt: string;
  claimUrl: string;
  consoleMode: boolean;
}

export interface InboxEntry {
  to: string;
  body: string;
  sentAt: string;
  claimToken: string;
}

export interface QueuedSend {
  /** Locally-generated stable id, separate from the claim token. */
  id: string;
  phoneE164: string;
  phoneHash: `0x${string}`;
  amount: string;
  sender: `0x${string}`;
  senderSig: `0x${string}`;
  claimToken: string;
  note: string | null;
  queuedAt: string;
  attempts: number;
  lastError: string | null;
}
