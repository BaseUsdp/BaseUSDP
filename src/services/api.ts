/**
 * API Service
 * Frontend API client for BASEUSDP backend
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
  async request<T>(
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
    status: "success" | "failed" | "pending";
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

// ==========================================================================
// ZK Deposit and Balance Endpoints
// ==========================================================================

export interface ZKDepositRequest {
  wallet: string;
  amount: number;
  token: "SOL" | "USDC" | "USDT";
}

export interface ZKDepositResponse {
  success: boolean;
  depositId?: string;
  transaction?: string; // Base64 encoded unsigned transaction
  error?: string;
}

export interface ZKProcessDepositRequest {
  depositId: string;
  transactionSignature: string;
  wallet: string;
  amount: number;
  token: "SOL" | "USDC" | "USDT";
}

export interface ZKProcessDepositResponse {
  success: boolean;
  depositId?: string;
  intermediateWallet?: string;
  zkProofNonce?: number;
  splitParts?: Array<{ amount: number; swapSignature?: string }>;
  error?: string;
}

export interface ZKBalanceResponse {
  success?: boolean;
  wallet?: string;
  balance?: number;
  token?: string;
  available?: number;
  deposited?: number;
  withdrawn?: number;
  balances?: {
    sol: number;
    usdc: number;
    usdt: number;
  };
  error?: string;
}

/**
 * Create ZK deposit transaction
 */
export const createZKDeposit = async (
  params: ZKDepositRequest
): Promise<ZKDepositResponse> => {
  return api.request<ZKDepositResponse>("/api/zk/deposit", {
    method: "POST",
    body: JSON.stringify(params),
  });
};

/**
 * Process ZK deposit after signing
 */
export const processZKDeposit = async (
  params: ZKProcessDepositRequest
): Promise<ZKProcessDepositResponse> => {
  return api.request<ZKProcessDepositResponse>("/api/zk/process-deposit", {
    method: "POST",
    body: JSON.stringify(params),
  });
};

/**
 * Get ZK balance for a specific token
 */
export const getZKBalance = async (
  wallet: string,
  token: "USDC" | "USDT" = "USDC"
): Promise<ZKBalanceResponse> => {
  return api.request<ZKBalanceResponse>(`/api/zk/balance/${wallet}?token=${token}`);
};

// ==========================================================================
// ZK x402 Payment Endpoints
// ==========================================================================

export interface ZKX402CreateRequest {
  amount: number;
  recipient: string;
  service_id: string;
  token: "SOL" | "USDC" | "USDT";
  wallet: string;
  metadata?: Record<string, any>;
}

export interface ZKX402CreateResponse {
  success: boolean;
  paymentId?: string;
  paymentHash?: string;
  nonce?: number;
  status?: string;
  error?: string;
}

export interface ZKX402SettleRequest {
  paymentId: string;
  wallet: string;
  proof_bytes: string;
  commitment_bytes: string;
  blinding_factor_bytes: string;
  wallet_signature?: string;
  message_to_sign?: string;
}

export interface ZKX402SettleResponse {
  success: boolean;
  signature?: string;
  paymentId?: string;
  error?: string;
}

/**
 * Create ZK x402 payment request
 */
export const createZKX402Payment = async (
  params: ZKX402CreateRequest
): Promise<ZKX402CreateResponse> => {
  return api.request<ZKX402CreateResponse>("/api/zk-x402/create", {
    method: "POST",
    body: JSON.stringify(params),
  });
};

/**
 * Settle ZK x402 payment (simplified - just sign message)
 */
export const settleZKX402PaymentSimple = async (
  paymentId: string,
  wallet: string,
  walletSignature: string,
  messageToSign: string
): Promise<ZKX402SettleResponse> => {
  return api.request<ZKX402SettleResponse>("/api/zk-x402/settle-simple", {
    method: "POST",
    body: JSON.stringify({
      paymentId,
      wallet,
      wallet_signature: walletSignature,
      message_to_sign: messageToSign,
    }),
  });
};

/**
 * Settle ZK x402 payment (full - with proof data)
 */
export const settleZKX402Payment = async (
  params: ZKX402SettleRequest
): Promise<ZKX402SettleResponse> => {
  return api.request<ZKX402SettleResponse>("/api/zk-x402/settle", {
    method: "POST",
    body: JSON.stringify(params),
  });
};

// ==========================================================================
// ZK Transfer Endpoints (Simplified)
// ==========================================================================

export interface ZKTransferRequest {
  sender_wallet: string;
  recipient_wallet?: string; // For direct address transfers
  recipient_username?: string; // For username transfers (resolved server-side for privacy)
  token: "USDC" | "USDT";
  amount: number;
  nonce: number;
  wallet_signature?: string;
  message_to_sign?: string;
}

export interface ZKTransferResponse {
  success: boolean;
  signature?: string;
  transfer_amount?: number;
  proof_pda?: string;
  nonce?: number;
  error?: string;
  step?: string;
}

/**
 * Execute a private transfer using ZK proofs
 */
export const executeZKTransfer = async (
  params: ZKTransferRequest
): Promise<ZKTransferResponse> => {
  return api.request<ZKTransferResponse>("/api/zk/transfer", {
    method: "POST",
    body: JSON.stringify(params),
  });
};

// ============================================================================
// Messaging Types & Functions
// @deprecated — These centralized Supabase-backed messaging functions are
// replaced by the XMTP decentralized messaging integration (see xmtpService.ts
// and XMTPContext.tsx). Kept as fallback; will be removed in a future release.
// ============================================================================

export interface Message {
  id: string;
  sender_username?: string;
  recipient_username?: string;
  message: string;
  read: boolean;
  created_at: string;
}

export interface SendMessageRequest {
  recipient_username: string;
  message: string;
}

export const sendMessage = async (
  params: SendMessageRequest
): Promise<{ success: boolean; message_id?: string; error?: string }> => {
  return api.request("/api/messages/send", {
    method: "POST",
    body: JSON.stringify(params),
  });
};

export const getSentMessages = async (): Promise<{ success: boolean; messages: Message[] }> => {
  return api.request("/api/messages/sent");
};

export const getReceivedMessages = async (): Promise<{ success: boolean; messages: Message[] }> => {
  return api.request("/api/messages/received");
};

export const getConversation = async (
  username: string
): Promise<{ success: boolean; messages: Message[]; my_username: string }> => {
  return api.request(`/api/messages/conversation?with=${encodeURIComponent(username)}`);
};

export const getUnreadMessageCount = async (): Promise<{ success: boolean; count: number }> => {
  return api.request("/api/messages/unread-count");
};

export const markMessagesRead = async (
  senderUsername: string
): Promise<{ success: boolean }> => {
  return api.request("/api/messages/mark-read", {
    method: "POST",
    body: JSON.stringify({ sender_username: senderUsername }),
  });
};

// ==========================================================================
// Agent API Types & Functions
// ==========================================================================

export interface AgentProfile {
  id: string;
  owner_wallet: string;
  name: string;
  description: string | null;
  status: 'active' | 'paused' | 'revoked';
  created_at: string;
  updated_at: string;
  agent_spending_policies?: AgentSpendingPolicy[] | AgentSpendingPolicy;
  // ERC-8004 Passport fields
  passport_token_id?: number | null;
  passport_tx_hash?: string | null;
  passport_chain?: string | null;
  agent_wallet?: string | null;
  is_verified?: boolean;
  is_revoked?: boolean;
  trust_score?: number | null;
  trust_score_updated_at?: string | null;
}

export interface AgentPassportResponse {
  success: boolean;
  passport: {
    tokenId: number;
    txHash: string;
    chain: string;
    wallet: string;
    verified: boolean;
    revoked: boolean;
    trustScore: number;
    reputation: {
      positiveSignals: number;
      negativeSignals: number;
      txCount: number;
      totalVolume: string;
    } | null;
    cached?: boolean;
  } | null;
  message?: string;
}

export interface AgentSpendingPolicy {
  id: string;
  agent_id: string;
  max_per_tx: number;
  daily_limit: number;
  allowed_tokens: string[];
  allowed_recipients: string[] | null;
  blocked_recipients: string[] | null;
  time_window_start: string | null;
  time_window_end: string | null;
}

export interface AgentApiKeyInfo {
  id: string;
  key_prefix: string;
  label: string | null;
  scopes: string[];
  expires_at: string | null;
  revoked: boolean;
  last_used_at: string | null;
  created_at: string;
}

export interface AgentSpendingLogEntry {
  id: string;
  agent_id: string;
  action: 'transfer' | 'withdraw';
  amount: number;
  token: string;
  recipient: string | null;
  status: 'allowed' | 'blocked' | 'completed' | 'failed';
  reason: string | null;
  tx_hash: string | null;
  created_at: string;
}

/**
 * Register a new AI agent
 */
export const registerAgent = async (
  wallet: string,
  name: string,
  description?: string
): Promise<{ success: boolean; agent?: AgentProfile; error?: string }> => {
  return api.request("/api/agents/register", {
    method: "POST",
    body: JSON.stringify({ wallet, name, description }),
  });
};

/**
 * List operator's agents
 */
export const listAgents = async (
  wallet: string
): Promise<{ success: boolean; agents: AgentProfile[] }> => {
  return api.request(`/api/agents?wallet=${encodeURIComponent(wallet)}`);
};

/**
 * Update agent details
 */
export const updateAgent = async (
  wallet: string,
  agentId: string,
  updates: { name?: string; description?: string; status?: string }
): Promise<{ success: boolean; agent?: AgentProfile; error?: string }> => {
  return api.request("/api/agents/update", {
    method: "PUT",
    body: JSON.stringify({ wallet, agent_id: agentId, ...updates }),
  });
};

/**
 * Delete an agent and all associated data
 */
export const deleteAgent = async (
  wallet: string,
  agentId: string
): Promise<{ success: boolean; error?: string }> => {
  return api.request("/api/agents/delete", {
    method: "DELETE",
    body: JSON.stringify({ wallet, agent_id: agentId }),
  });
};

/**
 * Generate API key for an agent
 */
export const generateAgentKey = async (
  wallet: string,
  agentId: string,
  label?: string,
  scopes?: string[],
  expiresInDays?: number
): Promise<{ success: boolean; key?: string; key_id?: string; key_prefix?: string; error?: string }> => {
  return api.request("/api/agents/keys", {
    method: "POST",
    body: JSON.stringify({
      wallet,
      agent_id: agentId,
      label,
      scopes,
      expires_in_days: expiresInDays,
    }),
  });
};

/**
 * Revoke an API key
 */
export const revokeAgentKey = async (
  wallet: string,
  keyId: string
): Promise<{ success: boolean; error?: string }> => {
  return api.request("/api/agents/keys", {
    method: "DELETE",
    body: JSON.stringify({ wallet, key_id: keyId }),
  });
};

/**
 * Update agent spending policy
 */
export const updateAgentPolicy = async (
  wallet: string,
  agentId: string,
  policy: Partial<AgentSpendingPolicy>
): Promise<{ success: boolean; policy?: AgentSpendingPolicy; error?: string }> => {
  return api.request("/api/agents/policy", {
    method: "PUT",
    body: JSON.stringify({ wallet, agent_id: agentId, ...policy }),
  });
};

/**
 * Get agent spending logs
 */
export const getAgentLogs = async (
  wallet: string,
  agentId: string,
  limit?: number,
  offset?: number
): Promise<{ success: boolean; logs: AgentSpendingLogEntry[]; total: number }> => {
  const params = new URLSearchParams({
    wallet,
    agent_id: agentId,
    limit: (limit || 50).toString(),
    offset: (offset || 0).toString(),
  });
  return api.request(`/api/agents/logs?${params.toString()}`);
};

// ==========================================================================
// Farcaster Cast Mentions
// ==========================================================================

export interface CastMention {
  id: string;
  castHash: string;
  senderUsername: string;
  recipientUsername: string;
  status: "pending" | "processing" | "completed" | "failed";
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface CastMentionsStats {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  volume: number;
}

export interface CastMentionsResponse {
  success: boolean;
  mentions: CastMention[];
  stats: CastMentionsStats;
}

export const getCastMentions = async (
  limit: number = 20
): Promise<CastMentionsResponse> => {
  return api.request(`/api/farcaster/cast-mentions?limit=${limit}`);
};

// ==========================================================================
// AgentKit Wallet Provisioning
// ==========================================================================

/**
 * Provision an AgentKit smart wallet for an agent
 */
export const provisionAgentKitWallet = async (
  wallet: string,
  agentId: string
): Promise<{
  success: boolean;
  wallet_address?: string;
  wallet_id?: string;
  already_provisioned?: boolean;
  error?: string;
}> => {
  return api.request("/api/agents/agentkit-wallet", {
    method: "POST",
    body: JSON.stringify({ wallet, agent_id: agentId }),
  });
};

// ==========================================================================
// ERC-8004 Agent Passport
// ==========================================================================

/**
 * Get live on-chain passport status + reputation data for an agent
 */
export const getAgentPassport = async (
  agentId: string
): Promise<AgentPassportResponse> => {
  return api.request(`/api/agents/passport?agent_id=${agentId}`);
};

/**
 * Verify an agent's passport on-chain (admin only)
 */
export const verifyAgentPassport = async (
  wallet: string,
  agentId: string
): Promise<{ success: boolean; txHash?: string; tokenId?: number; error?: string }> => {
  return api.request("/api/agents/verify", {
    method: "POST",
    body: JSON.stringify({ wallet, agent_id: agentId }),
  });
};

export default api;
