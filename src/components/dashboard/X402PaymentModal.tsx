import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, QrCode, Copy, CheckCircle, Loader2, ExternalLink, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useWallet } from "@/contexts/WalletContext";
import { getApiUrl } from "@/utils/apiConfig";

interface X402PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialAmount?: string;
}

type CreateStep = "form" | "creating" | "success" | "error";

interface PaymentRequest {
  id: string;
  amount: string;
  serviceName: string;
  description: string;
  status: "pending" | "paid" | "expired" | "cancelled" | "settled" | "failed";
  createdAt: string;
  paymentLink: string;
}

const X402PaymentModal = ({ open, onOpenChange, initialAmount }: X402PaymentModalProps) => {
  const { fullWalletAddress } = useWallet();
  const [serviceName, setServiceName] = useState("");
  const [amount, setAmount] = useState("");

  // Pre-fill from AI Terminal
  useEffect(() => {
    if (open && initialAmount) {
      setAmount(initialAmount);
    }
  }, [open, initialAmount]);
  const [description, setDescription] = useState("");
  const [step, setStep] = useState<CreateStep>("form");
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [copied, setCopied] = useState(false);
  const [createError, setCreateError] = useState("");

  const handleCreate = async () => {
    if (!serviceName || !amount) return;
    
    setStep("creating");
    setCreateError("");
    
    try {
      if (!fullWalletAddress) {
        throw new Error("Wallet not connected");
      }

      const apiUrl = getApiUrl();

      // Call the backend API to create the payment request in Supabase
      const response = await fetch(`${apiUrl}/api/payments/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(amount),
          recipient_wallet: fullWalletAddress,
          service_name: serviceName,
          description: description,
          token: "USDC",
        }),
      });

      const result = await response.json();

      if (!result.success || !result.paymentId) {
        throw new Error(result.error || "Failed to create payment request");
      }

      const paymentLink = `${window.location.origin}/pay/${result.paymentId}`;

      const request: PaymentRequest = {
        id: result.paymentId,
        amount,
        serviceName,
        description,
        status: "pending",
        createdAt: new Date().toISOString(),
        paymentLink,
      };

      // Dispatch event to notify management component to reload
      window.dispatchEvent(new Event("paymentRequestCreated"));
      
      setPaymentRequest(request);
      setStep("success");
    } catch (error: any) {
      console.error("Error creating payment request:", error);
      setCreateError(error.message || "Failed to create payment request");
      setStep("error");
    }
  };

  const handleCopyLink = () => {
    if (paymentRequest) {
      navigator.clipboard.writeText(paymentRequest.paymentLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReset = () => {
    setServiceName("");
    setAmount("");
    setDescription("");
    setStep("form");
    setPaymentRequest(null);
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
              <Download className="w-4 h-4 text-accent" />
            </div>
            {step === "form" && "Create x402 Payment Request"}
            {step === "creating" && "Creating Payment Request..."}
            {step === "success" && "Payment Request Created"}
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
              {/* Service Name */}
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">
                  Service / Product Name *
                </label>
                <Input
                  placeholder="e.g., Premium API Access"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  className="bg-secondary border-border h-12"
                />
              </div>

              {/* Amount */}
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">
                  Amount (USD) *
                </label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="bg-secondary border-border h-14 text-2xl font-mono"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">
                  Description (Optional)
                </label>
                <Textarea
                  placeholder="Add notes or details about this payment..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="bg-secondary border-border min-h-[80px]"
                />
              </div>

              {/* Info */}
              <div className="rounded-xl bg-accent/5 border border-accent/20 p-4">
                <p className="text-sm text-muted-foreground">
                  Create a shareable payment request using the x402 protocol. 
                  Once paid, funds will be automatically transferred to your wallet.
                </p>
              </div>

              {/* Submit Button */}
              <Button
                onClick={handleCreate}
                disabled={!serviceName || !amount}
                className="w-full h-12 bg-accent hover:bg-accent/90"
              >
                Create Payment Request
              </Button>
            </motion.div>
          )}

          {/* Creating Step */}
          {step === "creating" && (
            <motion.div
              key="creating"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-8 text-center"
            >
              <div className="relative w-20 h-20 mx-auto mb-6">
                <div className="absolute inset-0 rounded-full border-4 border-accent/20" />
                <div className="absolute inset-0 rounded-full border-4 border-accent border-t-transparent animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-accent animate-spin" />
                </div>
              </div>
              
              <h3 className="text-lg font-bold mb-2">Creating Payment Request</h3>
              <p className="text-muted-foreground text-sm">
                Generating encrypted payment link...
              </p>
            </motion.div>
          )}

          {/* Success Step */}
          {step === "success" && paymentRequest && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6 py-4"
            >
              {/* Payment Request Card */}
              <div className="rounded-2xl border border-accent/30 bg-accent/5 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-bold text-lg">{paymentRequest.serviceName}</h4>
                    <p className="text-sm text-muted-foreground">
                      {new Date(paymentRequest.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-yellow-500/20 text-yellow-500 font-medium">
                    Pending
                  </span>
                </div>
                
                <div className="text-3xl font-display font-bold mb-4">
                  ${parseFloat(paymentRequest.amount).toFixed(2)}
                </div>

                {paymentRequest.description && (
                  <p className="text-sm text-muted-foreground mb-4">
                    {paymentRequest.description}
                  </p>
                )}

                {/* Payment ID */}
                <div className="rounded-lg bg-secondary/50 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Payment ID</p>
                  <p className="font-mono text-sm">{paymentRequest.id}</p>
                </div>
              </div>

              {/* Payment Link */}
              <div className="rounded-xl bg-secondary p-4">
                <p className="text-xs text-muted-foreground mb-2">Payment Link</p>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm truncate flex-1">
                    {paymentRequest.paymentLink}
                  </span>
                  <button
                    onClick={handleCopyLink}
                    className="p-2 hover:bg-primary/10 rounded-lg transition-colors"
                  >
                    {copied ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="h-12" onClick={handleCopyLink}>
                  <Copy className="w-4 h-4 mr-2" />
                  {copied ? "Copied!" : "Copy Link"}
                </Button>
                <Button variant="outline" className="h-12">
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
              </div>

              <Button onClick={handleClose} className="w-full">
                Done
              </Button>
            </motion.div>
          )}

          {/* Error Step */}
          {step === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-8 text-center space-y-4"
            >
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
                <ExternalLink className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-lg font-bold">Failed to Create Request</h3>
              <p className="text-sm text-muted-foreground">{createError}</p>
              <Button onClick={() => setStep("form")} variant="outline">
                Try Again
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};

export default X402PaymentModal;
