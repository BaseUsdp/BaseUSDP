/**
 * API Service
 * Frontend API client for Void402 backend
 * 
 * Provides type-safe methods for:
 * - Building unsigned transactions
 * - Submitting signed transactions
 * - Creating and managing x402 payments
 * - Querying balances and accounts
 * 
 * Authentication:
 * - Automatically includes session token in requests
 * - Handles 401 errors by triggering re-authentication
 */

import { authService } from "./authService";
import { getApiUrl } from "@/utils/apiConfig";

// API Configuration
const API_BASE_URL = getApiUrl();

// ============================================================================
// Types
// ============================================================================

export type PrivacyLevel = "public" | "partial" | "full";

// Build Transaction Types
export interface BuildTransferRequest {
  from: string;
  to: string;
  amount: number;
  privacyLevel: PrivacyLevel;
}

export interface BuildPaymentRequest {
  paymentId: string;
  payerAddress: string;
  amount: number;
}

export interface BuildTransactionResponse {
  success: boolean;
  unsignedTransaction?: string;
  blockhash?: string;
  lastValidBlockHeight?: number;
  message?: string;
  error?: string;
}

// Submit Transaction Types
export interface SubmitTransactionRequest {
  signedTransaction: string;
  transactionType: "transfer" | "payment";
  paymentId?: string;
}

export interface SubmitTransactionResponse {
  success: boolean;
  signature?: string;
  confirmationStatus?: string;
  error?: string;
}

// x402 Payment Types
export interface CreatePaymentRequest {
  amount: number;
  recipient: string;
  serviceId: string;
  metadata?: Record<string, any>;
}

export interface PaymentResponse {
  success: boolean;
  payment?: {
    paymentId: string;
    paymentHash: string;
    status: "pending" | "settled" | "failed";
  };
  error?: string;
}

// Balance Types
export interface BalanceResponse {
  success: boolean;
  address?: string;
  encryptedBalance?: any;
  error?: string;
}

// Validation Types
export interface ValidateAddressResponse {
  success: boolean;
  address?: string;
  sufficient?: boolean;
  balance?: number;
  error?: string;
}

export interface TokenAccountResponse {
  success: boolean;
  ownerAddress?: string;
  exists?: boolean;
  address?: string;
  balance?: number;
  error?: string;
}

// ============================================================================
// API Client Class
// ============================================================================

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Make a fetch request with error handling, authentication, and retry logic
   * 
   * Automatically retries 503 Service Unavailable errors (service initializing)
   * with exponential backoff up to 3 times.
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    requireAuth: boolean = false,
    retryCount: number = 0
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const MAX_RETRIES = 3;
    const INITIAL_RETRY_DELAY = 1000; // 1 second
    
    // Build headers with optional auth token
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    // Add auth token if available
    const token = authService.getSessionToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
      });

      // Handle 503 Service Unavailable (service initializing) with retry
      if (response.status === 503 && retryCount < MAX_RETRIES) {
        const errorData = await response.json().catch(() => ({}));
        
        // Check if it's a service initialization error
        if (errorData.code === "SERVICE_INITIALIZING" || errorData.error?.includes("initializing")) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
          
          console.log(`Service initializing, retrying in ${delay}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Retry the request
          return this.request<T>(endpoint, options, requireAuth, retryCount + 1);
        }
      }

      // Handle 401 Unauthorized
      if (response.status === 401) {
        // Clear the invalid session
        await authService.logout(false);
        
        // Throw error so caller can handle re-auth
        const error = new Error("Session expired. Please authenticate again.");
        (error as any).status = 401;
        (error as any).requiresAuth = true;
        throw error;
      }

      // Handle other error responses
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.error || `Request failed with status ${response.status}`);
        (error as any).status = response.status;
        (error as any).data = errorData;
        throw error;
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      // If it's a 503 after max retries, provide a helpful error message
      if ((error as any)?.status === 503 && retryCount >= MAX_RETRIES) {
        throw new Error("Backend service is taking longer than expected to initialize. Please refresh the page in a few moments.");
      }
      throw error;
    }
  }

  // ==========================================================================
  // Transaction Building Endpoints (NEW ARCHITECTURE)
  // ==========================================================================

  /**
   * Build an unsigned transfer transaction
   * 
   * @param params Transfer parameters
   * @returns Unsigned transaction in base58 format
   */
  async buildTransferTransaction(
    params: BuildTransferRequest
  ): Promise<BuildTransactionResponse> {
    return this.request<BuildTransactionResponse>(
      "/api/solana/build-transfer-transaction",
      {
        method: "POST",
        body: JSON.stringify(params),
      }
    );
  }

  /**
   * Build an unsigned payment settlement transaction
   * 
   * @param params Payment parameters
   * @returns Unsigned transaction in base58 format
   */
  async buildPaymentTransaction(
    params: BuildPaymentRequest
  ): Promise<BuildTransactionResponse> {
    return this.request<BuildTransactionResponse>(
      "/api/solana/build-payment-transaction",
      {
        method: "POST",
        body: JSON.stringify(params),
      }
    );
  }

  /**
   * Submit a signed transaction to Solana
   * 
   * @param params Signed transaction and type
   * @returns Transaction signature and status
   */
  async submitSignedTransaction(
    params: SubmitTransactionRequest
  ): Promise<SubmitTransactionResponse> {
    return this.request<SubmitTransactionResponse>(
      "/api/solana/submit-transaction",
      {
        method: "POST",
        body: JSON.stringify(params),
      }
    );
  }

  // ==========================================================================
  // x402 Payment Endpoints
  // ==========================================================================

  /**
   * Create a new x402 payment request
   * 
   * @param params Payment request parameters
   * @returns Payment response with ID and hash
   */
  async createPaymentRequest(
    params: CreatePaymentRequest
  ): Promise<PaymentResponse> {
    return this.request<PaymentResponse>("/api/payments/create", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  /**
   * Verify an x402 payment
   * 
   * @param paymentId Payment ID
   * @param encryptedAmount Encrypted amount (for verification)
   * @returns Verification result
   */
  async verifyPayment(
    paymentId: string,
    encryptedAmount: string
  ): Promise<{ success: boolean; verified: boolean; error?: string }> {
    return this.request("/api/payments/verify", {
      method: "POST",
      body: JSON.stringify({ paymentId, encryptedAmount }),
    });
  }

  /**
   * Get payment status
   * 
   * @param paymentId Payment ID
   * @returns Payment status
   */
  async getPaymentStatus(paymentId: string): Promise<PaymentResponse> {
    return this.request<PaymentResponse>(`/api/payments/status/${paymentId}`);
  }

  // ==========================================================================
  // Balance and Account Endpoints
  // ==========================================================================

  /**
   * Get encrypted balance for an address
   * 
   * @param address Wallet address
   * @returns Balance info (token balance + SOL balance)
   */
  async getBalance(address: string): Promise<{
    success: boolean;
    address: string;
    tokenBalance?: number;
    solBalance?: number;
    tokenAccountExists?: boolean;
    tokenAccountAddress?: string;
    error?: string;
  }> {
    return this.request(`/api/solana/balance/${address}`);
  }

  /**
   * Validate address has sufficient SOL for fees
   * 
   * @param address Wallet address
   * @returns Validation result
   */
  async validateAddress(address: string): Promise<ValidateAddressResponse> {
    return this.request<ValidateAddressResponse>(
      `/api/solana/validate-address/${address}`
    );
  }

  /**
   * Get token account info for an address
   * 
   * @param address Wallet owner address
   * @returns Token account info
   */
  async getTokenAccount(address: string): Promise<TokenAccountResponse> {
    return this.request<TokenAccountResponse>(
      `/api/solana/token-account/${address}`
    );
  }

  // ==========================================================================
  // Health Check
  // ==========================================================================

  /**
   * Check API health
   */
  async healthCheck(): Promise<{
    status: string;
    service: string;
    version: string;
  }> {
    return this.request("/health");
  }
}

// ============================================================================
// Export singleton instance and convenience functions
// ============================================================================

export const api = new ApiClient();

// Convenience functions for direct imports
export const buildTransferTransaction = (params: BuildTransferRequest) =>
  api.buildTransferTransaction(params);

export const buildPaymentTransaction = (params: BuildPaymentRequest) =>
  api.buildPaymentTransaction(params);

export const submitSignedTransaction = (params: SubmitTransactionRequest) =>
  api.submitSignedTransaction(params);

export const createPaymentRequest = (params: CreatePaymentRequest) =>
  api.createPaymentRequest(params);

export const getBalance = (address: string) => api.getBalance(address);

export const validateAddress = (address: string) => api.validateAddress(address);

export const getTokenAccount = (address: string) => api.getTokenAccount(address);

export const getPaymentStatus = (paymentId: string) =>
  api.getPaymentStatus(paymentId);

// ==========================================================================
// Transaction History Endpoints
// ==========================================================================

export interface TransactionHistoryResponse {
  success: boolean;
  address: string;
  transactions: Array<{
    signature: string;
    timestamp: number;
    type: "transfer" | "payment" | "deposit" | "withdraw" | "unknown";
    status: "success" | "failed";
    from?: string;
    to?: string;
    amount?: number;
    fee: number;
    slot: number;
    memo?: string;
  }>;
  hasMore: boolean;
  oldestSignature?: string;
}

/**
 * Get transaction history for an address
 */
export const getTransactionHistory = async (
  address: string,
  limit: number = 20,
  before?: string
): Promise<TransactionHistoryResponse> => {
  const params = new URLSearchParams({ limit: limit.toString() });
  if (before) params.append("before", before);
  return api.request<TransactionHistoryResponse>(
    `/api/history/${address}?${params.toString()}`
  );
};

export default api;

