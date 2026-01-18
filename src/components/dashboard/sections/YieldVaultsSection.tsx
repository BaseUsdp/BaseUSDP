import { motion } from "framer-motion";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";

interface YieldVaultsSectionProps {
  showBalance: boolean;
}

const YieldVaultsSection = ({ showBalance }: YieldVaultsSectionProps) => {
  const [depositAmount, setDepositAmount] = useState("");
  const [selectedVault, setSelectedVault] = useState("stable");
  const [activeTab, setActiveTab] = useState<"deposit" | "withdraw">("deposit");

  const vaults = [
    { 
      id: "stable", 
      name: "Stable Yield", 
      apy: "12.5%", 
      tvl: "$2.4M", 
      risk: "Low",
      description: "Optimized for stable returns with minimal volatility",
      yourDeposit: "$5,000.00",
      earned: "$125.00"
    },
    { 
      id: "growth", 
      name: "Growth Vault", 
      apy: "24.8%", 
      tvl: "$890K", 
      risk: "Medium",
      description: "Higher yields through diversified DeFi strategies",
      yourDeposit: "$0.00",
      earned: "$0.00"
    },
    { 
      id: "aggressive", 
      name: "Alpha Vault", 
      apy: "45.2%", 
      tvl: "$320K", 
      risk: "High",
      description: "Maximum yield potential with active management",
      yourDeposit: "$0.00",
      earned: "$0.00"
    },
  ];

  const selectedVaultData = vaults.find(v => v.id === selectedVault);

  const recentActivity = [
    { type: "deposit", amount: "$1,000.00", vault: "Stable Yield", time: "2 hours ago", status: "confirmed" },
    { type: "yield", amount: "+$12.50", vault: "Stable Yield", time: "1 day ago", status: "compounded" },
    { type: "deposit", amount: "$4,000.00", vault: "Stable Yield", time: "3 days ago", status: "confirmed" },
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
          Yield Vaults<span className="text-primary">.</span>
        </h1>
        <p className="text-muted-foreground mt-1">
          Earn confidential yields on your encrypted assets
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card p-5"
        >
          <div className="flex items-center gap-2 mb-2">
            <Icon icon="ph:wallet-bold" className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Total Deposited</span>
          </div>
          <p className="text-2xl font-display font-bold">
            {showBalance ? "$5,000.00" : "••••••"}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-border bg-card p-5"
        >
          <div className="flex items-center gap-2 mb-2">
            <Icon icon="ph:trend-up-bold" className="w-4 h-4 text-green-500" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Total Earned</span>
          </div>
          <p className="text-2xl font-display font-bold text-green-500">
            {showBalance ? "+$125.00" : "••••••"}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-border bg-card p-5"
        >
          <div className="flex items-center gap-2 mb-2">
            <Icon icon="ph:lightning-bold" className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Avg APY</span>
          </div>
          <p className="text-2xl font-display font-bold text-primary">12.5%</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl border border-border bg-card p-5"
        >
          <div className="flex items-center gap-2 mb-2">
            <Icon icon="ph:shield-check-bold" className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Privacy Level</span>
          </div>
          <p className="text-2xl font-display font-bold">100%</p>
        </motion.div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Vault Selection */}
        <div className="col-span-12 lg:col-span-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl border border-border bg-card p-6"
          >
            <h3 className="font-display text-lg font-bold mb-6">Select Vault</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {vaults.map((vault) => (
                <button
                  key={vault.id}
                  onClick={() => setSelectedVault(vault.id)}
                  className={cn(
                    "p-4 rounded-xl border-2 text-left transition-all",
                    selectedVault === vault.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className={cn(
                      "text-xs px-2 py-1 rounded-full font-medium",
                      vault.risk === "Low" ? "bg-green-500/20 text-green-500" :
                      vault.risk === "Medium" ? "bg-yellow-500/20 text-yellow-500" :
                      "bg-red-500/20 text-red-500"
                    )}>
                      {vault.risk} Risk
                    </span>
                    {selectedVault === vault.id && (
                      <Icon icon="ph:check-circle-bold" className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <h4 className="font-bold mb-1">{vault.name}</h4>
                  <p className="text-2xl font-display font-bold text-primary mb-2">{vault.apy}</p>
                  <p className="text-xs text-muted-foreground">TVL: {vault.tvl}</p>
                </button>
              ))}
            </div>

            {/* Selected Vault Details */}
            {selectedVaultData && (
              <div className="rounded-xl bg-secondary/50 border border-border p-5">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                    <Icon icon="ph:lightning-bold" className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-lg">{selectedVaultData.name}</h4>
                    <p className="text-sm text-muted-foreground mb-4">{selectedVaultData.description}</p>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Your Deposit</p>
                        <p className="font-bold">{showBalance ? selectedVaultData.yourDeposit : "••••••"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Earned</p>
                        <p className="font-bold text-green-500">{showBalance ? selectedVaultData.earned : "••••••"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Deposit/Withdraw Form */}
        <div className="col-span-12 lg:col-span-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="rounded-2xl border border-border bg-card p-6"
          >
            {/* Tabs */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setActiveTab("deposit")}
                className={cn(
                  "flex-1 py-2 rounded-lg font-medium transition-all",
                  activeTab === "deposit"
                    ? "bg-primary text-white"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                Deposit
              </button>
              <button
                onClick={() => setActiveTab("withdraw")}
                className={cn(
                  "flex-1 py-2 rounded-lg font-medium transition-all",
                  activeTab === "withdraw"
                    ? "bg-primary text-white"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                Withdraw
              </button>
            </div>

            {/* Amount Input */}
            <div className="mb-6">
              <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">
                Amount (USDC)
              </label>
              <Input
                type="number"
                placeholder="0.00"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="bg-secondary border-border h-14 text-2xl font-mono"
              />
              <div className="flex justify-between mt-2">
                <p className="text-xs text-muted-foreground">
                  Available: {showBalance ? "$7,450.00" : "••••••"}
                </p>
                <button 
                  onClick={() => setDepositAmount("7450")}
                  className="text-xs text-primary font-medium"
                >
                  MAX
                </button>
              </div>
            </div>

            {/* Encryption Notice */}
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 mb-6">
              <div className="flex items-start gap-3">
                <Icon icon="ph:lock-bold" className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  Your deposit amount and yield earnings are protected with ZK proofs. Only you can view your balance.
                </p>
              </div>
            </div>

            {/* Action Button */}
            <Button
              disabled={!depositAmount}
              className="w-full h-12 bg-accent hover:bg-accent/90 text-white font-semibold"
            >
              {activeTab === "deposit" ? (
                <>
                  <Icon icon="ph:arrow-down-left-bold" className="w-5 h-5 mr-2" />
                  DEPOSIT TO VAULT
                </>
              ) : (
                <>
                  <Icon icon="ph:arrow-up-right-bold" className="w-5 h-5 mr-2" />
                  WITHDRAW FROM VAULT
                </>
              )}
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-2xl border border-border bg-card p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Icon icon="ph:clock-bold" className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-display text-lg font-bold">Recent Activity</h3>
          </div>
          <Button variant="outline" size="sm">View All</Button>
        </div>

        <div className="space-y-3">
          {recentActivity.map((activity, i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-secondary/30">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center",
                activity.type === "deposit" ? "bg-blue-500/20" :
                activity.type === "yield" ? "bg-green-500/20" : "bg-red-500/20"
              )}>
                {activity.type === "deposit" ? (
                  <Icon icon="ph:arrow-down-left-bold" className="w-5 h-5 text-blue-500" />
                ) : activity.type === "yield" ? (
                  <Icon icon="ph:trend-up-bold" className="w-5 h-5 text-green-500" />
                ) : (
                  <Icon icon="ph:arrow-up-right-bold" className="w-5 h-5 text-red-500" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium capitalize">{activity.type} - {activity.vault}</p>
                <p className="text-xs text-muted-foreground">{activity.time}</p>
              </div>
              <div className="text-right">
                <p className={cn(
                  "font-bold",
                  activity.type === "yield" ? "text-green-500" : ""
                )}>
                  {showBalance ? activity.amount : "••••••"}
                </p>
                <p className="text-xs text-muted-foreground capitalize">{activity.status}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default YieldVaultsSection;