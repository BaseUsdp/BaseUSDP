import { motion } from "framer-motion";
import { Clock, ArrowDownRight, ArrowUpRight, TrendingUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { getTransactionHistory, TransactionHistoryResponse } from "@/services/api";

interface TransactionHistoryProps {
  showBalance: boolean;
}

const TransactionHistory = ({ showBalance }: TransactionHistoryProps) => {
  const { fullWalletAddress, isConnected } = useWallet();
  const [transactions, setTransactions] = useState<TransactionHistoryResponse["transactions"]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = async () => {
    if (!isConnected || !fullWalletAddress) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const result = await getTransactionHistory(fullWalletAddress, 10);
      
      if (result.success) {
        setTransactions(result.transactions);
        setError(null);
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

  useEffect(() => {
    fetchTransactions();
    // Refresh transactions every 60 seconds
    const interval = setInterval(fetchTransactions, 60000);
    return () => clearInterval(interval);
  }, [fullWalletAddress, isConnected]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const month = date.toLocaleString("default", { month: "short" }).toUpperCase();
    const day = date.getDate();
    return `${month} ${day}`;
  };

  const formatHash = (signature: string) => {
    if (signature.length <= 8) return signature;
    return `${signature.slice(0, 4)}...${signature.slice(-4)}`;
  };

  const formatAmount = (amount?: number, type?: string) => {
    if (!amount) return "••••••";
    const sign = type === "transfer" && amount < 0 ? "-" : "+";
    const absAmount = Math.abs(amount);
    return `${sign}$${absAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getTransactionType = (tx: TransactionHistoryResponse["transactions"][0]) => {
    if (tx.type === "transfer") {
      // Determine if it's incoming or outgoing based on from/to
      return tx.from === fullWalletAddress ? "send" : "receive";
    }
    if (tx.type === "payment") return "send";
    if (tx.type === "deposit") return "receive";
    return "send";
  };

  const getTransactionLabel = (tx: TransactionHistoryResponse["transactions"][0]) => {
    const type = getTransactionType(tx);
    if (type === "receive") return "Received";
    if (type === "send") return "Sent";
    return "Transaction";
  };

  const getTransactionTag = (tx: TransactionHistoryResponse["transactions"][0]) => {
    if (tx.type === "transfer") return "CONFIDENTIAL";
    if (tx.type === "payment") return "x402 PAYMENT";
    if (tx.type === "deposit") return "DEPOSIT";
    return "ENCRYPTED";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="rounded-2xl border border-border bg-card p-6 h-full flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-display text-lg font-bold">History.</h3>
        <Clock className="w-5 h-5 text-muted-foreground" />
      </div>

      {/* Transactions List */}
      <div className="flex-1 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
          </div>
        ) : error ? (
          <div className="text-sm text-destructive py-8 text-center">{error}</div>
        ) : transactions.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            No transactions yet
          </div>
        ) : (
          transactions.map((tx, index) => {
            const type = getTransactionType(tx);
            const label = getTransactionLabel(tx);
            const tag = getTransactionTag(tx);
            
            return (
              <motion.div
                key={tx.signature}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + index * 0.1 }}
                className="flex items-center gap-3"
              >
                {/* Icon */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                  type === "receive" 
                    ? "bg-primary/10" 
                    : "bg-secondary"
                }`}>
                  {type === "receive" ? (
                    <ArrowDownRight className="w-4 h-4 text-primary" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(tx.timestamp)} • {formatHash(tx.signature)}
                  </p>
                </div>

                {/* Amount & Tag */}
                <div className="text-right">
                  <p className={`text-sm font-semibold ${
                    type === "receive"
                      ? "text-foreground" 
                      : "text-muted-foreground"
                  }`}>
                    {showBalance ? formatAmount(tx.amount, tx.type) : "••••••"}
                  </p>
                  <p className={`text-[10px] font-semibold uppercase ${
                    tx.status === "success" ? "text-primary" : "text-destructive"
                  }`}>
                    {tag}
                  </p>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* CTA */}
      <Button 
        variant="ghost" 
        className="w-full mt-4 text-muted-foreground hover:text-foreground"
        onClick={fetchTransactions}
      >
        REFRESH
      </Button>
    </motion.div>
  );
};

export default TransactionHistory;
