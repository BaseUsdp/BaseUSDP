import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";
import { authService } from "@/services/authService";
import { getZKBalance } from "@/services/api";

export type WalletType = "phantom" | "solflare" | null;
export type PrivacyLevel = "public" | "partial" | "full";
export type NetworkStatus = "connected" | "wrong_network" | "disconnected";

interface PhantomProvider {
  isPhantom?: boolean;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString: () => string } }>;
  disconnect: () => Promise<void>;
  on: (event: string, callback: (args?: any) => void) => void;
  off: (event: string, callback: (args?: any) => void) => void;
  publicKey?: { toString: () => string };
  isConnected?: boolean;
}

interface SolflareProvider {
  isSolflare?: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  on: (event: string, callback: (args?: any) => void) => void;
  off: (event: string, callback: (args?: any) => void) => void;
  publicKey?: { toString: () => string };
  isConnected?: boolean;
}

// Helper to get Phantom provider
const getPhantomProvider = (): PhantomProvider | null => {
  if (typeof window === "undefined") return null;
  const provider = (window as any).phantom?.solana || (window as any).solana;
  if (provider?.isPhantom) return provider;
  return null;
};

// Helper to get Solflare provider
const getSolflareProvider = (): SolflareProvider | null => {
  if (typeof window === "undefined") return null;
  const provider = (window as any).solflare;
  if (provider?.isSolflare) return provider;
  return null;
};

interface WalletContextType {
  isConnected: boolean;
  walletAddress: string;
  fullWalletAddress: string; // Full address for transactions
  walletType: WalletType;
  isConnecting: boolean;
  networkStatus: NetworkStatus;
  chainId: number | null;
  privacyLevel: PrivacyLevel;
  encryptedBalance: string;
  isBalanceLoading: boolean;
  // Auth state
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  authError: string | null;
  // Actions
  connect: (type: WalletType) => Promise<void>;
  disconnect: () => void;
  switchNetwork: () => Promise<void>;
  setPrivacyLevel: (level: PrivacyLevel) => void;
  refreshBalance: () => Promise<void>;
  authenticate: () => Promise<boolean>;
  clearAuthError: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [fullWalletAddress, setFullWalletAddress] = useState(""); // Full address for transactions
  const [walletType, setWalletType] = useState<WalletType>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>("disconnected");
  const [chainId, setChainId] = useState<number | null>(null);
  const [privacyLevel, setPrivacyLevel] = useState<PrivacyLevel>("full");
  const [encryptedBalance, setEncryptedBalance] = useState("0");
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  // Track if initial reconnect attempt is complete
  const [initialReconnectComplete, setInitialReconnectComplete] = useState(false);

  // Format address for display
  const formatAddress = (address: string) => {
    if (address.length > 10) {
      return `${address.slice(0, 4)}...${address.slice(-4)}`;
    }
    return address;
  };

  // Clear wallet state and redirect to landing (used on disconnect/switch)
  const clearWalletAndRedirect = useCallback(() => {
    authService.logout(true).catch(() => {});
    setIsAuthenticated(false);
    setAuthError(null);
    setIsConnected(false);
    setWalletAddress("");
    setFullWalletAddress("");
    setWalletType(null);
    setNetworkStatus("disconnected");
    setChainId(null);
    setEncryptedBalance("0");
    localStorage.removeItem("void402_wallet");
    // Redirect to landing when on dashboard (or any protected area)
    if (typeof window !== "undefined" && window.location.pathname !== "/") {
      window.location.href = "/";
    }
  }, []);

  // Check for persisted connection and auth on mount - eagerly reconnect like Nolvipay
  useEffect(() => {
    const savedWallet = localStorage.getItem("void402_wallet");
    if (!savedWallet) {
      setInitialReconnectComplete(true);
      return;
    }

    const { type, address, fullAddress } = JSON.parse(savedWallet);
    
    // Set initial state from localStorage
    setWalletType(type);
    setWalletAddress(address);
    setFullWalletAddress(fullAddress || address);
    setIsConnected(true);
    setNetworkStatus("connected");
    
    // Check if user has valid session
    if (authService.isAuthenticated()) {
      setIsAuthenticated(true);
    }

    // Eagerly reconnect to the wallet (like Nolvipay does)
    // This ensures the wallet provider is properly connected after page refresh
    const eagerReconnect = async () => {
      try {
        // Wait a bit for wallet extension to initialize
        await new Promise(resolve => setTimeout(resolve, 500));

        if (type === "phantom") {
          const phantom = getPhantomProvider();
          if (phantom) {
            // Use onlyIfTrusted to auto-connect without popup if previously approved
            try {
              const response = await phantom.connect({ onlyIfTrusted: true });
              const reconnectedAddress = response.publicKey.toString();
              console.log("[WalletContext] Phantom eagerly reconnected:", reconnectedAddress);
              
              // Verify it's the same wallet
              if (reconnectedAddress !== fullAddress) {
                console.log("[WalletContext] Wallet address changed during reconnect");
                clearWalletAndRedirect();
                return;
              }
            } catch (err) {
              // onlyIfTrusted failed - wallet was disconnected by user
              console.log("[WalletContext] Phantom eager reconnect failed (not trusted):", err);
              clearWalletAndRedirect();
              return;
            }
          }
        } else if (type === "solflare") {
          const solflare = getSolflareProvider();
          if (solflare) {
            // Solflare auto-connects if previously approved
            try {
              await solflare.connect();
              await new Promise(resolve => setTimeout(resolve, 100));
              
              if (solflare.publicKey) {
                const reconnectedAddress = solflare.publicKey.toString();
                console.log("[WalletContext] Solflare eagerly reconnected:", reconnectedAddress);
                
                if (reconnectedAddress !== fullAddress) {
                  console.log("[WalletContext] Wallet address changed during reconnect");
                  clearWalletAndRedirect();
                  return;
                }
              } else {
                console.log("[WalletContext] Solflare reconnect failed - no public key");
                clearWalletAndRedirect();
                return;
              }
            } catch (err) {
              console.log("[WalletContext] Solflare eager reconnect failed:", err);
              clearWalletAndRedirect();
              return;
            }
          }
        }
      } catch (err) {
        console.warn("[WalletContext] Eager reconnect error:", err);
      } finally {
        // Mark reconnect as complete - now polling can start
        setInitialReconnectComplete(true);
      }
    };

    eagerReconnect();
  }, []); // Only run once on mount

  // Listen for wallet disconnect or account switch (like Nolvipay) → redirect to landing
  useEffect(() => {
    if (!isConnected || !fullWalletAddress) return;

    const phantom = getPhantomProvider();
    const solflare = getSolflareProvider();
    const provider = walletType === "phantom" ? phantom : walletType === "solflare" ? solflare : null;

    if (!provider) return;

    const handleDisconnect = () => {
      console.log("[WalletContext] Wallet disconnected event");
      clearWalletAndRedirect();
    };

    const handleAccountChanged = (newPubkey: unknown) => {
      console.log("[WalletContext] Account changed event:", newPubkey);
      // null = disconnected; different key = switched account
      if (newPubkey == null) {
        clearWalletAndRedirect();
        return;
      }
      // Get the new address string
      const newAddress = typeof newPubkey === 'object' && newPubkey !== null && 'toString' in newPubkey 
        ? (newPubkey as { toString: () => string }).toString() 
        : String(newPubkey);
      
      // If the address changed, treat as disconnect and send to landing
      if (newAddress !== fullWalletAddress) {
        console.log("[WalletContext] Account switched from", fullWalletAddress, "to", newAddress);
        clearWalletAndRedirect();
      }
    };

    try {
      if ("on" in provider && typeof provider.on === "function") {
        provider.on("disconnect", handleDisconnect);
        provider.on("accountChanged", handleAccountChanged);
        console.log("[WalletContext] Wallet event listeners attached for", walletType);
        return () => {
          provider.off?.("disconnect", handleDisconnect);
          provider.off?.("accountChanged", handleAccountChanged);
        };
      }
    } catch (err) {
      console.warn("Wallet event listeners not supported:", err);
    }
    return undefined;
  }, [isConnected, walletType, fullWalletAddress, clearWalletAndRedirect]);

  // Poll for wallet state changes (backup for when events don't fire)
  // Only start polling AFTER initial reconnect is complete
  useEffect(() => {
    // Don't poll until initial reconnect attempt is done
    if (!initialReconnectComplete) return;
    if (!isConnected || !fullWalletAddress) return;

    const checkWalletState = () => {
      const phantom = getPhantomProvider();
      const solflare = getSolflareProvider();
      const provider = walletType === "phantom" ? phantom : walletType === "solflare" ? solflare : null;

      if (!provider) {
        // Provider disappeared (e.g., extension removed)
        console.log("[WalletContext] Wallet provider no longer available");
        clearWalletAndRedirect();
        return;
      }

      // Check if wallet is still connected
      if (!provider.isConnected) {
        console.log("[WalletContext] Wallet no longer connected (poll)");
        clearWalletAndRedirect();
        return;
      }

      // Check if the address changed
      const currentAddress = provider.publicKey?.toString();
      if (currentAddress && currentAddress !== fullWalletAddress) {
        console.log("[WalletContext] Wallet address changed (poll):", currentAddress, "vs", fullWalletAddress);
        clearWalletAndRedirect();
        return;
      }
    };

    // Don't check immediately - wait a bit after reconnect completes
    // Then poll every 1 second
    const interval = setInterval(checkWalletState, 1000);

    return () => clearInterval(interval);
  }, [isConnected, walletType, fullWalletAddress, initialReconnectComplete, clearWalletAndRedirect]);

  // Fetch balance when wallet is connected
  useEffect(() => {
    if (!isConnected || !fullWalletAddress) {
      setEncryptedBalance("0");
      return;
    }

    const fetchBalance = async () => {
      setIsBalanceLoading(true);
      try {
        // Fetch USDC and USDT balances separately
        let usdcBalance = 0;
        let usdtBalance = 0;
        
        try {
          const usdcResult = await getZKBalance(fullWalletAddress, 'USDC');
          if (usdcResult && typeof usdcResult.balance === 'number') {
            usdcBalance = usdcResult.balance;
          }
        } catch (e) {
          console.log("[WalletContext] USDC balance fetch failed, using 0");
        }
        
        try {
          const usdtResult = await getZKBalance(fullWalletAddress, 'USDT');
          if (usdtResult && typeof usdtResult.balance === 'number') {
            usdtBalance = usdtResult.balance;
          }
        } catch (e) {
          console.log("[WalletContext] USDT balance fetch failed, using 0");
        }
        
        const totalBalance = usdcBalance + usdtBalance;
        
        const formattedBalance = totalBalance.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        
        setEncryptedBalance(formattedBalance);
      } catch (error) {
        console.error("[WalletContext] Error fetching balance:", error);
        setEncryptedBalance("0");
      } finally {
        setIsBalanceLoading(false);
      }
    };

    // Small delay to ensure state is set
    const timer = setTimeout(fetchBalance, 300);
    return () => clearTimeout(timer);
  }, [isConnected, fullWalletAddress]);

  const connect = useCallback(async (type: WalletType) => {
    setIsConnecting(true);
    
    try {
      let publicKey: string | null = null;

      if (type === "phantom") {
        const phantom = getPhantomProvider();
        
        if (phantom) {
          try {
            // Request connection - this will trigger the Phantom popup
            const response = await phantom.connect();
            publicKey = response.publicKey.toString();
            console.log("Phantom connected:", publicKey);
          } catch (err: any) {
            console.error("Phantom connection error:", err);
            // User rejected or error occurred - don't fallback to demo
            if (err.code === 4001 || err.message?.includes("rejected")) {
              setIsConnecting(false);
              return;
            }
            throw err;
          }
        } else {
          // Phantom not installed - open install page
          window.open("https://phantom.app/", "_blank");
          setIsConnecting(false);
          return;
        }
      } else if (type === "solflare") {
        const solflare = getSolflareProvider();
        
        if (solflare) {
          try {
            // Solflare connect doesn't return publicKey directly
            await solflare.connect();
            // Wait a moment for the connection to establish
            await new Promise(resolve => setTimeout(resolve, 100));
            
            if (solflare.publicKey) {
              publicKey = solflare.publicKey.toString();
              console.log("Solflare connected:", publicKey);
            } else {
              throw new Error("Failed to get public key from Solflare");
            }
          } catch (err: any) {
            console.error("Solflare connection error:", err);
            // User rejected or error occurred - don't fallback to demo
            if (err.message?.includes("rejected") || err.message?.includes("cancelled")) {
              setIsConnecting(false);
              return;
            }
            throw err;
          }
        } else {
          // Solflare not installed - open install page
          window.open("https://solflare.com/", "_blank");
          setIsConnecting(false);
          return;
        }
      }

      if (publicKey && type) {
        const formattedAddress = formatAddress(publicKey);
        setWalletType(type);
        setWalletAddress(formattedAddress);
        setFullWalletAddress(publicKey); // Store full address for transactions
        setIsConnected(true);
        setNetworkStatus("connected");
        
        // Persist connection
        localStorage.setItem("void402_wallet", JSON.stringify({
          type,
          address: formattedAddress,
          fullAddress: publicKey
        }));
        
        // Fetch balance immediately after connecting
        setTimeout(() => {
          // Balance will be fetched automatically by useEffect when isConnected/fullWalletAddress changes
        }, 100);
      }
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      setNetworkStatus("disconnected");
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      // Disconnect from the wallet
      if (walletType === "phantom") {
        const phantom = getPhantomProvider();
        if (phantom) await phantom.disconnect();
      } else if (walletType === "solflare") {
        const solflare = getSolflareProvider();
        if (solflare) await solflare.disconnect();
      }
    } catch (err) {
      console.error("Disconnect error:", err);
    }
    clearWalletAndRedirect();
  }, [walletType, clearWalletAndRedirect]);

  // Authenticate with wallet signature
  const authenticate = useCallback(async (): Promise<boolean> => {
    if (!isConnected) {
      setAuthError("Wallet not connected");
      return false;
    }

    setIsAuthenticating(true);
    setAuthError(null);

    try {
      // Get the wallet provider
      const phantom = getPhantomProvider();
      const solflare = getSolflareProvider();
      const wallet = phantom || solflare;

      if (!wallet) {
        throw new Error("No wallet found");
      }

      // Create wallet adapter
      const walletAdapter = {
        publicKey: wallet.publicKey ? { toBase58: () => wallet.publicKey!.toString() } : null,
        signMessage: async (message: Uint8Array) => {
          if (phantom?.isPhantom) {
            const { signature } = await (phantom as any).signMessage(message, "utf8");
            return signature;
          } else if (solflare?.isSolflare) {
            return await (solflare as any).signMessage(message, "utf8");
          }
          throw new Error("Wallet does not support message signing");
        },
        connected: wallet.isConnected || false,
      };

      const result = await authService.authenticate(walletAdapter);

      if (result.success) {
        setIsAuthenticated(true);
        setAuthError(null);
        return true;
      } else {
        setAuthError(result.error || "Authentication failed");
        return false;
      }
    } catch (error) {
      console.error("Auth error:", error);
      setAuthError(error instanceof Error ? error.message : "Authentication failed");
      return false;
    } finally {
      setIsAuthenticating(false);
    }
  }, [isConnected]);

  // Clear auth error
  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  const switchNetwork = useCallback(async () => {
    // Solana doesn't have network switching in the same way as EVM
    // This is kept for API compatibility
    await new Promise(resolve => setTimeout(resolve, 500));
    setNetworkStatus("connected");
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!isConnected || !fullWalletAddress) {
      setEncryptedBalance("0");
      return;
    }

    setIsBalanceLoading(true);
    try {
      // Fetch USDC and USDT balances separately
      let usdcBalance = 0;
      let usdtBalance = 0;
      
      try {
        const usdcResult = await getZKBalance(fullWalletAddress, 'USDC');
        if (usdcResult && typeof usdcResult.balance === 'number') {
          usdcBalance = usdcResult.balance;
        }
      } catch (e) {
        console.log("[WalletContext] USDC balance fetch failed, using 0");
      }
      
      try {
        const usdtResult = await getZKBalance(fullWalletAddress, 'USDT');
        if (usdtResult && typeof usdtResult.balance === 'number') {
          usdtBalance = usdtResult.balance;
        }
      } catch (e) {
        console.log("[WalletContext] USDT balance fetch failed, using 0");
      }
      
      const totalBalance = usdcBalance + usdtBalance;
      
      const formattedBalance = totalBalance.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      
      setEncryptedBalance(formattedBalance);
    } catch (error) {
      console.error("[WalletContext] Error fetching balance:", error);
      setEncryptedBalance("0");
    } finally {
      setIsBalanceLoading(false);
    }
  }, [isConnected, fullWalletAddress]);

  return (
    <WalletContext.Provider
      value={{
        isConnected,
        walletAddress,
        fullWalletAddress,
        walletType,
        isConnecting,
        networkStatus,
        chainId,
        privacyLevel,
        encryptedBalance,
        isBalanceLoading,
        // Auth state
        isAuthenticated,
        isAuthenticating,
        authError,
        // Actions
        connect,
        disconnect,
        switchNetwork,
        setPrivacyLevel,
        refreshBalance,
        authenticate,
        clearAuthError,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
};
