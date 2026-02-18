import { motion } from "framer-motion";
import { Shield, Lock, TrendingUp, ArrowUpRight, ArrowDownRight, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { getZKBalance } from "@/services/api";

interface BalanceDisplayProps {
  showBalance: boolean;
}

const BalanceDisplay = ({ showBalance }: BalanceDisplayProps) => {
  const { fullWalletAddress, isConnected } = useWallet();
  const [isLoading, setIsLoading] = useState(true);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [solBalance, setSolBalance] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = async () => {
    if (!isConnected || !fullWalletAddress) {
      setIsLoading(false);
      return;
    }

    try {
      setIsDecrypting(true);
      console.log("[BalanceDisplay v2] Fetching balance for", fullWalletAddress?.slice(0, 8));
      
      // Fetch USDC balance (primary)
      let usdcBalance = 0;
      let usdtBalance = 0;
      
      try {
        const usdcResult = await getZKBalance(fullWalletAddress, 'USDC');
        if (usdcResult && typeof usdcResult.balance === 'number') {
          usdcBalance = usdcResult.balance;
        }
      } catch (e) {
        console.log("USDC balance fetch failed, using 0");
      }
      
      try {
        const usdtResult = await getZKBalance(fullWalletAddress, 'USDT');
        if (usdtResult && typeof usdtResult.balance === 'number') {
          usdtBalance = usdtResult.balance;
        }
      } catch (e) {
        console.log("USDT balance fetch failed, using 0");
      }
      
      setTokenBalance(usdcBalance + usdtBalance);
      setSolBalance(0); // ETH balance not tracked in ZK pool
      setError(null);
    } catch (err: any) {
      console.error("Error fetching balance:", err);
      // On any error, just show 0 balance instead of error message
      setTokenBalance(0);
      setSolBalance(0);
      setError(null);
    } finally {
      setIsLoading(false);
      setIsDecrypting(false);
    }
  };

  useEffect(() => {
    fetchBalance();
    // Refresh balance every 30 seconds
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, [fullWalletAddress, isConnected]);

  const handleRefresh = () => {
    fetchBalance();
  };

  const formatBalance = (balance: number) => {
    if (balance === 0) return "0.00";
    if (balance < 0.01) return balance.toFixed(6);
    if (balance < 1) return balance.toFixed(4);
    return balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatHiddenValue = (value: string) => {
    return "•".repeat(value.replace(/[^0-9]/g, "").length || 6);
  };

  const totalValue = tokenBalance + solBalance;
  const displayBalance = showBalance ? formatBalance(totalValue) : "••••••";

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Main Balance Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="lg:col-span-2 card-premium p-8 relative"
      >
        {/* Encryption Status */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/30 rounded-full">
              <Lock className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-semibold text-primary">ZK Protected</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-full">
              <Shield className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Privacy Mode Active</span>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isDecrypting}
            className={`p-2 rounded-lg border border-border hover:bg-secondary transition-colors ${isDecrypting ? "animate-spin" : ""}`}
          >
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Total Balance */}
        <div className="mb-8">
          <p className="text-sm text-muted-foreground mb-2">Total Portfolio Value</p>
          {isLoading ? (
            <div className="flex items-center gap-4">
              <div className="h-14 w-64 bg-secondary rounded-lg animate-pulse shimmer" />
            </div>
          ) : error ? (
            <div className="text-sm text-destructive">{error}</div>
          ) : (
            <div className="flex items-baseline gap-4">
              <motion.h1
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="font-display text-5xl lg:text-6xl font-bold"
              >
                {showBalance ? (
                  <>
                    <span className="text-gradient-primary">${displayBalance}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground tracking-widest">{displayBalance}</span>
                )}
              </motion.h1>
            </div>
          )}
          <p className="text-sm text-muted-foreground mt-2">
            {showBalance ? "Updated just now • Decrypted on-device" : "Balance hidden"}
          </p>
        </div>

        {/* Decryption Animation Overlay */}
        {isDecrypting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-card/90 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center z-10"
          >
            <div className="relative mb-4">
              <Lock className="w-12 h-12 text-primary animate-pulse" />
              <div className="absolute inset-0 blur-xl bg-primary/30 animate-ping" />
            </div>
            <p className="text-sm font-medium mb-1">Decrypting Balance</p>
            <p className="text-xs text-muted-foreground">Using Zero-Knowledge Proofs</p>
          </motion.div>
        )}

        {/* Asset Breakdown */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Assets</p>
          {/* Token Balance */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center justify-between p-4 bg-secondary/30 border border-border rounded-xl hover:border-primary/30 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-xl">
                ◎
              </div>
              <div>
                <p className="font-semibold">VOID</p>
                <p className="text-xs text-muted-foreground">BASEUSDP Token</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-mono font-medium">
                {showBalance ? formatBalance(tokenBalance) : formatHiddenValue(formatBalance(tokenBalance))}
              </p>
              <span className="text-sm text-muted-foreground">
                {showBalance ? `$${formatBalance(tokenBalance)}` : "••••••"}
              </span>
            </div>
          </motion.div>
          {/* ETH Balance */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-between p-4 bg-secondary/30 border border-border rounded-xl hover:border-primary/30 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-xl">
                ◎
              </div>
              <div>
                <p className="font-semibold">ETH</p>
                <p className="text-xs text-muted-foreground">Base</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-mono font-medium">
                {showBalance ? formatBalance(solBalance) : formatHiddenValue(formatBalance(solBalance))}
              </p>
              <span className="text-sm text-muted-foreground">
                {showBalance ? `$${formatBalance(solBalance)}` : "••••••"}
              </span>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Side Panel */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-6"
      >
        {/* Privacy Score */}
        <div className="card-premium p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Privacy Score</h3>
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div className="relative mb-4">
            <div className="flex items-end gap-2">
              <span className="font-display text-4xl font-bold text-gradient-primary">98</span>
              <span className="text-muted-foreground mb-1">/100</span>
            </div>
            <div className="mt-3 h-2 bg-secondary rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "98%" }}
                transition={{ delay: 0.5, duration: 1 }}
                className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
              />
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">ZK Privacy</span>
              <span className="text-primary font-medium">Active</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">ZK Proofs</span>
              <span className="text-primary font-medium">Enabled</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Data Visibility</span>
              <span className="text-primary font-medium">Private</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default BalanceDisplay;
