import { useState, useEffect, useMemo } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { getTransactionHistory } from "@/services/api";

interface TransactionStats {
  sent: number;
  received: number;
  transfers: number;
  payments: number;
  yieldEarnings: number;
  gasFees: number;
  monthlySent: number;
  monthlyReceived: number;
  monthlyYield: number;
}

export function useTransactionStats() {
  const { fullWalletAddress, isConnected } = useWallet();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!isConnected || !fullWalletAddress) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        // Fetch last 100 transactions for stats calculation
        const result = await getTransactionHistory(fullWalletAddress, 100);
        if (result && result.success) {
          setTransactions(result.transactions);
        }
      } catch (err) {
        console.error("Error fetching transaction stats:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransactions();
    // Refresh every 60 seconds
    const interval = setInterval(fetchTransactions, 60000);
    return () => clearInterval(interval);
  }, [fullWalletAddress, isConnected]);

  const stats = useMemo(() => {
    if (!transactions.length) {
      return {
        sent: 0,
        received: 0,
        transfers: 0,
        payments: 0,
        yieldEarnings: 0,
        gasFees: 0,
        monthlySent: 0,
        monthlyReceived: 0,
        monthlyYield: 0,
      };
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let sent = 0;
    let received = 0;
    let transfers = 0;
    let payments = 0;
    let yieldEarnings = 0;
    let gasFees = 0;
    let monthlySent = 0;
    let monthlyReceived = 0;
    let monthlyYield = 0;

    transactions.forEach(tx => {
      const txDate = new Date(tx.timestamp);
      const isSent = tx.from === fullWalletAddress;
      const amount = tx.amount || 0;
      const fee = tx.fee || 0;

      // All-time stats
      if (isSent) {
        sent += amount;
      } else {
        received += amount;
      }

      if (tx.type === "transfer") {
        transfers += amount;
      } else if (tx.type === "payment") {
        payments += amount;
      } else if (tx.type === "deposit") {
        yieldEarnings += amount;
      }

      gasFees += fee;

      // Monthly stats (this month)
      if (txDate >= thisMonthStart) {
        if (isSent) {
          monthlySent += amount;
        } else {
          monthlyReceived += amount;
        }
        if (tx.type === "deposit") {
          monthlyYield += amount;
        }
      }
    });

    return {
      sent,
      received,
      transfers,
      payments,
      yieldEarnings,
      gasFees,
      monthlySent,
      monthlyReceived,
      monthlyYield,
    };
  }, [transactions, fullWalletAddress]);

  return { stats, isLoading };
}
