import { motion, AnimatePresence } from "framer-motion";
import { Wallet, ChevronDown, LogOut, Copy, CheckCircle, Loader2, AlertTriangle, AtSign, AlertCircle, Check, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useWallet, WalletType } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { getApiUrl } from "@/utils/apiConfig";
import phantomLogo from "@/assets/phantom.svg";
import metamaskLogo from "@/assets/metamask.svg";

// Phantom logo component using the actual asset
const PhantomLogo = ({ size = 20 }: { size?: number }) => (
  <img src={phantomLogo} alt="Phantom" width={size} height={size} className="rounded-md" />
);

// MetaMask logo component using the actual asset
const MetaMaskLogo = ({ size = 20 }: { size?: number }) => (
  <img src={metamaskLogo} alt="MetaMask" width={size} height={size} className="rounded-md" />
);

interface WalletConnectButtonProps {
  variant?: "navbar" | "dashboard";
}

// Username validation (same rules as UsernameCreation)
function validateUsername(value: string): { isValid: boolean; error?: string } {
  if (!value || value.length < 3) {
    return { isValid: false, error: "Username must be at least 3 characters long" };
  }
  if (value.length > 20) {
    return { isValid: false, error: "Username must be 20 characters or less" };
  }
  if (!/^[a-zA-Z0-9]/.test(value)) {
    return { isValid: false, error: "Username must start with a letter or number" };
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(value)) {
    return { isValid: false, error: "Only letters, numbers, underscores, and hyphens allowed" };
  }
  return { isValid: true };
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
  const [showSettings, setShowSettings] = useState(false);
  const [copied, setCopied] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [isValidatingUsername, setIsValidatingUsername] = useState(false);
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const apiUrl = getApiUrl();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const walletSelectRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Close main dropdown
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
      // Close wallet selection
      if (walletSelectRef.current && !walletSelectRef.current.contains(event.target as Node)) {
        setShowWalletSelect(false);
      }
    };

    if (isOpen || showWalletSelect) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, showWalletSelect]);

  // Validate new username in real-time (debounced)
  useEffect(() => {
    if (newUsername.length === 0) {
      setUsernameError(null);
      setIsValidatingUsername(false);
      return;
    }
    if (newUsername.length < 3) {
      setUsernameError("Username must be at least 3 characters long");
      setIsValidatingUsername(false);
      return;
    }
    setIsValidatingUsername(true);
    const timeoutId = setTimeout(async () => {
      const validation = validateUsername(newUsername);
      if (!validation.isValid) {
        setUsernameError(validation.error || "Invalid username");
        setIsValidatingUsername(false);
        return;
      }
      try {
        const response = await fetch(`${apiUrl}/api/user/check-username?username=${encodeURIComponent(newUsername)}`);
        const data = await response.json();
        if (data.exists && data.wallet_address !== fullWalletAddress) {
          setUsernameError("This username is already taken");
          setIsValidatingUsername(false);
          return;
        }
      } catch {
        // Continue even if check fails
      }
      setUsernameError(null);
      setIsValidatingUsername(false);
    }, 300);
    return () => {
      clearTimeout(timeoutId);
      setIsValidatingUsername(false);
    };
  }, [newUsername, fullWalletAddress, apiUrl]);

  const isUsernameFormValid = newUsername.trim().length >= 3 && !usernameError && !isValidatingUsername;

  const handleOpenSettings = () => {
    setIsOpen(false);
    setNewUsername(username || "");
    setUsernameError(null);
    setSaveSuccess(false);
    setShowSettings(true);
  };

  const handleCloseSettings = () => {
    setShowSettings(false);
    setNewUsername("");
    setUsernameError(null);
    setSaveSuccess(false);
  };

  const handleSaveUsername = async () => {
    if (!isUsernameFormValid || !isConnected || !fullWalletAddress) return;

    setIsSavingUsername(true);
    try {
      const checkResponse = await fetch(`${apiUrl}/api/user/check-username?username=${encodeURIComponent(newUsername)}`);
      const checkData = await checkResponse.json();
      if (checkData.exists && checkData.wallet_address !== fullWalletAddress) {
        setUsernameError("This username is already taken");
        setIsSavingUsername(false);
        return;
      }

      const saveResponse = await fetch(`${apiUrl}/api/user/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet_address: fullWalletAddress,
          username: newUsername.trim(),
        }),
      });
      const saveData = await saveResponse.json();
      if (!saveResponse.ok || !saveData.success) {
        throw new Error(saveData.error || "Failed to save username");
      }

      setUsername(newUsername.trim());
      setSaveSuccess(true);
      setTimeout(() => handleCloseSettings(), 1500);
    } catch (err: any) {
      setUsernameError(err.message || "Failed to save username. Please try again.");
    } finally {
      setIsSavingUsername(false);
    }
  };

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
        
        // Only show username if it's a custom one (not the default wallet address format)
        if (data.success && data.profile?.username && data.profile?.has_custom_username) {
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
      case "metamask": return <MetaMaskLogo />;
      default: return <Wallet className="w-4 h-4" />;
    }
  };

  const getWalletName = () => {
    switch (walletType) {
      case "phantom": return "Phantom";
      case "metamask": return "MetaMask";
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
      <div className="relative" ref={walletSelectRef}>
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
          className="absolute right-0 top-full mt-2 w-80 p-4 bg-card/95 border border-border rounded-2xl shadow-2xl backdrop-blur-xl z-50"
        >
          <p className="text-sm font-semibold mb-1 text-center text-foreground">Connect Wallet</p>
          <p className="text-xs text-muted-foreground text-center mb-4">
            Select a wallet to connect to USDP
          </p>

          <div className="space-y-2">
            <button
              onClick={() => handleConnect("phantom")}
              disabled={isConnecting}
              className="w-full flex items-center gap-3 px-4 py-4 rounded-xl border border-border hover:border-purple-500/50 hover:bg-purple-500/10 transition-all group"
            >
              <PhantomLogo size={24} />
              <div className="text-left flex-1">
                <span className="font-medium text-foreground">Phantom</span>
                <p className="text-xs text-muted-foreground">Most popular</p>
              </div>
              {isConnecting && (
                <Loader2 className="ml-2 h-4 w-4 animate-spin text-purple-400" />
              )}
            </button>

            <button
              onClick={() => handleConnect("metamask")}
              disabled={isConnecting}
              className="w-full flex items-center gap-3 px-4 py-4 rounded-xl border border-border hover:border-orange-500/50 hover:bg-orange-500/10 transition-all group"
            >
              <MetaMaskLogo size={24} />
              <div className="text-left flex-1">
                <span className="font-medium text-foreground">MetaMask</span>
                <p className="text-xs text-muted-foreground">Popular EVM wallet</p>
              </div>
              {isConnecting && (
                <Loader2 className="ml-2 h-4 w-4 animate-spin text-orange-400" />
              )}
            </button>
          </div>

          <p className="text-xs text-muted-foreground text-center mt-4">
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
        className={`gap-2 rounded-full border border-border ${
          variant === "navbar"
            ? "bg-foreground text-background font-semibold hover:bg-foreground/90 transition-all duration-300 shadow-md hover:shadow-lg"
            : "bg-foreground text-background font-semibold hover:bg-foreground/90 transition-all duration-300 shadow-md hover:shadow-lg px-8 py-4"
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
    <div className="relative" ref={dropdownRef}>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-3 px-4 py-2.5 bg-muted border border-border rounded-xl hover:border-foreground/30 hover:bg-accent transition-all backdrop-blur-md"
      >
        <div className="relative">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center overflow-hidden">
            {getWalletLogo()}
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-background" />
        </div>
        <div className="text-left">
          <p className="text-xs text-muted-foreground">{getWalletName()}</p>
          <p className={`text-sm font-medium text-foreground ${username ? '' : 'font-mono'}`}>{displayName}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-500 font-medium">
            Base
          </span>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 top-full mt-2 w-72 p-2 bg-card/95 border border-border rounded-xl shadow-2xl backdrop-blur-xl z-50"
          >
            {username && (
              <div className="p-3 mb-2 bg-primary/10 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Username</p>
                <p className="text-sm font-medium text-foreground">@{username}</p>
              </div>
            )}
            <div className="p-3 mb-2 bg-primary/10 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Wallet Address</p>
              <p className="text-xs font-mono break-all text-foreground">
                {fullWalletAddress || walletAddress}
              </p>
            </div>

            <div className="p-3 mb-2 bg-green-500/10 rounded-lg flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-green-500 font-medium">Connected to Base</span>
            </div>
            
            <button
              onClick={handleCopy}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left text-foreground hover:bg-primary/10 rounded-lg transition-colors"
            >
              {copied ? (
                <CheckCircle className="w-4 h-4 text-primary" />
              ) : (
                <Copy className="w-4 h-4 text-muted-foreground" />
              )}
              {copied ? "Copied!" : "Copy Address"}
            </button>

            <button
              onClick={handleOpenSettings}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left text-foreground hover:bg-primary/10 rounded-lg transition-colors"
            >
              <AtSign className="w-4 h-4 text-muted-foreground" />
              Edit Username
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

      {/* Settings Modal Overlay */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={handleCloseSettings}
            />
            {/* Modal */}
            <motion.div
              ref={settingsRef}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md mx-4 p-6 bg-card/95 border border-border rounded-2xl shadow-2xl backdrop-blur-xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-foreground">Edit Username</h2>
                <button
                  onClick={handleCloseSettings}
                  className="p-1 rounded-lg hover:bg-muted transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              {/* Username Section */}
              <div>
                <label className="block text-sm font-medium text-foreground/70 mb-2">
                  Username
                </label>
                {username && (
                  <p className="text-xs text-muted-foreground mb-2">
                    Current: <span className="text-foreground/60 font-mono">@{username}</span>
                  </p>
                )}
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <AtSign className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => {
                      setNewUsername(e.target.value.replace(/@/g, ""));
                      setUsernameError(null);
                      setSaveSuccess(false);
                    }}
                    placeholder="Enter new username"
                    className={`w-full pl-10 pr-10 py-3 rounded-xl bg-muted border transition-all text-sm ${
                      usernameError
                        ? "border-red-500/50 focus:border-red-400"
                        : isValidatingUsername
                        ? "border-yellow-500/50 focus:border-yellow-400"
                        : isUsernameFormValid
                        ? "border-purple-500/50 focus:border-purple-400"
                        : "border-border focus:border-foreground/40"
                    } text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/20`}
                    disabled={isSavingUsername}
                    maxLength={20}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {isValidatingUsername && <Loader2 className="w-4 h-4 text-yellow-500 animate-spin" />}
                    {!isValidatingUsername && usernameError && <AlertCircle className="w-4 h-4 text-red-500" />}
                    {!isValidatingUsername && !usernameError && isUsernameFormValid && <Check className="w-4 h-4 text-purple-400" />}
                  </div>
                </div>
                {usernameError && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 text-xs text-red-400 flex items-center gap-1"
                  >
                    <AlertCircle className="w-3 h-3" />
                    {usernameError}
                  </motion.p>
                )}
                {saveSuccess && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-2 text-xs text-green-400 flex items-center gap-1"
                  >
                    <CheckCircle className="w-3 h-3" />
                    Username updated successfully!
                  </motion.p>
                )}
                <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                  <p>3-20 characters, letters, numbers, underscores, hyphens</p>
                </div>
              </div>

              {/* Save Button */}
              <motion.button
                onClick={handleSaveUsername}
                disabled={!isUsernameFormValid || isSavingUsername}
                whileHover={isUsernameFormValid && !isSavingUsername ? { scale: 1.02 } : {}}
                whileTap={isUsernameFormValid && !isSavingUsername ? { scale: 0.98 } : {}}
                className={`w-full mt-6 py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                  isUsernameFormValid && !isSavingUsername
                    ? "bg-gradient-to-r from-purple-500 to-violet-600 text-white shadow-lg hover:shadow-xl cursor-pointer"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                }`}
              >
                {isSavingUsername ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Username"
                )}
              </motion.button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WalletConnectButton;
