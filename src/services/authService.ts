/**
 * Authentication Service
 * Handles wallet-based authentication for Void402
 * 
 * Flow:
 * 1. Get nonce from backend
 * 2. Sign message with wallet
 * 3. Verify signature and get session token
 * 4. Store token in localStorage
 * 5. Include token in API requests
 */

import bs58 from "bs58";
import { getApiUrl } from "@/utils/apiConfig";

// API Configuration
const API_BASE_URL = getApiUrl();

// Token storage key
const TOKEN_KEY = "void402_session_token";
const TOKEN_EXPIRY_KEY = "void402_token_expiry";

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

// Wallet adapter interface (compatible with @solana/wallet-adapter)
export interface WalletAdapter {
  publicKey: { toBase58: () => string } | null;
  signMessage?: (message: Uint8Array) => Promise<Uint8Array>;
  connected: boolean;
}

// ============================================================================
// Auth Service Class
// ============================================================================

class AuthService {
  private sessionToken: string | null = null;
  private tokenExpiry: number | null = null;

  constructor() {
    // Load session from localStorage on init
    this.loadSession();
  }

  /**
   * Load session from localStorage
   */
  private loadSession(): void {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
      
      if (token && expiry) {
        const expiryTime = parseInt(expiry, 10);
        
        // Check if token is still valid
        if (Date.now() < expiryTime) {
          this.sessionToken = token;
          this.tokenExpiry = expiryTime;
        } else {
          // Token expired, clear it
          this.clearSession();
        }
      }
    } catch (error) {
      console.error("Failed to load session:", error);
      this.clearSession();
    }
  }

  /**
   * Save session to localStorage
   */
  private saveSession(token: string, expiresIn: number): void {
    const expiryTime = Date.now() + (expiresIn * 1000);
    
    this.sessionToken = token;
    this.tokenExpiry = expiryTime;
    
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
  }

  /**
   * Clear session from memory and localStorage
   */
  private clearSession(): void {
    this.sessionToken = null;
    this.tokenExpiry = null;
    
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  }

  /**
   * Get nonce from backend for authentication
   * 
   * @param walletAddress - The wallet's public key as base58 string
   * @returns Nonce response with message to sign
   */
  async getNonce(walletAddress: string): Promise<NonceResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/nonce`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ walletAddress }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const msg =
          (data?.error && typeof data.error === "object" && data.error.message) ||
          (typeof data?.error === "string" ? data.error : null) ||
          (typeof data?.message === "string" ? data.message : null);
        return {
          success: false,
          error: msg || "Failed to get authentication nonce",
        };
      }

      return data;
    } catch (error) {
      console.error("Failed to get nonce:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get nonce",
      };
    }
  }

  /**
   * Sign a message with the wallet
   * 
   * @param wallet - Wallet adapter with signMessage capability
   * @param message - Message to sign (from getNonce response)
   * @returns Signature as base58 string
   */
  async signMessage(wallet: WalletAdapter, message: string): Promise<string> {
    if (!wallet.signMessage) {
      throw new Error("Wallet does not support message signing");
    }

    if (!wallet.connected || !wallet.publicKey) {
      throw new Error("Wallet not connected");
    }

    // Encode message to Uint8Array
    const encoder = new TextEncoder();
    const messageBytes = encoder.encode(message);

    // Sign the message
    const signatureBytes = await wallet.signMessage(messageBytes);

    // Convert to base58
    const signature = bs58.encode(signatureBytes);
    
    return signature;
  }

  /**
   * Verify signature and get session token
   * 
   * @param walletAddress - Wallet public key as base58 string
   * @param signature - Signature from signMessage
   * @param nonce - Nonce from getNonce
   * @returns Session token if successful
   */
  async verifySignature(
    walletAddress: string,
    signature: string,
    nonce: string
  ): Promise<VerifyResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ walletAddress, signature, nonce }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const msg =
          (data?.error && typeof data.error === "object" && data.error.message) ||
          (typeof data?.error === "string" ? data.error : null) ||
          (typeof data?.message === "string" ? data.message : null);
        return {
          success: false,
          error: msg || "Signature verification failed",
        };
      }

      if (data.success && data.sessionToken && data.expiresIn) {
        this.saveSession(data.sessionToken, data.expiresIn);
      }

      return data;
    } catch (error) {
      console.error("Failed to verify signature:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to verify signature",
      };
    }
  }

  /**
   * Complete authentication flow
   * 
   * @param wallet - Connected wallet adapter
   * @returns Success status and any error message
   */
  async authenticate(wallet: WalletAdapter): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      if (!wallet.connected || !wallet.publicKey) {
        return { success: false, error: "Wallet not connected" };
      }

      const walletAddress = wallet.publicKey.toBase58();

      // Step 1: Get nonce
      const nonceResponse = await this.getNonce(walletAddress);
      if (!nonceResponse.success || !nonceResponse.nonce || !nonceResponse.message) {
        return { 
          success: false, 
          error: nonceResponse.error || "Failed to get authentication nonce" 
        };
      }

      // Step 2: Sign message
      let signature: string;
      try {
        signature = await this.signMessage(wallet, nonceResponse.message);
      } catch (error) {
        // User likely rejected the signature request
        const errorMessage = error instanceof Error ? error.message : "Signature rejected";
        return { success: false, error: errorMessage };
      }

      // Step 3: Verify signature
      const verifyResponse = await this.verifySignature(
        walletAddress,
        signature,
        nonceResponse.nonce
      );

      if (!verifyResponse.success) {
        return { 
          success: false, 
          error: verifyResponse.error || "Signature verification failed" 
        };
      }

      return { success: true };
    } catch (error) {
      console.error("Authentication failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Authentication failed",
      };
    }
  }

  /**
   * Get current session token
   * 
   * @returns Token string or null if not authenticated
   */
  getSessionToken(): string | null {
    // Check if token exists and is not expired
    if (this.sessionToken && this.tokenExpiry) {
      if (Date.now() < this.tokenExpiry) {
        return this.sessionToken;
      } else {
        // Token expired
        this.clearSession();
      }
    }
    return null;
  }

  /**
   * Check if user is authenticated
   * 
   * @returns True if user has valid session
   */
  isAuthenticated(): boolean {
    return this.getSessionToken() !== null;
  }

  /**
   * Get time until token expires (in seconds)
   * 
   * @returns Seconds until expiry, or 0 if expired/not authenticated
   */
  getTimeUntilExpiry(): number {
    if (this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return Math.floor((this.tokenExpiry - Date.now()) / 1000);
    }
    return 0;
  }

  /**
   * Logout - clear session and optionally call backend
   * 
   * @param callBackend - Whether to also call backend logout endpoint
   */
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
        // Continue with local logout even if backend fails
      }
    }

    this.clearSession();
  }

  /**
   * Refresh session (re-authenticate)
   * 
   * @param wallet - Connected wallet adapter
   * @returns Success status
   */
  async refreshSession(wallet: WalletAdapter): Promise<{
    success: boolean;
    error?: string;
  }> {
    // Clear current session first
    this.clearSession();
    
    // Re-authenticate
    return this.authenticate(wallet);
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const authService = new AuthService();

// Export individual functions for convenience
export const getNonce = (walletAddress: string) => 
  authService.getNonce(walletAddress);

export const signMessage = (wallet: WalletAdapter, message: string) => 
  authService.signMessage(wallet, message);

export const verifySignature = (walletAddress: string, signature: string, nonce: string) => 
  authService.verifySignature(walletAddress, signature, nonce);

export const authenticate = (wallet: WalletAdapter) => 
  authService.authenticate(wallet);

export const getSessionToken = () => 
  authService.getSessionToken();

export const isAuthenticated = () => 
  authService.isAuthenticated();

export const logout = (callBackend?: boolean) => 
  authService.logout(callBackend);

export default authService;

