/**
 * Transaction Type Definitions
 *
 * Types for on-chain transactions, history records,
 * and transaction lifecycle management.
 */

/** Privacy level for a transaction */
export type PrivacyLevel = "public" | "partial" | "full";

/** Transaction direction relative to the current user */
export type TransactionDirection = "sent" | "received" | "swap" | "deposit" | "withdrawal";

/** On-chain transaction status */
export type TransactionStatus =
  | "pending"
  | "submitted"
  | "confirming"
  | "confirmed"
  | "failed"
  | "cancelled";

/** Supported tokens */
export type TokenSymbol = "USDC" | "ETH" | "USDT" | "DAI" | "WETH" | "cbETH";

/** Token metadata */
export interface TokenInfo {
  symbol: TokenSymbol;
  name: string;
  address: string;
  decimals: number;
  logoUrl?: string;
}

/** Transaction record from history API */
export interface Transaction {
  id: string;
  txHash: string;
  from: string;
  to: string;
  amount: string;
  token: TokenSymbol;
  direction: TransactionDirection;
  status: TransactionStatus;
  privacyLevel: PrivacyLevel;
  timestamp: number;
  blockNumber?: number;
  confirmations: number;
  fee?: string;
  memo?: string;
  /** ZK proof hash for private transactions */
  proofHash?: string;
  /** x402 payment ID if this is a payment link settlement */
  paymentId?: string;
}

/** Transaction filter options */
export interface TransactionFilter {
  direction?: TransactionDirection;
  status?: TransactionStatus;
  privacyLevel?: PrivacyLevel;
  token?: TokenSymbol;
  startDate?: number;
  endDate?: number;
  minAmount?: string;
  maxAmount?: string;
  search?: string;
}

/** Transaction sort options */
export interface TransactionSort {
  field: "timestamp" | "amount" | "status";
  order: "asc" | "desc";
}

/** CSV export row */
export interface TransactionCSVRow {
  date: string;
  type: TransactionDirection;
  from: string;
  to: string;
  amount: string;
  token: string;
  status: string;
  privacy: string;
  txHash: string;
  fee: string;
}

/** ZK proof metadata for private transactions */
export interface ZKProofMetadata {
  proofHash: string;
  verificationKey: string;
  nullifier: string;
  commitment: string;
  proofType: "groth16" | "plonk";
  generatedAt: number;
  verifiedAt?: number;
}

/** Transaction receipt after on-chain confirmation */
export interface TransactionReceipt {
  txHash: string;
  blockNumber: number;
  blockHash: string;
  gasUsed: string;
  effectiveGasPrice: string;
  status: "success" | "reverted";
  logs: TransactionLog[];
}

/** Individual event log from a transaction */
export interface TransactionLog {
  address: string;
  topics: string[];
  data: string;
  logIndex: number;
}
