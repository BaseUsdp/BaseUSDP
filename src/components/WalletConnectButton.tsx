import { motion, AnimatePresence } from "framer-motion";
import { Wallet, ChevronDown, LogOut, Copy, CheckCircle, Loader2, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";
import { useWallet, WalletType } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { getApiUrl } from "@/utils/apiConfig";
import phantomLogo from "@/assets/phantom.svg";
import solflareLogo from "@/assets/solflare.jpeg";

// Phantom logo component using the actual asset
const PhantomLogo = ({ size = 20 }: { size?: number }) => (
  <img src={phantomLogo} alt="Phantom" width={size} height={size} className="rounded-md" />
);

// Solflare logo component using the actual asset
const SolflareLogo = ({ size = 20 }: { size?: number }) => (
  <img src={solflareLogo} alt="Solflare" width={size} height={size} className="rounded-md" />
);

interface WalletConnectButtonProps {
  variant?: "navbar" | "dashboard";
}

const WalletConnectButton = ({ variant = "navbar" }: WalletConnectButtonProps) => {
  const { 
    isConnected, 
    walletAddress,
    fullWalletAddress,
    walletType, 
    isConnecting, 
    networkStatus,
    connect, 
    disconnect,
    switchNetwork 
  } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [showWalletSelect, setShowWalletSelect] = useState(false);
  const [copied, setCopied] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const apiUrl = getApiUrl();

  // Fetch username when wallet is connected
  useEffect(() => {
    const fetchUsername = async () => {
      if (!isConnected || !fullWalletAddress) {
        setUsername(null);
        return;
      }

      try {
        const response = await fetch(`${apiUrl}/api/user/profile?wallet=${encodeURIComponent(fullWalletAddress)}`);
        const data = await response.json();
        
        if (data.success && data.profile?.username) {
          setUsername(data.profile.username);
        } else {
          setUsername(null);
        }
      } catch (err) {
        console.log("Could not fetch username:", err);
        setUsername(null);
      }
    };

    fetchUsername();
  }, [isConnected, fullWalletAddress, apiUrl]);

  // Display name - username or truncated wallet address
  const displayName = username ? `@${username}` : walletAddress;

  const handleCopy = () => {
    navigator.clipboard.writeText(fullWalletAddress || walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConnect = async (type: WalletType) => {
    await connect(type);
    setShowWalletSelect(false);
  };

  const getWalletLogo = () => {
    switch (walletType) {
      case "phantom": return <PhantomLogo />;
      case "solflare": return <SolflareLogo />;
      default: return <Wallet className="w-4 h-4" />;
    }
  };

  const getWalletName = () => {
    switch (walletType) {
      case "phantom": return "Phantom";
      case "solflare": return "Solflare";
      default: return "Wallet";
    }
  };

  // Network mismatch warning
  if (isConnected && networkStatus === "wrong_network") {
    return (
      <Button
        onClick={switchNetwork}
        variant="destructive"
        className="gap-2"
      >
        <AlertTriangle className="w-4 h-4" />
        Wrong Network
      </Button>
    );
  }

  // Wallet selection modal
  if (showWalletSelect) {
    return (
      <div className="relative">
        <Button
          variant="outline"
          className="gap-2 border-primary/30 bg-primary/10 backdrop-blur-md hover:bg-primary/20"
          onClick={() => setShowWalletSelect(false)}
        >
          <Wallet className="h-4 w-4" />
          Cancel
        </Button>
        
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="absolute right-0 top-full mt-2 w-80 p-4 bg-[#0a0a0a]/95 border border-primary/20 rounded-2xl shadow-2xl backdrop-blur-xl z-50"
        >
          <p className="text-sm font-semibold mb-1 text-center text-white">Connect Wallet</p>
          <p className="text-xs text-white/50 text-center mb-4">
            Select a wallet to connect to Void402
          </p>
          
          <div className="space-y-2">
            <button
              onClick={() => handleConnect("phantom")}
              disabled={isConnecting}
              className="w-full flex items-center gap-3 px-4 py-4 rounded-xl border border-white/10 hover:border-purple-500/50 hover:bg-purple-500/10 transition-all group"
            >
              <PhantomLogo size={24} />
              <div className="text-left flex-1">
                <span className="font-medium text-white">Phantom</span>
                <p className="text-xs text-white/40">Most popular</p>
              </div>
              {isConnecting && (
                <Loader2 className="ml-2 h-4 w-4 animate-spin text-purple-400" />
              )}
            </button>
            
            <button
              onClick={() => handleConnect("solflare")}
              disabled={isConnecting}
              className="w-full flex items-center gap-3 px-4 py-4 rounded-xl border border-white/10 hover:border-orange-500/50 hover:bg-orange-500/10 transition-all group"
            >
              <SolflareLogo size={24} />
              <div className="text-left flex-1">
                <span className="font-medium text-white">Solflare</span>
                <p className="text-xs text-white/40">Secure wallet</p>
              </div>
              {isConnecting && (
                <Loader2 className="ml-2 h-4 w-4 animate-spin text-orange-400" />
              )}
            </button>
          </div>
          
          <p className="text-xs text-white/40 text-center mt-4">
            By connecting, you agree to the Terms of Service
          </p>
        </motion.div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <Button
        onClick={() => setShowWalletSelect(true)}
        disabled={isConnecting}
        className={`gap-2 ${
          variant === "navbar"
            ? "bg-primary/20 text-white border border-primary/40 backdrop-blur-md hover:bg-primary/30 shadow-[0_0_20px_-5px_hsl(262_83%_58%_/_0.4)] transition-all hover:shadow-[0_0_30px_-5px_hsl(262_83%_58%_/_0.6)]"
            : "bg-primary/20 text-white border border-primary/40 backdrop-blur-md hover:bg-primary/30 shadow-[0_0_25px_-5px_hsl(262_83%_58%_/_0.4)] px-8 py-4"
        }`}
      >
        {isConnecting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Wallet className="h-4 w-4" />
        )}
        Connect Wallet
      </Button>
    );
  }

  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-3 px-4 py-2.5 bg-primary/10 border border-primary/30 rounded-xl hover:border-primary/50 hover:bg-primary/20 transition-all backdrop-blur-md"
      >
        <div className="relative">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center overflow-hidden">
            {getWalletLogo()}
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-[#0a0a0a]" />
        </div>
        <div className="text-left">
          <p className="text-xs text-white/50">{getWalletName()}</p>
          <p className={`text-sm font-medium text-white ${username ? '' : 'font-mono'}`}>{displayName}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-500 font-medium">
            Solana
          </span>
          <ChevronDown className={`w-4 h-4 text-white/50 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 top-full mt-2 w-72 p-2 bg-[#0a0a0a]/95 border border-primary/20 rounded-xl shadow-2xl backdrop-blur-xl z-50"
          >
            {username && (
              <div className="p-3 mb-2 bg-primary/10 rounded-lg">
                <p className="text-xs text-white/50 mb-1">Username</p>
                <p className="text-sm font-medium text-white">@{username}</p>
              </div>
            )}
            <div className="p-3 mb-2 bg-primary/10 rounded-lg">
              <p className="text-xs text-white/50 mb-1">Wallet Address</p>
              <p className="text-xs font-mono break-all text-white">
                {fullWalletAddress || walletAddress}
              </p>
            </div>

            <div className="p-3 mb-2 bg-green-500/10 rounded-lg flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-green-500 font-medium">Connected to Solana</span>
            </div>
            
            <button
              onClick={handleCopy}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left text-white hover:bg-primary/10 rounded-lg transition-colors"
            >
              {copied ? (
                <CheckCircle className="w-4 h-4 text-primary" />
              ) : (
                <Copy className="w-4 h-4 text-white/50" />
              )}
              {copied ? "Copied!" : "Copy Address"}
            </button>
            
            <button
              onClick={() => {
                setIsOpen(false);
                disconnect();
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Disconnect
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WalletConnectButton;
