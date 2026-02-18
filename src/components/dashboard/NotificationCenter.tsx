import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWallet } from "@/contexts/WalletContext";
import { getApiUrl } from "@/utils/apiConfig";
import { authService } from "@/services/authService";

interface Notification {
  id: string;
  type: "deposit" | "withdraw" | "transfer_received" | "transfer_sent";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onUnreadChange?: (hasUnread: boolean) => void;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

const NotificationCenter = ({ isOpen, onClose, onUnreadChange }: NotificationCenterProps) => {
  const { fullWalletAddress, isConnected } = useWallet();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    // Load read state from localStorage
    try {
      const saved = localStorage.getItem("baseusdp_read_notifications");
      return saved ? new Set(JSON.parse(saved)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  // Fetch real transactions and convert to notifications
  const fetchNotifications = useCallback(async (showLoading = true) => {
    if (!isConnected || !fullWalletAddress) return;
    
    if (showLoading) setIsLoading(true);
    try {
      const apiUrl = getApiUrl();
      const sessionToken = authService.getSessionToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (sessionToken) {
        headers["Authorization"] = `Bearer ${sessionToken}`;
      }

      const response = await fetch(
        `${apiUrl}/api/history/${fullWalletAddress}?limit=20`,
        { headers }
      );
      const data = await response.json();

      if (data.success && data.transactions) {
        const notifs: Notification[] = data.transactions.map((tx: any) => {
          const amount = parseFloat(tx.amount || 0);
          const formattedAmount = `$${amount.toFixed(2)}`;
          const txType = tx.type || "transfer";
          const created = tx.created_at || tx.timestamp || new Date().toISOString();

          let type: Notification["type"];
          let title: string;
          let message: string;

          if (txType === "deposit") {
            type = "deposit";
            title = "Deposit Received";
            message = `Your deposit of ${formattedAmount} ${tx.token || "USDC"} has been processed`;
          } else if (txType === "withdraw") {
            type = "withdraw";
            title = "Withdrawal Completed";
            message = `Your withdrawal of ${formattedAmount} ${tx.token || "USDC"} has been sent`;
          } else if (tx.from === fullWalletAddress) {
            type = "transfer_sent";
            title = "Transfer Sent";
            message = `You sent ${formattedAmount} ${tx.token || "USDC"}`;
          } else {
            type = "transfer_received";
            title = "Transfer Received";
            message = `You received ${formattedAmount} ${tx.token || "USDC"}`;
          }

          return {
            id: tx.id || tx.tx_hash || `${created}-${amount}`,
            type,
            title,
            message,
            timestamp: timeAgo(created),
            read: readIds.has(tx.id || tx.tx_hash || `${created}-${amount}`),
          };
        });

        setNotifications(notifs);
      }
    } catch (err) {
      console.error("[NotificationCenter] Error fetching:", err);
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, fullWalletAddress, readIds]);

  // Fetch on mount (silently) to determine unread state for the dot indicator
  useEffect(() => {
    if (isConnected && fullWalletAddress) {
      fetchNotifications(false);
    }
  }, [isConnected, fullWalletAddress]);

  // Re-fetch when panel opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications(true);
    }
  }, [isOpen]);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Notify parent about unread state changes
  useEffect(() => {
    onUnreadChange?.(unreadCount > 0);
  }, [unreadCount, onUnreadChange]);

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
    setReadIds(prev => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem("baseusdp_read_notifications", JSON.stringify([...next]));
      return next;
    });
  };

  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(n => ({ ...n, read: true }))
    );
    setReadIds(prev => {
      const next = new Set(prev);
      notifications.forEach(n => next.add(n.id));
      localStorage.setItem("baseusdp_read_notifications", JSON.stringify([...next]));
      return next;
    });
  };

  const clearNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const getIcon = (type: Notification["type"]) => {
    switch (type) {
      case "deposit":
        return <Icon icon="ph:arrow-down-left-bold" className="w-4 h-4 text-green-500" />;
      case "withdraw":
        return <Icon icon="ph:arrow-up-right-bold" className="w-4 h-4 text-orange-500" />;
      case "transfer_received":
        return <Icon icon="ph:arrow-down-left-bold" className="w-4 h-4 text-green-500" />;
      case "transfer_sent":
        return <Icon icon="ph:arrow-up-right-bold" className="w-4 h-4 text-blue-500" />;
    }
  };

  const getIconBg = (type: Notification["type"]) => {
    switch (type) {
      case "deposit":
        return "bg-green-500/20";
      case "withdraw":
        return "bg-orange-500/20";
      case "transfer_received":
        return "bg-green-500/20";
      case "transfer_sent":
        return "bg-blue-500/20";
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40"
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 top-full mt-2 w-96 max-h-[500px] bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <h3 className="font-bold">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
                    {unreadCount} new
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  <Icon icon="ph:checks-bold" className="w-4 h-4 mr-1" />
                  Mark all read
                </Button>
              )}
            </div>

            {/* Notifications List */}
            <div className="max-h-[400px] overflow-y-auto">
              {isLoading ? (
                <div className="p-8 text-center">
                  <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm">Loading...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Icon icon="ph:bell-bold" className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {notifications.map((notification) => (
                    <motion.div
                      key={notification.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className={cn(
                        "p-4 hover:bg-secondary/50 transition-colors cursor-pointer relative group",
                        !notification.read && "bg-primary/5"
                      )}
                      onClick={() => markAsRead(notification.id)}
                    >
                      <div className="flex gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                          getIconBg(notification.type)
                        )}>
                          {getIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{notification.title}</p>
                            {!notification.read && (
                              <div className="w-2 h-2 rounded-full bg-primary" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {notification.timestamp}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            clearNotification(notification.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-secondary rounded"
                        >
                          <Icon icon="ph:x-bold" className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default NotificationCenter;
