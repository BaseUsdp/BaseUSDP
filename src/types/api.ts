/**
 * API type definitions for BaseUSDP
 */

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  code?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: { total: number; limit: number; offset: number; hasMore: boolean };
}

export interface AuthNonceResponse {
  nonce: string;
  expiresAt: string;
  message: string;
}

export interface AuthVerifyResponse {
  token: string;
  expiresAt: string;
  user: { address: string; username: string | null; tier: string; createdAt: string };
}

export interface DepositResponse {
  depositId: string;
  contractAddress: string;
  calldata: string;
  estimatedGas: string;
  note: string;
}

export interface TransferResponse {
  transferId: string;
  transactionHash: string;
  status: 'submitted' | 'pending' | 'confirmed' | 'failed';
}

export interface PaymentResponse {
  paymentId: string;
  paymentUrl: string;
  amount: string;
  status: 'pending' | 'confirmed' | 'expired' | 'cancelled';
  expiresAt: string;
}

export interface TransactionHistoryItem {
  id: string;
  type: 'deposit' | 'transfer' | 'withdrawal';
  amount: string;
  fee: string;
  status: string;
  timestamp: string;
  transactionHash: string;
}
