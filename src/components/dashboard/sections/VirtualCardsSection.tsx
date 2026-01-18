import { motion } from "framer-motion";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";

interface VirtualCardsSectionProps {
  showBalance: boolean;
}

const VirtualCardsSection = ({ showBalance }: VirtualCardsSectionProps) => {
  const [showCardDetails, setShowCardDetails] = useState<number | null>(null);
  const [isCreatingCard, setIsCreatingCard] = useState(false);
  const [newCardLimit, setNewCardLimit] = useState("");

  const cards = [
    { 
      id: 1, 
      name: "Primary Card", 
      last4: "4202", 
      balance: "$2,500.00",
      limit: "$5,000.00",
      expiry: "12/28",
      status: "active",
      spent: "$1,245.00",
      color: "from-gray-800 via-gray-900 to-black"
    },
    { 
      id: 2, 
      name: "Shopping Card", 
      last4: "7891", 
      balance: "$500.00",
      limit: "$1,000.00",
      expiry: "06/27",
      status: "active",
      spent: "$312.00",
      color: "from-primary via-primary/80 to-accent"
    },
    { 
      id: 3, 
      name: "Travel Card", 
      last4: "3456", 
      balance: "$0.00",
      limit: "$2,000.00",
      expiry: "09/27",
      status: "frozen",
      spent: "$0.00",
      color: "from-blue-600 via-blue-700 to-blue-900"
    },
  ];

  const recentTransactions = [
    { merchant: "Amazon", amount: "-$125.00", card: "****4202", time: "2 hours ago", category: "Shopping" },
    { merchant: "Uber", amount: "-$24.50", card: "****4202", time: "Yesterday", category: "Transport" },
    { merchant: "Spotify", amount: "-$9.99", card: "****7891", time: "Jan 8", category: "Subscription" },
    { merchant: "Apple Store", amount: "-$149.00", card: "****4202", time: "Jan 5", category: "Electronics" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">
            Virtual Cards<span className="text-primary">.</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your anonymous virtual cards powered by ZK proofs
          </p>
        </div>
        <Button 
          onClick={() => setIsCreatingCard(true)}
          className="bg-primary hover:bg-primary/90"
        >
          <Icon icon="ph:plus-bold" className="w-4 h-4 mr-2" />
          Create New Card
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card p-5"
        >
          <div className="flex items-center gap-2 mb-2">
            <Icon icon="ph:credit-card-bold" className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Active Cards</span>
          </div>
          <p className="text-2xl font-display font-bold">
            {cards.filter(c => c.status === "active").length}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-border bg-card p-5"
        >
          <div className="flex items-center gap-2 mb-2">
            <Icon icon="ph:shopping-bag-bold" className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Total Spent (Month)</span>
          </div>
          <p className="text-2xl font-display font-bold">
            {showBalance ? "$1,557.00" : "••••••"}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-border bg-card p-5"
        >
          <div className="flex items-center gap-2 mb-2">
            <Icon icon="ph:globe-bold" className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Total Limit</span>
          </div>
          <p className="text-2xl font-display font-bold">
            {showBalance ? "$8,000.00" : "••••••"}
          </p>
        </motion.div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card, index) => (
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + index * 0.05 }}
            className="rounded-2xl border border-border bg-card p-6"
          >
            {/* Card Visual */}
            <div className="mb-6">
              <motion.div
                whileHover={{ scale: 1.02, rotateY: 5 }}
                className="relative"
                style={{ perspective: "1000px" }}
              >
                <div className={cn(
                  "rounded-2xl bg-gradient-to-br p-5 aspect-[1.6/1] flex flex-col justify-between shadow-2xl",
                  card.color,
                  card.status === "frozen" && "opacity-60"
                )}>
                  {/* Card Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-5 rounded bg-gradient-to-r from-yellow-400 to-yellow-600" />
                      <div className="w-8 h-5 rounded bg-gradient-to-r from-yellow-400/50 to-yellow-600/50 -ml-4" />
                    </div>
                    <span className="text-white/60 text-xs font-medium">VISA</span>
                  </div>

                  {/* Card Number */}
                  <div className="space-y-1">
                    <div className="flex gap-3 text-white/80 font-mono text-sm tracking-widest">
                      <span>{showCardDetails === card.id ? "4242" : "****"}</span>
                      <span>{showCardDetails === card.id ? "4242" : "****"}</span>
                      <span>{showCardDetails === card.id ? "4242" : "****"}</span>
                      <span>{card.last4}</span>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[10px] text-white/40 uppercase">Account Name</p>
                      <p className="text-xs text-white/80 font-medium">{card.name.toUpperCase()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-white/80 font-mono">{card.expiry}</p>
                    </div>
                  </div>

                  {/* Frozen Overlay */}
                  {card.status === "frozen" && (
                    <div className="absolute inset-0 rounded-2xl bg-blue-500/20 flex items-center justify-center">
                      <div className="bg-blue-500 px-4 py-2 rounded-full flex items-center gap-2">
                        <Icon icon="ph:snowflake-bold" className="w-4 h-4 text-white" />
                        <span className="text-white font-bold text-sm">FROZEN</span>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>

            {/* Card Details */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold">{card.name}</h4>
                <span className={cn(
                  "text-xs px-2 py-1 rounded-full font-medium",
                  card.status === "active" 
                    ? "bg-green-500/20 text-green-500"
                    : "bg-blue-500/20 text-blue-500"
                )}>
                  {card.status.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Balance</p>
                  <p className="font-bold">{showBalance ? card.balance : "••••••"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Limit</p>
                  <p className="font-bold">{showBalance ? card.limit : "••••••"}</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Spent this month</span>
                  <span>{showBalance ? card.spent : "••••"}</span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div 
                    className="h-full rounded-full bg-primary"
                    style={{ 
                      width: `${(parseFloat(card.spent.replace(/[$,]/g, '')) / parseFloat(card.limit.replace(/[$,]/g, ''))) * 100}%` 
                    }}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="flex-1"
                  onClick={() => setShowCardDetails(showCardDetails === card.id ? null : card.id)}
                >
                  {showCardDetails === card.id ? (
                    <Icon icon="ph:eye-slash-bold" className="w-4 h-4 mr-1" />
                  ) : (
                    <Icon icon="ph:eye-bold" className="w-4 h-4 mr-1" />
                  )}
                  {showCardDetails === card.id ? "Hide" : "Show"}
                </Button>
                <Button variant="outline" size="sm">
                  <Icon icon="ph:copy-bold" className="w-4 h-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  className={card.status === "frozen" ? "text-green-500 border-green-500/30" : ""}
                >
                  <Icon icon="ph:snowflake-bold" className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" className="text-red-500 border-red-500/30">
                  <Icon icon="ph:trash-bold" className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        ))}

        {/* Create New Card */}
        {isCreatingCard && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border-2 border-dashed border-primary/50 bg-primary/5 p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <Icon icon="ph:plus-bold" className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h4 className="font-bold">Create New Card</h4>
                <p className="text-xs text-muted-foreground">Anonymous virtual card</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">
                  Card Name
                </label>
                <Input
                  placeholder="e.g., Travel Card"
                  className="bg-secondary border-border"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">
                  Spending Limit (USDC)
                </label>
                <Input
                  type="number"
                  placeholder="1000"
                  value={newCardLimit}
                  onChange={(e) => setNewCardLimit(e.target.value)}
                  className="bg-secondary border-border"
                />
              </div>

              <div className="rounded-xl bg-primary/5 border border-primary/20 p-3">
                <div className="flex items-start gap-2">
                  <Icon icon="ph:lock-bold" className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    Card details are encrypted. Only you can view card numbers and CVV.
                  </p>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsCreatingCard(false)}
                >
                  Cancel
                </Button>
                <Button className="flex-1 bg-primary hover:bg-primary/90">
                  Create Card
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Add Card Button */}
        {!isCreatingCard && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            onClick={() => setIsCreatingCard(true)}
            className="rounded-2xl border-2 border-dashed border-border hover:border-primary/50 bg-card/50 p-6 flex flex-col items-center justify-center min-h-[320px] transition-colors group"
          >
            <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
              <Icon icon="ph:plus-bold" className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <p className="font-medium text-muted-foreground group-hover:text-foreground transition-colors">
              Create New Card
            </p>
          </motion.button>
        )}
      </div>

      {/* Recent Transactions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="rounded-2xl border border-border bg-card p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display text-lg font-bold">Card Transactions</h3>
          <Button variant="outline" size="sm">View All</Button>
        </div>

        <div className="space-y-3">
          {recentTransactions.map((tx, i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-secondary/30">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                <Icon icon="ph:shopping-bag-bold" className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-medium">{tx.merchant}</p>
                <p className="text-xs text-muted-foreground">{tx.card} • {tx.time}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-red-500">{showBalance ? tx.amount : "••••"}</p>
                <p className="text-xs text-muted-foreground">{tx.category}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default VirtualCardsSection;