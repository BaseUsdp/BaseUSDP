import { motion } from "framer-motion";
import { Lock, RefreshCw, Eye, EyeOff, Shield, TrendingUp, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import PrivacyLevelSelector from "./PrivacyLevelSelector";
import { cn } from "@/lib/utils";
import { getTransactionHistory } from "@/services/api";
import DepositModal from "./DepositModal";

interface EncryptedBalanceCardProps {
  showBalance: boolean;
  onToggleBalance: () => void;
}

const DepositButton = () => {
  const [depositOpen, setDepositOpen] = useState(false);
  
  return (
    <>
      <Button 
        className="flex-1 bg-primary hover:bg-primary/90 h-12"
        onClick={() => setDepositOpen(true)}
      >
        <ArrowUpRight className="w-4 h-4 mr-2" />
        Deposit
      </Button>
      <DepositModal open={depositOpen} onOpenChange={setDepositOpen} />
    </>
  );
};

const EncryptedBalanceCard = ({ showBalance, onToggleBalance }: EncryptedBalanceCardProps) => {
  const { encryptedBalance, isBalanceLoading, refreshBalance, privacyLevel, fullWalletAddress, isConnected } = useWallet();
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Calculate real sent/received amounts from transaction history
  const stats = useMemo(() => {
    if (!transactions.length) return { sent: 0, received: 0 };

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let sent = 0;
    let received = 0;

    transactions.forEach(tx => {
      const txDate = new Date(tx.timestamp);
      if (txDate < thirtyDaysAgo) return; // Only count last 30 days

      const isSent = tx.from === fullWalletAddress;
      const amount = tx.amount || 0;

      if (isSent) {
        sent += amount;
      } else {
        received += amount;
      }
    });

    return { sent, received };
  }, [transactions, fullWalletAddress]);

  useEffect(() => {
    const fetchStats = async () => {
      if (!isConnected || !fullWalletAddress) return;

      try {
        setIsLoadingStats(true);
        // Fetch last 100 transactions to calculate 30-day stats
        const result = await getTransactionHistory(fullWalletAddress, 100);
        if (result && result.success) {
          setTransactions(result.transactions);
        }
      } catch (err) {
        console.error("Error fetching transaction stats:", err);
      } finally {
        setIsLoadingStats(false);
      }
    };

    fetchStats();
    // Refresh stats every 60 seconds
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, [fullWalletAddress, isConnected]);

  const handleRefresh = async () => {
    setIsDecrypting(true);
    await refreshBalance();
    setTimeout(() => setIsDecrypting(false), 500);
  };

  const getPrivacyBadge = () => {
    switch (privacyLevel) {
      case "public":
        return { label: "Public", color: "bg-yellow-500/20 text-yellow-500" };
      case "partial":
        return { label: "Partial Privacy", color: "bg-blue-500/20 text-blue-500" };
      case "full":
        return { label: "Full Privacy", color: "bg-green-500/20 text-green-500" };
    }
  };

  const badge = getPrivacyBadge();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-6 relative overflow-hidden"
    >
      {/* Background decoration */}
      <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-accent/10 blur-3xl" />
      
      <div className="relative">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-primary" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                Encrypted Balance
              </span>
            </div>
            <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", badge.color)}>
              <Lock className="w-3 h-3" />
              {badge.label}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleBalance}
              className="p-2 rounded-lg border border-border hover:bg-secondary transition-colors"
              title={showBalance ? "Hide balance" : "Show balance"}
            >
              {showBalance ? (
                <EyeOff className="w-4 h-4 text-muted-foreground" />
              ) : (
                <Eye className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
            <button
              onClick={handleRefresh}
              disabled={isBalanceLoading || isDecrypting}
              className="p-2 rounded-lg border border-border hover:bg-secondary transition-colors disabled:opacity-50"
              title="Refresh balance"
            >
              <RefreshCw className={cn(
                "w-4 h-4 text-muted-foreground",
                (isBalanceLoading || isDecrypting) && "animate-spin"
              )} />
            </button>
          </div>
        </div>

        {/* Balance Display */}
        <div className="mb-6">
          {isBalanceLoading || isDecrypting ? (
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <span className="text-lg text-muted-foreground">Loading balance...</span>
            </div>
          ) : (
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl md:text-5xl font-display font-bold">
                  {showBalance ? `$${encryptedBalance}` : "••••••••"}
                </span>
                {showBalance && (
                  <span className="text-lg text-green-500 font-medium flex items-center gap-1">
                    <TrendingUp className="w-4 h-4" />
                    +2.4%
                  </span>
                )}
              </div>
              {!showBalance && (
                <p className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Balance encrypted - click eye icon to reveal
                </p>
              )}
            </div>
          )}
        </div>

        {/* Quick Stats */}
        {showBalance && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="rounded-xl bg-secondary/50 p-4">
              <div className="flex items-center gap-2 mb-1">
                <ArrowUpRight className="w-4 h-4 text-red-500" />
                <span className="text-xs text-muted-foreground">Sent (30d)</span>
              </div>
              <p className="text-lg font-bold">
                {isLoadingStats ? "..." : `$${stats.sent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </p>
            </div>
            <div className="rounded-xl bg-secondary/50 p-4">
              <div className="flex items-center gap-2 mb-1">
                <ArrowDownLeft className="w-4 h-4 text-green-500" />
                <span className="text-xs text-muted-foreground">Received (30d)</span>
              </div>
              <p className="text-lg font-bold">
                {isLoadingStats ? "..." : `$${stats.received.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <DepositButton />
          <Button variant="outline" className="flex-1 h-12">
            <ArrowDownLeft className="w-4 h-4 mr-2" />
            Withdraw
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default EncryptedBalanceCard;
