import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from "react";
import { authService } from "@/services/authService";
import { getZKBalance } from "@/services/api";
import { getApiUrl } from "@/utils/apiConfig";

export type WalletType = "phantom" | "metamask" | null;
export type ActiveChain = "solana" | "base";
export type PrivacyLevel = "public" | "partial" | "full";
export type NetworkStatus = "connected" | "wrong_network" | "disconnected";

// Base chain ID constants
const BASE_MAINNET_CHAIN_ID = 8453;
const BASE_SEPOLIA_CHAIN_ID = 84532;
const BASE_MAINNET_HEX = "0x2105";
const BASE_SEPOLIA_HEX = "0x14a34";

// Determine target chain based on environment
const isProduction = typeof window !== "undefined" && (window.location.hostname === "baseusdp.com" || window.location.hostname === "www.baseusdp.com" || window.location.hostname.endsWith(".vercel.app"));
const TARGET_CHAIN_ID = isProduction ? BASE_MAINNET_CHAIN_ID : BASE_SEPOLIA_CHAIN_ID;
const TARGET_CHAIN_HEX = isProduction ? BASE_MAINNET_HEX : BASE_SEPOLIA_HEX;

interface PhantomSolanaProvider {
  isPhantom?: boolean;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString: () => string } }>;
  disconnect: () => Promise<void>;
  on: (event: string, callback: (args?: any) => void) => void;
  off: (event: string, callback: (args?: any) => void) => void;
  publicKey?: { toString: () => string };
  isConnected?: boolean;
}

interface PhantomEVMProvider {
  isPhantom?: boolean;
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on: (event: string, callback: (args?: any) => void) => void;
  removeListener: (event: string, callback: (args?: any) => void) => void;
  selectedAddress?: string | null;
  isConnected?: boolean;
}

interface MetaMaskEVMProvider {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on: (event: string, callback: (args?: any) => void) => void;
  removeListener: (event: string, callback: (args?: any) => void) => void;
  selectedAddress?: string | null;
  isConnected?: boolean;
}

// Helper to get Phantom Solana provider (kept for Solana mode)
const getPhantomSolanaProvider = (): PhantomSolanaProvider | null => {
  if (typeof window === "undefined") return null;
  const provider = (window as any).phantom?.solana || (window as any).solana;
  if (provider?.isPhantom) return provider;
  return null;
};

// Helper to get Phantom EVM provider (for Base)
const getPhantomEVMProvider = (): PhantomEVMProvider | null => {
  if (typeof window === "undefined") return null;
  const provider = (window as any).phantom?.ethereum;
  if (provider?.isPhantom) return provider;
  return null;
};

// Legacy alias for existing code that references getPhantomProvider
const getPhantomProvider = getPhantomSolanaProvider;

// Helper to get MetaMask EVM provider (for Base)
const getMetaMaskProvider = (): MetaMaskEVMProvider | null => {
  if (typeof window === "undefined") return null;
  // MetaMask injects window.ethereum with isMetaMask=true
  // Avoid picking up Phantom's window.ethereum (which also sets isMetaMask)
  const provider = (window as any).ethereum;
  if (provider?.isMetaMask && !provider?.isPhantom) return provider;
  return null;
};

interface WalletContextType {
  isConnected: boolean;
  walletAddress: string;
  fullWalletAddress: string;
  walletType: WalletType;
  activeChain: ActiveChain;
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
  const [fullWalletAddress, setFullWalletAddress] = useState("");
  const [walletType, setWalletType] = useState<WalletType>(null);
  const [activeChain, setActiveChain] = useState<ActiveChain>("base"); // Default to Base
  const [isConnecting, setIsConnecting] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>("disconnected");
  const [chainId, setChainId] = useState<number | null>(null);
  const [privacyLevel, setPrivacyLevelState] = useState<PrivacyLevel>("full");

  const fullWalletAddressRef = useRef(fullWalletAddress);
  useEffect(() => {
    fullWalletAddressRef.current = fullWalletAddress;
  }, [fullWalletAddress]);

  const getPrivacyStorageKey = (walletAddr: string) => `baseusdp_privacy_${walletAddr}`;

  const setPrivacyLevel = useCallback((level: PrivacyLevel) => {
    setPrivacyLevelState(level);
    const walletAddr = fullWalletAddressRef.current;
    if (typeof window !== "undefined" && walletAddr) {
      localStorage.setItem(getPrivacyStorageKey(walletAddr), level);
      console.log(`[WalletContext] Saved privacy level "${level}" for wallet ${walletAddr.slice(0,8)}...`);
    }
  }, []);

  useEffect(() => {
    if (fullWalletAddress && typeof window !== "undefined") {
      const saved = localStorage.getItem(getPrivacyStorageKey(fullWalletAddress));
      if (saved && ["public", "partial", "full"].includes(saved)) {
        setPrivacyLevelState(saved as PrivacyLevel);
      } else {
        setPrivacyLevelState("full");
      }
    }
  }, [fullWalletAddress]);

  const [encryptedBalance, setEncryptedBalance] = useState("0");
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [initialReconnectComplete, setInitialReconnectComplete] = useState(false);

  const formatAddress = (address: string) => {
    if (address.length > 10) {
      return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }
    return address;
  };

  const hasHandledDisconnect = useRef(false);

  const clearWalletAndRedirect = useCallback(async (message?: string) => {
    if (hasHandledDisconnect.current) return;
    hasHandledDisconnect.current = true;

    console.log("[WalletContext] Disconnecting wallet:", message || "No message");

    try {
      await authService.logout(true);
    } catch {
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
    localStorage.removeItem("baseusdp_wallet");

    if (message && typeof window !== "undefined") {
      sessionStorage.setItem("baseusdp_disconnect_message", message);
    }

    if (typeof window !== "undefined" && window.location.pathname !== "/") {
      window.location.href = "/";
    }
  }, []);

  // ============================================================
  // EVM Helper: ensure Phantom is on the correct Base chain
  // ============================================================
  const ensureBaseChain = useCallback(async (provider: PhantomEVMProvider): Promise<boolean> => {
    try {
      const currentChainHex = await provider.request({ method: 'eth_chainId' });
      const currentChainId = parseInt(currentChainHex, 16);
      setChainId(currentChainId);

      if (currentChainId === TARGET_CHAIN_ID) {
        setNetworkStatus("connected");
        return true;
      }

      // Try switching to Base
      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: TARGET_CHAIN_HEX }],
        });
        setChainId(TARGET_CHAIN_ID);
        setNetworkStatus("connected");
        return true;
      } catch (switchError: any) {
        // Chain not added yet — add it
        if (switchError.code === 4902) {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: TARGET_CHAIN_HEX,
              chainName: isProduction ? 'Base' : 'Base Sepolia',
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              rpcUrls: [isProduction ? 'https://mainnet.base.org' : 'https://sepolia.base.org'],
              blockExplorerUrls: [isProduction ? 'https://basescan.org' : 'https://sepolia.basescan.org'],
            }],
          });
          setChainId(TARGET_CHAIN_ID);
          setNetworkStatus("connected");
          return true;
        }
        console.error("[WalletContext] Failed to switch to Base:", switchError);
        setNetworkStatus("wrong_network");
        return false;
      }
    } catch (err) {
      console.error("[WalletContext] Error checking chain:", err);
      setNetworkStatus("wrong_network");
      return false;
    }
  }, []);

  // ============================================================
  // Build wallet adapter for auth (chain-aware)
  // ============================================================
  const buildWalletAdapter = useCallback((chain: ActiveChain, address: string, wType?: WalletType) => {
    if (chain === "base") {
      // Pick the right EVM provider based on wallet type
      const evmProvider = wType === "metamask" ? getMetaMaskProvider() : getPhantomEVMProvider();
      return {
        address,
        chain: "base" as const,
        connected: true,
        publicKey: null,
        signEVMMessage: async (message: string): Promise<string> => {
          if (!evmProvider) throw new Error("EVM provider not found");
          const signature = await evmProvider.request({
            method: 'personal_sign',
            params: [message, address],
          });
          return signature;
        },
      };
    }

    // Solana adapter (kept for legacy support)
    const phantom = getPhantomSolanaProvider();

    return {
      chain: "solana" as const,
      connected: phantom?.isConnected || false,
      publicKey: phantom?.publicKey ? { toBase58: () => phantom.publicKey!.toString() } : null,
      signMessage: async (message: Uint8Array) => {
        if (phantom?.isPhantom) {
          const { signature } = await (phantom as any).signMessage(message, "utf8");
          return signature;
        }
        throw new Error("Wallet does not support message signing");
      },
    };
  }, []);

  // ============================================================
  // Check for persisted connection on mount
  // ============================================================
  useEffect(() => {
    const savedWallet = localStorage.getItem("baseusdp_wallet");
    if (!savedWallet) {
      setInitialReconnectComplete(true);
      return;
    }

    const { type, address, fullAddress, chain } = JSON.parse(savedWallet);
    const savedChain: ActiveChain = chain || "base";

    setWalletType(type);
    setWalletAddress(address);
    setFullWalletAddress(fullAddress || address);
    setActiveChain(savedChain);
    setIsConnected(true);
    setNetworkStatus("connected");

    const hasLocalSession = authService.isAuthenticated();
    if (hasLocalSession) {
      setIsAuthenticated(true);
    }

    const verifyAndReauth = async (walletAddr: string, walletChain: ActiveChain) => {
      const sessionToken = authService.getSessionToken();
      let sessionValid = false;

      if (sessionToken) {
        try {
          const apiUrl = getApiUrl();
          const verifyRes = await fetch(`${apiUrl}/api/zk/balance/${walletAddr}?token=USDC`, {
            headers: { 'Authorization': `Bearer ${sessionToken}` },
          });
          const verifyData = await verifyRes.json();
          if (verifyData.message && (verifyData.message.includes('Not authenticated') || verifyData.message.includes('Session invalid') || verifyData.message.includes('invalid'))) {
            sessionValid = false;
          } else {
            sessionValid = true;
            console.log("[WalletContext] Backend session verified OK");
          }
        } catch {
          sessionValid = true;
        }
      }

      if (!sessionValid) {
        console.log("[WalletContext] Re-authenticating...");
        try {
          const adapter = buildWalletAdapter(walletChain, walletAddr, type);
          const authResult = await authService.authenticate(adapter);
          if (authResult.success) {
            setIsAuthenticated(true);
            console.log("[WalletContext] Re-authenticated successfully");
          }
        } catch (authErr) {
          console.warn("[WalletContext] Re-auth error:", authErr);
        }
      }
    };

    const eagerReconnect = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 500));

        if (savedChain === "base") {
          // EVM reconnect via Phantom or MetaMask
          const evmProvider = type === "metamask" ? getMetaMaskProvider() : getPhantomEVMProvider();
          if (evmProvider) {
            try {
              const accounts: string[] = await evmProvider.request({ method: 'eth_accounts' });
              if (accounts.length > 0) {
                const reconnectedAddress = accounts[0].toLowerCase();
                const savedAddr = (fullAddress || address).toLowerCase();

                if (reconnectedAddress !== savedAddr) {
                  clearWalletAndRedirect("You switched to a different wallet. Please reconnect to continue.");
                  return;
                }

                await ensureBaseChain(evmProvider);
                await verifyAndReauth(accounts[0], "base");
                console.log(`[WalletContext] ${type} EVM eagerly reconnected:`, accounts[0]);
              } else {
                clearWalletAndRedirect("Your wallet connection was lost. Please reconnect.");
                return;
              }
            } catch (err) {
              console.log(`[WalletContext] ${type} EVM eager reconnect failed:`, err);
              clearWalletAndRedirect("Your wallet connection was lost. Please reconnect.");
              return;
            }
          }
        } else if (type === "phantom") {
          // Solana Phantom reconnect
          const phantom = getPhantomSolanaProvider();
          if (phantom) {
            try {
              const response = await phantom.connect({ onlyIfTrusted: true });
              const reconnectedAddress = response.publicKey.toString();

              if (reconnectedAddress !== fullAddress) {
                clearWalletAndRedirect("You switched to a different wallet. Please reconnect to continue.");
                return;
              }

              await verifyAndReauth(fullAddress, "solana");
            } catch (err) {
              clearWalletAndRedirect("Your wallet connection was lost. Please reconnect.");
              return;
            }
          }
        }
      } catch (err) {
        console.warn("[WalletContext] Eager reconnect error:", err);
      } finally {
        setInitialReconnectComplete(true);
      }
    };

    eagerReconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================================
  // Event listeners for wallet disconnect / account switch
  // ============================================================
  useEffect(() => {
    if (!isConnected || !fullWalletAddress) return;

    if (activeChain === "base") {
      // EVM event listeners (Phantom or MetaMask)
      const evmProvider = walletType === "metamask" ? getMetaMaskProvider() : getPhantomEVMProvider();
      if (!evmProvider) return;

      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          clearWalletAndRedirect("Your wallet has been disconnected.");
          return;
        }
        if (accounts[0].toLowerCase() !== fullWalletAddress.toLowerCase()) {
          clearWalletAndRedirect("You switched to a different wallet. Please reconnect to continue.");
        }
      };

      const handleChainChanged = (newChainHex: string) => {
        const newChainId = parseInt(newChainHex, 16);
        setChainId(newChainId);
        if (newChainId !== TARGET_CHAIN_ID) {
          setNetworkStatus("wrong_network");
        } else {
          setNetworkStatus("connected");
        }
      };

      const handleDisconnect = () => {
        clearWalletAndRedirect("Your wallet has been disconnected.");
      };

      evmProvider.on("accountsChanged", handleAccountsChanged);
      evmProvider.on("chainChanged", handleChainChanged);
      evmProvider.on("disconnect", handleDisconnect);
      console.log("[WalletContext] EVM event listeners attached");

      return () => {
        evmProvider.removeListener("accountsChanged", handleAccountsChanged);
        evmProvider.removeListener("chainChanged", handleChainChanged);
        evmProvider.removeListener("disconnect", handleDisconnect);
      };
    }

    // Solana event listeners
    const phantom = getPhantomSolanaProvider();
    const provider = walletType === "phantom" ? phantom : null;

    if (!provider) return;

    const handleDisconnect = () => {
      clearWalletAndRedirect("Your wallet has been disconnected.");
    };

    const handleAccountChanged = (newPubkey: unknown) => {
      if (newPubkey == null) {
        clearWalletAndRedirect("Your wallet has been disconnected.");
        return;
      }
      const newAddress = typeof newPubkey === 'object' && newPubkey !== null && 'toString' in newPubkey
        ? (newPubkey as { toString: () => string }).toString()
        : String(newPubkey);

      if (newAddress !== fullWalletAddress) {
        clearWalletAndRedirect("You switched to a different wallet. Please reconnect to continue.");
      }
    };

    try {
      if ("on" in provider && typeof provider.on === "function") {
        provider.on("disconnect", handleDisconnect);
        provider.on("accountChanged", handleAccountChanged);
        return () => {
          provider.off?.("disconnect", handleDisconnect);
          provider.off?.("accountChanged", handleAccountChanged);
        };
      }
    } catch (err) {
      console.warn("Wallet event listeners not supported:", err);
    }
    return undefined;
  }, [isConnected, walletType, activeChain, fullWalletAddress, clearWalletAndRedirect]);

  // ============================================================
  // Polling for wallet state changes (backup)
  // ============================================================
  useEffect(() => {
    if (!initialReconnectComplete) return;
    if (!isConnected || !fullWalletAddress) return;

    const checkWalletState = async () => {
      if (activeChain === "base") {
        // EVM polling (Phantom or MetaMask)
        const evmProvider = walletType === "metamask" ? getMetaMaskProvider() : getPhantomEVMProvider();
        if (!evmProvider) {
          clearWalletAndRedirect("Your wallet connection was lost. Please reconnect.");
          return;
        }
        try {
          const accounts: string[] = await evmProvider.request({ method: 'eth_accounts' });
          if (accounts.length === 0) {
            clearWalletAndRedirect("Your wallet has been disconnected.");
            return;
          }
          if (accounts[0].toLowerCase() !== fullWalletAddress.toLowerCase()) {
            clearWalletAndRedirect("You switched to a different wallet. Please reconnect to continue.");
            return;
          }
        } catch {
          clearWalletAndRedirect("Your wallet connection was lost. Please reconnect.");
        }
        return;
      }

      // Solana polling
      const phantom = getPhantomSolanaProvider();
      const provider = walletType === "phantom" ? phantom : null;

      if (!provider) {
        clearWalletAndRedirect("Your wallet connection was lost. Please reconnect.");
        return;
      }

      if (!provider.isConnected) {
        clearWalletAndRedirect("Your wallet has been disconnected.");
        return;
      }

      const currentAddress = provider.publicKey?.toString();
      if (currentAddress && currentAddress !== fullWalletAddress) {
        clearWalletAndRedirect("You switched to a different wallet. Please reconnect to continue.");
        return;
      }

      try {
        const response = await provider.connect({ onlyIfTrusted: true });
        const actualCurrentAccount = response?.publicKey?.toString?.();
        if (actualCurrentAccount && actualCurrentAccount !== fullWalletAddress) {
          clearWalletAndRedirect("You switched to a different wallet. Please reconnect to continue.");
        }
      } catch {
        clearWalletAndRedirect("Your wallet connection was lost. Please reconnect.");
      }
    };

    checkWalletState();
    const interval = setInterval(checkWalletState, 2000);
    return () => clearInterval(interval);
  }, [isConnected, walletType, activeChain, fullWalletAddress, initialReconnectComplete, clearWalletAndRedirect]);

  // ============================================================
  // Fetch balance when wallet is connected
  // ============================================================
  useEffect(() => {
    if (!isConnected || !fullWalletAddress) {
      setEncryptedBalance("0");
      return;
    }

    const fetchBalance = async () => {
      setIsBalanceLoading(true);
      try {
        let usdcBalance = 0;
        try {
          const usdcResult = await getZKBalance(fullWalletAddress, 'USDC');
          if (usdcResult && typeof usdcResult.balance === 'number') {
            usdcBalance = usdcResult.balance;
          }
        } catch (e) {
          console.log("[WalletContext] USDC balance fetch failed, using 0");
        }

        let usdtBalance = 0;
        try {
          const usdtResult = await getZKBalance(fullWalletAddress, 'USDT');
          if (usdtResult && typeof usdtResult.balance === 'number') {
            usdtBalance = usdtResult.balance;
          }
        } catch (e) {
          console.log("[WalletContext] USDT balance fetch failed, using 0");
        }

        const totalBalance = usdcBalance + usdtBalance;
        setEncryptedBalance(totalBalance.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }));
      } catch (error) {
        console.error("[WalletContext] Error fetching balance:", error);
        setEncryptedBalance("0");
      } finally {
        setIsBalanceLoading(false);
      }
    };

    const timer = setTimeout(fetchBalance, 300);
    return () => clearTimeout(timer);
  }, [isConnected, fullWalletAddress]);

  // ============================================================
  // Connect wallet
  // ============================================================
  const connect = useCallback(async (type: WalletType) => {
    setIsConnecting(true);
    hasHandledDisconnect.current = false;

    try {
      let walletAddress: string | null = null;
      let chain: ActiveChain = "base"; // Default to Base

      if (type === "phantom") {
        // Try EVM (Base) first — this is the primary flow
        const evmProvider = getPhantomEVMProvider();

        if (evmProvider) {
          try {
            const accounts: string[] = await evmProvider.request({ method: 'eth_requestAccounts' });
            if (accounts.length > 0) {
              walletAddress = accounts[0];
              chain = "base";
              console.log("[WalletContext] Phantom EVM connected:", walletAddress);

              // Ensure we're on Base chain
              await ensureBaseChain(evmProvider);
            }
          } catch (err: any) {
            console.error("[WalletContext] Phantom EVM connection error:", err);
            if (err.code === 4001 || err.message?.includes("rejected")) {
              setIsConnecting(false);
              return;
            }
            throw err;
          }
        } else {
          // Phantom not installed
          window.open("https://phantom.app/", "_blank");
          setIsConnecting(false);
          return;
        }
      } else if (type === "metamask") {
        // MetaMask EVM — same EIP-1193 flow as Phantom
        const metaMaskProvider = getMetaMaskProvider();

        if (metaMaskProvider) {
          try {
            const accounts: string[] = await metaMaskProvider.request({ method: 'eth_requestAccounts' });
            if (accounts.length > 0) {
              walletAddress = accounts[0];
              chain = "base";
              console.log("[WalletContext] MetaMask connected:", walletAddress);

              // Ensure we're on Base chain
              await ensureBaseChain(metaMaskProvider);
            }
          } catch (err: any) {
            console.error("[WalletContext] MetaMask connection error:", err);
            if (err.code === 4001 || err.message?.includes("rejected")) {
              setIsConnecting(false);
              return;
            }
            throw err;
          }
        } else {
          window.open("https://metamask.io/download/", "_blank");
          setIsConnecting(false);
          return;
        }
      }

      if (walletAddress && type) {
        const formattedAddress = formatAddress(walletAddress);
        setWalletType(type);
        setActiveChain(chain);
        setWalletAddress(formattedAddress);
        setFullWalletAddress(walletAddress);
        setIsConnected(true);
        setNetworkStatus("connected");

        localStorage.setItem("baseusdp_wallet", JSON.stringify({
          type,
          chain,
          address: formattedAddress,
          fullAddress: walletAddress,
        }));

        // Auto-authenticate after connecting
        try {
          const adapter = buildWalletAdapter(chain, walletAddress, type);
          const result = await authService.authenticate(adapter);
          if (result.success) {
            setIsAuthenticated(true);
            console.log("[WalletContext] Auto-authenticated after connect");
          } else {
            console.warn("[WalletContext] Auto-auth failed:", result.error);
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
  }, [ensureBaseChain, buildWalletAdapter]);

  // ============================================================
  // Disconnect wallet
  // ============================================================
  const disconnect = useCallback(async () => {
    try {
      if (activeChain === "base") {
        // EVM doesn't have a standard disconnect — just clear state
        console.log("[WalletContext] Disconnecting from Base");
      } else if (walletType === "phantom") {
        const phantom = getPhantomSolanaProvider();
        if (phantom) await phantom.disconnect();
      }
    } catch (err) {
      console.error("Disconnect error:", err);
    }
    await clearWalletAndRedirect("You have been disconnected.");
  }, [walletType, activeChain, clearWalletAndRedirect]);

  // ============================================================
  // Authenticate with wallet signature
  // ============================================================
  const authenticate = useCallback(async (): Promise<boolean> => {
    if (!isConnected) {
      setAuthError("Wallet not connected");
      return false;
    }

    setIsAuthenticating(true);
    setAuthError(null);

    try {
      const adapter = buildWalletAdapter(activeChain, fullWalletAddress, walletType);
      const result = await authService.authenticate(adapter);

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
  }, [isConnected, activeChain, fullWalletAddress, buildWalletAdapter]);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  // ============================================================
  // Switch network (Base chain switching)
  // ============================================================
  const switchNetwork = useCallback(async () => {
    if (activeChain === "base") {
      const evmProvider = walletType === "metamask" ? getMetaMaskProvider() : getPhantomEVMProvider();
      if (evmProvider) {
        await ensureBaseChain(evmProvider);
      }
    } else {
      // Solana doesn't have network switching
      await new Promise(resolve => setTimeout(resolve, 500));
      setNetworkStatus("connected");
    }
  }, [activeChain, walletType, ensureBaseChain]);

  // ============================================================
  // Refresh balance
  // ============================================================
  const refreshBalance = useCallback(async () => {
    if (!isConnected || !fullWalletAddress) {
      setEncryptedBalance("0");
      return;
    }

    setIsBalanceLoading(true);
    try {
      let usdcBalance = 0;
      try {
        const usdcResult = await getZKBalance(fullWalletAddress, 'USDC');
        if (usdcResult && typeof usdcResult.balance === 'number') {
          usdcBalance = usdcResult.balance;
        }
      } catch (e) {
        console.log("[WalletContext] USDC balance fetch failed, using 0");
      }

      let usdtBalance = 0;
      try {
        const usdtResult = await getZKBalance(fullWalletAddress, 'USDT');
        if (usdtResult && typeof usdtResult.balance === 'number') {
          usdtBalance = usdtResult.balance;
        }
      } catch (e) {
        console.log("[WalletContext] USDT balance fetch failed, using 0");
      }

      const totalBalance = usdcBalance + usdtBalance;
      setEncryptedBalance(totalBalance.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }));
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
        activeChain,
        isConnecting,
        networkStatus,
        chainId,
        privacyLevel,
        encryptedBalance,
        isBalanceLoading,
        isAuthenticated,
        isAuthenticating,
        authError,
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
