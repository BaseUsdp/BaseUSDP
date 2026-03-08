import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import DepositModal from "./DepositModal";
import SendPaymentModal from "./SendPaymentModal";
import X402PaymentModal from "./X402PaymentModal";
import PayX402Modal from "./PayX402Modal";
import PrivacyLevelSelector from "./PrivacyLevelSelector";
import SettingsSection from "./sections/SettingsSection";
import PaymentsSection from "./sections/PaymentsSection";
import HistorySection from "./sections/HistorySection";
import WithdrawSection from "./sections/WithdrawSection";
import MessagesSection from "./sections/MessagesSection";
import AITerminalSection from "./sections/AITerminalSection";
import AgentsSection from "./sections/AgentsSection";
import SwapSection from "./sections/SwapSection";
import { getTransactionHistory, TransactionHistoryResponse, getZKBalance } from "@/services/api";
import { useTransactionStats } from "@/hooks/useTransactionStats";

interface DashboardMainContentProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  showBalance: boolean;
  setShowBalance: (show: boolean) => void;
  paymentsInitialTab?: string;
  withdrawInitialAmount?: string;
  withdrawInitialToken?: "USDC" | "USDT";
}

const DashboardMainContent = ({ activeTab, setActiveTab, showBalance, setShowBalance, paymentsInitialTab, withdrawInitialAmount, withdrawInitialToken }: DashboardMainContentProps) => {
  const { encryptedBalance, privacyLevel, refreshBalance, isBalanceLoading, fullWalletAddress, isConnected } = useWallet();
  const { stats, isLoading: isLoadingStats } = useTransactionStats();
  const [localWithdrawAmount, setLocalWithdrawAmount] = useState<string | undefined>(undefined);
  const [localWithdrawToken, setLocalWithdrawToken] = useState<"USDC" | "USDT" | undefined>(undefined);
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [x402ModalOpen, setX402ModalOpen] = useState(false);
  const [payX402ModalOpen, setPayX402ModalOpen] = useState(false);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const [tokenBalances, setTokenBalances] = useState({ usdc: 0, usdt: 0 });

  // Function to fetch token balances (extractable for refresh)
  const fetchTokenBalances = async () => {
    if (!isConnected || !fullWalletAddress) return;
    
    try {
      const [usdcResult, usdtResult] = await Promise.all([
        getZKBalance(fullWalletAddress, 'USDC').catch(() => ({ balance: 0 })),
        getZKBalance(fullWalletAddress, 'USDT').catch(() => ({ balance: 0 })),
      ]);
      
      setTokenBalances({
        usdc: usdcResult?.balance || 0,
        usdt: usdtResult?.balance || 0,
      });
    } catch (e) {
      console.log("Error fetching token balances");
    }
  };

  // Fetch token balances and global balance on mount and when returning to overview tab
  useEffect(() => {
    if (activeTab === "overview" || activeTab === "dashboard") {
      fetchTokenBalances();
      refreshBalance();
    }
  }, [isConnected, fullWalletAddress, activeTab]);

  // Fetch recent transactions
  const fetchTransactions = async () => {
      if (!isConnected || !fullWalletAddress) {
        setIsLoadingTransactions(false);
        return;
      }

      try {
        setIsLoadingTransactions(true);
        const result = await getTransactionHistory(fullWalletAddress, 5);
        if (result && result.success) {
          // Convert API transactions to UI format
          const converted = result.transactions.map(tx => {
            // Deposits are always incoming, withdrawals always outgoing
            let direction: string;
            if (tx.type === "deposit") {
              direction = "received";
            } else if (tx.type === "withdraw") {
              direction = "sent";
            } else {
              direction = tx.from === fullWalletAddress ? "sent" : "received";
            }
            // Use pre-resolved counterparty from API (@username for internal transfers)
            const counterparty = (tx as any).counterparty || (direction === "sent" ? tx.to : tx.from);
            const amount = tx.amount || 0;
            
            // Format date
            const date = new Date(tx.timestamp);
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);

            let timeStr = "";
            if (diffMins < 1) timeStr = "Just now";
            else if (diffMins < 60) timeStr = `${diffMins}m ago`;
            else if (diffHours < 24) {
              const hours = date.getHours();
              const mins = date.getMinutes();
              const ampm = hours >= 12 ? "PM" : "AM";
              const displayHours = hours % 12 || 12;
              timeStr = `Today, ${displayHours}:${mins.toString().padStart(2, "0")} ${ampm}`;
            } else if (diffDays === 1) timeStr = "Yesterday, " + date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
            else timeStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

            // Format address
            const formatAddress = (addr?: string) => {
              if (!addr) return "Unknown";
              if (addr.length <= 8) return addr;
              return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
            };

            // Determine type and icon
            let type = "transfer";
            let icon = "ph:arrow-down-left-bold";
            let color = "text-emerald-400";
            let bgColor = "bg-emerald-500/20";

            if (tx.type === "payment") {
              type = "x402";
              icon = "ph:download-bold";
              color = "text-purple-400";
              bgColor = "bg-purple-500/20";
            } else if (tx.type === "deposit") {
              type = "deposit";
              icon = "ph:arrow-down-left-bold";
              color = "text-emerald-400";
              bgColor = "bg-emerald-500/20";
            } else if (tx.type === "withdraw") {
              type = "withdraw";
              icon = "ph:arrow-up-right-bold";
              color = "text-red-400";
              bgColor = "bg-red-500/20";
            } else if (direction === "sent") {
              icon = "ph:arrow-up-right-bold";
              color = "text-red-400";
              bgColor = "bg-red-500/20";
            }

            // For usernames (@...) show as-is, for wallet addresses truncate
            const displayCounterparty = counterparty?.startsWith("@") ? counterparty : formatAddress(counterparty);

            return {
              type,
              direction,
              from: direction === "received" ? displayCounterparty : undefined,
              to: direction === "sent" ? displayCounterparty : undefined,
              amount: `${direction === "sent" ? "-" : "+"}$${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              time: timeStr,
              icon,
              color,
              bgColor,
              agentName: (tx as any).agentName || null,
              source: (tx as any).source || null,
            };
          });
          setRecentTransactions(converted);
        }
      } catch (err) {
        console.error("Error fetching recent transactions:", err);
        setRecentTransactions([]);
      } finally {
        setIsLoadingTransactions(false);
      }
    };

  useEffect(() => {
    fetchTransactions();
    // Refresh every 60 seconds
    const interval = setInterval(fetchTransactions, 60000);
    return () => clearInterval(interval);
  }, [fullWalletAddress, isConnected, activeTab]);

  // Handler for refresh button - refreshes all balances and transactions
  const handleRefreshAll = async () => {
    await Promise.all([
      refreshBalance(),
      fetchTokenBalances(),
      fetchTransactions(),
    ]);
  };

  // Called when deposit or send modals close — refresh everything
  const handleDepositModalChange = (open: boolean) => {
    setDepositModalOpen(open);
    if (!open) {
      // Modal just closed — refresh all data after a short delay
      setTimeout(() => handleRefreshAll(), 1500);
    }
  };

  const handleSendModalChange = (open: boolean) => {
    setSendModalOpen(open);
    if (!open) {
      setTimeout(() => handleRefreshAll(), 1500);
    }
  };

  const handleExportCSV = async () => {
    if (!isConnected || !fullWalletAddress) return;
    try {
      const result = await getTransactionHistory(fullWalletAddress, 100);
      if (!result?.success || !result.transactions.length) return;

      const headers = ["Date", "Type", "Direction", "Amount (USD)", "Counterparty", "Status", "Tx Hash"];
      const rows = result.transactions.map(tx => {
        const direction = tx.type === "deposit" ? "received"
          : tx.type === "withdraw" ? "sent"
          : tx.from === fullWalletAddress ? "sent" : "received";
        const counterparty = (tx as any).counterparty || (direction === "sent" ? tx.to : tx.from);
        return [
          new Date(tx.timestamp).toISOString(),
          tx.type,
          direction,
          (tx.amount || 0).toFixed(2),
          counterparty || "Unknown",
          tx.status,
          tx.signature,
        ];
      });

      const csv = [headers, ...rows].map(row => row.map(c => `"${c}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `usdp_transactions_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  if (activeTab === "terminal") {
    return (
      <AITerminalSection showBalance={showBalance} setActiveTab={setActiveTab} onWithdraw={(amount, token) => {
        setLocalWithdrawAmount(amount);
        setLocalWithdrawToken(token as "USDC" | "USDT" | undefined);
        setActiveTab("withdraw");
      }} />
    );
  }

  if (activeTab === "agents") {
    return (
      <div className="p-4 sm:p-6">
        <AgentsSection />
      </div>
    );
  }

  if (activeTab === "settings") {
    return (
      <div className="p-4 sm:p-6">
        <SettingsSection />
      </div>
    );
  }

  if (activeTab === "payments") {
    return (
      <div className="p-4 sm:p-6">
        <PaymentsSection showBalance={showBalance} initialTab={paymentsInitialTab} />
      </div>
    );
  }

  if (activeTab === "history") {
    return (
      <div className="p-4 sm:p-6">
        <HistorySection showBalance={showBalance} />
      </div>
    );
  }

  if (activeTab === "withdraw") {
    return (
      <div className="p-4 sm:p-6">
        <WithdrawSection showBalance={showBalance} initialAmount={withdrawInitialAmount || localWithdrawAmount} initialToken={withdrawInitialToken || localWithdrawToken} />
      </div>
    );
  }

  if (activeTab === "swap") {
    return (
      <div className="p-4 sm:p-6">
        <SwapSection showBalance={showBalance} />
      </div>
    );
  }

  if (activeTab === "messages") {
    return (
      <div className="p-4 sm:p-6">
        <MessagesSection />
      </div>
    );
  }

  // Overview Tab
  return (
    <>
      {/* Content Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 text-xs"
        style={{ borderBottom: '1px solid var(--dash-border)', color: 'var(--dash-text)' }}
      >
        <Icon icon="ph:package-bold" className="h-4 w-4 text-sky-400" />
        <span>Dashboard</span>
        <span style={{ color: 'var(--dash-text-faint)' }}>•</span>
        <span style={{ color: 'var(--dash-text-muted)' }}>Privacy Mode: {privacyLevel}</span>
        <div className="ml-auto">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors"
            style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-surface)', color: 'var(--dash-text)' }}
          >
            <Icon icon="ph:upload-bold" className="w-3 h-3" />
            Export
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-4">
        {/* Spending Overview / Balance Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-xl p-5 backdrop-blur"
          style={{ border: '1px solid var(--dash-border)', background: 'var(--dash-surface)' }}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Icon icon="ph:shield-check-bold" className="w-4 h-4 text-sky-400" />
                <span className="text-sm" style={{ color: 'var(--dash-text-muted)' }}>Encrypted Balance</span>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-semibold tracking-tight">
                  {showBalance ? `$${encryptedBalance}` : "••••••••"}
                </span>
                <button
                  onClick={() => setShowBalance(!showBalance)}
                  className="p-1 rounded transition-colors"
                >
                  {showBalance ? (
                    <Icon icon="ph:eye-slash-bold" className="w-4 h-4" style={{ color: 'var(--dash-text-muted)' }} />
                  ) : (
                    <Icon icon="ph:eye-bold" className="w-4 h-4" style={{ color: 'var(--dash-text-muted)' }} />
                  )}
                </button>
                <button
                  onClick={() => handleRefreshAll()}
                  disabled={isBalanceLoading}
                  className="p-1 rounded transition-colors"
                  title="Refresh all balances"
                >
                  <Icon icon="ph:arrows-clockwise-bold" className={cn(
                    "w-4 h-4",
                    isBalanceLoading && "animate-spin"
                  )} style={{ color: 'var(--dash-text-muted)' }} />
                </button>
              </div>
              <div className="flex items-center gap-1 text-xs mt-1 text-emerald-400">
                <Icon icon="ph:trend-up-bold" className="w-3 h-3" />
                +2.4% from last month
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm mb-1" style={{ color: 'var(--dash-text-muted)' }}>Privacy</div>
              <div className={cn(
                "text-xl font-semibold capitalize",
                privacyLevel === "full" ? "text-emerald-400" :
                privacyLevel === "partial" ? "text-yellow-400" : "text-sky-400"
              )}>
                {privacyLevel}
              </div>
              <div className="flex items-center gap-1 justify-end text-xs mt-1" style={{ color: 'var(--dash-text-muted)' }}>
                <Icon icon="ph:lock-bold" className="w-3 h-3" />
                ZK Protected
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-lg p-3" style={{ background: 'var(--dash-surface)' }}>
              <div className="flex items-center gap-2 mb-1">
                <Icon icon="ph:arrow-down-left-bold" className="w-4 h-4 text-emerald-400" />
                <span className="text-xs" style={{ color: 'var(--dash-text-muted)' }}>Received</span>
              </div>
              <p className="text-lg font-semibold">
                {showBalance 
                  ? (isLoadingStats ? "..." : `$${stats.received.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
                  : "••••"}
              </p>
            </div>
            <div className="rounded-lg p-3" style={{ background: 'var(--dash-surface)' }}>
              <div className="flex items-center gap-2 mb-1">
                <Icon icon="ph:arrow-up-right-bold" className="w-4 h-4 text-red-400" />
                <span className="text-xs" style={{ color: 'var(--dash-text-muted)' }}>Sent</span>
              </div>
              <p className="text-lg font-semibold">
                {showBalance 
                  ? (isLoadingStats ? "..." : `$${stats.sent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
                  : "••••"}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button 
              onClick={() => setDepositModalOpen(true)}
              className="flex-1 bg-green-600 hover:bg-green-500 text-white"
            >
              <Icon icon="ph:arrow-down-left-bold" className="w-4 h-4 mr-2" />
              Deposit
            </Button>
            <Button 
              onClick={() => setSendModalOpen(true)}
              className="flex-1 bg-sky-600 hover:bg-sky-500 text-white"
            >
              <Icon icon="ph:paper-plane-tilt-bold" className="w-4 h-4 mr-2" />
              Send
            </Button>
          </div>
        </motion.div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-2 gap-3">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl p-4 backdrop-blur"
            style={{ border: '1px solid var(--dash-border)', background: 'var(--dash-surface)' }}
          >
            <div className="mb-3">
              <div className="text-sm font-medium" style={{ color: 'var(--dash-text)' }}>Stable Currencies</div>
            </div>
            <div className="flex items-center justify-evenly">
              <div className="flex flex-col items-center gap-1" title="USDC">
                <img
                  src="https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png"
                  alt="USDC"
                  className="w-7 h-7 rounded-full"
                />
                <span className="text-xs" style={{ color: 'var(--dash-text-muted)' }}>USDC</span>
                <span className="text-sm font-medium" style={{ color: 'var(--dash-text-heading)' }}>
                  {showBalance ? `$${tokenBalances.usdc.toFixed(2)}` : "••••"}
                </span>
              </div>
              <div className="flex flex-col items-center gap-1" title="USDT">
                <img
                  src="https://assets.coingecko.com/coins/images/325/small/Tether.png"
                  alt="USDT"
                  className="w-7 h-7 rounded-full"
                />
                <span className="text-xs" style={{ color: 'var(--dash-text-muted)' }}>USDT</span>
                <span className="text-sm font-medium" style={{ color: 'var(--dash-text-heading)' }}>
                  {showBalance ? `$${tokenBalances.usdt.toFixed(2)}` : "••••"}
                </span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-xl p-4 backdrop-blur"
            style={{ border: '1px solid var(--dash-border)', background: 'var(--dash-surface)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium" style={{ color: 'var(--dash-text)' }}>Privacy Level</div>
            </div>
            <PrivacyLevelSelector compact onNavigateToSettings={() => setActiveTab("settings")} />
          </motion.div>
        </div>

        {/* Recent Transactions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl p-4 backdrop-blur"
          style={{ border: '1px solid var(--dash-border)', background: 'var(--dash-surface)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium" style={{ color: 'var(--dash-text)' }}>Recent Transactions</div>
            <button
              onClick={() => setActiveTab("history")}
              className="text-xs transition-colors"
              style={{ color: 'var(--dash-text-faint)' }}
            >
              See All
            </button>
          </div>
          <div className="space-y-2">
            {isLoadingTransactions ? (
              <div className="flex items-center justify-center py-4">
                <Icon icon="ph:spinner-bold" className="w-5 h-5 animate-spin" style={{ color: 'var(--dash-text-muted)' }} />
              </div>
            ) : recentTransactions.length === 0 ? (
              <div className="text-center py-4 text-sm" style={{ color: 'var(--dash-text-faint)' }}>No transactions yet</div>
            ) : (
              recentTransactions.map((tx, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + i * 0.05 }}
                  className="flex items-center gap-3 p-2 rounded-lg transition-colors"
                >
                  <div className={cn("w-8 h-8 rounded-lg grid place-items-center", tx.bgColor)}>
                    <Icon icon={tx.icon} className={cn("w-4 h-4", tx.color)} />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm flex items-center gap-1.5" style={{ color: 'var(--dash-text)' }}>
                      {tx.type === "deposit" ? "Deposit" :
                       tx.type === "withdraw" ? "Withdrawal" :
                       tx.type === "sent" ? `Sent to ${tx.to}` :
                       tx.type === "received" ? `Received from ${tx.from}` :
                       tx.type === "x402" ? `x402 from ${tx.from || "Service"}` : `Transfer`}
                      {tx.agentName && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/15 text-sky-400 font-medium">
                          <Icon icon="ph:robot-bold" className="w-3 h-3" />
                          {tx.agentName}
                        </span>
                      )}
                      {tx.source === "x_bot" && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/15 text-sky-400 font-medium">
                          <Icon icon="ri:twitter-x-fill" className="w-3 h-3" />
                          X Bot
                        </span>
                      )}
                    </div>
                    <div className="text-[11px]" style={{ color: 'var(--dash-text-faint)' }}>{tx.time}</div>
                  </div>
                  <div className={cn(
                    "text-sm font-medium",
                    tx.amount.startsWith("+") ? "text-emerald-400" : "text-red-400"
                  )}>
                    {showBalance ? tx.amount : "••••"}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Modals */}
      <DepositModal open={depositModalOpen} onOpenChange={handleDepositModalChange} />
      <SendPaymentModal open={sendModalOpen} onOpenChange={handleSendModalChange} />
      <X402PaymentModal open={x402ModalOpen} onOpenChange={setX402ModalOpen} />
      <PayX402Modal open={payX402ModalOpen} onOpenChange={setPayX402ModalOpen} />
    </>
  );
};

export default DashboardMainContent;
