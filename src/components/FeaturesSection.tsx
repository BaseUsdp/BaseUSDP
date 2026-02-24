import { motion, useInView, AnimatePresence } from "framer-motion";
import { useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BorderBeam } from "@/components/ui/border-beam";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const features = [
  {
    id: "balance",
    label: "Encrypted Balance",
    icon: "ph:shield-check-bold",
    tag: "Privacy",
    stat: "256-bit",
    statLabel: "Encryption",
    description: "View and manage your balances with ZK Proof encryption. Only you can see your true holdings — fully hidden on-chain.",
  },
  {
    id: "payments",
    label: "Confidential Pay",
    icon: "ph:paper-plane-tilt-fill",
    tag: "Payments",
    stat: "<2s",
    statLabel: "Settlement",
    description: "Send and receive payments with complete transaction privacy. Amounts, senders, and recipients stay hidden from public view.",
  },
{
    id: "yield",
    label: "Yield Vaults",
    icon: "ph:chart-line-up-fill",
    tag: "Yield",
    stat: "8%",
    statLabel: "Max APY",
    description: "Earn up to 8% APY on your encrypted assets through privacy-preserving DeFi strategies across multiple protocols.",
  },
];

// Mock dashboard preview components
function BalancePreview() {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Icon icon="ph:shield-check-bold" className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-muted-foreground">Encrypted Balance</span>
          </div>
          <div className="text-3xl font-semibold tracking-tight text-foreground">$24,891.50</div>
          <div className="flex items-center gap-1 text-xs mt-1 text-emerald-400">
            <Icon icon="ph:trend-up-bold" className="w-3 h-3" />
            +2.4% from last month
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground mb-1">Privacy</div>
          <div className="text-lg font-semibold text-emerald-400">Full</div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Icon icon="ph:lock-bold" className="w-3 h-3" />
            ZK Protected
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground mb-1">USDC</div>
          <div className="text-sm font-semibold text-foreground">$18,420.00</div>
          <div className="h-1.5 bg-secondary rounded-full mt-2 overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: "74%" }} transition={{ duration: 1.2, delay: 0.3 }} className="h-full bg-foreground rounded-full" />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground mb-1">USDT</div>
          <div className="text-sm font-semibold text-foreground">$6,471.50</div>
          <div className="h-1.5 bg-secondary rounded-full mt-2 overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: "26%" }} transition={{ duration: 1.2, delay: 0.5 }} className="h-full bg-foreground rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentsPreview() {
  const txs = [
    { direction: "sent", to: "@alice", amount: "-$250.00", time: "2m ago", icon: "ph:arrow-up-right-bold", color: "text-red-400", bg: "bg-red-500/10" },
    { direction: "received", to: "@bob_vault", amount: "+$1,200.00", time: "15m ago", icon: "ph:arrow-down-left-bold", color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { direction: "sent", to: "0x9f2e...b4c1", amount: "-$89.99", time: "1h ago", icon: "ph:arrow-up-right-bold", color: "text-red-400", bg: "bg-red-500/10" },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-foreground">Recent Transactions</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">Live</span>
      </div>
      {txs.map((tx, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.15 }}
          className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-card"
        >
          <div className={`w-8 h-8 rounded-lg ${tx.bg} flex items-center justify-center`}>
            <Icon icon={tx.icon} className={`w-4 h-4 ${tx.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-foreground truncate">{tx.to}</div>
            <div className="text-[10px] text-muted-foreground">{tx.time}</div>
          </div>
          <div className={`text-xs font-semibold ${tx.direction === "sent" ? "text-red-400" : "text-emerald-400"}`}>
            {tx.amount}
          </div>
        </motion.div>
      ))}
    </div>
  );
}


function YieldPreview() {
  const vaults = [
    { name: "Stable Yield", apy: "4.2%", tvl: "$12.4M", risk: "Low" },
    { name: "DeFi Alpha", apy: "8.1%", tvl: "$3.2M", risk: "Medium" },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-foreground">Active Vaults</span>
        <span className="text-xs text-emerald-400 font-medium">+$48.20 today</span>
      </div>
      {vaults.map((vault, i) => (
        <motion.div
          key={vault.name}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.2 }}
          className="p-3 rounded-lg border border-border bg-card"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-foreground">{vault.name}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{vault.risk}</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] text-muted-foreground">APY</div>
              <div className="text-sm font-semibold text-emerald-400">{vault.apy}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-muted-foreground">TVL</div>
              <div className="text-sm font-medium text-foreground">{vault.tvl}</div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

const previewComponents: Record<string, React.FC> = {
  balance: BalancePreview,
  payments: PaymentsPreview,
  yield: YieldPreview,
};

const FeaturesSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [activeTab, setActiveTab] = useState("balance");
  const navigate = useNavigate();
  const activeFeature = features.find((f) => f.id === activeTab)!;

  return (
    <section ref={ref} className="max-w-[1400px] mx-auto px-8 py-28 border-t border-border">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6 }}
        className="mb-12"
      >
        <span className="tag-pill">Feature Suite</span>
      </motion.div>

      <div className="grid md:grid-cols-12 gap-10 mb-16">
        <motion.div
          className="md:col-span-6"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.1 }}
        >
          <h2 className="display-section font-serif text-foreground">
            Your <em className="gradient-text" style={{ background: 'var(--gradient-beam)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Privacy</em> Dashboard
          </h2>
        </motion.div>
        <motion.div
          className="md:col-span-4 md:col-start-9 flex items-end"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          <p className="text-base text-muted-foreground leading-relaxed">
            A complete suite of privacy-first financial tools, all accessible from a single intuitive dashboard.
          </p>
        </motion.div>
      </div>

      {/* Tabbed Dashboard Showcase */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <TabsList className="w-full md:w-auto bg-secondary/50 border border-border p-1 rounded-xl h-auto flex-wrap">
            {features.map((feature) => (
              <TabsTrigger
                key={feature.id}
                value={feature.id}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-md transition-all"
              >
                <Icon icon={feature.icon} className="w-4 h-4" />
                {feature.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-8"
        >
          <div className="grid lg:grid-cols-2 gap-0 rounded-2xl border border-border overflow-hidden bg-card relative">
            <BorderBeam size={250} duration={12} delay={0} colorFrom="hsl(var(--beam-cyan))" colorTo="hsl(var(--beam-violet))" />

            {/* Left: Feature info */}
            <div className="p-8 md:p-10 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-border">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-foreground flex items-center justify-center">
                      <Icon icon={activeFeature.icon} className="w-6 h-6 text-background" />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{activeFeature.tag}</div>
                      <h3 className="text-xl font-semibold text-foreground">{activeFeature.label}</h3>
                    </div>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-8 max-w-md">
                    {activeFeature.description}
                  </p>
                </motion.div>
              </AnimatePresence>

              <div className="flex items-end justify-between mt-auto pt-6 border-t border-border">
                <div>
                  <p className="font-serif text-4xl md:text-5xl tracking-tight text-foreground" style={{ letterSpacing: "-0.03em" }}>
                    {activeFeature.stat}
                  </p>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">{activeFeature.statLabel}</p>
                </div>
                <Button
                  onClick={() => navigate("/dashboard")}
                  className="rounded-full gap-2"
                >
                  Try Now
                  <Icon icon="ph:arrow-right" className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Right: Dashboard preview */}
            <div className="p-8 md:p-10 bg-background">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.35 }}
                >
                  {/* Mock dashboard chrome */}
                  <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
                      <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/60" />
                      </div>
                      <div className="flex-1 flex justify-center">
                        <div className="px-3 py-0.5 rounded-md bg-secondary text-[10px] text-muted-foreground font-mono">
                          baseusdp.app/dashboard
                        </div>
                      </div>
                    </div>
                    <div className="p-5">
                      {(() => {
                        const PreviewComponent = previewComponents[activeTab];
                        return PreviewComponent ? <PreviewComponent /> : null;
                      })()}
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </Tabs>

      {/* Bottom CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, delay: 0.6 }}
        className="mt-16 flex items-center justify-center gap-4 px-8 py-4 rounded-full border border-border bg-background w-fit mx-auto"
      >
        <Icon icon="ph:wallet-fill" className="h-5 w-5 text-foreground" />
        <span className="text-foreground font-medium text-sm">Ready to experience privacy-first finance?</span>
        <Button
          onClick={() => navigate("/dashboard")}
          className="rounded-full gap-2"
          size="sm"
        >
          Open Dashboard
          <Icon icon="ph:arrow-right" className="h-4 w-4" />
        </Button>
      </motion.div>
    </section>
  );
};

export default FeaturesSection;
