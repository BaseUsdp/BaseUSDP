import { motion, AnimatePresence } from "framer-motion";
import { Wallet, Loader2, ArrowLeft, X, Shield, Sparkles } from "lucide-react";
import { useState } from "react";
import { useWallet, WalletType } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import phantomLogo from "@/assets/phantom.svg";
import metamaskLogo from "@/assets/metamask.svg";

interface WalletConnectOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const WalletConnectOverlay = ({ isOpen, onClose }: WalletConnectOverlayProps) => {
  const { connect, isConnecting } = useWallet();
  const [showWalletSelect, setShowWalletSelect] = useState(false);
  const [connectingWallet, setConnectingWallet] = useState<WalletType>(null);

  const handleConnect = async (type: WalletType) => {
    setConnectingWallet(type);
    await connect(type);
    setConnectingWallet(null);
    onClose();
  };

  const handleBack = () => {
    if (showWalletSelect) {
      setShowWalletSelect(false);
    } else {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
        >
          {/* Blurred backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-xl"
            onClick={onClose}
          />
          
          {/* Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="relative z-10"
          >
            <AnimatePresence mode="wait">
              {!showWalletSelect ? (
                <motion.div
                  key="welcome"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, y: -20 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="relative max-w-lg w-full mx-4"
                >
                  {/* Premium card with animated border */}
                  <div className="absolute -inset-[1px] bg-gradient-to-r from-primary via-accent to-primary rounded-3xl opacity-50 blur-sm animate-pulse" />
                  <div className="relative rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-xl p-12 text-center overflow-hidden">
                    {/* Back/Close button */}
                    <button
                      onClick={onClose}
                      className="absolute top-6 right-6 p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-white/50 hover:text-white"
                    >
                      <X className="w-5 h-5" />
                    </button>
                    
                    {/* Background glow */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
                    
                    <div className="relative">
                      <div className="relative mx-auto mb-8 w-24 h-24">
                        <motion.div 
                          className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center border border-white/20 shadow-2xl"
                          animate={{ rotate: [0, 5, -5, 0] }}
                          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        >
                          <Wallet className="w-12 h-12 text-white" />
                        </motion.div>
                        <motion.div 
                          className="absolute inset-0 rounded-2xl bg-primary/40 blur-2xl"
                          animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.1, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                      </div>
                      
                      <div className="flex items-center justify-center gap-2 mb-4">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span className="text-xs font-medium text-primary uppercase tracking-wider">Secure Connection</span>
                      </div>
                      
                      <h2 className="font-display text-3xl font-bold mb-4 text-white">
                        Connect Your Wallet
                      </h2>
                      <p className="text-white/50 mb-8 leading-relaxed">
                        Connect your wallet to access the BASEUSDP Terminal. 
                        Experience encrypted balances, confidential payments, and privacy-first 
                        financial tools.
                      </p>
                      
                      <Button
                        onClick={() => setShowWalletSelect(true)}
                        className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90 px-10 py-5 text-base font-semibold rounded-xl shadow-[0_0_40px_-10px_hsl(262_83%_58%_/_0.6)] transition-all hover:shadow-[0_0_50px_-10px_hsl(262_83%_58%_/_0.8)]"
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
                  className="relative max-w-md w-full mx-4"
                >
                  {/* Premium card with animated border */}
                  <div className="absolute -inset-[1px] bg-gradient-to-r from-primary via-accent to-primary rounded-3xl opacity-30" />
                  <div className="relative rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-xl p-8 overflow-hidden">
                    {/* Background glow */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-primary/15 rounded-full blur-[80px] pointer-events-none" />
                    
                    {/* Back button */}
                    <button
                      onClick={handleBack}
                      className="absolute top-6 left-6 p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-white/50 hover:text-white flex items-center gap-2"
                    >
                      <ArrowLeft className="w-5 h-5" />
                      <span className="text-sm">Back</span>
                    </button>
                    
                    <div className="relative text-center mb-8 pt-4">
                      <div className="relative mx-auto mb-4 w-16 h-16">
                        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/25 to-accent/25 flex items-center justify-center border border-white/20">
                          <Wallet className="w-8 h-8 text-white" />
                        </div>
                      </div>
                      
                      <h2 className="font-display text-2xl font-bold mb-2 text-white">
                        Select Wallet
                      </h2>
                      <p className="text-sm text-white/40">
                        Choose a wallet to connect to BASEUSDP
                      </p>
                    </div>

                    <div className="space-y-3 relative">
                      {/* Phantom */}
                      <motion.button
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleConnect("phantom")}
                        disabled={isConnecting}
                        className="w-full flex items-center gap-4 px-6 py-5 rounded-2xl border border-white/10 bg-gradient-to-r from-white/[0.06] to-white/[0.02] hover:from-purple-500/20 hover:to-purple-500/10 hover:border-purple-500/40 transition-all disabled:opacity-50 group shadow-lg"
                      >
                        <div className="relative">
                          <img src={phantomLogo} alt="Phantom" width={28} height={28} className="rounded-md" />
                          <div className="absolute inset-0 rounded-full bg-purple-500/30 blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="text-left flex-1">
                          <span className="font-semibold text-white text-lg">Phantom</span>
                          <p className="text-xs text-white/40">Most popular crypto wallet</p>
                        </div>
                        {connectingWallet === "phantom" ? (
                          <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
                        ) : (
                          <div className="px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30">
                            <span className="text-xs font-medium text-purple-400">Recommended</span>
                          </div>
                        )}
                      </motion.button>

                      {/* MetaMask */}
                      <motion.button
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleConnect("metamask")}
                        disabled={isConnecting}
                        className="w-full flex items-center gap-4 px-6 py-5 rounded-2xl border border-white/10 bg-gradient-to-r from-white/[0.06] to-white/[0.02] hover:from-orange-500/20 hover:to-orange-500/10 hover:border-orange-500/40 transition-all disabled:opacity-50 group shadow-lg"
                      >
                        <div className="relative">
                          <img src={metamaskLogo} alt="MetaMask" width={28} height={28} className="rounded-md" />
                          <div className="absolute inset-0 rounded-full bg-orange-500/30 blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="text-left flex-1">
                          <span className="font-semibold text-white text-lg">MetaMask</span>
                          <p className="text-xs text-white/40">Popular EVM wallet</p>
                        </div>
                        {connectingWallet === "metamask" && (
                          <Loader2 className="h-5 w-5 animate-spin text-orange-400" />
                        )}
                      </motion.button>
                    </div>

                    <div className="mt-8 pt-6 border-t border-white/5">
                      <p className="text-xs text-white/30 text-center">
                        By connecting, you agree to the Terms of Service and Privacy Policy
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WalletConnectOverlay;
