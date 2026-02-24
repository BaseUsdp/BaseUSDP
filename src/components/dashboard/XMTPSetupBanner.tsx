/**
 * XMTP Setup Banner
 * Shown when XMTP is not initialized, prompting the user to enable E2E encrypted messaging.
 */

import { motion } from "framer-motion";
import { Shield, Loader2, AlertCircle } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { useXMTP } from "@/contexts/XMTPContext";

const XMTPSetupBanner = () => {
  const { activeChain } = useWallet();
  const { isInitializing, initError, initializeXMTP } = useXMTP();

  // Solana-only wallets can't use XMTP
  if (activeChain !== "base") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 rounded-xl bg-yellow-500/5 border border-yellow-500/20 text-center"
      >
        <AlertCircle className="w-8 h-8 text-yellow-500/60 mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-white/80 mb-1">EVM Wallet Required</h3>
        <p className="text-xs text-white/40">
          Encrypted messaging requires an EVM wallet (MetaMask or Phantom on Base).
          Switch to an EVM wallet to enable messaging.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 rounded-xl bg-primary/5 border border-primary/20 text-center"
    >
      <Shield className="w-10 h-10 text-primary/60 mx-auto mb-3" />
      <h3 className="text-base font-semibold text-white mb-1">
        End-to-End Encrypted Messaging
      </h3>
      <p className="text-sm text-white/50 mb-4 max-w-md mx-auto">
        Enable decentralized messaging powered by XMTP. Your messages are encrypted
        end-to-end and stored on the XMTP network — not on any centralized server.
      </p>

      {initError && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 inline-block"
        >
          <p className="text-xs text-red-400 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {initError}
          </p>
        </motion.div>
      )}

      <button
        onClick={initializeXMTP}
        disabled={isInitializing}
        className={`px-6 py-2.5 rounded-xl font-semibold text-sm transition-all inline-flex items-center gap-2 ${
          isInitializing
            ? "bg-white/10 text-white/40 cursor-wait"
            : "bg-gradient-to-r from-purple-500 to-violet-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
        }`}
      >
        {isInitializing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Enabling Messaging...
          </>
        ) : (
          <>
            <Shield className="w-4 h-4" />
            Enable Messaging
          </>
        )}
      </button>

      <p className="text-[10px] text-white/25 mt-3">
        You'll be asked to sign 1-2 messages to create your messaging identity.
      </p>
    </motion.div>
  );
};

export default XMTPSetupBanner;
