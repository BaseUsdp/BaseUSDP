import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownLeft, Lock, CheckCircle2, Clock, XCircle, ExternalLink, Loader2 } from "lucide-react";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { getTransactionHistory, TransactionHistoryResponse } from "@/services/api";

interface RecentTransactionsProps {
  showBalance: boolean;
  limit?: number;
  onViewAll?: () => void;
}

const RecentTransactions = ({ showBalance, limit = 5, onViewAll }: RecentTransactionsProps) => {
  const { fullWalletAddress, isConnected, activeChain } = useWallet();
  const [transactions, setTransactions] = useState<TransactionHistoryResponse["transactions"]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!isConnected || !fullWalletAddress) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const result = await getTransactionHistory(fullWalletAddress, limit);
        
        if (result && result.success) {
          setTransactions(result.transactions);
        } else {
          setError("Failed to fetch transactions");
        }
      } catch (err) {
        console.error("Error fetching transactions:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch transactions");
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransactions();
    // Refresh every 60 seconds
    const interval = setInterval(fetchTransactions, 60000);
    return () => clearInterval(interval);
  }, [fullWalletAddress, isConnected, limit]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) {
      const hours = date.getHours();
      const mins = date.getMinutes();
      const ampm = hours >= 12 ? "PM" : "AM";
      const displayHours = hours % 12 || 12;
      return `Today, ${displayHours}:${mins.toString().padStart(2, "0")} ${ampm}`;
    }
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
  };

  const formatAddress = (address?: string) => {
    if (!address) return "Unknown";
    if (address.length <= 8) return address;
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const formatAmount = (amount?: number, type?: string, from?: string, to?: string) => {
    if (!showBalance || amount === undefined) return "••••••";
    // Deposits are always positive, withdrawals always negative
    let isSent: boolean;
    if (type === "deposit") {
      isSent = false;
    } else if (type === "withdraw") {
      isSent = true;
    } else {
      isSent = from === fullWalletAddress;
    }
    const sign = isSent ? "-" : "+";
    return `${sign}$${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getDirection = (tx: TransactionHistoryResponse["transactions"][0]) => {
    if (tx.type === "deposit") return "received";
    if (tx.type === "withdraw") return "sent";
    if (tx.type === "payment") {
      return tx.to === fullWalletAddress ? "received" : "sent";
    }
    return tx.from === fullWalletAddress ? "sent" : "received";
  };

  const getCounterparty = (tx: TransactionHistoryResponse["transactions"][0]) => {
    // Use pre-resolved counterparty from API (includes @username for internal transfers)
    if ((tx as any).counterparty) {
      return (tx as any).counterparty;
    }
    const direction = getDirection(tx);
    return direction === "sent" ? tx.to : tx.from;
  };


  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-2xl border border-border bg-card p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-display text-lg font-bold">Recent Transactions</h3>
        {onViewAll && (
          <Button variant="outline" size="sm" onClick={onViewAll}>
            View All
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-8">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No transactions yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map((tx, i) => {
            const direction = getDirection(tx);
            const counterparty = getCounterparty(tx);
            
            return (
              <motion.div
                key={tx.signature}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * i }}
                className="flex items-center gap-4 p-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors group"
              >
                {/* Direction Icon */}
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                  direction === "sent" ? "bg-red-500/20" : "bg-green-500/20"
                )}>
                  {direction === "sent" ? (
                    <ArrowUpRight className="w-5 h-5 text-red-500" />
                  ) : (
                    <ArrowDownLeft className="w-5 h-5 text-green-500" />
                  )}
                </div>

                {/* Transaction Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">
                      {tx.type === "deposit" ? "Deposit" :
                       tx.type === "withdraw" ? "Withdrawal" :
                       direction === "sent" 
                        ? `Sent to ${counterparty?.startsWith("@") ? counterparty : formatAddress(counterparty)}` 
                        : `Received from ${counterparty?.startsWith("@") ? counterparty : formatAddress(counterparty)}`}
                    </p>
                    {tx.type === "payment" && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium">
                        x402
                      </span>
                    )}
                    {(tx as any).source === "x_bot" && (
                      <span className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400 font-medium">
                        <Icon icon="ri:twitter-x-fill" className="w-3 h-3" />
                        X Bot
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{formatDate(tx.timestamp)}</p>
                </div>

                {/* Amount & Status */}
                <div className="text-right shrink-0">
                  <div className="flex items-center justify-end gap-2">
                    <p className={cn(
                      "font-bold",
                      direction === "sent" ? "text-red-500" : "text-green-500"
                    )}>
                      {formatAmount(tx.amount, tx.type, tx.from, tx.to)}
                    </p>
                    {!showBalance && (
                      <Lock className="w-3 h-3 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex items-center gap-1 justify-end mt-1">
                    {tx.status === "success" ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : tx.status === "pending" ? (
                      <Clock className="w-4 h-4 text-yellow-500 animate-pulse" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className="text-xs text-muted-foreground capitalize">{tx.status}</span>
                  </div>
                </div>

                {/* External Link (on hover) */}
                <a
                  href={activeChain === "base" ? `https://basescan.org/tx/${tx.signature}` : `https://solscan.io/tx/${tx.signature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-secondary rounded-lg"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="w-4 h-4 text-muted-foreground" />
                </a>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

export default RecentTransactions;
