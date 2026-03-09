import { motion } from "framer-motion";
import {
  CreditCard,
  Plus,
  Shield,
  TrendingUp,
  Wallet,
  LayoutDashboard,
  Send,
  Download,
  Settings,
  History,
  ArrowUpRight,
  ArrowLeftRight,
  MessageSquare,
  Terminal,
  Bot
} from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { cn } from "@/lib/utils";
import { useTransactionStats } from "@/hooks/useTransactionStats";

interface DashboardLeftSidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  showBalance: boolean;
  unreadMessages?: number;
}

const DashboardLeftSidebar = ({ activeTab, setActiveTab, showBalance, unreadMessages = 0 }: DashboardLeftSidebarProps) => {
  const { encryptedBalance, privacyLevel, walletAddress, activeChain } = useWallet();
  const { stats, isLoading: isLoadingStats } = useTransactionStats();

  const navItems = [
    { id: "overview", label: "Dashboard", icon: LayoutDashboard },
    { id: "terminal", label: "AI Terminal", icon: Terminal },
    { id: "agents", label: "Agents", icon: Bot },
    { id: "payments", label: "Payments", icon: Send },
    { id: "withdraw", label: "Withdraw", icon: ArrowUpRight },
    { id: "swap", label: "Swap", icon: ArrowLeftRight },
    { id: "history", label: "History", icon: History },
    { id: "messages", label: "Messages", icon: MessageSquare },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const accounts = [
    {
      name: "Encrypted Wallet",
      address: walletAddress || "Connect Wallet",
      balance: encryptedBalance,
      color: "from-sky-500 to-sky-600",
      active: true
    },
  ];

  const formatUsd = (amount: number) => {
    return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatEth = (amount: number) => {
    if (amount === 0) return "0 ETH";
    return `${amount.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 4 })} ETH`;
  };

  const categories = [
    { name: "Transfers", color: "bg-sky-500", amount: isLoadingStats ? "..." : formatUsd(stats.transfers), disabled: false },
    { name: "Stables (USDC/USDT)", color: "bg-emerald-500", amount: isLoadingStats ? "..." : formatUsd(stats.stables), disabled: false },
    { name: "Yield Earnings", color: "bg-purple-500/40", amount: "Coming Soon", disabled: true },
    { name: "Gas Fees", color: "bg-red-500", amount: isLoadingStats ? "..." : formatEth(stats.gasFeesEth), disabled: false },
  ];

  return (
    <div className="p-3 h-full flex flex-col">
      {/* Navigation */}
      <div className="mb-4">
        <div
          className="inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs font-medium mb-3"
          style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-surface)', color: 'var(--dash-text)' }}
        >
          <LayoutDashboard className="h-3.5 w-3.5" />
          Navigation
        </div>
        <div className="space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => !["messages", "terminal", "swap"].includes(item.id) && setActiveTab(item.id)}
              disabled={["messages", "terminal", "swap"].includes(item.id)}
              className={cn(
                "w-full flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors",
                (["messages", "terminal", "swap"].includes(item.id))
                  ? "cursor-not-allowed opacity-50"
                  : activeTab === item.id
                  ? "bg-sky-500/20 text-sky-400"
                  : ""
              )}
              style={
                (["messages", "terminal", "swap"].includes(item.id))
                  ? { color: 'var(--dash-text-faint)' }
                  : activeTab === item.id
                  ? undefined
                  : { color: 'var(--dash-text)' }
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
              {(["messages", "terminal", "swap"].includes(item.id)) && (
                <span
                  className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                  style={{ background: 'var(--dash-surface)', color: 'var(--dash-text-faint)' }}
                >
                  Soon
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Stats */}
      <div className="rounded-lg p-2 mb-4" style={{ background: 'var(--dash-surface)' }}>
        <div className="text-xs mb-2" style={{ color: 'var(--dash-text-muted)' }}>Overview</div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--dash-text-muted)' }}>Total Balance</span>
            <span className="text-xs font-semibold text-sky-400">
              {showBalance ? `$${encryptedBalance}` : "••••••"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--dash-text-muted)' }}>Privacy Level</span>
            <span className={cn(
              "text-xs font-semibold capitalize",
              privacyLevel === "full" ? "text-emerald-400" :
              privacyLevel === "partial" ? "text-yellow-400" : "text-sky-400"
            )}>
              {privacyLevel}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--dash-text-muted)' }}>Network</span>
            <span className="text-xs font-semibold text-emerald-400">{activeChain === "base" ? "Base" : "Legacy"}</span>
          </div>
        </div>
      </div>

      {/* Accounts Header */}
      <div className="mb-3 flex items-center justify-between">
        <div
          className="inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs font-medium"
          style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-surface)', color: 'var(--dash-text)' }}
        >
          <Wallet className="h-3.5 w-3.5" />
          Accounts
        </div>
        <button
          className="rounded-md border p-1 opacity-40 cursor-not-allowed"
          style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-surface)', color: 'var(--dash-text-faint)' }}
          disabled
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Accounts List */}
      <div className="flex-1 rounded-lg p-2 mb-4" style={{ background: 'var(--dash-surface)' }}>
        <div className="text-xs mb-2" style={{ color: 'var(--dash-text-muted)' }}>Connected Accounts</div>
        <ul className="space-y-1">
          {accounts.map((account, i) => (
            <motion.li
              key={account.name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer transition-colors",
                account.active ? "bg-sky-500/20" : ""
              )}
            >
              <div className={cn(
                "w-6 h-6 rounded bg-gradient-to-br grid place-items-center",
                account.color
              )}>
                <Shield className="w-3 h-3 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate" style={{ color: 'var(--dash-text)' }}>{account.name}</div>
                <div className="text-[11px] font-mono" style={{ color: 'var(--dash-text-faint)' }}>{account.address}</div>
              </div>
              <span className={cn(
                "text-xs",
                account.active ? "text-sky-400" : ""
              )} style={!account.active ? { color: 'var(--dash-text-muted)' } : undefined}>
                {showBalance ? `$${account.balance}` : "••••"}
              </span>
            </motion.li>
          ))}
        </ul>
      </div>

      {/* Categories */}
      <div className="rounded-lg p-3" style={{ background: 'var(--dash-surface)' }}>
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-sky-400" />
            <span className="text-xs font-medium" style={{ color: 'var(--dash-text)' }}>Activity</span>
          </div>
          <span className="text-[11px]" style={{ color: 'var(--dash-text-faint)' }}>This Month</span>
        </div>
        <div className="space-y-1">
          {categories.map((cat) => (
            <div key={cat.name} className={cn(
              "flex items-center gap-2 text-xs p-1 rounded",
              cat.disabled ? "opacity-40 cursor-not-allowed" : ""
            )}>
              <div className={cn("w-2 h-2 rounded-full", cat.color)} />
              <span className="flex-1 text-xs" style={{ color: cat.disabled ? 'var(--dash-text-faint)' : 'var(--dash-text)' }}>
                {cat.name}
              </span>
              <div className="text-xs" style={{ color: cat.disabled ? 'var(--dash-text-faint)' : 'var(--dash-text-muted)' }}>
                {cat.disabled ? cat.amount : (showBalance ? cat.amount : "••••")}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardLeftSidebar;
