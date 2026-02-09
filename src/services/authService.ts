/**
 * Authentication Service
 * Handles wallet-based authentication for BASEUSDP
 * Supports both Solana (ed25519) and EVM/Base (personal_sign) authentication
 *
 * Flow:
 * 1. Get nonce from backend
 * 2. Sign message with wallet (Solana: signMessage, EVM: personal_sign)
 * 3. Verify signature and get session token
 * 4. Store token in localStorage
 * 5. Include token in API requests
 */

import bs58 from "bs58";
import { getApiUrl } from "@/utils/apiConfig";

// API Configuration
const API_BASE_URL = getApiUrl();

// Token storage key
const TOKEN_KEY = "baseusdp_session_token";
const TOKEN_EXPIRY_KEY = "baseusdp_token_expiry";

// Session duration (24 hours in milliseconds)
const SESSION_DURATION = 24 * 60 * 60 * 1000;

// ============================================================================
// Types
// ============================================================================

export interface NonceResponse {
  success: boolean;
  nonce?: string;
  message?: string;
  error?: string;
}

export interface VerifyResponse {
  success: boolean;
  sessionToken?: string;
  expiresIn?: number;
  walletAddress?: string;
  error?: string;
}

export interface SessionInfo {
  token: string;
  expiresAt: number;
  walletAddress?: string;
}

// Chain-aware wallet adapter interface
export interface WalletAdapter {
  // Solana fields
  publicKey?: { toBase58: () => string } | null;
  signMessage?: (message: Uint8Array) => Promise<Uint8Array>;
  // EVM fields
  address?: string;
  signEVMMessage?: (message: string) => Promise<string>;
  // Common
  connected: boolean;
  chain?: "solana" | "base";
}

// ============================================================================
// Auth Service Class
// ============================================================================

class AuthService {
  private sessionToken: string | null = null;
  private tokenExpiry: number | null = null;

  constructor() {
    this.loadSession();
  }

  private loadSession(): void {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);

      if (token && expiry) {
        const expiryTime = parseInt(expiry, 10);
        if (Date.now() < expiryTime) {
          this.sessionToken = token;
          this.tokenExpiry = expiryTime;
        } else {
          this.clearSession();
        }
      }
    } catch (error) {
      console.error("Failed to load session:", error);
      this.clearSession();
    }
  }

  private saveSession(token: string, expiresIn: number): void {
    const expiryTime = Date.now() + (expiresIn * 1000);
    this.sessionToken = token;
    this.tokenExpiry = expiryTime;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
  }

  private clearSession(): void {
    this.sessionToken = null;
    this.tokenExpiry = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  }

  /**
   * Get nonce from backend for authentication
   */
  async getNonce(walletAddress: string, chain: "solana" | "base" = "base"): Promise<NonceResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/nonce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, chain }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const msg =
          (data?.error && typeof data.error === "object" && data.error.message) ||
          (typeof data?.error === "string" ? data.error : null) ||
          (typeof data?.message === "string" ? data.message : null);
        return { success: false, error: msg || "Failed to get authentication nonce" };
      }

      return data;
    } catch (error) {
      console.error("Failed to get nonce:", error);
      return { success: false, error: error instanceof Error ? error.message : "Failed to get nonce" };
    }
  }

  /**
   * Sign a message with Solana wallet (returns base58 signature)
   */
  async signMessageSolana(wallet: WalletAdapter, message: string): Promise<string> {
    if (!wallet.signMessage) {
      throw new Error("Wallet does not support message signing");
    }
    if (!wallet.connected || !wallet.publicKey) {
      throw new Error("Wallet not connected");
    }

    const encoder = new TextEncoder();
    const messageBytes = encoder.encode(message);
    const signatureBytes = await wallet.signMessage(messageBytes);
    return bs58.encode(signatureBytes);
  }

  /**
   * Sign a message with EVM wallet (returns hex signature)
   */
  async signMessageEVM(wallet: WalletAdapter, message: string): Promise<string> {
    if (!wallet.signEVMMessage) {
      throw new Error("Wallet does not support EVM message signing");
    }
    if (!wallet.connected || !wallet.address) {
      throw new Error("Wallet not connected");
    }

    return await wallet.signEVMMessage(message);
  }

  /**
   * Verify signature and get session token
   */
  async verifySignature(
    walletAddress: string,
    signature: string,
    nonce: string,
    chain: "solana" | "base" = "base"
  ): Promise<VerifyResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, signature, nonce, chain }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const msg =
          (data?.error && typeof data.error === "object" && data.error.message) ||
          (typeof data?.error === "string" ? data.error : null) ||
          (typeof data?.message === "string" ? data.message : null);
        return { success: false, error: msg || "Signature verification failed" };
      }

      if (data.success && data.sessionToken && data.expiresIn) {
        this.saveSession(data.sessionToken, data.expiresIn);
      }

      return data;
    } catch (error) {
      console.error("Failed to verify signature:", error);
      return { success: false, error: error instanceof Error ? error.message : "Failed to verify signature" };
    }
  }

  /**
   * Complete authentication flow (chain-aware)
   */
  async authenticate(wallet: WalletAdapter): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const chain = wallet.chain || "base";

      // Determine wallet address
      let walletAddress: string;
      if (chain === "base") {
        if (!wallet.address) {
          return { success: false, error: "EVM wallet address not provided" };
        }
        walletAddress = wallet.address;
      } else {
        if (!wallet.connected || !wallet.publicKey) {
          return { success: false, error: "Wallet not connected" };
        }
        walletAddress = wallet.publicKey.toBase58();
      }

      // Step 1: Get nonce
      const nonceResponse = await this.getNonce(walletAddress, chain);
      if (!nonceResponse.success || !nonceResponse.nonce || !nonceResponse.message) {
        return { success: false, error: nonceResponse.error || "Failed to get authentication nonce" };
      }

      // Step 2: Sign message (chain-specific)
      let signature: string;
      try {
        if (chain === "base") {
          signature = await this.signMessageEVM(wallet, nonceResponse.message);
        } else {
          signature = await this.signMessageSolana(wallet, nonceResponse.message);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Signature rejected";
        return { success: false, error: errorMessage };
      }

      // Step 3: Verify signature
      const verifyResponse = await this.verifySignature(
        walletAddress,
        signature,
        nonceResponse.nonce,
        chain
      );

      if (!verifyResponse.success) {
        return { success: false, error: verifyResponse.error || "Signature verification failed" };
      }

      return { success: true };
    } catch (error) {
      console.error("Authentication failed:", error);
      return { success: false, error: error instanceof Error ? error.message : "Authentication failed" };
    }
  }

  getSessionToken(): string | null {
    if (this.sessionToken && this.tokenExpiry) {
      if (Date.now() < this.tokenExpiry) {
        return this.sessionToken;
      } else {
        this.clearSession();
      }
    }
    return null;
  }

  isAuthenticated(): boolean {
    return this.getSessionToken() !== null;
  }

  getTimeUntilExpiry(): number {
    if (this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return Math.floor((this.tokenExpiry - Date.now()) / 1000);
    }
    return 0;
  }

  async logout(callBackend: boolean = true): Promise<void> {
    if (callBackend && this.sessionToken) {
      try {
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.sessionToken}`,
          },
        });
      } catch (error) {
        console.error("Backend logout failed:", error);
      }
    }
    this.clearSession();
  }

  async refreshSession(wallet: WalletAdapter): Promise<{ success: boolean; error?: string }> {
    this.clearSession();
    return this.authenticate(wallet);
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const authService = new AuthService();

export const getNonce = (walletAddress: string, chain?: "solana" | "base") =>
  authService.getNonce(walletAddress, chain);

export const verifySignature = (walletAddress: string, signature: string, nonce: string, chain?: "solana" | "base") =>
  authService.verifySignature(walletAddress, signature, nonce, chain);

export const authenticate = (wallet: WalletAdapter) =>
  authService.authenticate(wallet);

export const getSessionToken = () =>
  authService.getSessionToken();

export const isAuthenticated = () =>
  authService.isAuthenticated();

export const logout = (callBackend?: boolean) =>
  authService.logout(callBackend);

export default authService;
