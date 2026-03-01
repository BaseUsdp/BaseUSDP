/**
 * Farcaster Context Provider
 * Mirrors WalletContext but for Farcaster Mini App.
 *
 * On mount: init SDK → authenticate → connect wallet → fetch balance
 * If SDK is unavailable (not in Warpcast), shows helpful message.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useFarcasterAuth } from "../hooks/useFarcasterAuth";
import { useFarcasterWallet } from "../hooks/useFarcasterWallet";
import { useMiniAppContext } from "../hooks/useMiniAppContext";
import { getApiUrl } from "@/utils/apiConfig";

const API_BASE = getApiUrl();

interface FarcasterContextValue {
  fid: number | null;
  farcasterUsername: string | null;
  walletAddress: string | null;
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  bearerToken: string | null;
  authError: string | null;
  provider: any | null;
  isWalletConnected: boolean;
  balance: { usdc: number; usdt: number } | null;
  isBalanceLoading: boolean;
  location: "cast_embed" | "notification" | "launcher" | "direct_cast" | null;
  isClientAdded: boolean;
  isContextLoaded: boolean;
  sdkAvailable: boolean;
  authenticate: () => Promise<any>;
  refreshBalance: () => Promise<void>;
  logout: () => void;
}

const FarcasterContext = createContext<FarcasterContextValue | null>(null);

export function FarcasterProvider({ children }: { children: React.ReactNode }) {
  const miniAppContext = useMiniAppContext();
  const auth = useFarcasterAuth();
  const wallet = useFarcasterWallet();

  const [balance, setBalance] = useState<{ usdc: number; usdt: number } | null>(null);
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!auth.walletAddress || !auth.bearerToken) return;

    setIsBalanceLoading(true);
    try {
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.bearerToken}`,
      };

      const [usdcRes, usdtRes] = await Promise.all([
        fetch(`${API_BASE}/api/zk/balance/${auth.walletAddress}?token=USDC`, { headers }),
        fetch(`${API_BASE}/api/zk/balance/${auth.walletAddress}?token=USDT`, { headers }),
      ]);

      const usdcData = await usdcRes.json();
      const usdtData = await usdtRes.json();

      setBalance({
        usdc: usdcData.balance || usdcData.available || 0,
        usdt: usdtData.balance || usdtData.available || 0,
      });
    } catch (error) {
      console.error("[Farcaster] Balance fetch error:", error);
    } finally {
      setIsBalanceLoading(false);
    }
  }, [auth.walletAddress, auth.bearerToken]);

  // Auto-authenticate only if SDK is available
  useEffect(() => {
    if (
      miniAppContext.isLoaded &&
      miniAppContext.sdkAvailable &&
      !auth.isAuthenticated &&
      !auth.isAuthenticating
    ) {
      auth.authenticate();
    }
  }, [miniAppContext.isLoaded, miniAppContext.sdkAvailable]);

  // Connect wallet after auth
  useEffect(() => {
    if (auth.isAuthenticated && !wallet.isConnected && !wallet.isConnecting) {
      wallet.connect();
    }
  }, [auth.isAuthenticated]);

  // Fetch balance after auth
  useEffect(() => {
    if (auth.isAuthenticated && auth.walletAddress) {
      fetchBalance();
    }
  }, [auth.isAuthenticated, auth.walletAddress, fetchBalance]);

  const value: FarcasterContextValue = {
    fid: auth.fid,
    farcasterUsername: auth.username,
    walletAddress: auth.walletAddress,
    isAuthenticated: auth.isAuthenticated,
    isAuthenticating: auth.isAuthenticating,
    bearerToken: auth.bearerToken,
    authError: auth.authError,
    provider: wallet.provider,
    isWalletConnected: wallet.isConnected,
    balance,
    isBalanceLoading,
    location: miniAppContext.location,
    isClientAdded: miniAppContext.isClientAdded,
    isContextLoaded: miniAppContext.isLoaded,
    sdkAvailable: miniAppContext.sdkAvailable,
    authenticate: auth.authenticate,
    refreshBalance: fetchBalance,
    logout: auth.logout,
  };

  return (
    <FarcasterContext.Provider value={value}>
      {children}
    </FarcasterContext.Provider>
  );
}

export function useFarcaster() {
  const context = useContext(FarcasterContext);
  if (!context) {
    throw new Error("useFarcaster must be used within a FarcasterProvider");
  }
  return context;
}
