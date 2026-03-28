/**
 * API Response Type Definitions
 *
 * Shared types for all API request/response payloads.
 * Used by the service layer and React hooks.
 */

/** Standard API response wrapper */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: number;
}

/** Paginated response */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

/** Auth: nonce request */
export interface NonceRequest {
  walletAddress: string;
  chain: "base" | "solana";
}

/** Auth: nonce response */
export interface NonceResponse {
  success: boolean;
  nonce: string;
  message: string;
  expiresAt: number;
}

/** Auth: verify signature request */
export interface VerifyRequest {
  walletAddress: string;
  signature: string;
  nonce: string;
  chain: "base" | "solana";
}

/** Auth: verify response */
export interface VerifyResponse {
  success: boolean;
  sessionToken: string;
  expiresIn: number;
  walletAddress: string;
}

/** Balance response */
export interface BalanceResponse {
  walletAddress: string;
  balances: {
    token: string;
    symbol: string;
    amount: string;
    decimals: number;
    usdValue: number;
  }[];
  totalUsdValue: number;
  lastUpdated: number;
}

/** ZK Balance response */
export interface ZKBalanceResponse {
  shieldedBalance: string;
  publicBalance: string;
  pendingDeposits: string;
  pendingWithdrawals: string;
}

/** Transfer request */
export interface TransferRequest {
  from: string;
  to: string;
  amount: string;
  token: string;
  privacyLevel: "public" | "partial" | "full";
  memo?: string;
}

/** Transfer response */
export interface TransferResponse {
  success: boolean;
  txHash: string;
  status: "pending" | "submitted";
  estimatedConfirmation: number;
}

/** Swap quote request */
export interface SwapQuoteRequest {
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  slippageBps: number;
  takerAddress: string;
}

/** Swap quote response */
export interface SwapQuoteResponse {
  buyAmount: string;
  sellAmount: string;
  price: string;
  guaranteedPrice: string;
  estimatedGas: string;
  priceImpact: number;
  sources: { name: string; proportion: number }[];
}

/** x402 payment link */
export interface PaymentLinkResponse {
  paymentId: string;
  url: string;
  qrCode: string;
  amount: string;
  token: string;
  expiresAt: number;
  status: "pending" | "paid" | "expired";
}

/** Support ticket */
export interface SupportTicketRequest {
  subject: string;
  message: string;
  category: "bug" | "feature" | "account" | "transaction" | "other";
  walletAddress?: string;
  txHash?: string;
}

/** Health check */
export interface HealthCheckResponse {
  status: "healthy" | "degraded" | "down";
  version: string;
  uptime: number;
  services: {
    name: string;
    status: "up" | "down";
    latency: number;
  }[];
}
