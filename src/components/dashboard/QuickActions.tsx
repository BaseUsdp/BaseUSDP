import { motion } from "framer-motion";
import { Icon } from "@iconify/react";

const QuickActions = () => {
  const actions = [
    { icon: "ph:paper-plane-tilt-bold", label: "Send", description: "Private P2P transfer", color: "from-primary to-violet-500" },
    { icon: "ph:download-bold", label: "Receive", description: "Generate QR code", color: "from-accent to-purple-500" },
    { icon: "ph:arrows-left-right-bold", label: "Swap", description: "Private token swap", color: "from-violet-500 to-primary" },
    { icon: "ph:credit-card-bold", label: "Card", description: "Virtual debit card", color: "from-purple-500 to-accent" },
    { icon: "ph:piggy-bank-bold", label: "Savings", description: "Earn yield privately", color: "from-primary to-accent" },
    { icon: "ph:qr-code-bold", label: "Scan", description: "Scan to pay", color: "from-violet-500 to-purple-500" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <h3 className="font-semibold text-muted-foreground uppercase tracking-wider text-sm mb-4">
        Quick Actions
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {actions.map((action, i) => (
          <motion.button
            key={action.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 + i * 0.05 }}
            whileHover={{ scale: 1.05, y: -4 }}
            whileTap={{ scale: 0.95 }}
            className="card-premium p-5 flex flex-col items-center text-center group cursor-pointer"
          >
            <div className={`relative w-12 h-12 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center mb-3 group-hover:shadow-glow transition-shadow`}>
              <Icon icon={action.icon} className="w-5 h-5 text-white" />
              <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${action.color} opacity-0 blur-xl group-hover:opacity-50 transition-opacity`} />
            </div>
            <p className="font-semibold text-sm mb-1">{action.label}</p>
            <p className="text-xs text-muted-foreground">{action.description}</p>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
};

export default QuickActions;
