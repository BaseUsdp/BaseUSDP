import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useWallet } from "@/contexts/WalletContext";
import NetworkWarningBanner from "./NetworkWarningBanner";
import DashboardTopBar from "./DashboardTopBar";
import DashboardLeftSidebar from "./DashboardLeftSidebar";
import DashboardRightSidebar from "./DashboardRightSidebar";
import DashboardMainContent from "./DashboardMainContent";
import WalletConnectPrompt from "./WalletConnectPrompt";
import { getUnreadMessageCount } from "@/services/api";

const DashboardLayoutNew = () => {
  const { isConnected } = useWallet();
  const [showBalance, setShowBalance] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [paymentsInitialTab, setPaymentsInitialTab] = useState<string | undefined>(undefined);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await getUnreadMessageCount();
      if (res.success) setUnreadMessages(res.count);
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    if (!isConnected) return;
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [isConnected, fetchUnreadCount]);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <WalletConnectPrompt />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <NetworkWarningBanner />
      
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] shadow-2xl backdrop-blur-xl"
          style={{
            maskImage: "linear-gradient(180deg, black 0%, black 100%)",
          }}
        >
          {/* Top Bar */}
          <DashboardTopBar showBalance={showBalance} setShowBalance={setShowBalance} setActiveTab={setActiveTab} unreadMessages={unreadMessages} />

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Left Sidebar */}
            <aside className="hidden lg:block lg:col-span-3 bg-black/30 border-r border-white/10">
              <DashboardLeftSidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                showBalance={showBalance}
                unreadMessages={unreadMessages}
              />
            </aside>

            {/* Main Content */}
            <main className="lg:col-span-6 bg-black/20 min-h-[700px]">
              <DashboardMainContent
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                showBalance={showBalance}
                setShowBalance={setShowBalance}
                paymentsInitialTab={paymentsInitialTab}
              />
            </main>

            {/* Right Sidebar */}
            <aside className="hidden lg:block lg:col-span-3 bg-black/30 border-l border-white/10">
              <DashboardRightSidebar
                showBalance={showBalance}
                onNavigateToPaymentsTab={(tab) => {
                  setPaymentsInitialTab(tab);
                  setActiveTab("payments");
                }}
              />
            </aside>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default DashboardLayoutNew;
