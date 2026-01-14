import { motion } from "framer-motion";
import { CreditCard, Plus, Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";

const AnonymousCards = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="rounded-2xl border border-border bg-card p-6 h-full flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-display text-lg font-bold">Anonymous Cards</h3>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            Instant Issuance via Fhenix
          </p>
        </div>
        <CreditCard className="w-5 h-5 text-muted-foreground" />
      </div>

      {/* Virtual Card Display */}
      <div className="flex-1 flex items-center justify-center py-4">
        <motion.div
          whileHover={{ scale: 1.02, rotateY: 5 }}
          className="relative w-full max-w-[280px]"
          style={{ perspective: "1000px" }}
        >
          <div className="rounded-2xl bg-gradient-to-br from-gray-800 via-gray-900 to-black p-5 aspect-[1.6/1] flex flex-col justify-between border border-gray-700 shadow-2xl">
            {/* Card Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-5 rounded bg-gradient-to-r from-primary to-accent" />
                <div className="w-8 h-5 rounded bg-gradient-to-r from-primary/50 to-accent/50 -ml-4" />
              </div>
              <span className="text-white/60 text-xs font-medium">VISA</span>
            </div>

            {/* Card Number */}
            <div className="space-y-1">
              <div className="flex gap-3 text-white/80 font-mono text-sm tracking-widest">
                <span>****</span>
                <span>****</span>
                <span>****</span>
                <span>4202</span>
              </div>
            </div>

            {/* Card Footer */}
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[10px] text-white/40 uppercase">Account Name</p>
                <p className="text-xs text-white/80 font-medium">VOID402 PROTOCOL</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-white/80 font-mono">12/28</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 mt-4">
        <Button 
          variant="outline" 
          className="flex-1 h-11 border-border hover:bg-secondary font-semibold"
        >
          <Snowflake className="w-4 h-4 mr-2" />
          FREEZE CARD
        </Button>
        <Button 
          size="icon" 
          className="h-11 w-11 bg-primary hover:bg-primary/90"
        >
          <Plus className="w-5 h-5" />
        </Button>
      </div>
    </motion.div>
  );
};

export default AnonymousCards;