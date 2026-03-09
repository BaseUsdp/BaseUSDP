import { motion, AnimatePresence } from "framer-motion";
import { Wallet, Loader2, ArrowLeft, Shield, Sparkles } from "lucide-react";
import { useState } from "react";
import { useWallet, WalletType } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import phantomLogo from "@/assets/phantom.svg";
import metamaskLogo from "@/assets/metamask.svg";

const WalletConnectPrompt = () => {
  const { connect, isConnecting } = useWallet();
  const [showWalletSelect, setShowWalletSelect] = useState(false);
  const [connectingWallet, setConnectingWallet] = useState<WalletType>(null);

  const handleConnect = async (type: WalletType) => {
    setConnectingWallet(type);
    await connect(type);
    setConnectingWallet(null);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
      <AnimatePresence mode="wait">
        {!showWalletSelect ? (
          <motion.div
            key="welcome"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="relative max-w-lg w-full"
          >
            {/* Premium card with animated border */}
            <div className="absolute -inset-[1px] bg-gradient-to-r from-primary via-accent to-primary rounded-3xl opacity-50 blur-sm animate-pulse" />
            <div className="relative rounded-3xl border border-border bg-card backdrop-blur-xl p-12 text-center overflow-hidden shadow-xl">
              {/* Background glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />

              <div className="relative">
                <div className="relative mx-auto mb-8 w-24 h-24">
                  <motion.div
                    className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center border border-border shadow-2xl"
                    animate={{ rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <Wallet className="w-12 h-12 text-foreground" />
                  </motion.div>
                  <motion.div
                    className="absolute inset-0 rounded-2xl bg-primary/20 blur-2xl"
                    animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </div>

                <div className="flex items-center justify-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-foreground/70" />
                  <span className="text-xs font-medium text-foreground/70 uppercase tracking-wider">Secure Connection</span>
                </div>

                <h2 className="font-display text-3xl font-bold mb-4 text-foreground">
                  Connect Your Wallet
                </h2>
                <p className="text-muted-foreground mb-8 leading-relaxed">
                  Connect your wallet to access the USDP Terminal.
                  Experience encrypted balances, confidential payments, and privacy-first
                  financial tools.
                </p>

                <Button
                  onClick={() => setShowWalletSelect(true)}
                  className="gap-2 bg-foreground text-background hover:bg-foreground/90 px-10 py-5 text-base font-semibold rounded-xl shadow-lg transition-all hover:shadow-xl"
                >
                  <Shield className="h-5 w-5" />
                  Connect Wallet
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="wallet-select"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="relative max-w-md w-full"
          >
            {/* Premium card with animated border */}
            <div className="absolute -inset-[1px] bg-gradient-to-r from-primary via-accent to-primary rounded-3xl opacity-20" />
            <div className="relative rounded-3xl border border-border bg-card backdrop-blur-xl p-8 overflow-hidden shadow-xl">
              {/* Background glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-primary/10 rounded-full blur-[80px] pointer-events-none" />

              <button
                onClick={() => setShowWalletSelect(false)}
                className="absolute top-6 left-6 p-2.5 rounded-xl bg-muted border border-border hover:bg-accent transition-all text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div className="relative text-center mb-8 pt-4">
                <div className="relative mx-auto mb-4 w-16 h-16">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 flex items-center justify-center border border-border">
                    <Wallet className="w-8 h-8 text-foreground" />
                  </div>
                </div>

                <h2 className="font-display text-2xl font-bold mb-2 text-foreground">
                  Select Wallet
                </h2>
                <p className="text-sm text-muted-foreground">
                  Choose a wallet to connect to USDP
                </p>
              </div>

              <div className="space-y-3 relative">
                {/* Phantom */}
                <motion.button
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleConnect("phantom")}
                  disabled={isConnecting}
                  className="w-full flex items-center gap-4 px-6 py-5 rounded-2xl border border-border bg-muted/50 hover:bg-purple-500/10 hover:border-purple-500/40 transition-all disabled:opacity-50 group shadow-sm"
                >
                  <div className="relative">
                    <img src={phantomLogo} alt="Phantom" width={28} height={28} className="rounded-md" />
                    <div className="absolute inset-0 rounded-full bg-purple-500/30 blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="text-left flex-1">
                    <span className="font-semibold text-foreground text-lg">Phantom</span>
                    <p className="text-xs text-muted-foreground">Most popular crypto wallet</p>
                  </div>
                  {connectingWallet === "phantom" ? (
                    <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
                  ) : (
                    <div className="px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30">
                      <span className="text-xs font-medium text-purple-600">Recommended</span>
                    </div>
                  )}
                </motion.button>

                {/* MetaMask */}
                <motion.button
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleConnect("metamask")}
                  disabled={isConnecting}
                  className="w-full flex items-center gap-4 px-6 py-5 rounded-2xl border border-border bg-muted/50 hover:bg-orange-500/10 hover:border-orange-500/40 transition-all disabled:opacity-50 group shadow-sm"
                >
                  <div className="relative">
                    <img src={metamaskLogo} alt="MetaMask" width={28} height={28} className="rounded-md" />
                    <div className="absolute inset-0 rounded-full bg-orange-500/30 blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="text-left flex-1">
                    <span className="font-semibold text-foreground text-lg">MetaMask</span>
                    <p className="text-xs text-muted-foreground">Popular EVM wallet</p>
                  </div>
                  {connectingWallet === "metamask" && (
                    <Loader2 className="h-5 w-5 animate-spin text-orange-400" />
                  )}
                </motion.button>
              </div>

              <div className="mt-8 pt-6 border-t border-border">
                <p className="text-xs text-muted-foreground text-center">
                  By connecting, you agree to the Terms of Service and Privacy Policy
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WalletConnectPrompt;
