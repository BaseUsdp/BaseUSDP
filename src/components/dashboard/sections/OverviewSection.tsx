import { useState } from "react";
import { motion } from "framer-motion";
import { useWallet } from "@/contexts/WalletContext";
import EncryptedBalanceCard from "../EncryptedBalanceCard";
import QuickActionsGrid from "../QuickActionsGrid";
import RecentTransactions from "../RecentTransactions";
import SendPaymentModal from "../SendPaymentModal";
import ReceivePaymentModal from "../ReceivePaymentModal";
import X402PaymentModal from "../X402PaymentModal";
import PayX402Modal from "../PayX402Modal";
import PrivacyLevelSelector from "../PrivacyLevelSelector";

interface OverviewSectionProps {
  showBalance: boolean;
  setShowBalance: (show: boolean) => void;
  setActiveTab: (tab: string) => void;
}

const OverviewSection = ({ showBalance, setShowBalance, setActiveTab }: OverviewSectionProps) => {
  const { privacyLevel } = useWallet();
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [x402ModalOpen, setX402ModalOpen] = useState(false);
  const [payX402ModalOpen, setPayX402ModalOpen] = useState(false);

  const handleQuickAction = (action: string) => {
    switch (action) {
      case "send":
        setSendModalOpen(true);
        break;
      case "receive":
        setReceiveModalOpen(true);
        break;
      case "request":
        setX402ModalOpen(true);
        break;
      case "pay_x402":
        setPayX402ModalOpen(true);
        break;
      case "history":
        setActiveTab("payments");
        break;
      case "settings":
        setActiveTab("settings");
        break;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="mb-2">
        <h1 className="font-display text-3xl font-bold">
          Dashboard<span className="text-primary">.</span>
        </h1>
        <p className="text-muted-foreground mt-1">
          Privacy-first encrypted payments on Base
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Balance Card */}
        <div className="col-span-12 lg:col-span-7">
          <EncryptedBalanceCard 
            showBalance={showBalance} 
            onToggleBalance={() => setShowBalance(!showBalance)} 
          />
        </div>

        {/* Privacy Settings Card */}
        <div className="col-span-12 lg:col-span-5">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl border border-border bg-card p-6 h-full"
          >
            <h3 className="font-display font-bold mb-4">Privacy Settings</h3>
            <PrivacyLevelSelector />
          </motion.div>
        </div>
      </div>

      {/* Quick Actions */}
      <QuickActionsGrid onAction={handleQuickAction} />

      {/* Recent Transactions */}
      <RecentTransactions 
        showBalance={showBalance} 
        limit={5} 
        onViewAll={() => setActiveTab("history")} 
      />

      {/* Modals */}
      <SendPaymentModal open={sendModalOpen} onOpenChange={setSendModalOpen} />
      <ReceivePaymentModal open={receiveModalOpen} onOpenChange={setReceiveModalOpen} />
      <X402PaymentModal open={x402ModalOpen} onOpenChange={setX402ModalOpen} />
      <PayX402Modal open={payX402ModalOpen} onOpenChange={setPayX402ModalOpen} />
    </motion.div>
  );
};

export default OverviewSection;
