import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from "react";
import { authService } from "@/services/authService";
import { getZKBalance } from "@/services/api";
import { getApiUrl } from "@/utils/apiConfig";

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
  // Privacy level - default to "full", loaded per-wallet once connected
  const [privacyLevel, setPrivacyLevelState] = useState<PrivacyLevel>("full");
  
  // Use a ref to always have access to the latest wallet address in callbacks
  const fullWalletAddressRef = useRef(fullWalletAddress);
  useEffect(() => {
    fullWalletAddressRef.current = fullWalletAddress;
  }, [fullWalletAddress]);

  // Helper to get privacy level storage key for a wallet
  const getPrivacyStorageKey = (walletAddr: string) => `void402_privacy_${walletAddr}`;

  // Wrapper to save privacy level to localStorage (per wallet) - uses ref for latest address
  const setPrivacyLevel = useCallback((level: PrivacyLevel) => {
    setPrivacyLevelState(level);
    const walletAddr = fullWalletAddressRef.current;
    if (typeof window !== "undefined" && walletAddr) {
      localStorage.setItem(getPrivacyStorageKey(walletAddr), level);
      console.log(`[WalletContext] Saved privacy level "${level}" for wallet ${walletAddr.slice(0,8)}...`);
    } else {
      console.warn(`[WalletContext] Cannot save privacy - no wallet address`);
    }
  }, []);

  // Load privacy level when wallet address changes
  useEffect(() => {
    if (fullWalletAddress && typeof window !== "undefined") {
      const saved = localStorage.getItem(getPrivacyStorageKey(fullWalletAddress));
      if (saved && ["public", "partial", "full"].includes(saved)) {
        setPrivacyLevelState(saved as PrivacyLevel);
        console.log(`[WalletContext] Loaded privacy level "${saved}" for wallet ${fullWalletAddress.slice(0,8)}...`);
      } else {
        // Default to "full" for new wallets
        setPrivacyLevelState("full");
      }
    }
  }, [fullWalletAddress]);

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

  // Track if we've already handled a disconnect (prevent double-handling)
  const hasHandledDisconnect = useRef(false);

  // Clear wallet state and redirect to landing (used on disconnect/switch)
  // 1:1 with VigilFi - stores message in sessionStorage, does full page refresh
  const clearWalletAndRedirect = useCallback(async (message?: string) => {
    // Prevent double-handling
    if (hasHandledDisconnect.current) return;
    hasHandledDisconnect.current = true;

    console.log("[WalletContext] Disconnecting wallet:", message || "No message");

    // IMPORTANT: Await the backend logout to ensure session is deleted from DB
    // This prevents stale sessions from bypassing re-authentication on reconnect
    try {
      await authService.logout(true);
    } catch {
      // If backend logout fails, still clear locally
      console.warn("[WalletContext] Backend logout failed, clearing locally");
    }
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

    // Store the toast message to show after refresh (1:1 with VigilFi)
    if (message && typeof window !== "undefined") {
      sessionStorage.setItem("void402_disconnect_message", message);
    }

    // Force a full page refresh to landing - this completely resets all state
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
    
    // Check if user has valid session locally
    const hasLocalSession = authService.isAuthenticated();
    if (hasLocalSession) {
      setIsAuthenticated(true);
    }

    // Helper: verify session is valid with backend, re-auth if not
    const verifyAndReauth = async (walletProvider: any, isPhantom: boolean) => {
      // First check: does the token exist locally?
      const sessionToken = authService.getSessionToken();
      let sessionValid = false;
      
      if (sessionToken) {
        // Verify with backend that the session is still valid
        try {
          const apiUrl = getApiUrl();
          const verifyRes = await fetch(`${apiUrl}/api/zk/balance/${fullAddress}?token=USDC`, {
            headers: { 'Authorization': `Bearer ${sessionToken}` },
          });
          const verifyData = await verifyRes.json();
          // If the response has a message about auth, session is invalid
          if (verifyData.message && (verifyData.message.includes('Not authenticated') || verifyData.message.includes('Session invalid') || verifyData.message.includes('invalid'))) {
            console.log("[WalletContext] Backend session invalid, need re-auth");
            sessionValid = false;
          } else {
            sessionValid = true;
            console.log("[WalletContext] Backend session verified OK");
          }
        } catch {
          // Network error - assume session might be valid
          sessionValid = true;
        }
      }
      
      if (!sessionValid) {
        // Session is stale or missing - re-authenticate
        console.log("[WalletContext] Re-authenticating...");
        try {
          const walletAdapter = {
            publicKey: walletProvider.publicKey ? { toBase58: () => walletProvider.publicKey!.toString() } : null,
            signMessage: async (message: Uint8Array) => {
              if (isPhantom) {
                const { signature } = await (walletProvider as any).signMessage(message, "utf8");
                return signature;
              } else {
                return await (walletProvider as any).signMessage(message, "utf8");
              }
            },
            connected: walletProvider.isConnected || false,
          };
          const authResult = await authService.authenticate(walletAdapter);
          if (authResult.success) {
            setIsAuthenticated(true);
            console.log("[WalletContext] Re-authenticated successfully");
          } else {
            console.warn("[WalletContext] Re-auth failed:", authResult.error);
          }
        } catch (authErr) {
          console.warn("[WalletContext] Re-auth error:", authErr);
        }
      }
    };

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
                clearWalletAndRedirect("You switched to a different wallet. Please reconnect to continue.");
                return;
              }
              
              // Verify session with backend and re-auth if needed
              await verifyAndReauth(phantom, true);
            } catch (err) {
              // onlyIfTrusted failed - wallet was disconnected by user
              console.log("[WalletContext] Phantom eager reconnect failed (not trusted):", err);
              clearWalletAndRedirect("Your wallet connection was lost. Please reconnect.");
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
                  clearWalletAndRedirect("You switched to a different wallet. Please reconnect to continue.");
                  return;
                }
                
                // Verify session with backend and re-auth if needed
                await verifyAndReauth(solflare, false);
              } else {
                console.log("[WalletContext] Solflare reconnect failed - no public key");
                clearWalletAndRedirect("Your wallet connection was lost. Please reconnect.");
                return;
              }
            } catch (err) {
              console.log("[WalletContext] Solflare eager reconnect failed:", err);
              clearWalletAndRedirect("Your wallet connection was lost. Please reconnect.");
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
      clearWalletAndRedirect("Your wallet has been disconnected.");
    };

    const handleAccountChanged = (newPubkey: unknown) => {
      console.log("[WalletContext] Account changed event:", newPubkey);
      // null = disconnected; different key = switched account
      if (newPubkey == null) {
        clearWalletAndRedirect("Your wallet has been disconnected.");
        return;
      }
      // Get the new address string
      const newAddress = typeof newPubkey === 'object' && newPubkey !== null && 'toString' in newPubkey 
        ? (newPubkey as { toString: () => string }).toString() 
        : String(newPubkey);
      
      // If the address changed, treat as disconnect and send to landing
      if (newAddress !== fullWalletAddress) {
        console.log("[WalletContext] Account switched from", fullWalletAddress, "to", newAddress);
        clearWalletAndRedirect("You switched to a different wallet. Please reconnect to continue.");
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
  // 1:1 with VigilFi pattern
  useEffect(() => {
    // Don't poll until initial reconnect attempt is done
    if (!initialReconnectComplete) return;
    if (!isConnected || !fullWalletAddress) return;

    const checkWalletState = async () => {
      const phantom = getPhantomProvider();
      const solflare = getSolflareProvider();
      const provider = walletType === "phantom" ? phantom : walletType === "solflare" ? solflare : null;

      if (!provider) {
        // Provider disappeared (e.g., extension removed)
        console.log("[WalletContext] Wallet provider no longer available");
        clearWalletAndRedirect("Your wallet connection was lost. Please reconnect.");
        return;
      }

      // Check if wallet is still connected
      if (!provider.isConnected) {
        console.log("[WalletContext] Wallet no longer connected (poll)");
        clearWalletAndRedirect("Your wallet has been disconnected.");
        return;
      }

      // Method 1: Check provider.publicKey directly
      const currentAddress = provider.publicKey?.toString();
      if (currentAddress && currentAddress !== fullWalletAddress) {
        console.log("[WalletContext] Wallet address changed (poll publicKey):", currentAddress, "vs", fullWalletAddress);
        clearWalletAndRedirect("You switched to a different wallet. Please reconnect to continue.");
        return;
      }

      // Method 2 (1:1 VigilFi): Use connect({ onlyIfTrusted: true }) to get the ACTUAL current account
      // This forces Phantom to return the currently selected account without prompting
      try {
        const response = await provider.connect({ onlyIfTrusted: true });
        const actualCurrentAccount = response?.publicKey?.toString?.();
        
        if (actualCurrentAccount && actualCurrentAccount !== fullWalletAddress) {
          console.log("[WalletContext] Wallet address changed (poll connect):", actualCurrentAccount, "vs", fullWalletAddress);
          clearWalletAndRedirect("You switched to a different wallet. Please reconnect to continue.");
          return;
        }
      } catch (connectErr) {
        // If connect fails, user may have revoked trust - treat as disconnect
        console.log("[WalletContext] Polling: connect() failed, treating as disconnect", connectErr);
        clearWalletAndRedirect("Your wallet connection was lost. Please reconnect.");
      }
    };

    // Check immediately
    checkWalletState();
    
    // Check every 1 second (1:1 with VigilFi)
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
        
        // Always authenticate after connecting (like NolviPay)
        // This ensures a fresh, valid session token for the balance API
        try {
          const phantom = getPhantomProvider();
          const solflare = getSolflareProvider();
          const wallet = phantom || solflare;
          
          if (wallet) {
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
              console.log("[WalletContext] Auto-authenticated after connect");
            } else {
              console.warn("[WalletContext] Auto-auth failed:", result.error);
            }
          }
        } catch (authErr) {
          console.warn("[WalletContext] Auto-auth error:", authErr);
        }
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
    await clearWalletAndRedirect("You have been disconnected.");
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
