import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import { useState } from "react";

interface WalletConnectProps {
  isConnected: boolean;
  walletAddress: string;
  onConnect: () => void;
  onDisconnect: () => void;
}

const WalletConnect = ({
  isConnected,
  walletAddress,
  onConnect,
  onDisconnect,
}: WalletConnectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    // Copy the actual wallet address passed as prop
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isConnected) {
    return (
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onConnect}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-accent text-white font-semibold rounded-xl glow-primary transition-all"
      >
        <Icon icon="ph:wallet-bold" className="w-4 h-4" />
        Connect Wallet
      </motion.button>
    );
  }

  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-3 px-4 py-2.5 bg-card border border-border rounded-xl hover:border-primary/50 transition-colors"
      >
        <div className="relative">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
            <Icon icon="ph:wallet-bold" className="w-4 h-4 text-primary" />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-primary border-2 border-card" />
        </div>
        <div className="text-left">
          <p className="text-xs text-muted-foreground">Connected</p>
          <p className="text-sm font-mono font-medium">{walletAddress}</p>
        </div>
        <Icon icon="ph:caret-down-bold" className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 top-full mt-2 w-64 p-2 bg-card border border-border rounded-xl shadow-2xl z-50"
          >
            <div className="p-3 mb-2 bg-secondary/50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Wallet Address</p>
              <p className="text-xs font-mono break-all">{walletAddress}</p>
            </div>
            
            <button
              onClick={handleCopy}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left hover:bg-secondary rounded-lg transition-colors"
            >
              {copied ? (
                <Icon icon="ph:check-circle-bold" className="w-4 h-4 text-primary" />
              ) : (
                <Icon icon="ph:copy-bold" className="w-4 h-4 text-muted-foreground" />
              )}
              {copied ? "Copied!" : "Copy Address"}
            </button>
            
            <button
              onClick={() => {
                setIsOpen(false);
                onDisconnect();
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
            >
              <Icon icon="ph:sign-out-bold" className="w-4 h-4" />
              Disconnect
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WalletConnect;
