/**
 * Farcaster Authentication Hook
 * Uses Quick Auth SDK to sign in, then exchanges JWT for ORB402 Bearer token
 *
 * Token is stored in React state (NOT localStorage — iframe sandbox may block it)
 */

import { useState, useCallback } from "react";
import sdk from "@farcaster/miniapp-sdk";
import { getApiUrl } from "@/utils/apiConfig";

const API_BASE = getApiUrl();

interface FarcasterAuthState {
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  bearerToken: string | null;
  walletAddress: string | null;
  username: string | null;
  fid: number | null;
  authError: string | null;
}

export function useFarcasterAuth() {
  const [authState, setAuthState] = useState<FarcasterAuthState>({
    isAuthenticated: false,
    isAuthenticating: false,
    bearerToken: null,
    walletAddress: null,
    username: null,
    fid: null,
    authError: null,
  });

  const authenticate = useCallback(async () => {
    setAuthState((prev) => ({
      ...prev,
      isAuthenticating: true,
      authError: null,
    }));

    try {
      // Generate nonce for the sign-in request
      const nonce = crypto.randomUUID();

      // Use Farcaster Quick Auth to get a signed JWT
      const signInResult = await sdk.actions.signIn({
        nonce,
        acceptAuthAddress: true,
      });

      if (!signInResult?.token) {
        throw new Error("Sign-in did not return a token");
      }

      // Exchange Farcaster JWT for ORB402 Bearer token
      const response = await fetch(`${API_BASE}/api/farcaster/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ farcasterJwt: signInResult.token }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Auth failed: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success || !data.sessionToken) {
        throw new Error(data.error || "Auth response missing session token");
      }

      setAuthState({
        isAuthenticated: true,
        isAuthenticating: false,
        bearerToken: data.sessionToken,
        walletAddress: data.walletAddress,
        username: data.username,
        fid: data.fid,
        authError: null,
      });

      return data;
    } catch (error: any) {
      console.error("[Farcaster Auth] Error:", error);
      setAuthState((prev) => ({
        ...prev,
        isAuthenticating: false,
        authError: error.message || "Authentication failed",
      }));
      return null;
    }
  }, []);

  const logout = useCallback(() => {
    setAuthState({
      isAuthenticated: false,
      isAuthenticating: false,
      bearerToken: null,
      walletAddress: null,
      username: null,
      fid: null,
      authError: null,
    });
  }, []);

  return { ...authState, authenticate, logout };
}
