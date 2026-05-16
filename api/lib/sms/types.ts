/**
 * Shared types for the SMS escrow API.
 *
 * The local file-backed store simulates SMSEscrow.sol on Base. Once a real
 * contract is deployed, these records map 1:1 onto on-chain state and the
 * file-backed implementation is swapped for a chain reader.
 */

export type EscrowStatus = "pending" | "claimed" | "refunded" | "expired";

export interface EscrowRecord {
  /** Random 32-char hex token, used in the SMS claim link. */
  claimToken: string;
  /** keccak256 of the normalized E.164 phone number (recipient). */
  phoneHash: `0x${string}`;
  /** Amount in USDC, stored as a decimal string (e.g. "12.50"). */
  amount: string;
  /** Sender wallet address (lowercased). */
  sender: `0x${string}`;
  /** Recipient wallet address once claimed; null while pending. */
  recipient: `0x${string}` | null;
  /** EIP-191 signature of the commitment payload by the sender. */
  senderSig: `0x${string}`;
  /** Optional plaintext note travelling with the SMS (not on-chain in V1). */
  note: string | null;
  status: EscrowStatus;
  createdAt: string;
  expiresAt: string;
  /** Set when status transitions to claimed or refunded. */
  settledAt: string | null;
}

export interface SmsSendRequest {
  phoneHash: `0x${string}`;
  amount: string;
  sender: `0x${string}`;
  senderSig: `0x${string}`;
  /** Plaintext recipient phone — only used to dispatch the SMS, never persisted. */
  phoneE164: string;
  note?: string;
}

export interface SmsSendResponse {
  claimToken: string;
  expiresAt: string;
  claimUrl: string;
  /** True if the gateway is in console mode and no real SMS was sent. */
  consoleMode: boolean;
}

export interface SmsClaimRequest {
  recipient: `0x${string}`;
  /** EIP-191 signature over the claim token by the recipient. */
  recipientSig: `0x${string}`;
}

export interface SmsStatusResponse {
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

export interface SmsInboxEntry {
  to: string;
  body: string;
  sentAt: string;
  claimToken: string;
}
