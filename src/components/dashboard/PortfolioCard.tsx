import { motion } from "framer-motion";
import { Lock, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DotPattern } from "@/components/ui/dot-pattern";

interface PortfolioCardProps {
  showBalance: boolean;
}

const PortfolioCard = ({ showBalance }: PortfolioCardProps) => {
  const [isDecrypting, setIsDecrypting] = useState(false);

  const handleDecrypt = () => {
    setIsDecrypting(true);
    setTimeout(() => setIsDecrypting(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="relative rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-accent p-8 min-h-[280px] flex flex-col overflow-hidden"
    >
      <DotPattern width={32} height={32} cr={1} className="fill-white/10" />

      {/* Header */}
      <div className="relative flex items-center gap-2 mb-auto">
        <Lock className="w-4 h-4 text-white/60" />
        <span className="text-xs text-white/60 uppercase tracking-widest font-medium">
          Confidential Portfolio Value
        </span>
      </div>

      {/* Balance Display */}
      <div className="relative my-auto py-8">
        {isDecrypting ? (
          <div className="flex items-center gap-4">
            <div className="animate-pulse flex items-center gap-2">
              <Lock className="w-8 h-8 text-white/80 animate-spin" />
              <span className="text-lg text-white/80">Loading balance...</span>
            </div>
          </div>
        ) : (
          <div className="text-center">
            {showBalance ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center justify-center gap-2"
              >
                <span className="text-5xl lg:text-6xl font-display font-bold text-white">
                  $76,570
                </span>
                <span className="text-2xl text-white/60">.02</span>
              </motion.div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <EyeOff className="w-8 h-8 text-white/40" />
                <span className="text-3xl text-white/40 tracking-widest">••••••••</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="relative flex items-center gap-4 mt-auto">
        <Button
          variant="outline"
          className="flex-1 h-12 bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white font-semibold"
          onClick={handleDecrypt}
        >
          DEPOSIT
        </Button>
        <Button
          className="flex-1 h-12 bg-white/20 hover:bg-white/30 text-white font-semibold"
        >
          WITHDRAW
        </Button>
      </div>
    </motion.div>
  );
};

export default PortfolioCard;