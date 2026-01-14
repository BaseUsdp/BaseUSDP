import { motion } from "framer-motion";
import { Send, Download, QrCode, Settings, History, Shield, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickActionsGridProps {
  onAction: (action: string) => void;
}

const QuickActionsGrid = ({ onAction }: QuickActionsGridProps) => {
  const actions = [
    { 
      id: "send", 
      icon: Send, 
      label: "Send Payment", 
      description: "Encrypted P2P transfer",
      color: "from-primary to-violet-500"
    },
    { 
      id: "request", 
      icon: Download, 
      label: "Request x402", 
      description: "Create payment request",
      color: "from-accent to-purple-500"
    },
    { 
      id: "pay_x402", 
      icon: CreditCard, 
      label: "Pay Request", 
      description: "Pay x402 payment",
      color: "from-pink-500 to-rose-500"
    },
    { 
      id: "receive", 
      icon: QrCode, 
      label: "Receive", 
      description: "Show QR code",
      color: "from-blue-500 to-cyan-500"
    },
    { 
      id: "history", 
      icon: History, 
      label: "History", 
      description: "View transactions",
      color: "from-green-500 to-emerald-500"
    },
    { 
      id: "settings", 
      icon: Settings, 
      label: "Settings", 
      description: "Configure wallet",
      color: "from-gray-500 to-slate-500"
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <h3 className="font-semibold text-muted-foreground uppercase tracking-wider text-sm mb-4">
        Quick Actions
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {actions.map((action, i) => (
          <motion.button
            key={action.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 + i * 0.03 }}
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onAction(action.id)}
            className="rounded-2xl border border-border bg-card p-4 flex flex-col items-center text-center group cursor-pointer hover:border-primary/30 transition-all"
          >
            <div className={cn(
              "relative w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center mb-3 group-hover:shadow-lg transition-shadow",
              action.color
            )}>
              <action.icon className="w-5 h-5 text-white" />
              <div className={cn(
                "absolute inset-0 rounded-xl bg-gradient-to-br opacity-0 blur-xl group-hover:opacity-40 transition-opacity",
                action.color
              )} />
            </div>
            <p className="font-semibold text-sm mb-0.5">{action.label}</p>
            <p className="text-xs text-muted-foreground">{action.description}</p>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
};

export default QuickActionsGrid;
