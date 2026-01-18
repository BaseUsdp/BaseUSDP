import { motion } from "framer-motion";
import { 
  Sparkles, 
  RefreshCw, 
  AlertTriangle, 
  Bell, 
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

interface DashboardRightSidebarProps {
  showBalance: boolean;
}

const DashboardRightSidebar = ({ showBalance }: DashboardRightSidebarProps) => {
  const { encryptedBalance, privacyLevel, refreshBalance, isBalanceLoading } = useWallet();
  const { stats, isLoading: isLoadingStats } = useTransactionStats();

  const formatAmount = (amount: number, showSign: boolean = false) => {
    const sign = showSign ? (amount >= 0 ? "+" : "") : "";
    return `${sign}$${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // TODO: Fetch real upcoming payments from x402 API
  const upcomingPayments: any[] = [];

  // TODO: Fetch real alerts/status from API
  const alerts = [
    { 
      type: "success", 
      title: "Full Privacy Active", 
      message: "All transactions use ZK proofs for privacy",
      color: "border-emerald-500/20 bg-emerald-500/10",
      textColor: "text-emerald-400"
    },
  ];

  const quickActions = [
    { icon: Send, label: "Send Payment", color: "text-sky-400" },
    { icon: Download, label: "Request x402", color: "text-purple-400" },
    { icon: TrendingUp, label: "Yield Vaults", color: "text-emerald-400" },
  ];

  return (
    <div className="p-3 h-full flex flex-col">
      {/* AI Insights Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs font-medium text-neutral-300">
          <Sparkles className="h-3.5 w-3.5 text-sky-400" />
          Insights
        </div>
        <button 
          onClick={() => refreshBalance()}
          disabled={isBalanceLoading}
          className="rounded-md border border-white/10 bg-white/5 p-1 text-neutral-300 hover:bg-white/10 transition-colors"
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
          <p className="text-xs text-neutral-300 leading-relaxed mb-2">
            Your transactions are protected with ZK proofs. Amounts and parties are hidden for maximum privacy.
          </p>
          <button className="text-[11px] text-sky-400 hover:text-sky-300 transition-colors">
            Learn More →
          </button>
        </motion.div>

        {/* Upcoming Payments */}
        <div className="bg-white/5 rounded-lg p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-300">Upcoming</span>
            <span className="text-[11px] text-neutral-500">Next 7 days</span>
          </div>
          <div className="space-y-2">
            {upcomingPayments.map((payment, i) => (
              <motion.div
                key={payment.name}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between p-2 bg-white/5 rounded"
              >
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", payment.color)} />
                  <div>
                    <div className="text-xs text-neutral-300">{payment.name}</div>
                    <div className="text-[11px] text-neutral-500">{payment.due}</div>
                  </div>
                </div>
                <span className={cn(
                  "text-xs font-medium",
                  payment.amount.startsWith("+") ? "text-emerald-400" : "text-neutral-300"
                )}>
                  {showBalance ? payment.amount : "••••"}
                </span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Alerts */}
        <div className="bg-white/5 rounded-lg p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-300">Status</span>
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
                <p className="text-[11px] text-neutral-300">{alert.message}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white/5 rounded-lg p-3">
          <div className="mb-2 text-xs font-medium text-neutral-300">Quick Actions</div>
          <div className="space-y-2">
            {quickActions.map((action) => (
              <button
                key={action.label}
                className="w-full flex items-center gap-2 p-2 bg-white/5 hover:bg-white/10 rounded text-left transition-colors"
              >
                <action.icon className={cn("w-4 h-4", action.color)} />
                <span className="text-xs text-neutral-300">{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Monthly Summary */}
        <div className="bg-white/5 rounded-lg p-3">
          <div className="mb-2 text-xs font-medium text-neutral-300">This Month</div>
          <div className="space-y-2 text-[11px]">
            <div className="flex justify-between">
              <span className="text-neutral-400">Received</span>
              <span className="text-sky-400">
                {showBalance ? (isLoadingStats ? "..." : formatAmount(stats.monthlyReceived, true)) : "••••"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Sent</span>
              <span className="text-red-400">
                {showBalance ? (isLoadingStats ? "..." : formatAmount(stats.monthlySent, true)) : "••••"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Yield</span>
              <span className="text-emerald-400">
                {showBalance ? (isLoadingStats ? "..." : formatAmount(stats.monthlyYield, true)) : "••••"}
              </span>
            </div>
            <div className="h-px bg-white/10 my-1" />
            <div className="flex justify-between font-medium">
              <span className="text-neutral-300">Net</span>
              <span className="text-sky-400">
                {showBalance ? (isLoadingStats ? "..." : formatAmount(stats.monthlyReceived - stats.monthlySent, true)) : "••••"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="mt-4 flex gap-2">
        <button className="flex-1 px-3 py-2 text-white rounded text-xs font-medium bg-sky-600 hover:bg-sky-500 transition-colors">
          Sync All
        </button>
        <button className="px-3 py-2 bg-white/5 text-neutral-300 rounded text-xs font-medium border border-white/10 hover:bg-white/10 transition-colors">
          <Bell className="inline w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default DashboardRightSidebar;
