import { motion } from "framer-motion";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SendPaymentModal from "../SendPaymentModal";
import X402PaymentModal from "../X402PaymentModal";
import PayX402Modal from "../PayX402Modal";
import X402RequestsManagement from "../X402RequestsManagement";
import TransactionHistoryFull from "../TransactionHistoryFull";

interface PaymentsSectionProps {
  showBalance: boolean;
}

const PaymentsSection = ({ showBalance }: PaymentsSectionProps) => {
  const [activeTab, setActiveTab] = useState("send");
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [x402CreateModalOpen, setX402CreateModalOpen] = useState(false);
  const [payX402ModalOpen, setPayX402ModalOpen] = useState(false);

  const recentContacts = [
    { name: "alice.sol", address: "3nFv...8kLz", avatar: "A" },
    { name: "bob.sol", address: "7xKq...9mPw", avatar: "B" },
    { name: "carol.sol", address: "9hGt...2rYs", avatar: "C" },
  ];

  const pendingPayments = [
    { id: 1, type: "outgoing", recipient: "3nFv...8kLz", amount: "$250.00", status: "encrypting", time: "2 min ago" },
    { id: 2, type: "incoming", sender: "7xKq...9mPw", amount: "$1,500.00", status: "pending", time: "5 min ago" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Page Header */}
      <div className="mb-2">
        <h1 className="font-display text-3xl font-bold">
          Confidential Payments<span className="text-primary">.</span>
        </h1>
        <p className="text-muted-foreground mt-1">
          Send, receive, and manage encrypted payments via x402 protocol
        </p>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-secondary/50 p-1">
          <TabsTrigger value="send" className="gap-2">
            <Icon icon="ph:paper-plane-tilt-bold" className="w-4 h-4" />
            Send
          </TabsTrigger>
          <TabsTrigger value="x402" className="gap-2">
            <Icon icon="ph:download-bold" className="w-4 h-4" />
            x402 Requests
          </TabsTrigger>
          <TabsTrigger value="pay" className="gap-2">
            <Icon icon="ph:credit-card-bold" className="w-4 h-4" />
            Pay Request
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <Icon icon="ph:clock-counter-clockwise-bold" className="w-4 h-4" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Send Tab */}
        <TabsContent value="send" className="space-y-6">
          <div className="grid grid-cols-12 gap-6">
            {/* Send Payment Card */}
            <div className="col-span-12 lg:col-span-7">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-border bg-card p-6"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                    <Icon icon="ph:paper-plane-tilt-bold" className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold">Send Payment</h3>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">
                      FHE Encrypted Transfer
                    </p>
                  </div>
                </div>

                {/* Privacy Level Indicator */}
                <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 mb-6">
                  <div className="flex items-center gap-3">
                    <Icon icon="ph:shield-check-bold" className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium text-primary">Full Encryption Active</p>
                      <p className="text-xs text-muted-foreground">
                        Amount, recipient, and metadata will be encrypted using FHE
                      </p>
                    </div>
                  </div>
                </div>

                {/* Submit */}
                <Button
                  onClick={() => setSendModalOpen(true)}
                  className="w-full h-14 bg-primary hover:bg-primary/90 text-white font-semibold text-lg"
                >
                  <Icon icon="ph:lightning-bold" className="w-5 h-5 mr-2" />
                  NEW ENCRYPTED PAYMENT
                </Button>
              </motion.div>
            </div>

            {/* Right Side */}
            <div className="col-span-12 lg:col-span-5 space-y-6">
              {/* Quick Contacts */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-2xl border border-border bg-card p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Icon icon="ph:users-three-bold" className="w-5 h-5 text-muted-foreground" />
                    <h3 className="font-display font-bold">Recent Contacts</h3>
                  </div>
                </div>

                <div className="space-y-3">
                  {recentContacts.map((contact) => (
                    <button
                      key={contact.address}
                      onClick={() => setSendModalOpen(true)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold">
                        {contact.avatar}
                      </div>
                      <div className="text-left flex-1">
                        <p className="font-medium">{contact.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{contact.address}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>

              {/* Pending Transactions */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-2xl border border-border bg-card p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Icon icon="ph:clock-bold" className="w-5 h-5 text-muted-foreground" />
                    <h3 className="font-display font-bold">Pending</h3>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-500 font-medium">
                    {pendingPayments.length} Active
                  </span>
                </div>

                <div className="space-y-3">
                  {pendingPayments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50"
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center",
                        payment.type === "outgoing" ? "bg-red-500/20" : "bg-green-500/20"
                      )}>
                        {payment.type === "outgoing" ? (
                          <Icon icon="ph:arrow-up-right-bold" className="w-5 h-5 text-red-500" />
                        ) : (
                          <Icon icon="ph:arrow-down-left-bold" className="w-5 h-5 text-green-500" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-mono text-sm">
                          {payment.type === "outgoing" ? payment.recipient : payment.sender}
                        </p>
                        <p className="text-xs text-muted-foreground">{payment.time}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">
                          {payment.type === "outgoing" ? "-" : "+"}{showBalance ? payment.amount : "••••"}
                        </p>
                        <p className={cn(
                          "text-xs capitalize",
                          payment.status === "encrypting" ? "text-yellow-500" : "text-muted-foreground"
                        )}>
                          {payment.status}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </TabsContent>

        {/* x402 Requests Tab */}
        <TabsContent value="x402">
          <X402RequestsManagement onCreateNew={() => setX402CreateModalOpen(true)} />
        </TabsContent>

        {/* Pay Request Tab */}
        <TabsContent value="pay">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto"
          >
            <div className="rounded-2xl border border-border bg-card p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-accent/20 flex items-center justify-center mx-auto mb-6">
                <Icon icon="ph:credit-card-bold" className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-2xl font-display font-bold mb-3">Pay x402 Request</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Enter a payment ID or scan a QR code to pay an existing x402 payment request with encrypted funds.
              </p>
              <Button 
                onClick={() => setPayX402ModalOpen(true)}
                className="bg-accent hover:bg-accent/90 h-12 px-8"
              >
                <Icon icon="ph:credit-card-bold" className="w-5 h-5 mr-2" />
                Pay a Request
              </Button>
            </div>
          </motion.div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <TransactionHistoryFull showBalance={showBalance} />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <SendPaymentModal open={sendModalOpen} onOpenChange={setSendModalOpen} />
      <X402PaymentModal open={x402CreateModalOpen} onOpenChange={setX402CreateModalOpen} />
      <PayX402Modal open={payX402ModalOpen} onOpenChange={setPayX402ModalOpen} />
    </motion.div>
  );
};

export default PaymentsSection;