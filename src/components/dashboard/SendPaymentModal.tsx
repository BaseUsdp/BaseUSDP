import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Shield, QrCode, CheckCircle2, Loader2, AlertCircle, ExternalLink, Copy, X } from "lucide-react";
import { useWallet, PrivacyLevel } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import PrivacyLevelSelector from "./PrivacyLevelSelector";
import { cn } from "@/lib/utils";
import {
  executeConfidentialTransfer,
  getPhantomProvider,
  getSolflareProvider,
  WalletAdapter,
} from "@/services/transactionSigningService";

interface SendPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TransactionStep = "form" | "preview" | "signing" | "encrypting" | "pending" | "success" | "failed";

const SendPaymentModal = ({ open, onOpenChange }: SendPaymentModalProps) => {
  const { encryptedBalance, privacyLevel, walletType } = useWallet();
  
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedPrivacy, setSelectedPrivacy] = useState<PrivacyLevel>(privacyLevel);
  const [step, setStep] = useState<TransactionStep>("form");
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");

  // Get the appropriate wallet provider based on connected wallet type
  const getWalletProvider = useCallback((): WalletAdapter | null => {
    if (walletType === "phantom") {
      return getPhantomProvider();
    } else if (walletType === "solflare") {
      return getSolflareProvider();
    }
    return null;
  }, [walletType]);

  // Validate Solana address (base58 format, 32-44 characters)
  const isValidAddress = (address: string) => {
    // Solana addresses are base58 encoded and typically 32-44 characters
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    return base58Regex.test(address);
  };

  const handlePreview = () => {
    if (!recipient || !amount) return;
    
    if (!isValidAddress(recipient)) {
      setError("Please enter a valid Solana address");
      return;
    }
    
    if (parseFloat(amount) <= 0) {
      setError("Amount must be greater than 0");
      return;
    }
    
    setError("");
    setStep("preview");
  };

  const handleConfirm = async () => {
    // Get the wallet provider
    const wallet = getWalletProvider();
    
    // Check for both 'connected' and 'isConnected' (different wallet providers use different properties)
    const isWalletConnected = wallet?.connected || (wallet as any)?.isConnected;
    
    if (!wallet || !isWalletConnected || !wallet.publicKey) {
      setError("Wallet not connected. Please connect your wallet first.");
      setStep("failed");
      return;
    }

    try {
      // Step 1: Signing - Wallet popup will appear
      setStep("signing");
      
      // Get backend URL from environment or use default
      const backendUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
      
      // Execute the confidential transfer with client-side signing
      // This will:
      // 1. Build unsigned transaction on backend
      // 2. Sign with wallet (popup appears)
      // 3. Submit signed transaction to backend
      // 4. Backend submits to Solana
      const result = await executeConfidentialTransfer(
        wallet,
        recipient,
        parseFloat(amount),
        selectedPrivacy,
        backendUrl
      );

      if (result.success && result.signature) {
        // Transaction succeeded!
        setTxHash(result.signature);
        
        // Show encrypting step briefly for UX
        setStep("encrypting");
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Show pending step briefly
        setStep("pending");
        await new Promise(resolve => setTimeout(resolve, 500));
        
        setStep("success");
      } else {
        // Transaction failed
        const errorStep = result.step || "unknown";
        let errorMessage = result.error || "Transaction failed";
        
        // Add context based on which step failed
        if (errorStep === "build") {
          errorMessage = `Failed to build transaction: ${errorMessage}`;
        } else if (errorStep === "sign") {
          errorMessage = `Signing failed: ${errorMessage}`;
        } else if (errorStep === "submit") {
          errorMessage = `Submission failed: ${errorMessage}`;
        }
        
        setError(errorMessage);
        setStep("failed");
      }
    } catch (err) {
      console.error("Transaction error:", err);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      setStep("failed");
    }
  };

  const handleReset = () => {
    setRecipient("");
    setAmount("");
    setStep("form");
    setTxHash("");
    setError("");
  };

  const handleClose = () => {
    handleReset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Send className="w-4 h-4 text-primary" />
            </div>
            {step === "form" && "Send Encrypted Payment"}
            {step === "preview" && "Confirm Transaction"}
            {(step === "signing" || step === "encrypting" || step === "pending") && "Processing"}
            {step === "success" && "Transaction Successful"}
            {step === "failed" && "Transaction Failed"}
          </DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {/* Form Step */}
          {step === "form" && (
            <motion.div
              key="form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              {/* Recipient */}
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">
                  Recipient Address
                </label>
                <div className="relative">
                  <Input
                    placeholder="0x... or name.eth"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    className="bg-secondary border-border h-12 pr-12"
                  />
                  <button className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-primary/10 rounded">
                    <QrCode className="w-5 h-5 text-muted-foreground" />
                  </button>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">
                  Amount (USDC)
                </label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="bg-secondary border-border h-14 text-2xl font-mono"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Available: ${encryptedBalance}
                </p>
              </div>

              {/* Privacy Level */}
              <PrivacyLevelSelector onChange={setSelectedPrivacy} />

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <Button
                onClick={handlePreview}
                disabled={!recipient || !amount}
                className="w-full h-12 bg-primary hover:bg-primary/90"
              >
                Preview Transaction
              </Button>
            </motion.div>
          )}

          {/* Preview Step */}
          {step === "preview" && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              <div className="rounded-xl bg-secondary p-4 space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Recipient</span>
                  <span className="font-mono text-sm">{recipient}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-bold">
                    {selectedPrivacy === "public" ? `$${amount}` : "Encrypted"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Privacy Level</span>
                  <span className="capitalize">{selectedPrivacy}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Est. Gas Fee</span>
                  <span>~$0.02</span>
                </div>
              </div>

              <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    This transaction will be encrypted using Fully Homomorphic Encryption (FHE). 
                    The amount and recipient will be hidden based on your privacy level.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep("form")} className="flex-1">
                  Back
                </Button>
                <Button onClick={handleConfirm} className="flex-1 bg-primary hover:bg-primary/90">
                  Confirm & Sign
                </Button>
              </div>
            </motion.div>
          )}

          {/* Processing Steps */}
          {(step === "signing" || step === "encrypting" || step === "pending") && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-8 text-center"
            >
              <div className="relative w-20 h-20 mx-auto mb-6">
                <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  {step === "signing" && <Send className="w-8 h-8 text-primary" />}
                  {step === "encrypting" && <Shield className="w-8 h-8 text-primary" />}
                  {step === "pending" && <Loader2 className="w-8 h-8 text-primary animate-spin" />}
                </div>
              </div>
              
              <h3 className="text-lg font-bold mb-2">
                {step === "signing" && "Waiting for Signature..."}
                {step === "encrypting" && "Encrypting Transaction..."}
                {step === "pending" && "Transaction Pending..."}
              </h3>
              <p className="text-muted-foreground text-sm">
                {step === "signing" && "Please confirm the transaction in your wallet"}
                {step === "encrypting" && "Applying FHE encryption to your transaction"}
                {step === "pending" && "Waiting for block confirmation"}
              </p>

              {/* Progress Steps */}
              <div className="flex justify-center gap-2 mt-6">
                <div className={cn(
                  "w-3 h-3 rounded-full transition-colors",
                  step === "signing" ? "bg-primary" : "bg-primary/30"
                )} />
                <div className={cn(
                  "w-3 h-3 rounded-full transition-colors",
                  step === "encrypting" ? "bg-primary" : step === "pending" ? "bg-primary/30" : "bg-secondary"
                )} />
                <div className={cn(
                  "w-3 h-3 rounded-full transition-colors",
                  step === "pending" ? "bg-primary" : "bg-secondary"
                )} />
              </div>
            </motion.div>
          )}

          {/* Success Step */}
          {step === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="py-6 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              
              <h3 className="text-lg font-bold mb-2">Transaction Successful!</h3>
              <p className="text-muted-foreground text-sm mb-6">
                Your encrypted payment has been confirmed
              </p>

              <div className="rounded-xl bg-secondary p-4 mb-6">
                <p className="text-xs text-muted-foreground mb-2">Transaction Signature</p>
                <div className="flex items-center justify-center gap-2">
                  <span className="font-mono text-sm truncate max-w-[200px]">{txHash}</span>
                  <button 
                    onClick={() => navigator.clipboard.writeText(txHash)}
                    className="p-1 hover:bg-primary/10 rounded"
                  >
                    <Copy className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <a
                    href={`https://explorer.solana.com/tx/${txHash}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 hover:bg-primary/10 rounded"
                  >
                    <ExternalLink className="w-4 h-4 text-muted-foreground" />
                  </a>
                </div>
              </div>

              <Button onClick={handleClose} className="w-full">
                Done
              </Button>
            </motion.div>
          )}

          {/* Failed Step */}
          {step === "failed" && (
            <motion.div
              key="failed"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="py-6 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-4">
                <X className="w-8 h-8 text-destructive" />
              </div>
              
              <h3 className="text-lg font-bold mb-2">Transaction Failed</h3>
              <p className="text-muted-foreground text-sm mb-6">
                {error || "Something went wrong"}
              </p>

              <div className="flex gap-3">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={() => setStep("form")} className="flex-1 bg-primary hover:bg-primary/90">
                  Try Again
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};

export default SendPaymentModal;
