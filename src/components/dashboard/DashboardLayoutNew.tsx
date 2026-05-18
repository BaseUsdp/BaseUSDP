import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useWallet } from "@/contexts/WalletContext";
import { useXMTP } from "@/contexts/XMTPContext";
import NetworkWarningBanner from "./NetworkWarningBanner";
import ScheduledPaymentsBanner from "./ScheduledPaymentsBanner";
import DashboardTopBar from "./DashboardTopBar";
import DashboardLeftSidebar from "./DashboardLeftSidebar";
import DashboardRightSidebar from "./DashboardRightSidebar";
import DashboardMainContent from "./DashboardMainContent";
import WalletConnectPrompt from "./WalletConnectPrompt";

const DashboardLayoutNew = () => {
  const { isConnected } = useWallet();
  const { unreadCount: unreadMessages } = useXMTP();
  const [showBalance, setShowBalance] = useState(true);
  const [searchParams] = useSearchParams();
  const initialTabFromUrl = searchParams.get("tab");
  const hasSendPrefill =
    !!searchParams.get("send-to") || !!searchParams.get("send-handle");
  const [activeTab, setActiveTab] = useState(initialTabFromUrl || "overview");
  const [paymentsInitialTab, setPaymentsInitialTab] = useState<string | undefined>(
    hasSendPrefill ? "send" : undefined
  );
  const [withdrawInitialAmount, setWithdrawInitialAmount] = useState<string | undefined>(undefined);

  // If a payment-link visitor lands here with prefill params, force the
  // Payments tab on first mount so the prefilled Send form is visible.
  useEffect(() => {
    if (hasSendPrefill) {
      setActiveTab("payments");
      setPaymentsInitialTab("send");
    }
  }, [hasSendPrefill]);

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
      <ScheduledPaymentsBanner />

      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative w-full overflow-hidden rounded-2xl shadow-2xl backdrop-blur-xl"
          style={{
            border: '1px solid var(--dash-border)',
            background: 'var(--dash-overlay)',
            maskImage: "linear-gradient(180deg, black 0%, black 100%)",
          }}
        >
          {/* Top Bar */}
          <DashboardTopBar showBalance={showBalance} setShowBalance={setShowBalance} setActiveTab={setActiveTab} unreadMessages={unreadMessages} />

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Left Sidebar */}
            <aside
              className="hidden lg:block lg:col-span-3"
              style={{ background: 'var(--dash-sidebar)', borderRight: '1px solid var(--dash-border)' }}
            >
              <DashboardLeftSidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                showBalance={showBalance}
                unreadMessages={unreadMessages}
              />
            </aside>

            {/* Main Content */}
            <main className="lg:col-span-6 min-h-[700px]" style={{ background: 'var(--dash-main)' }}>
              <DashboardMainContent
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                showBalance={showBalance}
                setShowBalance={setShowBalance}
                paymentsInitialTab={paymentsInitialTab}
                withdrawInitialAmount={withdrawInitialAmount}
              />
            </main>

            {/* Right Sidebar */}
            <aside
              className="hidden lg:block lg:col-span-3"
              style={{ background: 'var(--dash-sidebar)', borderLeft: '1px solid var(--dash-border)' }}
            >
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
