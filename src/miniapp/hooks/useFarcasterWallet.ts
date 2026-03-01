/**
 * Farcaster Wallet Hook
 * Gets EIP-1193 provider from the Farcaster SDK
 * Enforces Base chain (reuses ensureBaseChain pattern from WalletContext)
 */

import { useState, useCallback, useEffect } from "react";
import sdk from "@farcaster/miniapp-sdk";

const BASE_CHAIN_ID = "0x2105"; // 8453
const BASE_CHAIN_CONFIG = {
  chainId: BASE_CHAIN_ID,
  chainName: "Base",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: ["https://mainnet.base.org"],
  blockExplorerUrls: ["https://basescan.org"],
};

interface FarcasterWalletState {
  provider: any | null;
  isConnected: boolean;
  isConnecting: boolean;
  chainId: string | null;
  error: string | null;
}

export function useFarcasterWallet() {
  const [walletState, setWalletState] = useState<FarcasterWalletState>({
    provider: null,
    isConnected: false,
    isConnecting: false,
    chainId: null,
    error: null,
  });

  const connect = useCallback(async () => {
    setWalletState((prev) => ({ ...prev, isConnecting: true, error: null }));

    try {
      const provider = await sdk.wallet.getEthereumProvider();

      if (!provider) {
        throw new Error("No Ethereum provider available from Farcaster");
      }

      // Ensure we're on Base chain
      const chainId = await provider.request({ method: "eth_chainId" });

      if (chainId !== BASE_CHAIN_ID) {
        try {
          await provider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: BASE_CHAIN_ID }],
          });
        } catch (switchError: any) {
          // Chain not added — try adding it
          if (switchError.code === 4902) {
            await provider.request({
              method: "wallet_addEthereumChain",
              params: [BASE_CHAIN_CONFIG],
            });
          } else {
            throw switchError;
          }
        }
      }

      setWalletState({
        provider,
        isConnected: true,
        isConnecting: false,
        chainId: BASE_CHAIN_ID,
        error: null,
      });

      return provider;
    } catch (error: any) {
      console.error("[Farcaster Wallet] Error:", error);
      setWalletState((prev) => ({
        ...prev,
        isConnecting: false,
        error: error.message || "Wallet connection failed",
      }));
      return null;
    }
  }, []);

  // Listen for chain changes
  useEffect(() => {
    const provider = walletState.provider;
    if (!provider?.on) return;

    const handleChainChanged = (newChainId: string) => {
      setWalletState((prev) => ({ ...prev, chainId: newChainId }));
    };

    provider.on("chainChanged", handleChainChanged);
    return () => {
      provider.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [walletState.provider]);

  return { ...walletState, connect };
}
