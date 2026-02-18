import { useState, useCallback } from "react";
import { Bell } from "lucide-react";
import WalletConnectButton from "@/components/WalletConnectButton";
import NotificationCenter from "./NotificationCenter";

interface DashboardHeaderProps {
  showBalance: boolean;
  setShowBalance: (show: boolean) => void;
  isConnected: boolean;
}

const DashboardHeader = ({ showBalance, setShowBalance, isConnected }: DashboardHeaderProps) => {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const handleUnreadChange = useCallback((unread: boolean) => setHasUnread(unread), []);

  return (
    <header className="h-16 border-b border-border bg-card/30 flex items-center justify-between px-6">
      {/* Network Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card border border-border">
          <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-yellow-500"} animate-pulse`} />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {isConnected ? "Base" : "Disconnected"}
          </span>
        </div>
      </div>

      {/* Right side controls */}
      <div className="flex items-center gap-3">
        <WalletConnectButton variant="dashboard" />
        
        {/* Notifications */}
        <div className="relative">
          <button 
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="p-2 rounded-lg border border-border bg-card hover:bg-secondary transition-colors relative"
          >
            <Bell className="w-4 h-4 text-muted-foreground" />
            {/* Unread indicator */}
            {hasUnread && (
              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary border-2 border-card" />
            )}
          </button>
          
          <NotificationCenter 
            isOpen={notificationsOpen} 
            onClose={() => setNotificationsOpen(false)}
            onUnreadChange={handleUnreadChange}
          />
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
