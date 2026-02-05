import { useState, useEffect, useMemo } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { getTransactionHistory } from "@/services/api";

interface TransactionStats {
  sent: number;
  received: number;
  transfers: number;
  stables: number;
  yieldEarnings: number;
  gasFeesEth: number;
  monthlySent: number;
  monthlyReceived: number;
  monthlyYield: number;
}

// Known gas costs per deposit on Base (ETH)
const GAS_COST_FULL_PRIVACY = 0.002;
const GAS_COST_PUBLIC = 0.001;

export function useTransactionStats() {
  const { fullWalletAddress, isConnected } = useWallet();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTransactions = async () => {
    if (!isConnected || !fullWalletAddress) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
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

  useEffect(() => {
    fetchTransactions();
    const interval = setInterval(fetchTransactions, 60000);
    return () => clearInterval(interval);
  }, [fullWalletAddress, isConnected]);

  const stats = useMemo((): TransactionStats => {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const defaults: TransactionStats = {
      sent: 0,
      received: 0,
      transfers: 0,
      stables: 0,
      yieldEarnings: 0,
      gasFeesEth: 0,
      monthlySent: 0,
      monthlyReceived: 0,
      monthlyYield: 0,
    };

    if (!transactions.length) return defaults;

    let sent = 0;
    let received = 0;
    let transfers = 0;
    let stables = 0;
    let gasFeesEth = 0;
    let monthlySent = 0;
    let monthlyReceived = 0;

    transactions.forEach(tx => {
      const txDate = new Date(tx.timestamp);
      const amount = tx.amount || 0;
      const isThisMonth = txDate >= thisMonthStart;

      // Only count this month's activity
      if (!isThisMonth) return;

      // Determine direction
      let isSent: boolean;
      if (tx.type === "deposit") {
        isSent = false;
      } else if (tx.type === "withdraw") {
        isSent = true;
      } else {
        isSent = tx.from === fullWalletAddress;
      }

      if (isSent) {
        sent += amount;
        monthlySent += amount;
      } else {
        received += amount;
        monthlyReceived += amount;
      }

      // Transfers: user-to-user sends/receives
      if (tx.type === "transfer" || tx.type === "sent" || tx.type === "received") {
        transfers += amount;
      }

      // Stables: all USDC/USDT deposit and withdrawal volume
      if (tx.type === "deposit" || tx.type === "withdraw") {
        stables += amount;
      }

      // Gas fees: each Base deposit costs ETH for gas
      if (tx.type === "deposit") {
        const gasCost = tx.privacyLevel === "public"
          ? GAS_COST_PUBLIC
          : GAS_COST_FULL_PRIVACY;
        gasFeesEth += gasCost;
      }
    });

    return {
      sent,
      received,
      transfers,
      stables,
      yieldEarnings: 0,
      gasFeesEth,
      monthlySent,
      monthlyReceived,
      monthlyYield: 0,
    };
  }, [transactions, fullWalletAddress]);

  return { stats, isLoading, refetch: fetchTransactions };
}
