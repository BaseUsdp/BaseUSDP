import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: "payment_received" | "payment_sent" | "x402_request" | "x402_paid" | "privacy_change" | "error";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

const mockNotifications: Notification[] = [
  {
    id: "1",
    type: "payment_received",
    title: "Payment Received",
    message: "You received an encrypted payment of $1,200.00 from 7xKq...9mPw",
    timestamp: "2 minutes ago",
    read: false,
  },
  {
    id: "2",
    type: "x402_paid",
    title: "x402 Payment Settled",
    message: "Your payment request for 'API Access' has been paid",
    timestamp: "1 hour ago",
    read: false,
  },
  {
    id: "3",
    type: "payment_sent",
    title: "Payment Confirmed",
    message: "Your payment of $500.00 to 3nFv...8kLz has been confirmed",
    timestamp: "3 hours ago",
    read: true,
  },
  {
    id: "4",
    type: "privacy_change",
    title: "Privacy Level Updated",
    message: "Your privacy level has been changed to 'Full'",
    timestamp: "Yesterday",
    read: true,
  },
];

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotificationCenter = ({ isOpen, onClose }: NotificationCenterProps) => {
  const [notifications, setNotifications] = useState(mockNotifications);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(n => ({ ...n, read: true }))
    );
  };

  const clearNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const getIcon = (type: Notification["type"]) => {
    switch (type) {
      case "payment_received":
        return <Icon icon="ph:arrow-down-left-bold" className="w-4 h-4 text-green-500" />;
      case "payment_sent":
        return <Icon icon="ph:arrow-up-right-bold" className="w-4 h-4 text-blue-500" />;
      case "x402_request":
      case "x402_paid":
        return <Icon icon="ph:check-bold" className="w-4 h-4 text-accent" />;
      case "privacy_change":
        return <Icon icon="ph:shield-check-bold" className="w-4 h-4 text-primary" />;
      case "error":
        return <Icon icon="ph:warning-circle-bold" className="w-4 h-4 text-destructive" />;
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
              {notifications.length === 0 ? (
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
                          notification.type === "payment_received" && "bg-green-500/20",
                          notification.type === "payment_sent" && "bg-blue-500/20",
                          (notification.type === "x402_request" || notification.type === "x402_paid") && "bg-accent/20",
                          notification.type === "privacy_change" && "bg-primary/20",
                          notification.type === "error" && "bg-destructive/20"
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
