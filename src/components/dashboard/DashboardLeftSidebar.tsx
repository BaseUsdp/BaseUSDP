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
  History
} from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { cn } from "@/lib/utils";
import { useTransactionStats } from "@/hooks/useTransactionStats";

interface DashboardLeftSidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  showBalance: boolean;
}

const DashboardLeftSidebar = ({ activeTab, setActiveTab, showBalance }: DashboardLeftSidebarProps) => {
  const { encryptedBalance, privacyLevel, walletAddress } = useWallet();
  const { stats, isLoading: isLoadingStats } = useTransactionStats();

  const navItems = [
    { id: "overview", label: "Dashboard", icon: LayoutDashboard },
    { id: "payments", label: "Payments", icon: Send },
    { id: "history", label: "History", icon: History },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  // Only show real encrypted wallet - remove mock accounts
  const accounts = [
    { 
      name: "Encrypted Wallet", 
      address: walletAddress || "Connect Wallet",
      balance: encryptedBalance,
      color: "from-sky-500 to-sky-600",
      active: true
    },
  ];

  const formatAmount = (amount: number) => {
    return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const categories = [
    { name: "Transfers", color: "bg-sky-500", amount: isLoadingStats ? "..." : formatAmount(stats.transfers) },
    { name: "Stables (USDC/USDT)", color: "bg-emerald-500", amount: isLoadingStats ? "..." : formatAmount(stats.payments) },
    { name: "Yield Earnings", color: "bg-purple-500", amount: isLoadingStats ? "..." : formatAmount(stats.yieldEarnings) },
    { name: "Gas Fees", color: "bg-red-500", amount: isLoadingStats ? "..." : formatAmount(stats.gasFees) },
  ];

  return (
    <div className="p-3 h-full flex flex-col">
      {/* Navigation */}
      <div className="mb-4">
        <div className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs font-medium text-neutral-300 mb-3">
          <LayoutDashboard className="h-3.5 w-3.5" />
          Navigation
        </div>
        <div className="space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors",
                activeTab === item.id
                  ? "bg-sky-500/20 text-sky-400"
                  : "text-neutral-300 hover:bg-white/5"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Stats */}
      <div className="bg-white/5 rounded-lg p-2 mb-4">
        <div className="text-xs text-neutral-400 mb-2">Overview</div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400">Total Balance</span>
            <span className="text-xs font-semibold text-sky-400">
              {showBalance ? `$${encryptedBalance}` : "••••••"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400">Privacy Level</span>
            <span className={cn(
              "text-xs font-semibold capitalize",
              privacyLevel === "full" ? "text-emerald-400" : 
              privacyLevel === "partial" ? "text-yellow-400" : "text-sky-400"
            )}>
              {privacyLevel}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400">Network</span>
            <span className="text-xs font-semibold text-emerald-400">Solana Mainnet</span>
          </div>
        </div>
      </div>

      {/* Accounts Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs font-medium text-neutral-300">
          <Wallet className="h-3.5 w-3.5" />
          Accounts
        </div>
        <button className="rounded-md border border-white/10 bg-white/5 p-1 text-neutral-300 hover:bg-white/10 transition-colors">
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Accounts List */}
      <div className="flex-1 bg-white/5 rounded-lg p-2 mb-4">
        <div className="text-xs text-neutral-400 mb-2">Connected Accounts</div>
        <ul className="space-y-1">
          {accounts.map((account, i) => (
            <motion.li
              key={account.name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer transition-colors",
                account.active ? "bg-sky-500/20" : "hover:bg-white/5"
              )}
            >
              <div className={cn(
                "w-6 h-6 rounded bg-gradient-to-br grid place-items-center",
                account.color
              )}>
                {account.name.includes("Vault") ? (
                  <TrendingUp className="w-3 h-3 text-white" />
                ) : account.name.includes("Escrow") ? (
                  <Download className="w-3 h-3 text-white" />
                ) : (
                  <Shield className="w-3 h-3 text-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-neutral-300 truncate">{account.name}</div>
                <div className="text-[11px] text-neutral-500 font-mono">{account.address}</div>
              </div>
              <span className={cn(
                "text-xs",
                account.active ? "text-sky-400" : "text-neutral-400"
              )}>
                {showBalance ? `$${account.balance}` : "••••"}
              </span>
            </motion.li>
          ))}
        </ul>
      </div>

      {/* Categories */}
      <div className="bg-white/5 rounded-lg p-3">
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-sky-400" />
            <span className="text-xs font-medium text-neutral-300">Activity</span>
          </div>
          <span className="text-[11px] text-neutral-500">This Month</span>
        </div>
        <div className="space-y-1">
          {categories.map((cat) => (
            <div key={cat.name} className="flex items-center gap-2 text-xs hover:bg-white/5 p-1 rounded">
              <div className={cn("w-2 h-2 rounded-full", cat.color)} />
              <span className="text-neutral-300 flex-1 text-xs">{cat.name}</span>
              <div className="text-xs text-neutral-400">
                {showBalance ? cat.amount : "••••"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardLeftSidebar;
