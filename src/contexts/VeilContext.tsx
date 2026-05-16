/**
 * In-memory Veil keypair session.
 *
 * The Veil keypair is derived from a deterministic personal_sign of the
 * VEIL_SIGNED_MESSAGE by the user's wallet.  It is held in React state
 * for the lifetime of the session and never persisted to localStorage.
 *
 * Isolated from BASEUSDP pool state — does not touch WalletContext's
 * internal state, only reads its public values.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Keypair } from "@veil-cash/sdk";
import { useWallet } from "@/contexts/WalletContext";
import { personalSign, type VeilWalletType } from "@/lib/veil/provider";

interface VeilContextValue {
  /** The derived Veil keypair, or null if not yet signed-in. */
  keypair: Keypair | null;
  /** Public deposit key (hex string) — registered on-chain. */
  depositKey: string | null;
  /** True while the wallet is being prompted for the derivation signature. */
  isConnecting: boolean;
  /** Last error from connect(), if any. */
  error: string | null;
  /** Prompt the wallet to sign the derivation message and store the keypair. */
  connect: () => Promise<Keypair>;
  /** Clear the in-memory keypair (no on-chain effect). */
  disconnect: () => void;
}

const VeilContext = createContext<VeilContextValue | undefined>(undefined);

export const VeilProvider = ({ children }: { children: ReactNode }) => {
  const { fullWalletAddress, walletType, isConnected } = useWallet();
  const [keypair, setKeypair] = useState<Keypair | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Drop the keypair whenever the wallet changes or disconnects.
  useEffect(() => {
    setKeypair(null);
    setError(null);
  }, [fullWalletAddress, isConnected]);

  const connect = useCallback(async (): Promise<Keypair> => {
    if (!isConnected || !fullWalletAddress) {
      throw new Error("Connect an EVM wallet first");
    }
    setIsConnecting(true);
    setError(null);
    try {
      // Dynamic import: avoids pulling snarkjs / circomlib into the main bundle.
      const sdk = await import("@veil-cash/sdk");
      const { Keypair: KeypairClass, VEIL_SIGNED_MESSAGE } = sdk;
      const wtype: VeilWalletType =
        walletType === "metamask" || walletType === "phantom"
          ? walletType
          : null;
      const kp = await KeypairClass.fromSigner(async (message: string) => {
        // The SDK passes VEIL_SIGNED_MESSAGE; we use the wallet's personal_sign.
        return personalSign(wtype, fullWalletAddress, message);
      });
      void VEIL_SIGNED_MESSAGE; // referenced for clarity, not used directly
      setKeypair(kp);
      return kp;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [fullWalletAddress, walletType, isConnected]);

  const disconnect = useCallback(() => {
    setKeypair(null);
    setError(null);
  }, []);

  const depositKey = keypair ? keypair.depositKey() : null;

  return (
    <VeilContext.Provider
      value={{
        keypair,
        depositKey,
        isConnecting,
        error,
        connect,
        disconnect,
      }}
    >
      {children}
    </VeilContext.Provider>
  );
};

export const useVeil = (): VeilContextValue => {
  const ctx = useContext(VeilContext);
  if (!ctx) throw new Error("useVeil must be used inside <VeilProvider>");
  return ctx;
};
