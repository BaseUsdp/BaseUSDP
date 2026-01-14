import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownLeft, Lock, CheckCircle2, Clock, XCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RecentTransactionsProps {
  showBalance: boolean;
  limit?: number;
  onViewAll?: () => void;
}

type TransactionStatus = "success" | "pending" | "failed";
type TransactionType = "transfer" | "x402";

interface Transaction {
  id: string;
  type: TransactionType;
  direction: "sent" | "received";
  amount: string;
  counterparty: string;
  timestamp: string;
  status: TransactionStatus;
  txHash: string;
  privacyLevel: "public" | "partial" | "full";
}

const mockTransactions: Transaction[] = [
  {
    id: "1",
    type: "transfer",
    direction: "sent",
    amount: "-$500.00",
    counterparty: "3nFv...8kLz",
    timestamp: "Today, 2:30 PM",
    status: "success",
    txHash: "5xYz...AbCd",
    privacyLevel: "full"
  },
  {
    id: "2",
    type: "x402",
    direction: "received",
    amount: "+$1,200.00",
    counterparty: "7xKq...9mPw",
    timestamp: "Today, 11:15 AM",
    status: "success",
    txHash: "4wRt...EfGh",
    privacyLevel: "full"
  },
  {
    id: "3",
    type: "transfer",
    direction: "sent",
    amount: "-$75.00",
    counterparty: "9hGt...2rYs",
    timestamp: "Yesterday",
    status: "pending",
    txHash: "2qPm...IjKl",
    privacyLevel: "partial"
  },
  {
    id: "4",
    type: "x402",
    direction: "received",
    amount: "+$3,000.00",
    counterparty: "5kNb...4uVx",
    timestamp: "Jan 8, 2026",
    status: "success",
    txHash: "8sLw...MnOp",
    privacyLevel: "full"
  },
  {
    id: "5",
    type: "transfer",
    direction: "sent",
    amount: "-$150.00",
    counterparty: "6jCz...7tQr",
    timestamp: "Jan 7, 2026",
    status: "failed",
    txHash: "1vUy...StWx",
    privacyLevel: "public"
  },
];

const RecentTransactions = ({ showBalance, limit = 5, onViewAll }: RecentTransactionsProps) => {
  const transactions = mockTransactions.slice(0, limit);

  const getStatusIcon = (status: TransactionStatus) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-500 animate-pulse" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusLabel = (status: TransactionStatus) => {
    switch (status) {
      case "success":
        return "Confirmed";
      case "pending":
        return "Pending";
      case "failed":
        return "Failed";
    }
  };

  const getAmountDisplay = (tx: Transaction) => {
    if (!showBalance) {
      return tx.privacyLevel === "public" ? tx.amount : "Encrypted";
    }
    return tx.amount;
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

      {transactions.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No transactions yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map((tx, i) => (
            <motion.div
              key={tx.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 * i }}
              className="flex items-center gap-4 p-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors group"
            >
              {/* Direction Icon */}
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                tx.direction === "sent" ? "bg-red-500/20" : "bg-green-500/20"
              )}>
                {tx.direction === "sent" ? (
                  <ArrowUpRight className="w-5 h-5 text-red-500" />
                ) : (
                  <ArrowDownLeft className="w-5 h-5 text-green-500" />
                )}
              </div>

              {/* Transaction Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">
                    {tx.direction === "sent" ? `Sent to ${tx.counterparty}` : `Received from ${tx.counterparty}`}
                  </p>
                  {tx.type === "x402" && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium">
                      x402
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{tx.timestamp}</p>
              </div>

              {/* Amount & Status */}
              <div className="text-right shrink-0">
                <div className="flex items-center justify-end gap-2">
                  <p className={cn(
                    "font-bold",
                    tx.direction === "sent" ? "text-red-500" : "text-green-500"
                  )}>
                    {getAmountDisplay(tx)}
                  </p>
                  {tx.privacyLevel !== "public" && !showBalance && (
                    <Lock className="w-3 h-3 text-muted-foreground" />
                  )}
                </div>
                <div className="flex items-center gap-1 justify-end mt-1">
                  {getStatusIcon(tx.status)}
                  <span className="text-xs text-muted-foreground">{getStatusLabel(tx.status)}</span>
                </div>
              </div>

              {/* External Link (on hover) */}
              <a
                href={`https://explorer.solana.com/tx/${tx.txHash}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-secondary rounded-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-4 h-4 text-muted-foreground" />
              </a>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default RecentTransactions;
