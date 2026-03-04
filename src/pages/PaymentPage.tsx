import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  Shield, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Loader2,
  ArrowLeft,
  Lock,
  Copy,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/contexts/WalletContext";
import { cn } from "@/lib/utils";
import { executeZKTransfer } from "@/services/api";
import { getApiUrl } from "@/utils/apiConfig";
import {
  getMetaMaskEVMProvider,
} from "@/services/transactionSigningService";
import WalletConnectButton from "@/components/WalletConnectButton";

type RequestStatus = "pending" | "settled" | "failed" | "expired" | "cancelled";
type PaymentStep = "view" | "signing" | "processing" | "success" | "failed";

interface PaymentRequest {
  id: string;
  serviceName: string;
  amount: string;
  description: string;
  status: RequestStatus;
  createdAt: string;
  expiresAt?: string;
  paidBy?: string;
  txHash?: string;
  recipientWallet?: string;
}

const PaymentPage = () => {
  const { id } = useParams<{ id: string }>();
  const { isConnected, fullWalletAddress, walletType, activeChain } = useWallet();
  const [request, setRequest] = useState<PaymentRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<PaymentStep>("view");
  const [txHash, setTxHash] = useState("");
  const [paymentError, setPaymentError] = useState("");

  useEffect(() => {
    const loadRequest = async () => {
      try {
        setIsLoading(true);
        
        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/api/payments/${id}`);
        const data = await response.json();

        if (data.success && data.payment) {
          setRequest({
            id: data.payment.id,
            serviceName: data.payment.serviceName,
            amount: data.payment.amount?.toString() || '0',
            description: data.payment.description || '',
            status: data.payment.status as RequestStatus,
            createdAt: data.payment.createdAt,
            paidBy: data.payment.paidBy,
            txHash: data.payment.txHash,
            recipientWallet: data.payment.recipientWallet,
          });
        } else {
          setError("Payment request not found");
        }
      } catch (err) {
        console.error("Error loading payment request:", err);
        setError("Failed to load payment request");
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      loadRequest();
    }
  }, [id]);

  const handlePay = async () => {
    if (!request || !isConnected || !fullWalletAddress || !walletType) {
      setPaymentError("Please connect your wallet first");
      return;
    }

    try {
      setStep("signing");
      
      // The recipient is the creator of the payment request
      // In production, this would come from the API/database
      const recipientWallet = request.recipientWallet || fullWalletAddress; // Fallback for demo
      const message = `Pay USDP Request:\nAmount: ${request.amount} USDC\nTo: ${recipientWallet}\nRequest ID: ${request.id}\nTimestamp: ${Date.now()}`;
      
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
        if (signError.message?.includes("reject") || signError.message?.includes("User rejected")) {
          setPaymentError("Transaction cancelled. You rejected the signature request.");
          setStep("failed");
          return;
        }
        throw signError;
      }

      setStep("processing");
      
      const nonce = Date.now() + Math.floor(Math.random() * 1000000);
      const result = await executeZKTransfer({
        sender_wallet: fullWalletAddress,
        recipient_wallet: recipientWallet,
        token: "USDC",
        amount: parseFloat(request.amount),
        nonce: nonce,
        wallet_signature: walletSignature,
        message_to_sign: message,
      });

      if (result.success && result.signature) {
        setTxHash(result.signature);
        
        // Mark payment as settled in the backend
        try {
          const apiUrl = getApiUrl();
          await fetch(`${apiUrl}/api/payments/settle`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              payment_id: id,
              paid_by: fullWalletAddress?.slice(0, 8) + "...",
              tx_hash: result.signature,
            }),
          });
        } catch (settleErr) {
          console.warn("Failed to update payment status:", settleErr);
        }
        
        setStep("success");
      } else {
        setPaymentError(result.error || "Payment failed");
        setStep("failed");
      }
    } catch (err) {
      console.error("Payment error:", err);
      setPaymentError(err instanceof Error ? err.message : "Payment failed");
      setStep("failed");
    }
  };

  const getStatusConfig = (status: RequestStatus) => {
    switch (status) {
      case "pending":
        return { icon: Clock, color: "text-yellow-500", bg: "bg-yellow-500/20", label: "Awaiting Payment" };
      case "settled":
        return { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/20", label: "Paid" };
      case "failed":
        return { icon: XCircle, color: "text-red-500", bg: "bg-red-500/20", label: "Failed" };
      case "expired":
        return { icon: AlertCircle, color: "text-gray-500", bg: "bg-gray-500/20", label: "Expired" };
      case "cancelled":
        return { icon: XCircle, color: "text-red-500", bg: "bg-red-500/20", label: "Cancelled" };
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Payment Request Not Found</h1>
          <p className="text-muted-foreground mb-6">
            {error || "This payment request doesn't exist or has been removed."}
          </p>
          <Link to="/">
            <Button>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Home
            </Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  const statusConfig = getStatusConfig(request.status);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back</span>
          </Link>
          <div className="flex items-center gap-2 text-primary">
            <Shield className="w-4 h-4" />
            <span className="text-sm font-medium">USDP</span>
          </div>
        </div>

        {/* Main Card */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {/* Status Banner */}
          <div className={cn("px-6 py-3 flex items-center justify-center gap-2", statusConfig.bg)}>
            <statusConfig.icon className={cn("w-4 h-4", statusConfig.color)} />
            <span className={cn("text-sm font-medium", statusConfig.color)}>
              {statusConfig.label}
            </span>
          </div>

          <div className="p-6">
            {step === "view" && (
              <>
                {/* Amount */}
                <div className="text-center mb-6">
                  <p className="text-sm text-muted-foreground mb-2">Payment Amount</p>
                  <p className="text-5xl font-bold">${request.amount}</p>
                </div>

                {/* Details */}
                <div className="rounded-xl bg-secondary/50 p-4 mb-6 space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Service</p>
                    <p className="font-medium">{request.serviceName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Description</p>
                    <p className="text-sm text-muted-foreground">{request.description}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Request ID</p>
                    <p className="text-xs font-mono text-muted-foreground">{request.id}</p>
                  </div>
                </div>

                {/* Privacy Note */}
                <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <Lock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground">
                      This payment uses ZK proofs for maximum privacy. Your transaction details will be encrypted.
                    </p>
                  </div>
                </div>

                {/* Action */}
                {request.status === "pending" ? (
                  isConnected ? (
                    <Button 
                      onClick={handlePay}
                      className="w-full h-12 bg-primary hover:bg-primary/90"
                    >
                      Pay ${request.amount}
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-center text-sm text-muted-foreground">
                        Connect your wallet to pay
                      </p>
                      <WalletConnectButton />
                    </div>
                  )
                ) : (
                  <div className="text-center text-muted-foreground">
                    This payment request is no longer available
                  </div>
                )}
              </>
            )}

            {/* Processing States */}
            {(step === "signing" || step === "processing") && (
              <div className="py-8 text-center">
                <div className="relative w-20 h-20 mx-auto mb-6">
                  <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                  <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    {step === "signing" ? (
                      <Shield className="w-8 h-8 text-primary" />
                    ) : (
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    )}
                  </div>
                </div>
                
                <h3 className="text-lg font-bold mb-2">
                  {step === "signing" ? "Waiting for Signature..." : "Processing Payment..."}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {step === "signing" 
                    ? "Please confirm the transaction in your wallet" 
                    : "Encrypting and submitting your payment"}
                </p>
              </div>
            )}

            {/* Success */}
            {step === "success" && (
              <div className="py-6 text-center">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
                
                <h3 className="text-lg font-bold mb-2">Payment Successful!</h3>
                <p className="text-muted-foreground text-sm mb-6">
                  Your encrypted payment has been confirmed
                </p>

                <div className="rounded-xl bg-secondary p-4 mb-6">
                  <p className="text-xs text-muted-foreground mb-2">Transaction Signature</p>
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-mono text-xs truncate max-w-[180px]">{txHash}</span>
                    <button 
                      onClick={() => navigator.clipboard.writeText(txHash)}
                      className="p-1 hover:bg-primary/10 rounded"
                    >
                      <Copy className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <a
                      href={activeChain === "base" ? `https://basescan.org/tx/${txHash}` : `https://solscan.io/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 hover:bg-primary/10 rounded"
                    >
                      <ExternalLink className="w-4 h-4 text-muted-foreground" />
                    </a>
                  </div>
                </div>

                <Link to="/">
                  <Button className="w-full">Done</Button>
                </Link>
              </div>
            )}

            {/* Failed */}
            {step === "failed" && (
              <div className="py-6 text-center">
                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                  <XCircle className="w-8 h-8 text-red-500" />
                </div>
                
                <h3 className="text-lg font-bold mb-2">Payment Failed</h3>
                <p className="text-muted-foreground text-sm mb-6">
                  {paymentError || "Something went wrong"}
                </p>

                <div className="flex gap-3">
                  <Link to="/" className="flex-1">
                    <Button variant="outline" className="w-full">Cancel</Button>
                  </Link>
                  <Button onClick={() => setStep("view")} className="flex-1">
                    Try Again
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          Secured by USDP • ZK Encrypted Payments
        </p>
      </motion.div>
    </div>
  );
};

export default PaymentPage;
