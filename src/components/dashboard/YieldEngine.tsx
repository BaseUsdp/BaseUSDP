import { motion } from "framer-motion";
import { Zap, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface YieldEngineProps {
  showBalance: boolean;
}

const YieldEngine = ({ showBalance }: YieldEngineProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="rounded-2xl border border-border bg-card p-6 h-full flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <span className="font-display font-bold">Yield Engine</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
          <span className="text-xs font-semibold text-primary">STABLE</span>
          <span className="text-xs font-bold text-primary">+12%</span>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-end gap-8 mb-6">
        <div>
          <span className="text-3xl font-display font-bold text-muted-foreground">
            {showBalance ? "--.-%" : "••••"}
          </span>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">
            Est. APY
          </p>
        </div>
        <div>
          <span className="text-3xl font-display font-bold">
            {showBalance ? "$0.00" : "••••"}
          </span>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">
            Total Earned
          </p>
        </div>
      </div>

      {/* Info Box */}
      <div className="flex-1 rounded-xl bg-secondary/50 border border-border p-4 mb-6">
        <div className="flex items-start gap-3">
          <HelpCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium mb-1">
              How does ZK-protected yield compare to standard pools?
            </p>
            <p className="text-xs text-muted-foreground">
              "Confidential compounding allows for higher capture of MEV returns without front running risks."
            </p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <Button className="w-full h-12 bg-foreground text-background hover:bg-foreground/90 font-semibold">
        STAKE ASSETS
      </Button>
    </motion.div>
  );
};

export default YieldEngine;