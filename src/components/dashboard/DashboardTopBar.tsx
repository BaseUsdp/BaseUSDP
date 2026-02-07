import { useState, useCallback } from "react";
import { Download, MoreVertical, RefreshCw, Eye, EyeOff, Bell, Home } from "lucide-react";
import { Link } from "react-router-dom";
import { useWallet } from "@/contexts/WalletContext";
import WalletConnectButton from "@/components/WalletConnectButton";
import NotificationCenter from "./NotificationCenter";

interface DashboardTopBarProps {
  showBalance: boolean;
  setShowBalance: (show: boolean) => void;
}

const DashboardTopBar = ({ showBalance, setShowBalance }: DashboardTopBarProps) => {
  const { refreshBalance, isBalanceLoading } = useWallet();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const handleUnreadChange = useCallback((unread: boolean) => setHasUnread(unread), []);

  return (
    <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
      {/* Left: Traffic Lights + Home Link */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-red-500/80" />
          <span className="h-3 w-3 rounded-full bg-yellow-400/80" />
          <span className="h-3 w-3 rounded-full bg-green-500/80" />
        </div>
        
        <Link
          to="/"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors text-neutral-200 hover:text-white"
        >
          <Home className="h-4 w-4" />
          <span className="text-xs font-medium hidden sm:inline">Home</span>
        </Link>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2">
        {/* Toggle Balance Visibility */}
        <button
          onClick={() => setShowBalance(!showBalance)}
          className="hidden sm:inline-flex rounded-md border border-white/10 bg-white/5 p-1.5 text-neutral-200 hover:bg-white/10 transition-colors"
          title={showBalance ? "Hide balances" : "Show balances"}
        >
          {showBalance ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>

        {/* Refresh */}
        <button
          onClick={() => refreshBalance()}
          disabled={isBalanceLoading}
          className="hidden sm:inline-flex rounded-md border border-white/10 bg-white/5 p-1.5 text-neutral-200 hover:bg-white/10 transition-colors disabled:opacity-50"
          title="Refresh balances"
        >
          <RefreshCw className={`h-4 w-4 ${isBalanceLoading ? "animate-spin" : ""}`} />
        </button>

        {/* Download/Export */}
        <button className="hidden sm:inline-flex rounded-md border border-white/10 bg-white/5 p-1.5 text-neutral-200 hover:bg-white/10 transition-colors">
          <Download className="h-4 w-4" />
        </button>

        {/* More Options */}
        <button className="hidden sm:inline-flex rounded-md border border-white/10 bg-white/5 p-1.5 text-neutral-200 hover:bg-white/10 transition-colors">
          <MoreVertical className="h-4 w-4" />
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="rounded-md border border-white/10 bg-white/5 p-1.5 text-neutral-200 hover:bg-white/10 transition-colors relative"
          >
            <Bell className="h-4 w-4" />
            {hasUnread && (
              <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-sky-500" />
            )}
          </button>
          <NotificationCenter 
            isOpen={notificationsOpen} 
            onClose={() => setNotificationsOpen(false)}
            onUnreadChange={handleUnreadChange}
          />
        </div>

        {/* Wallet Connect */}
        <WalletConnectButton variant="dashboard" />
      </div>
    </div>
  );
};

export default DashboardTopBar;
