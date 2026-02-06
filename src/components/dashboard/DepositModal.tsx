/**
 * Deposit Modal Component
 * Handles user deposits through ZK privacy layers
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDownLeft, Loader2, AlertCircle, CheckCircle2, X } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getApiUrl } from "@/utils/apiConfig";
import { authService } from "@/services/authService";
import { getPhantomProvider, getSolflareProvider, WalletAdapter } from "@/services/transactionSigningService";

interface DepositModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type DepositStep = "form" | "signing" | "processing" | "success" | "failed";

const DepositModal = ({ open, onOpenChange }: DepositModalProps) => {
  const { fullWalletAddress, isConnected, walletType, refreshBalance } = useWallet();
  
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState<"USDC" | "USDT" | "X402">("USDC");
  const [step, setStep] = useState<DepositStep>("form");
  const [depositId, setDepositId] = useState("");
  const [txSignature, setTxSignature] = useState("");
  const [error, setError] = useState("");

  const getWalletProvider = useCallback((): WalletAdapter | null => {
    if (!isConnected || !walletType) return null;
    
    if (walletType === "phantom") {
      return getPhantomProvider();
    } else if (walletType === "solflare") {
      return getSolflareProvider();
    }
    return null;
  }, [walletType, isConnected]);

  const handleDeposit = async () => {
    if (!isConnected || !fullWalletAddress) {
      setError("Wallet not connected. Please connect your wallet first.");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    try {
      setError("");
      setStep("signing");

      // Step 1: Create deposit transaction
      const apiUrl = getApiUrl();
      const depositAmount = parseFloat(amount);
      
      // DEBUG: Log amount being sent
      console.log(`[DepositModal] Sending deposit request: amount=${amount}, parsed=${depositAmount}, token=${token}`);
      
      const createResponse = await fetch(`${apiUrl}/api/zk/deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: fullWalletAddress,
          amount: depositAmount,
          token,
        }),
      });

      const createResult = await createResponse.json();

      if (!createResult.success) {
        throw new Error(createResult.error || "Failed to create deposit transaction");
      }

      setDepositId(createResult.depositId);

      // Step 2: Sign transaction with wallet
      const wallet = getWalletProvider();
      if (!wallet || !wallet.publicKey) {
        throw new Error("Wallet not available for signing");
      }

      const { VersionedTransaction } = await import("@solana/web3.js");
      
      // Convert base64 string to Uint8Array (browser-compatible)
      const base64String = createResult.transaction;
      const binaryString = atob(base64String);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const transaction = VersionedTransaction.deserialize(bytes);

      const signedTransaction = await wallet.signTransaction(transaction);
      
      // Convert Uint8Array to base64 string (browser-compatible)
      const signedBytes = signedTransaction.serialize();
      let binary = '';
      for (let i = 0; i < signedBytes.length; i++) {
        binary += String.fromCharCode(signedBytes[i]);
      }
      const signedBase64 = btoa(binary);

      // Step 3: Submit signed transaction first
      const submitResponse = await fetch(`${apiUrl}/api/solana/submit-transaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signedTransaction: signedBase64,
          transactionType: "transfer",
        }),
      });

      const submitResult = await submitResponse.json();

      if (!submitResult.success) {
        throw new Error(submitResult.error || "Failed to submit transaction");
      }

      setTxSignature(submitResult.signature);

      // Step 4: Process deposit (after transaction is confirmed) — requires Bearer auth like Nolvipay
      setStep("processing");
      const sessionToken = authService.getSessionToken();
      const processHeaders: HeadersInit = { "Content-Type": "application/json" };
      if (sessionToken) processHeaders["Authorization"] = `Bearer ${sessionToken}`;
      const processResponse = await fetch(`${apiUrl}/api/zk/deposit/process`, {
        method: "POST",
        headers: processHeaders,
        body: JSON.stringify({
          depositId: createResult.depositId,
          transactionSignature: submitResult.signature,
          wallet: fullWalletAddress,
          amount: parseFloat(amount),
          token,
        }),
      });

      const processResult = await processResponse.json();

      if (!processResult.success) {
        throw new Error(processResult.error || "Failed to process deposit");
      }
      setStep("success");
      
      // Refresh balance
      if (refreshBalance) {
        setTimeout(() => refreshBalance(), 2000);
      }
    } catch (err) {
      console.error("Deposit error:", err);
      setError(err instanceof Error ? err.message : "Failed to process deposit");
      setStep("failed");
    }
  };

  const handleReset = () => {
    setAmount("");
    setToken("USDC");
    setStep("form");
    setDepositId("");
    setTxSignature("");
    setError("");
  };

  const handleClose = () => {
    if (step === "success" || step === "failed") {
      handleReset();
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowDownLeft className="w-5 h-5 text-primary" />
            Deposit Funds
          </DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {step === "form" && (
            <motion.div
              key="form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              {/* Token Selection */}
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">
                  Token
                </label>
                <Select value={token} onValueChange={(value) => setToken(value as "USDC" | "USDT" | "X402")}>
                  <SelectTrigger className="bg-secondary border-border h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USDC">
                      <div className="flex items-center gap-2">
                        <img src="https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png" alt="USDC" className="w-5 h-5 rounded-full" />
                        USDC
                      </div>
                    </SelectItem>
                    <SelectItem value="USDT">
                      <div className="flex items-center gap-2">
                        <img src="https://assets.coingecko.com/coins/images/325/small/Tether.png" alt="USDT" className="w-5 h-5 rounded-full" />
                        USDT
                      </div>
                    </SelectItem>
                    <SelectItem value="X402">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                          <span className="text-[8px] font-bold text-white">X</span>
                        </div>
                        X402
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Amount Input */}
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">
                  Amount
                </label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="bg-secondary border-border h-14 text-2xl font-mono"
                />
              </div>

              {/* Info */}
              <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
                <p className="text-sm text-muted-foreground">
                  Your deposit will go through privacy layers:
                  <br />
                  • Smart split (2 parts)
                  <br />
                  • Privacy mixer (obfuscation)
                  <br />
                  • Intermediate wallet assignment
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <Button
                onClick={handleDeposit}
                disabled={!amount || parseFloat(amount) <= 0 || !isConnected}
                className="w-full h-12 bg-primary hover:bg-primary/90"
              >
                <ArrowDownLeft className="w-4 h-4 mr-2" />
                Deposit {token}
              </Button>
            </motion.div>
          )}

          {step === "signing" && (
            <motion.div
              key="signing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-12 space-y-4"
            >
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <p className="text-lg font-semibold">Sign Transaction</p>
              <p className="text-sm text-muted-foreground text-center">
                Please approve the transaction in your wallet
              </p>
            </motion.div>
          )}

          {step === "processing" && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-12 space-y-4"
            >
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <p className="text-lg font-semibold">Processing Deposit</p>
              <p className="text-sm text-muted-foreground text-center">
                Your deposit is being processed through privacy layers...
              </p>
            </motion.div>
          )}

          {step === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-12 space-y-4"
            >
              <CheckCircle2 className="w-16 h-16 text-green-500" />
              <p className="text-lg font-semibold">Deposit Successful!</p>
              <p className="text-sm text-muted-foreground text-center">
                Your funds are being processed through privacy layers
              </p>
              {txSignature && (
                <a
                  href={`https://solscan.io/tx/${txSignature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  View on Solscan
                </a>
              )}
              <Button onClick={handleClose} className="mt-4">
                Close
              </Button>
            </motion.div>
          )}

          {step === "failed" && (
            <motion.div
              key="failed"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-12 space-y-4"
            >
              <AlertCircle className="w-16 h-16 text-destructive" />
              <p className="text-lg font-semibold">Deposit Failed</p>
              <p className="text-sm text-muted-foreground text-center">{error}</p>
              <div className="flex gap-3 mt-4">
                <Button variant="outline" onClick={handleReset}>
                  Try Again
                </Button>
                <Button onClick={handleClose}>Close</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};

export default DepositModal;
