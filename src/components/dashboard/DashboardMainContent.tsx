import { useState } from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import SendPaymentModal from "./SendPaymentModal";
import ReceivePaymentModal from "./ReceivePaymentModal";
import X402PaymentModal from "./X402PaymentModal";
import PayX402Modal from "./PayX402Modal";
import PrivacyLevelSelector from "./PrivacyLevelSelector";
import SettingsSection from "./sections/SettingsSection";
import PaymentsSection from "./sections/PaymentsSection";

interface DashboardMainContentProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  showBalance: boolean;
  setShowBalance: (show: boolean) => void;
}

const DashboardMainContent = ({ activeTab, setActiveTab, showBalance, setShowBalance }: DashboardMainContentProps) => {
  const { encryptedBalance, privacyLevel, refreshBalance, isBalanceLoading } = useWallet();
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [x402ModalOpen, setX402ModalOpen] = useState(false);
  const [payX402ModalOpen, setPayX402ModalOpen] = useState(false);

  const recentTransactions = [
    { type: "received", from: "7xKq...9mPw", amount: "+$1,200.00", time: "Today, 2:34 PM", icon: "ph:arrow-down-left-bold", color: "text-emerald-400", bgColor: "bg-emerald-500/20" },
    { type: "sent", to: "3nFv...8kLz", amount: "-$500.00", time: "Yesterday, 6:12 PM", icon: "ph:arrow-up-right-bold", color: "text-red-400", bgColor: "bg-red-500/20" },
    { type: "x402", from: "API Service", amount: "+$50.00", time: "Jan 10, 9:00 AM", icon: "ph:download-bold", color: "text-purple-400", bgColor: "bg-purple-500/20" },
    { type: "yield", from: "Yield Vault", amount: "+$25.00", time: "Jan 8, 12:00 PM", icon: "ph:trend-up-bold", color: "text-sky-400", bgColor: "bg-sky-500/20" },
  ];

  if (activeTab === "settings") {
    return (
      <div className="p-4 sm:p-6">
        <SettingsSection />
      </div>
    );
  }

  if (activeTab === "payments" || activeTab === "history") {
    return (
      <div className="p-4 sm:p-6">
        <PaymentsSection showBalance={showBalance} />
      </div>
    );
  }

  // Overview Tab
  return (
    <>
      {/* Content Header */}
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2 text-xs text-neutral-300">
        <Icon icon="ph:package-bold" className="h-4 w-4 text-sky-400" />
        <span>Dashboard</span>
        <span className="text-neutral-500">•</span>
        <span className="text-neutral-400">Privacy Mode: {privacyLevel}</span>
        <div className="ml-auto">
          <button className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 hover:bg-white/10 text-[11px] transition-colors">
            <Icon icon="ph:upload-bold" className="w-3 h-3" />
            Export
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-4">
        {/* Spending Overview / Balance Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-xl p-5 bg-gradient-to-br from-black/0 via-black/10 to-black/0 backdrop-blur border border-white/5"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Icon icon="ph:shield-check-bold" className="w-4 h-4 text-sky-400" />
                <span className="text-sm text-neutral-400">Encrypted Balance</span>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-semibold tracking-tight">
                  {showBalance ? `$${encryptedBalance}` : "••••••••"}
                </span>
                <button
                  onClick={() => setShowBalance(!showBalance)}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                >
                  {showBalance ? (
                    <Icon icon="ph:eye-slash-bold" className="w-4 h-4 text-neutral-400" />
                  ) : (
                    <Icon icon="ph:eye-bold" className="w-4 h-4 text-neutral-400" />
                  )}
                </button>
                <button
                  onClick={() => refreshBalance()}
                  disabled={isBalanceLoading}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                >
                  <Icon icon="ph:arrows-clockwise-bold" className={cn(
                    "w-4 h-4 text-neutral-400",
                    isBalanceLoading && "animate-spin"
                  )} />
                </button>
              </div>
              <div className="flex items-center gap-1 text-xs mt-1 text-emerald-400">
                <Icon icon="ph:trend-up-bold" className="w-3 h-3" />
                +2.4% from last month
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-neutral-400 mb-1">Privacy</div>
              <div className={cn(
                "text-xl font-semibold capitalize",
                privacyLevel === "full" ? "text-emerald-400" :
                privacyLevel === "partial" ? "text-yellow-400" : "text-sky-400"
              )}>
                {privacyLevel}
              </div>
              <div className="flex items-center gap-1 justify-end text-xs text-neutral-400 mt-1">
                <Icon icon="ph:lock-bold" className="w-3 h-3" />
                FHE Protected
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-lg bg-white/5 p-3">
              <div className="flex items-center gap-2 mb-1">
                <Icon icon="ph:arrow-down-left-bold" className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-neutral-400">Received</span>
              </div>
              <p className="text-lg font-semibold">{showBalance ? "$5,200" : "••••"}</p>
            </div>
            <div className="rounded-lg bg-white/5 p-3">
              <div className="flex items-center gap-2 mb-1">
                <Icon icon="ph:arrow-up-right-bold" className="w-4 h-4 text-red-400" />
                <span className="text-xs text-neutral-400">Sent</span>
              </div>
              <p className="text-lg font-semibold">{showBalance ? "$2,450" : "••••"}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button 
              onClick={() => setSendModalOpen(true)}
              className="flex-1 bg-sky-600 hover:bg-sky-500 text-white"
            >
              <Icon icon="ph:paper-plane-tilt-bold" className="w-4 h-4 mr-2" />
              Send
            </Button>
            <Button 
              onClick={() => setReceiveModalOpen(true)}
              variant="outline" 
              className="flex-1 border-white/10 bg-white/5 hover:bg-white/10"
            >
              <Icon icon="ph:download-bold" className="w-4 h-4 mr-2" />
              Receive
            </Button>
          </div>
        </motion.div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-2 gap-3">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl p-4 bg-gradient-to-br from-black/0 via-black/10 to-black/0 backdrop-blur border border-white/5"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-neutral-300">x402 Payments</div>
              <span className="text-xs text-sky-400">Active</span>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={() => setX402ModalOpen(true)}
                size="sm" 
                className="flex-1 bg-purple-600 hover:bg-purple-500 text-white text-xs"
              >
                Request
              </Button>
              <Button 
                onClick={() => setPayX402ModalOpen(true)}
                size="sm" 
                variant="outline"
                className="flex-1 border-white/10 bg-white/5 hover:bg-white/10 text-xs"
              >
                Pay
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-xl p-4 bg-gradient-to-br from-black/0 via-black/10 to-black/0 backdrop-blur border border-white/5"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-neutral-300">Privacy Level</div>
            </div>
            <PrivacyLevelSelector compact />
          </motion.div>
        </div>

        {/* Recent Transactions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl p-4 bg-gradient-to-br from-black/0 via-black/10 to-black/0 backdrop-blur border border-white/5"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-neutral-300">Recent Transactions</div>
            <button 
              onClick={() => setActiveTab("payments")}
              className="text-xs text-neutral-500 hover:text-neutral-400 transition-colors"
            >
              See All
            </button>
          </div>
          <div className="space-y-2">
            {recentTransactions.map((tx, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 + i * 0.05 }}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <div className={cn("w-8 h-8 rounded-lg grid place-items-center", tx.bgColor)}>
                  <Icon icon={tx.icon} className={cn("w-4 h-4", tx.color)} />
                </div>
                <div className="flex-1">
                  <div className="text-sm text-neutral-300">
                    {tx.type === "sent" ? `Sent to ${tx.to}` : 
                     tx.type === "received" ? `Received from ${tx.from}` :
                     tx.type === "x402" ? `x402 from ${tx.from}` : `Yield from ${tx.from}`}
                  </div>
                  <div className="text-[11px] text-neutral-500">{tx.time}</div>
                </div>
                <div className={cn(
                  "text-sm font-medium",
                  tx.amount.startsWith("+") ? "text-emerald-400" : "text-red-400"
                )}>
                  {showBalance ? tx.amount : "••••"}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Modals */}
      <SendPaymentModal open={sendModalOpen} onOpenChange={setSendModalOpen} />
      <ReceivePaymentModal open={receiveModalOpen} onOpenChange={setReceiveModalOpen} />
      <X402PaymentModal open={x402ModalOpen} onOpenChange={setX402ModalOpen} />
      <PayX402Modal open={payX402ModalOpen} onOpenChange={setPayX402ModalOpen} />
    </>
  );
};

export default DashboardMainContent;
