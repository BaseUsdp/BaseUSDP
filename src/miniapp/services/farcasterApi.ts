/**
 * Farcaster API Service
 * Wraps the main ApiClient — injects Farcaster Bearer token from context
 * instead of localStorage. Same typed methods as src/services/api.ts.
 */

import { getApiUrl } from "@/utils/apiConfig";
import type {
  ZKBalanceResponse,
  ZKTransferRequest,
  ZKTransferResponse,
  TransactionHistoryResponse,
} from "@/services/api";

const API_BASE = getApiUrl();

class FarcasterApiClient {
  private bearerToken: string | null = null;

  setToken(token: string | null) {
    this.bearerToken = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (this.bearerToken) {
      headers["Authorization"] = `Bearer ${this.bearerToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers: { ...headers, ...options.headers },
    });

    if (response.status === 401) {
      throw Object.assign(new Error("Session expired"), {
        status: 401,
        requiresAuth: true,
      });
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw Object.assign(
        new Error(errorData.error || `Request failed: ${response.status}`),
        { status: response.status, data: errorData }
      );
    }

    return response.json();
  }

  // ZK Balance
  async getZKBalance(
    wallet: string,
    token: "USDC" | "USDT" = "USDC"
  ): Promise<ZKBalanceResponse> {
    return this.request(`/api/zk/balance/${wallet}?token=${token}`);
  }

  // ZK Transfer
  async executeZKTransfer(
    params: ZKTransferRequest
  ): Promise<ZKTransferResponse> {
    return this.request("/api/zk/transfer", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  // Payment requests
  async createPayment(params: {
    amount: number;
    recipient_wallet: string;
    service_name: string;
    description?: string;
    token?: string;
  }) {
    return this.request<{
      success: boolean;
      paymentId: string;
      paymentHash: string;
      status: string;
    }>("/api/payments/create", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async getPaymentStatus(paymentId: string) {
    return this.request<{
      success: boolean;
      payment?: any;
      error?: string;
    }>(`/api/payments/${paymentId}`);
  }

  async settlePayment(paymentId: string, paidBy?: string, txHash?: string) {
    return this.request<{
      success: boolean;
      paymentId: string;
      status: string;
    }>("/api/payments/settle", {
      method: "POST",
      body: JSON.stringify({
        payment_id: paymentId,
        paid_by: paidBy,
        tx_hash: txHash,
      }),
    });
  }

  // Transaction history
  async getTransactionHistory(
    address: string,
    limit = 20
  ): Promise<TransactionHistoryResponse> {
    return this.request(
      `/api/history/${address}?limit=${limit}`
    );
  }

  // Holding wallet for deposits
  async createHoldingWallet(params: {
    wallet: string;
    amount: number;
    token: string;
  }) {
    const result = await this.request<{
      success: boolean;
      holdingWalletAddress?: string;
      holdingWallet?: string;
      depositId?: string;
      needsApproval?: boolean;
      approveTransaction?: { to: string; data: string; value: string };
      evmTransaction?: { to: string; data: string; value: string };
      error?: string;
    }>("/api/zk/create-holding-wallet", {
      method: "POST",
      body: JSON.stringify(params),
    });
    // Normalize: API returns holdingWalletAddress, frontend expects holdingWallet
    return {
      ...result,
      holdingWallet: result.holdingWalletAddress || result.holdingWallet,
    };
  }

  // Auto-split after deposit
  async autoSplitAndExchange(params: {
    wallet: string;
    holdingWallet: string;
    amount: number;
    token: string;
    depositId?: string;
  }) {
    return this.request<{
      success: boolean;
      splits?: any[];
      error?: string;
    }>("/api/zk/auto-split-and-exchange", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  // Process split queue
  async processSplitQueue(params: { wallet: string }) {
    return this.request<{
      success: boolean;
      processed?: number;
      error?: string;
    }>("/api/zk/process-split-queue", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  // Process pending exchanges (mixer completion)
  async processPendingExchanges(params: {
    wallet: string;
    depositId?: string;
    statusOnly?: boolean;
  }) {
    return this.request<{
      success: boolean;
      allComplete?: boolean;
      completedExchanges?: number;
      totalExchanges?: number;
      error?: string;
    }>("/api/zk/process-pending-exchanges", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  // Cast payment settings
  async getCastPaymentSettings() {
    return this.request<{
      success: boolean;
      enabled: boolean;
      daily_limit: number;
    }>("/api/farcaster/cast-payment-settings");
  }

  async updateCastPaymentSettings(params: {
    wallet: string;
    enabled: boolean;
    daily_limit?: number;
  }) {
    return this.request<{ success: boolean }>("/api/farcaster/cast-payment-settings", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  // Resolve Farcaster username (privacy-safe)
  async resolveFarcasterUser(username: string) {
    return this.request<{
      found: boolean;
      baseusdpUsername: string | null;
      hasDeposited: boolean;
    }>(`/api/farcaster/resolve-fid?username=${encodeURIComponent(username)}`);
  }
}

export const farcasterApi = new FarcasterApiClient();
export default farcasterApi;
