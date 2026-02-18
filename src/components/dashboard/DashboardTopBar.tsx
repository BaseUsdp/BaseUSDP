import { useState, useCallback } from "react";
import { RefreshCw, Eye, EyeOff, Bell, Home, MessageSquare, Sun, Moon } from "lucide-react";
import { Link } from "react-router-dom";
import { useWallet } from "@/contexts/WalletContext";
import { useTheme } from "@/contexts/ThemeContext";
import WalletConnectButton from "@/components/WalletConnectButton";
import NotificationCenter from "./NotificationCenter";

interface DashboardTopBarProps {
  showBalance: boolean;
  setShowBalance: (show: boolean) => void;
  setActiveTab: (tab: string) => void;
  unreadMessages?: number;
}

const btnStyle: React.CSSProperties = {
  borderColor: 'var(--dash-border)',
  background: 'var(--dash-surface)',
  color: 'var(--dash-text)',
};

const DashboardTopBar = ({ showBalance, setShowBalance, setActiveTab, unreadMessages = 0 }: DashboardTopBarProps) => {
  const { refreshBalance, isBalanceLoading } = useWallet();
  const { theme, toggleTheme } = useTheme();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const handleUnreadChange = useCallback((unread: boolean) => setHasUnread(unread), []);

  return (
    <div
      className="flex items-center justify-between px-3 py-2"
      style={{ borderBottom: '1px solid var(--dash-border)' }}
    >
      {/* Left: Traffic Lights + Home Link */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-red-500/80" />
          <span className="h-3 w-3 rounded-full bg-yellow-400/80" />
          <span className="h-3 w-3 rounded-full bg-green-500/80" />
        </div>

        <Link
          to="/"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors"
          style={btnStyle}
        >
          <Home className="h-4 w-4" />
          <span className="text-xs font-medium hidden sm:inline">Home</span>
        </Link>

        <button
          disabled
          className="relative flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-not-allowed opacity-50"
          style={btnStyle}
        >
          <MessageSquare className="h-4 w-4" />
          <span className="text-xs font-medium hidden sm:inline">Messages</span>
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
            style={{ background: 'var(--dash-surface)', color: 'var(--dash-text-faint)' }}
          >
            Soon
          </span>
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="hidden sm:inline-flex rounded-md border p-1.5 transition-colors"
          style={btnStyle}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {/* Toggle Balance Visibility */}
        <button
          onClick={() => setShowBalance(!showBalance)}
          className="hidden sm:inline-flex rounded-md border p-1.5 transition-colors"
          style={btnStyle}
          title={showBalance ? "Hide balances" : "Show balances"}
        >
          {showBalance ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>

        {/* Refresh */}
        <button
          onClick={() => refreshBalance()}
          disabled={isBalanceLoading}
          className="hidden sm:inline-flex rounded-md border p-1.5 transition-colors disabled:opacity-50"
          style={btnStyle}
          title="Refresh balances"
        >
          <RefreshCw className={`h-4 w-4 ${isBalanceLoading ? "animate-spin" : ""}`} />
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="rounded-md border p-1.5 transition-colors relative"
            style={btnStyle}
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
