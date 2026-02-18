import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CreditCard, QrCode, Loader2, CheckCircle2, AlertCircle, Shield, ExternalLink, Copy, X } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getPaymentStatus, settleZKX402PaymentSimple } from "@/services/api";
import {
  getMetaMaskEVMProvider,
} from "@/services/transactionSigningService";

interface PayX402ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type PaymentStep = "input" | "loading" | "review" | "signing" | "pending" | "success" | "failed";

interface PaymentDetails {
  id: string;
  serviceName: string;
  amount: string;
  payee: string;
  description: string;
  status: "pending" | "paid" | "expired";
}

const PayX402Modal = ({ open, onOpenChange }: PayX402ModalProps) => {
  const { isConnected, walletType, fullWalletAddress, activeChain } = useWallet();
  const [paymentId, setPaymentId] = useState("");
  const [step, setStep] = useState<PaymentStep>("input");
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");

  const handleLookup = async () => {
    if (!paymentId.trim()) return;
    
    setStep("loading");
    setError("");
    
    try {
      // Try to look up the payment from the backend
      const result = await getPaymentStatus(paymentId);
      
      if (result.success && result.payment) {
        setPaymentDetails({
          id: result.payment.paymentId,
          serviceName: "Payment Request",
          amount: "0.00", // Amount would come from the payment metadata
          payee: "Recipient",
          description: "x402 Payment",
          status: result.payment.status === "settled" ? "paid" : result.payment.status === "failed" ? "expired" : result.payment.status as "expired" | "paid" | "pending",
        });
        setStep("review");
      } else {
        // Fallback: If payment ID looks valid, show mock data for demo
        if (paymentId.startsWith("x402_") || paymentId.includes("baseusdp")) {
          setPaymentDetails({
            id: paymentId.includes("x402_") ? paymentId : "x402_" + Math.random().toString(36).substr(2, 9),
            serviceName: "Premium API Access",
            amount: "50.00",
            payee: "Merchant",
            description: "Monthly subscription for API access",
            status: "pending",
          });
          setStep("review");
        } else {
          setError("Payment request not found. Please check the ID or link.");
          setStep("input");
        }
      }
    } catch (err) {
      console.error("Error looking up payment:", err);
      // Fallback for demo purposes
      if (paymentId.startsWith("x402_") || paymentId.includes("baseusdp")) {
        setPaymentDetails({
          id: paymentId.includes("x402_") ? paymentId : "x402_" + Math.random().toString(36).substr(2, 9),
          serviceName: "Premium API Access",
          amount: "50.00",
          payee: "Merchant",
          description: "Monthly subscription for API access",
          status: "pending",
        });
        setStep("review");
      } else {
        setError("Payment request not found. Please check the ID or link.");
        setStep("input");
      }
    }
  };

  const handlePay = async () => {
    if (!isConnected) {
      setError("Please connect your wallet first");
      return;
    }

    if (!paymentDetails) {
      setError("No payment details found");
      return;
    }

    if (!fullWalletAddress || !walletType) {
      setError("Wallet not connected. Please connect your wallet first.");
      setStep("failed");
      return;
    }

    try {
      setStep("signing");
      
      if (!fullWalletAddress) {
        setError("Wallet address not available");
        setStep("failed");
        return;
      }

      // Create message to sign
      const message = `Authorize USDP x402 payment:\nPayment ID: ${paymentDetails.id}\nAmount: ${paymentDetails.amount} USDC\nTimestamp: ${Date.now()}`;
      
      // Sign message with wallet (EVM signing for Base chain)
      let walletSignature: string;
      try {
        if (activeChain === "base") {
          // EVM signing via Phantom ethereum provider or MetaMask
          const ethereumProvider = walletType === "phantom"
            ? (window as any).phantom?.ethereum
            : getMetaMaskEVMProvider();
          if (!ethereumProvider) throw new Error("EVM wallet provider not found");
          const accounts = await ethereumProvider.request({ method: "eth_accounts" });
          if (!accounts || accounts.length === 0) throw new Error("No accounts connected");
          const hexMessage = "0x" + Array.from(new TextEncoder().encode(message)).map((b: number) => b.toString(16).padStart(2, "0")).join("");
          walletSignature = await ethereumProvider.request({
            method: "personal_sign",
            params: [hexMessage, accounts[0]],
          });
        } else {
          throw new Error("Unsupported chain");
        }
      } catch (signError: any) {
        if (signError.message?.includes("reject") || signError.message?.includes("User rejected") || signError.message?.includes("User cancelled")) {
          setError("Payment cancelled. You rejected the signature request.");
          setStep("failed");
          return;
        }
        throw signError;
      }

      // Execute ZK x402 payment settlement
      setStep("pending");
      const result = await settleZKX402PaymentSimple(
        paymentDetails.id,
        fullWalletAddress,
        walletSignature,
        message
      );

      if (result.success && result.signature) {
        setTxHash(result.signature);
        setStep("success");
      } else {
        setError(result.error || "Payment failed");
        setStep("failed");
      }
    } catch (err) {
      console.error("Payment error:", err);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      setStep("failed");
    }
  };

  const handleReset = () => {
    setPaymentId("");
    setStep("input");
    setPaymentDetails(null);
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
            <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-accent" />
            </div>
            {step === "input" && "Pay x402 Request"}
            {step === "loading" && "Looking up payment..."}
            {step === "review" && "Review Payment"}
            {(step === "signing" || step === "pending") && "Processing Payment"}
            {step === "success" && "Payment Successful"}
            {step === "failed" && "Payment Failed"}
          </DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {/* Input Step */}
          {step === "input" && (
            <motion.div
              key="input"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">
                  Payment ID or Link
                </label>
                <div className="relative">
                  <Input
                    placeholder="x402_abc123 or https://baseusdp.app/pay/..."
                    value={paymentId}
                    onChange={(e) => setPaymentId(e.target.value)}
                    className="bg-secondary border-border h-12 pr-12"
                  />
                  <button className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-primary/10 rounded">
                    <QrCode className="w-5 h-5 text-muted-foreground" />
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
                <p className="text-sm text-muted-foreground">
                  Enter the payment request ID or paste a payment link to pay an x402 request.
                </p>
              </div>

              <Button
                onClick={handleLookup}
                disabled={!paymentId.trim()}
                className="w-full h-12 bg-accent hover:bg-accent/90"
              >
                Look Up Payment
              </Button>
            </motion.div>
          )}

          {/* Loading Step */}
          {step === "loading" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-8 text-center"
            >
              <Loader2 className="w-12 h-12 text-accent animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Looking up payment request...</p>
            </motion.div>
          )}

          {/* Review Step */}
          {step === "review" && paymentDetails && (
            <motion.div
              key="review"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              <div className="rounded-2xl border border-accent/30 bg-accent/5 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-lg">{paymentDetails.serviceName}</h4>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-yellow-500/20 text-yellow-500 font-medium">
                    Pending
                  </span>
                </div>
                
                <div className="text-3xl font-display font-bold mb-4">
                  ${paymentDetails.amount}
                </div>

                <p className="text-sm text-muted-foreground mb-4">
                  {paymentDetails.description}
                </p>

                <div className="space-y-2 rounded-lg bg-secondary/50 p-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Payment ID</span>
                    <span className="font-mono">{paymentDetails.id}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Payee</span>
                    <span className="font-mono">{paymentDetails.payee}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    This payment uses ZK proofs for privacy. The amount will be hidden on-chain.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={handleReset} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handlePay} className="flex-1 bg-accent hover:bg-accent/90">
                  Pay ${paymentDetails.amount}
                </Button>
              </div>
            </motion.div>
          )}

          {/* Processing Steps */}
          {(step === "signing" || step === "pending") && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-8 text-center"
            >
              <div className="relative w-20 h-20 mx-auto mb-6">
                <div className="absolute inset-0 rounded-full border-4 border-accent/20" />
                <div className="absolute inset-0 rounded-full border-4 border-accent border-t-transparent animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  {step === "signing" ? (
                    <CreditCard className="w-8 h-8 text-accent" />
                  ) : (
                    <Loader2 className="w-8 h-8 text-accent animate-spin" />
                  )}
                </div>
              </div>
              
              <h3 className="text-lg font-bold mb-2">
                {step === "signing" ? "Waiting for Signature..." : "Processing Payment..."}
              </h3>
              <p className="text-muted-foreground text-sm">
                {step === "signing" 
                  ? "Please confirm the transaction in your wallet" 
                  : "Settling x402 payment on-chain"}
              </p>

              <div className="flex justify-center gap-2 mt-6">
                <div className={cn(
                  "w-3 h-3 rounded-full transition-colors",
                  step === "signing" ? "bg-accent" : "bg-accent/30"
                )} />
                <div className={cn(
                  "w-3 h-3 rounded-full transition-colors",
                  step === "pending" ? "bg-accent" : "bg-secondary"
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
              
              <h3 className="text-lg font-bold mb-2">Payment Successful!</h3>
              <p className="text-muted-foreground text-sm mb-6">
                Your x402 payment has been settled
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
                    href={`https://basescan.org/tx/${txHash}`}
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
              
              <h3 className="text-lg font-bold mb-2">Payment Failed</h3>
              <p className="text-muted-foreground text-sm mb-6">
                {error || "Something went wrong"}
              </p>

              <div className="flex gap-3">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={() => setStep("review")} className="flex-1 bg-accent hover:bg-accent/90">
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

export default PayX402Modal;
