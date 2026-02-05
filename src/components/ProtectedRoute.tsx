/**
 * Protected Route Component
 * Ensures user is authenticated before showing content
 * 
 * Features:
 * - Checks wallet connection
 * - Checks authentication status
 * - Shows loading state during auth check
 * - Redirects to wallet connect if not authenticated
 */

import { ReactNode, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { useWallet } from "@/contexts/WalletContext";
import { authService } from "@/services/authService";
import WalletConnectPrompt from "@/components/dashboard/WalletConnectPrompt";
import UsernameCreation from "@/components/dashboard/UsernameCreation";
import dashboardPreviewBg from "@/assets/dashboard-preview.png";
import { Button } from "@/components/ui/button";
import { getApiUrl } from "@/utils/apiConfig";

interface ProtectedRouteProps {
  children: ReactNode;
  requireAuth?: boolean; // If false, only wallet connection required
}

type AuthState = "loading" | "connected" | "authenticating" | "authenticated" | "needs_username" | "unauthenticated";

// Delay before showing unauthenticated state (allows wallet to auto-reconnect)
const WALLET_RECONNECT_GRACE_PERIOD = 1500;

const ProtectedRoute = ({ children, requireAuth = true }: ProtectedRouteProps) => {
  const { isConnected, isConnecting, fullWalletAddress } = useWallet();
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [authError, setAuthError] = useState<string | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const apiUrl = getApiUrl();

  // Check for custom username
  const checkUsername = async (walletAddress: string) => {
    try {
      const response = await fetch(`${apiUrl}/api/user/profile?wallet=${walletAddress}`);
      const data = await response.json();
      if (data.success && data.profile) {
        return data.profile.has_custom_username === true;
      }
      return false;
    } catch {
      // If check fails, allow through (don't block on error)
      return true;
    }
  };

  // Grace period for wallet auto-reconnect on page refresh
  useEffect(() => {
    const timer = setTimeout(() => {
      setInitialLoadComplete(true);
    }, WALLET_RECONNECT_GRACE_PERIOD);
    
    return () => clearTimeout(timer);
  }, []);

  // Check authentication status when wallet connects
  useEffect(() => {
    const checkAuth = async () => {
      // Still connecting wallet
      if (isConnecting) {
        setAuthState("loading");
        return;
      }

      // Not connected - but wait for grace period before showing unauth
      if (!isConnected) {
        // If we have a stored session token, keep loading during grace period
        if (authService.isAuthenticated() && !initialLoadComplete) {
          setAuthState("loading");
          return;
        }
        setAuthState("unauthenticated");
        return;
      }

      // Connected but auth not required
      if (!requireAuth) {
        setAuthState("connected");
        return;
      }

      // Check if already authenticated
      if (authService.isAuthenticated()) {
        // Check if user has a custom username
        const hasUsername = await checkUsername(fullWalletAddress);
        if (!hasUsername) {
          setAuthState("needs_username");
        } else {
          setAuthState("authenticated");
        }
        return;
      }

      // Need to authenticate
      setAuthState("connected");
    };

    checkAuth();
  }, [isConnected, isConnecting, requireAuth, fullWalletAddress, initialLoadComplete]);

  // Handle authentication
  const handleAuthenticate = async () => {
    setAuthState("authenticating");
    setAuthError(null);

    try {
      // Get the wallet adapter — supports Phantom (Solana + EVM) and MetaMask (EVM)
      const phantomSolana = (window as any).phantom?.solana || (window as any).solana;
      const phantomEVM = (window as any).phantom?.ethereum;
      const metaMask = (window as any).ethereum?.isMetaMask && !(window as any).ethereum?.isPhantom ? (window as any).ethereum : null;

      // For EVM wallets (Base chain), use EVM signing
      const evmProvider = phantomEVM?.isPhantom ? phantomEVM : metaMask;
      const solanaWallet = phantomSolana?.isPhantom ? phantomSolana : null;

      if (!evmProvider && !solanaWallet) {
        throw new Error("No wallet found. Please connect your wallet first.");
      }

      // Create a wallet adapter compatible object
      const walletAdapter = {
        publicKey: solanaWallet?.publicKey ? { toBase58: () => solanaWallet.publicKey.toString() } : null,
        address: fullWalletAddress,
        chain: evmProvider ? "base" as const : "solana" as const,
        signMessage: async (message: Uint8Array) => {
          if (solanaWallet?.isPhantom && solanaWallet.signMessage) {
            const { signature } = await solanaWallet.signMessage(message, "utf8");
            return signature;
          }
          throw new Error("Wallet does not support Solana message signing");
        },
        signEVMMessage: evmProvider ? async (message: string): Promise<string> => {
          const accounts = await evmProvider.request({ method: 'eth_accounts' });
          return await evmProvider.request({
            method: 'personal_sign',
            params: [message, accounts[0]],
          });
        } : undefined,
        connected: true,
      };

      const result = await authService.authenticate(walletAdapter);

      if (result.success) {
        // Check if user has a custom username
        const hasUsername = await checkUsername(fullWalletAddress);
        if (!hasUsername) {
          setAuthState("needs_username");
        } else {
          setAuthState("authenticated");
        }
      } else {
        const errMsg = result.error;
        setAuthError(
          typeof errMsg === "string" ? errMsg : errMsg ? String(errMsg) : "Authentication failed"
        );
        setAuthState("connected");
      }
    } catch (error) {
      console.error("Auth error:", error);
      const errMsg = error instanceof Error ? error.message : error;
      setAuthError(typeof errMsg === "string" ? errMsg : "Authentication failed");
      setAuthState("connected");
    }
  };

  // Handle username creation complete
  const handleUsernameComplete = () => {
    setAuthState("authenticated");
  };

  // Handle back from username creation
  const handleUsernameBack = () => {
    window.location.href = "/";
  };

  // Loading state
  if (authState === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <Icon icon="ph:spinner" className="w-8 h-8 text-sky-400 animate-spin" />
          <p className="text-neutral-400">Loading...</p>
        </motion.div>
      </div>
    );
  }

  // Not connected - show wallet connect prompt
  if (!isConnected) {
    return (
      <div className="relative min-h-screen bg-background flex items-center justify-center p-6 overflow-hidden">
        {/* Blurred dashboard background */}
        <div
          className="absolute inset-0 bg-cover bg-center blur-md scale-105 opacity-30"
          style={{ backgroundImage: `url(${dashboardPreviewBg})` }}
        />
        <div className="absolute inset-0 bg-background/60" />
        <div className="relative z-10">
          <WalletConnectPrompt />
        </div>
      </div>
    );
  }

  // Needs username creation
  if (authState === "needs_username") {
    return <UsernameCreation onComplete={handleUsernameComplete} onBack={handleUsernameBack} />;
  }

  // Connected but not authenticated (and auth required)
  if (requireAuth && authState !== "authenticated") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full"
        >
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-xl p-8 text-center">
            {/* Icon */}
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-sky-500/20 to-purple-500/20 flex items-center justify-center">
              <Icon icon="ph:shield-check-bold" className="w-8 h-8 text-sky-400" />
            </div>

            {/* Title */}
            <h2 className="text-2xl font-semibold mb-2">Authentication Required</h2>
            <p className="text-neutral-400 mb-6">
              Sign a message to verify your wallet ownership and access the dashboard.
            </p>

            {/* Wallet Info */}
            <div className="bg-white/5 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-center gap-2">
                <Icon icon="ph:wallet-bold" className="w-5 h-5 text-sky-400" />
                <span className="text-neutral-300 font-mono text-sm">
                  {fullWalletAddress.slice(0, 8)}...{fullWalletAddress.slice(-8)}
                </span>
              </div>
            </div>

            {/* Error Message */}
            {authError && typeof authError === "string" && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20"
              >
                <p className="text-sm text-red-400">{authError}</p>
              </motion.div>
            )}

            {/* Auth Button */}
            <Button
              onClick={handleAuthenticate}
              disabled={authState === "authenticating"}
              className="w-full bg-gradient-to-r from-sky-600 to-purple-600 hover:from-sky-500 hover:to-purple-500 text-white py-6"
            >
              {authState === "authenticating" ? (
                <>
                  <Icon icon="ph:spinner" className="w-5 h-5 mr-2 animate-spin" />
                  Signing...
                </>
              ) : (
                <>
                  <Icon icon="ph:pen-bold" className="w-5 h-5 mr-2" />
                  Sign to Authenticate
                </>
              )}
            </Button>

            {/* Info */}
            <p className="text-xs text-neutral-500 mt-4">
              This signature does not cost any gas fees.
              It only proves you own this wallet.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  // Authenticated - render children
  return <>{children}</>;
};

export default ProtectedRoute;

