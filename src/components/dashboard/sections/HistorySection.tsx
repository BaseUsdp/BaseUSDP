import { motion } from "framer-motion";
import TransactionHistoryFull from "../TransactionHistoryFull";

interface HistorySectionProps {
  showBalance: boolean;
}

const HistorySection = ({ showBalance }: HistorySectionProps) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Page Header */}
      <div className="mb-2">
        <h1 className="font-display text-3xl font-bold">
          Transaction History<span className="text-primary">.</span>
        </h1>
        <p className="text-muted-foreground mt-1">
          View all your deposits, transfers, and payment activity
        </p>
      </div>

      {/* Transaction History */}
      <TransactionHistoryFull showBalance={showBalance} />
    </motion.div>
  );
};

export default HistorySection;
