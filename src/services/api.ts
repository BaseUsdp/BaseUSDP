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
 * Features:
 * - Automatic retry on network failures (with exponential backoff)
 * - Request timeout handling
 * - Authentication with session tokens
 * - Comprehensive error handling
 * - Offline detection
 * 
 * SECURITY: This handles financial transactions - error handling is critical.
 */

import { authService } from "./authService";

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 10000; // 10 seconds
const REQUEST_TIMEOUT = 30000; // 30 seconds

// ============================================================================
// Custom Error Types
// ============================================================================

export class ApiError extends Error {
  status: number;
  data?: any;
  requiresAuth: boolean;
  isNetworkError: boolean;
  isTimeout: boolean;
  isOffline: boolean;

  constructor(
    message: string,
    options: {
      status?: number;
      data?: any;
      requiresAuth?: boolean;
      isNetworkError?: boolean;
      isTimeout?: boolean;
      isOffline?: boolean;
    } = {}
  ) {
    super(message);
    this.name = "ApiError";
    this.status = options.status || 0;
    this.data = options.data;
    this.requiresAuth = options.requiresAuth || false;
    this.isNetworkError = options.isNetworkError || false;
    this.isTimeout = options.isTimeout || false;
    this.isOffline = options.isOffline || false;
  }
}

/**
 * Check if user is online
 */
function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

/**
 * Delay helper for retry backoff
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate retry delay with exponential backoff and jitter
 */
function getRetryDelay(attempt: number): number {
  const exponentialDelay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
  const jitter = Math.random() * 500; // Add up to 500ms jitter
  return Math.min(exponentialDelay + jitter, MAX_RETRY_DELAY);
}

/**
 * Determine if an error is retryable
 */
function isRetryableError(error: any): boolean {
  // Network errors are retryable
  if (error instanceof TypeError && error.message.includes("fetch")) {
    return true;
  }
  
  // Timeout errors are retryable
  if (error.name === "AbortError") {
    return true;
  }
  
  // 5xx server errors are retryable
  if (error.status && error.status >= 500) {
    return true;
  }
  
  // 429 Too Many Requests - respect rate limiting but retry
  if (error.status === 429) {
    return true;
  }
  
  // Other errors are not retryable
  return false;
}

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

export interface TokenAccountNeededResponse {
  success: boolean;
  address?: string;
  needsAccount: boolean;
  estimatedCost: number;
  accountAddress?: string;
  error?: string;
}

// Transaction History Types
export interface TransactionRecord {
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
}

export interface TransactionHistoryResponse {
  success: boolean;
  address?: string;
  transactions: TransactionRecord[];
  hasMore: boolean;
  oldestSignature?: string;
  filters?: {
    type: string | null;
    status: string | null;
    minAmount: number | null;
    maxAmount: number | null;
    startDate: number | null;
    endDate: number | null;
  };
  error?: string;
}

export interface TransactionDetailResponse {
  success: boolean;
  transaction?: TransactionRecord;
  error?: string;
}

export interface TransactionSummaryResponse {
  success: boolean;
  address?: string;
  summary?: {
    total: number;
    transfers: number;
    payments: number;
    deposits: number;
    withdrawals: number;
    other: number;
    successful: number;
    failed: number;
  };
  hasMore?: boolean;
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
   * Make a fetch request with comprehensive error handling, retry logic, and authentication
   * 
   * SECURITY: This method handles all API requests including financial transactions.
   * Retry logic and error handling are critical for reliability.
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    config: {
      requireAuth?: boolean;
      retries?: number;
      timeout?: number;
    } = {}
  ): Promise<T> {
    const { 
      requireAuth = false, 
      retries = MAX_RETRIES, 
      timeout = REQUEST_TIMEOUT 
    } = config;
    
    const url = `${this.baseUrl}${endpoint}`;
    
    // Check if offline
    if (!isOnline()) {
      throw new ApiError("You appear to be offline. Please check your internet connection.", {
        isOffline: true,
        isNetworkError: true,
      });
    }

    let lastError: any;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Build headers with optional auth token
        const headers: HeadersInit = {
          "Content-Type": "application/json",
        };

        // Add auth token if available
        const token = authService.getSessionToken();
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
          const response = await fetch(url, {
            ...options,
            headers: {
              ...headers,
              ...options.headers,
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          // Handle 401 Unauthorized - no retry
          if (response.status === 401) {
            // Clear the invalid session
            await authService.logout(false);
            
            throw new ApiError("Session expired. Please authenticate again.", {
              status: 401,
              requiresAuth: true,
            });
          }

          // Handle rate limiting (429) - will retry with backoff
          if (response.status === 429) {
            const error = new ApiError("Too many requests. Please wait a moment.", {
              status: 429,
            });
            throw error;
          }

          // Handle other error responses
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new ApiError(
              errorData.error || `Request failed with status ${response.status}`,
              {
                status: response.status,
                data: errorData,
              }
            );
          }

          const data = await response.json();
          return data as T;

        } catch (error: any) {
          clearTimeout(timeoutId);
          
          // Handle timeout
          if (error.name === "AbortError") {
            throw new ApiError("Request timed out. Please try again.", {
              isTimeout: true,
              isNetworkError: true,
            });
          }
          
          throw error;
        }

      } catch (error: any) {
        lastError = error;

        // Don't retry on auth errors
        if (error.requiresAuth) {
          throw error;
        }

        // Check if error is retryable
        if (isRetryableError(error) && attempt < retries) {
          const retryDelay = getRetryDelay(attempt);
          console.warn(
            `API request failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${retryDelay}ms:`,
            error.message
          );
          await delay(retryDelay);
          continue;
        }

        // If not retryable or max retries reached, throw
        throw error;
      }
    }

    // Should never reach here, but just in case
    throw lastError || new ApiError("Request failed after multiple attempts.", {
      isNetworkError: true,
    });
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
   * @returns Encrypted balance info
   */
  async getBalance(address: string): Promise<BalanceResponse> {
    return this.request<BalanceResponse>(`/api/solana/balance/${address}`);
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

  /**
   * Check if a wallet needs a token account to be created
   * 
   * @param address Wallet address
   * @returns Whether account is needed and estimated cost
   */
  async checkTokenAccountNeeded(address: string): Promise<TokenAccountNeededResponse> {
    return this.request<TokenAccountNeededResponse>(
      `/api/solana/token-account-needed/${address}`
    );
  }

  /**
   * Build an unsigned transaction to create a token account
   * 
   * @param ownerAddress Wallet that will own the account
   * @param payerAddress Optional different payer wallet
   * @returns Unsigned transaction for account creation
   */
  async buildCreateAccountTransaction(
    ownerAddress: string,
    payerAddress?: string
  ): Promise<BuildTransactionResponse> {
    return this.request<BuildTransactionResponse>(
      "/api/solana/build-create-account-transaction",
      {
        method: "POST",
        body: JSON.stringify({ ownerAddress, payerAddress }),
      }
    );
  }

  // ==========================================================================
  // Transaction History Endpoints
  // ==========================================================================

  /**
   * Get transaction history for an address
   * 
   * @param address Wallet address
   * @param options Pagination and filtering options
   * @returns Transaction history with pagination info
   */
  async getTransactionHistory(
    address: string,
    options: {
      limit?: number;
      before?: string;
      type?: "transfer" | "payment" | "deposit" | "withdraw";
      status?: "success" | "failed";
      minAmount?: number;
      maxAmount?: number;
      startDate?: number;
      endDate?: number;
    } = {}
  ): Promise<TransactionHistoryResponse> {
    const params = new URLSearchParams();
    
    if (options.limit) params.append("limit", options.limit.toString());
    if (options.before) params.append("before", options.before);
    if (options.type) params.append("type", options.type);
    if (options.status) params.append("status", options.status);
    if (options.minAmount !== undefined) params.append("minAmount", options.minAmount.toString());
    if (options.maxAmount !== undefined) params.append("maxAmount", options.maxAmount.toString());
    if (options.startDate) params.append("startDate", options.startDate.toString());
    if (options.endDate) params.append("endDate", options.endDate.toString());

    const queryString = params.toString();
    const endpoint = `/api/history/${address}${queryString ? `?${queryString}` : ""}`;

    return this.request<TransactionHistoryResponse>(endpoint);
  }

  /**
   * Get transaction details by signature
   * 
   * @param signature Transaction signature
   * @returns Transaction details
   */
  async getTransaction(signature: string): Promise<TransactionDetailResponse> {
    return this.request<TransactionDetailResponse>(`/api/history/tx/${signature}`);
  }

  /**
   * Get transaction summary for an address
   * 
   * @param address Wallet address
   * @returns Transaction summary
   */
  async getTransactionSummary(address: string): Promise<TransactionSummaryResponse> {
    return this.request<TransactionSummaryResponse>(`/api/history/${address}/summary`);
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
// User-Friendly Error Messages
// ============================================================================

/**
 * Convert API errors to user-friendly messages
 * IMPORTANT: Never expose sensitive error details to users
 */
export function getErrorMessage(error: any): string {
  if (error instanceof ApiError) {
    // Authentication errors
    if (error.requiresAuth) {
      return "Your session has expired. Please reconnect your wallet.";
    }

    // Network errors
    if (error.isOffline) {
      return "You appear to be offline. Please check your internet connection.";
    }

    if (error.isTimeout) {
      return "The request timed out. Please try again.";
    }

    if (error.isNetworkError) {
      return "Unable to connect to the server. Please try again.";
    }

    // Specific status codes
    switch (error.status) {
      case 400:
        return error.message || "Invalid request. Please check your input.";
      case 403:
        return "You don't have permission to perform this action.";
      case 404:
        return "The requested resource was not found.";
      case 429:
        return "Too many requests. Please wait a moment before trying again.";
      case 500:
      case 502:
      case 503:
      case 504:
        return "The server is experiencing issues. Please try again later.";
      default:
        // Don't expose raw error messages that might contain sensitive info
        if (error.message && !error.message.includes("Error:")) {
          return error.message;
        }
        return "An unexpected error occurred. Please try again.";
    }
  }

  // Generic error handling
  if (error instanceof TypeError && error.message.includes("fetch")) {
    return "Unable to connect to the server. Please check your internet connection.";
  }

  if (error.message && typeof error.message === "string") {
    // Sanitize error messages - don't expose stack traces or internal details
    const message = error.message;
    if (message.includes("User rejected") || message.includes("rejected")) {
      return "Transaction was cancelled.";
    }
    if (message.includes("insufficient")) {
      return "Insufficient balance for this transaction.";
    }
    // Return clean message if it looks safe
    if (message.length < 100 && !message.includes("Error:")) {
      return message;
    }
  }

  return "An unexpected error occurred. Please try again.";
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

export const checkTokenAccountNeeded = (address: string) =>
  api.checkTokenAccountNeeded(address);

export const buildCreateAccountTransaction = (
  ownerAddress: string,
  payerAddress?: string
) => api.buildCreateAccountTransaction(ownerAddress, payerAddress);

export const getPaymentStatus = (paymentId: string) =>
  api.getPaymentStatus(paymentId);

export const getTransactionHistory = (
  address: string,
  options?: Parameters<typeof api.getTransactionHistory>[1]
) => api.getTransactionHistory(address, options);

export const getTransaction = (signature: string) =>
  api.getTransaction(signature);

export const getTransactionSummary = (address: string) =>
  api.getTransactionSummary(address);

export const healthCheck = () => api.healthCheck();

export default api;

