import { motion, AnimatePresence } from "framer-motion";
import { Wallet, Loader2, ArrowLeft, Shield, Sparkles } from "lucide-react";
import { useState } from "react";
import { useWallet, WalletType } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";

// Official Phantom logo
const PhantomLogo = () => (
  <svg width="28" height="28" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="64" cy="64" r="64" fill="url(#phantom-gradient)" />
    <path d="M110.584 64.9142H99.142C99.142 41.7651 80.173 23 56.7724 23C33.6612 23 14.8716 41.3057 14.4118 64.0452C13.9361 87.5724 35.3331 108 59.0296 108H62.2325C82.9503 108 110.584 89.1451 110.584 64.9142ZM40.4578 67.3909C40.4578 71.0469 37.4903 74.0095 33.8285 74.0095C30.1667 74.0095 27.1992 71.0469 27.1992 67.3909V57.6052C27.1992 53.9493 30.1667 50.9866 33.8285 50.9866C37.4903 50.9866 40.4578 53.9493 40.4578 57.6052V67.3909ZM63.8SEF3 67.3909C63.8593 71.0469 60.8918 74.0095 57.23 74.0095C53.5682 74.0095 50.6007 71.0469 50.6007 67.3909V57.6052C50.6007 53.9493 53.5682 50.9866 57.23 50.9866C60.8918 50.9866 63.8593 53.9493 63.8593 57.6052V67.3909Z" fill="white"/>
    <defs>
      <linearGradient id="phantom-gradient" x1="0" y1="0" x2="128" y2="128" gradientUnits="userSpaceOnUse">
        <stop stopColor="#534BB1"/>
        <stop offset="1" stopColor="#551BF9"/>
      </linearGradient>
    </defs>
  </svg>
);

// Official Solflare logo
const SolflareLogo = () => (
  <svg width="28" height="28" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="50" fill="url(#solflare-gradient)" />
    <path d="M72.5 35L50 25L27.5 35L50 45L72.5 35Z" fill="white"/>
    <path d="M27.5 35V55L50 65V45L27.5 35Z" fill="white" fillOpacity="0.8"/>
    <path d="M72.5 35V55L50 65V45L72.5 35Z" fill="white" fillOpacity="0.6"/>
    <path d="M50 70L27.5 60V55L50 65L72.5 55V60L50 70Z" fill="white" fillOpacity="0.9"/>
    <path d="M50 78L27.5 68V63L50 73L72.5 63V68L50 78Z" fill="white" fillOpacity="0.7"/>
    <defs>
      <linearGradient id="solflare-gradient" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FC9965"/>
        <stop offset="1" stopColor="#FE7B01"/>
      </linearGradient>
    </defs>
  </svg>
);

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
            <div className="relative rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-xl p-12 text-center overflow-hidden">
              {/* Background glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
              
              <div className="relative">
                <div className="relative mx-auto mb-8 w-24 h-24">
                  <motion.div 
                    className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center border border-primary/40 shadow-2xl"
                    animate={{ rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <Wallet className="w-12 h-12 text-primary" />
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
                  Connect your Solana wallet to access the Void402 Terminal. 
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
            className="relative max-w-md w-full"
          >
            {/* Premium card with animated border */}
            <div className="absolute -inset-[1px] bg-gradient-to-r from-primary via-accent to-primary rounded-3xl opacity-30" />
            <div className="relative rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-xl p-8 overflow-hidden">
              {/* Background glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-primary/15 rounded-full blur-[80px] pointer-events-none" />
              
              <button
                onClick={() => setShowWalletSelect(false)}
                className="absolute top-6 left-6 p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-white/50 hover:text-white"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              
              <div className="relative text-center mb-8 pt-4">
                <div className="relative mx-auto mb-4 w-16 h-16">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/25 to-accent/25 flex items-center justify-center border border-primary/30">
                    <Wallet className="w-8 h-8 text-primary" />
                  </div>
                </div>
                
                <h2 className="font-display text-2xl font-bold mb-2 text-white">
                  Select Wallet
                </h2>
                <p className="text-sm text-white/40">
                  Choose a wallet to connect to Void402
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
                    <PhantomLogo />
                    <div className="absolute inset-0 rounded-full bg-purple-500/30 blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="text-left flex-1">
                    <span className="font-semibold text-white text-lg">Phantom</span>
                    <p className="text-xs text-white/40">Most popular Solana wallet</p>
                  </div>
                  {connectingWallet === "phantom" ? (
                    <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
                  ) : (
                    <div className="px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30">
                      <span className="text-xs font-medium text-purple-400">Recommended</span>
                    </div>
                  )}
                </motion.button>

                {/* Solflare */}
                <motion.button
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleConnect("solflare")}
                  disabled={isConnecting}
                  className="w-full flex items-center gap-4 px-6 py-5 rounded-2xl border border-white/10 bg-gradient-to-r from-white/[0.06] to-white/[0.02] hover:from-orange-500/20 hover:to-orange-500/10 hover:border-orange-500/40 transition-all disabled:opacity-50 group shadow-lg"
                >
                  <div className="relative">
                    <SolflareLogo />
                    <div className="absolute inset-0 rounded-full bg-orange-500/30 blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="text-left flex-1">
                    <span className="font-semibold text-white text-lg">Solflare</span>
                    <p className="text-xs text-white/40">Secure Solana wallet</p>
                  </div>
                  {connectingWallet === "solflare" && (
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
    </div>
  );
};

export default WalletConnectPrompt;
