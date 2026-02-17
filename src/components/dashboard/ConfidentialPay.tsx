import { motion } from "framer-motion";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ConfidentialPay = () => {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [isEncrypting, setIsEncrypting] = useState(false);

  const handleSignAndEncrypt = () => {
    if (!recipient || !amount) return;
    setIsEncrypting(true);
    setTimeout(() => {
      setIsEncrypting(false);
      setRecipient("");
      setAmount("");
    }, 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-2xl border border-border bg-card p-6 h-full flex flex-col"
    >
      {/* Header */}
      <div className="mb-6">
        <h3 className="font-display text-lg font-bold">Confidential Pay</h3>
        <p className="text-xs text-muted-foreground uppercase tracking-wider">
          X402 Payment Rail
        </p>
      </div>

      {/* Form */}
      <div className="flex-1 space-y-5">
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">
            Recipient Hash
          </label>
          <Input
            placeholder="Enter Base address (e.g., 0x...)"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className="bg-secondary border-border h-11"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">
            Amount (USDC)
          </label>
          <Input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="bg-secondary border-border h-11 text-2xl font-mono"
          />
        </div>
      </div>

      {/* Submit Button */}
      <Button
        onClick={handleSignAndEncrypt}
        disabled={!recipient || !amount || isEncrypting}
        className="w-full h-12 mt-6 bg-accent hover:bg-accent/90 text-white font-semibold"
      >
        {isEncrypting ? (
          <span className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Encrypting...
          </span>
        ) : (
          "SIGN & ENCRYPT"
        )}
      </Button>
    </motion.div>
  );
};

export default ConfidentialPay;