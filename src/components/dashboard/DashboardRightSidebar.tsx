import { motion } from "framer-motion";
import { useState } from "react";
import {
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Plus,
  Download,
  TrendingUp,
  Clock,
  Shield,
  Send,
  Zap
} from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { cn } from "@/lib/utils";
import { useTransactionStats } from "@/hooks/useTransactionStats";
import SendPaymentModal from "./SendPaymentModal";

interface DashboardRightSidebarProps {
  showBalance: boolean;
  onNavigateToPaymentsTab?: (tab: string) => void;
}

const DashboardRightSidebar = ({ showBalance, onNavigateToPaymentsTab }: DashboardRightSidebarProps) => {
  const { encryptedBalance, privacyLevel, refreshBalance, isBalanceLoading } = useWallet();
  const { stats, isLoading: isLoadingStats, refetch: refetchStats } = useTransactionStats();
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const formatAmount = (amount: number, showSign: boolean = false) => {
    const sign = showSign ? (amount >= 0 ? "+" : "") : "";
    return `${sign}$${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const upcomingPayments: any[] = [];

  const alerts = [
    {
      type: "success",
      title: "Full Privacy Active",
      message: "All transactions use ZK proofs for privacy",
      color: "border-emerald-500/20 bg-emerald-500/10",
      textColor: "text-emerald-400"
    },
  ];

  const handleSyncAll = async () => {
    setIsSyncing(true);
    try {
      await Promise.all([refreshBalance(), refetchStats()]);
    } finally {
      setIsSyncing(false);
    }
  };

  const quickActions = [
    { icon: Send, label: "Send Payment", color: "text-sky-400", onClick: () => setSendModalOpen(true) },
    { icon: Download, label: "Request Payment", color: "text-purple-400", onClick: () => onNavigateToPaymentsTab?.("x402") },
  ];

  const surface = { background: 'var(--dash-surface)' };

  return (
    <div className="p-3 h-full flex flex-col">
      {/* AI Insights Header */}
      <div className="mb-3 flex items-center justify-between">
        <div
          className="inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs font-medium"
          style={{ borderColor: 'var(--dash-border)', ...surface, color: 'var(--dash-text)' }}
        >
          <Sparkles className="h-3.5 w-3.5 text-sky-400" />
          Insights
        </div>
        <button
          onClick={() => refreshBalance()}
          disabled={isBalanceLoading}
          className="rounded-md border p-1 transition-colors"
          style={{ borderColor: 'var(--dash-border)', ...surface, color: 'var(--dash-text)' }}
        >
          <RefreshCw className={cn("h-3 w-3", isBalanceLoading && "animate-spin")} />
        </button>
      </div>

      <div className="space-y-3 flex-1 overflow-y-auto">
        {/* Smart Tip */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg p-3 border border-sky-500/20 bg-sky-500/10"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full grid place-items-center bg-sky-500/20">
              <Zap className="w-3 h-3 text-sky-400" />
            </div>
            <span className="text-xs font-medium text-sky-400">Privacy Tip</span>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--dash-text)' }}>
            Your transactions are protected with ZK proofs. Amounts and parties are hidden for maximum privacy.
          </p>
        </motion.div>

        {/* Upcoming Payments */}
        <div className="rounded-lg p-3" style={surface}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: 'var(--dash-text)' }}>Upcoming</span>
            <span className="text-[11px]" style={{ color: 'var(--dash-text-faint)' }}>Next 7 days</span>
          </div>
          <div className="space-y-2">
            {upcomingPayments.map((payment, i) => (
              <motion.div
                key={payment.name}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between p-2 rounded"
                style={surface}
              >
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", payment.color)} />
                  <div>
                    <div className="text-xs" style={{ color: 'var(--dash-text)' }}>{payment.name}</div>
                    <div className="text-[11px]" style={{ color: 'var(--dash-text-faint)' }}>{payment.due}</div>
                  </div>
                </div>
                <span className={cn(
                  "text-xs font-medium",
                  payment.amount.startsWith("+") ? "text-emerald-400" : ""
                )} style={!payment.amount.startsWith("+") ? { color: 'var(--dash-text)' } : undefined}>
                  {showBalance ? payment.amount : "••••"}
                </span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Alerts */}
        <div className="rounded-lg p-3" style={surface}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: 'var(--dash-text)' }}>Status</span>
            <span className="px-1.5 py-0.5 rounded-full text-[11px] bg-emerald-500/20 text-emerald-400">
              {alerts.length} Active
            </span>
          </div>
          <div className="space-y-2">
            {alerts.map((alert, i) => (
              <motion.div
                key={alert.title}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={cn("p-2 border rounded", alert.color)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Shield className={cn("w-3 h-3", alert.textColor)} />
                  <span className={cn("text-xs", alert.textColor)}>{alert.title}</span>
                </div>
                <p className="text-[11px]" style={{ color: 'var(--dash-text)' }}>{alert.message}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rounded-lg p-3" style={surface}>
          <div className="mb-2 text-xs font-medium" style={{ color: 'var(--dash-text)' }}>Quick Actions</div>
          <div className="space-y-2">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={action.onClick}
                className="w-full flex items-center gap-2 p-2 rounded text-left transition-colors"
                style={surface}
              >
                <action.icon className={cn("w-4 h-4", action.color)} />
                <span className="text-xs" style={{ color: 'var(--dash-text)' }}>{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Monthly Summary */}
        <div className="rounded-lg p-3" style={surface}>
          <div className="mb-2 text-xs font-medium" style={{ color: 'var(--dash-text)' }}>This Month</div>
          <div className="space-y-2 text-[11px]">
            <div className="flex justify-between">
              <span style={{ color: 'var(--dash-text-muted)' }}>Received</span>
              <span className="text-sky-400">
                {showBalance ? (isLoadingStats ? "..." : formatAmount(stats.monthlyReceived, true)) : "••••"}
              </span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--dash-text-muted)' }}>Sent</span>
              <span className="text-red-400">
                {showBalance ? (isLoadingStats ? "..." : formatAmount(stats.monthlySent, true)) : "••••"}
              </span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--dash-text-muted)' }}>Yield</span>
              <span className="text-emerald-400">
                {showBalance ? (isLoadingStats ? "..." : formatAmount(stats.monthlyYield, true)) : "••••"}
              </span>
            </div>
            <div className="h-px my-1" style={{ background: 'var(--dash-border)' }} />
            <div className="flex justify-between font-medium">
              <span style={{ color: 'var(--dash-text)' }}>Net</span>
              <span className="text-sky-400">
                {showBalance ? (isLoadingStats ? "..." : formatAmount(stats.monthlyReceived - stats.monthlySent, true)) : "••••"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="mt-4">
        <button
          onClick={handleSyncAll}
          disabled={isSyncing}
          className={cn(
            "w-full px-3 py-2 text-white rounded text-xs font-medium transition-colors",
            isSyncing ? "bg-sky-600/50 cursor-not-allowed" : "bg-sky-600 hover:bg-sky-500"
          )}
        >
          {isSyncing ? (
            <span className="inline-flex items-center gap-2">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Syncing...
            </span>
          ) : (
            "Sync All"
          )}
        </button>
      </div>

      <SendPaymentModal open={sendModalOpen} onOpenChange={setSendModalOpen} />
    </div>
  );
};

export default DashboardRightSidebar;
