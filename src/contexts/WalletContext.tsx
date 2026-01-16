import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";
import { authService } from "@/services/authService";

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

  // Format address for display
  const formatAddress = (address: string) => {
    if (address.length > 10) {
      return `${address.slice(0, 4)}...${address.slice(-4)}`;
    }
    return address;
  };

  // Handle external wallet disconnection
  const handleWalletDisconnect = useCallback(() => {
    console.log("Wallet disconnected externally");
    
    // Clear auth session
    authService.logout(false);
    setIsAuthenticated(false);
    setAuthError(null);
    
    // Clear wallet state
    setIsConnected(false);
    setWalletAddress("");
    setFullWalletAddress("");
    setWalletType(null);
    setNetworkStatus("disconnected");
    setChainId(null);
    setEncryptedBalance("0");
    localStorage.removeItem("void402_wallet");
  }, []);

  // Handle account change (user switched accounts in wallet)
  const handleAccountChange = useCallback((publicKey: any) => {
    if (!publicKey) {
      // Account was disconnected
      handleWalletDisconnect();
      return;
    }

    // Account was changed - update state
    const newAddress = publicKey.toString();
    console.log("Wallet account changed to:", newAddress);
    
    // Clear old auth session (new account needs to re-authenticate)
    authService.logout(false);
    setIsAuthenticated(false);
    setAuthError(null);
    
    // Update wallet address
    const formattedAddress = formatAddress(newAddress);
    setWalletAddress(formattedAddress);
    setFullWalletAddress(newAddress);
    
    // Update storage
    localStorage.setItem("void402_wallet", JSON.stringify({
      type: walletType,
      address: formattedAddress,
      fullAddress: newAddress
    }));
  }, [walletType]);

  // Check for persisted connection and auth on mount
  useEffect(() => {
    const savedWallet = localStorage.getItem("void402_wallet");
    if (savedWallet) {
      try {
        const { type, address, fullAddress } = JSON.parse(savedWallet);
        setWalletType(type);
        setWalletAddress(address);
        setFullWalletAddress(fullAddress || address);
        setIsConnected(true);
        setNetworkStatus("connected");
        setEncryptedBalance("12,450.00");
        
        // Check if user has valid session
        if (authService.isAuthenticated()) {
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error("Failed to restore wallet session:", error);
        localStorage.removeItem("void402_wallet");
      }
    }
  }, []);

  // Set up wallet event listeners
  useEffect(() => {
    if (!isConnected || !walletType) return;

    const phantom = getPhantomProvider();
    const solflare = getSolflareProvider();

    // Listen for disconnection and account changes
    if (walletType === "phantom" && phantom) {
      phantom.on("disconnect", handleWalletDisconnect);
      phantom.on("accountChanged", handleAccountChange);
      
      return () => {
        phantom.off("disconnect", handleWalletDisconnect);
        phantom.off("accountChanged", handleAccountChange);
      };
    }

    if (walletType === "solflare" && solflare) {
      solflare.on("disconnect", handleWalletDisconnect);
      solflare.on("accountChanged", handleAccountChange);
      
      return () => {
        solflare.off("disconnect", handleWalletDisconnect);
        solflare.off("accountChanged", handleAccountChange);
      };
    }
  }, [isConnected, walletType, handleWalletDisconnect, handleAccountChange]);

  // Verify wallet is still connected periodically
  useEffect(() => {
    if (!isConnected || !walletType) return;

    const checkConnection = () => {
      const phantom = getPhantomProvider();
      const solflare = getSolflareProvider();

      if (walletType === "phantom" && phantom) {
        if (!phantom.isConnected) {
          console.log("Phantom wallet no longer connected");
          handleWalletDisconnect();
        }
      }

      if (walletType === "solflare" && solflare) {
        if (!solflare.isConnected) {
          console.log("Solflare wallet no longer connected");
          handleWalletDisconnect();
        }
      }
    };

    // Check every 5 seconds
    const interval = setInterval(checkConnection, 5000);
    
    return () => clearInterval(interval);
  }, [isConnected, walletType, handleWalletDisconnect]);

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
        setEncryptedBalance("12,450.00");
        
        // Persist connection
        localStorage.setItem("void402_wallet", JSON.stringify({
          type,
          address: formattedAddress,
          fullAddress: publicKey
        }));
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
    
    // Clear auth session
    await authService.logout(true);
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
  }, [walletType]);

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
    setIsBalanceLoading(true);
    try {
      // Simulate balance fetch - in production this would call Solana RPC
      await new Promise(resolve => setTimeout(resolve, 1500));
      setEncryptedBalance("12,450.00");
    } finally {
      setIsBalanceLoading(false);
    }
  }, []);

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
