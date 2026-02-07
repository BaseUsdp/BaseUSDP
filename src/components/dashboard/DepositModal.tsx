/**
 * Deposit Modal Component (1:1 with NolviPay Deposit.tsx)
 * 
 * Full privacy deposit flow:
 * 1. Create holding wallet (deterministic per deposit)
 * 2. User signs SPL token transfer to holding wallet
 * 3. Auto-split deposit into 2-4 random parts
 * 4. Each split goes through ChangeNow privacy mixer
 * 5. Mixer output -> Intermediate Wallet -> Pool PDA (smart contract)
 * 6. Balance credited after all splits processed
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDownLeft, Loader2, AlertCircle, CheckCircle2, Clock } from "lucide-react";
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
import { getPhantomProvider, getSolflareProvider, WalletAdapter } from "@/services/transactionSigningService";

interface DepositModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type DepositStep =
  | "form"
  | "signing"
  | "submitting"
  | "waitingForFunds"
  | "splitting"
  | "mixerProcessing"
  | "success"
  | "failed";

const DepositModal = ({ open, onOpenChange }: DepositModalProps) => {
  const { fullWalletAddress, isConnected, walletType, refreshBalance } = useWallet();

  const [amount, setAmount] = useState("");
  const [token, setToken] = useState<"USDC" | "USDT" | "X402">("USDC");
  const [step, setStep] = useState<DepositStep>("form");
  const [depositId, setDepositId] = useState("");
  const [txSignature, setTxSignature] = useState("");
  const [error, setError] = useState("");
  const [processingStatus, setProcessingStatus] = useState("");

  // Split progress
  const [totalSplits, setTotalSplits] = useState(0);
  const [sentSplits, setSentSplits] = useState(0);

  // Mixer progress
  const [processedExchanges, setProcessedExchanges] = useState(0);
  const [totalExchanges, setTotalExchanges] = useState(0);

  // Polling refs
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isCancelledRef = useRef(false);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      isCancelledRef.current = true;
    };
  }, []);

  const getWalletProvider = useCallback((): WalletAdapter | null => {
    if (!isConnected || !walletType) return null;
    if (walletType === "phantom") return getPhantomProvider();
    if (walletType === "solflare") return getSolflareProvider();
    return null;
  }, [walletType, isConnected]);

  /**
   * Poll an endpoint until a condition is met
   */
  const pollEndpoint = async (
    url: string,
    body: Record<string, any>,
    checkFn: (data: any) => { done: boolean; data?: any },
    intervalMs: number,
    timeoutMs: number
  ): Promise<any> => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const poll = async () => {
        if (isCancelledRef.current) {
          reject(new Error("Cancelled"));
          return;
        }

        if (Date.now() - startTime > timeoutMs) {
          reject(new Error("Timeout waiting for response"));
          return;
        }

        try {
          const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

          const data = await response.json();
          const result = checkFn(data);

          if (result.done) {
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }
            resolve(result.data || data);
            return;
          }
        } catch (err) {
          console.warn("Poll error:", err);
        }
      };

      // Run immediately, then at interval
      poll();
      pollingRef.current = setInterval(poll, intervalMs);
    });
  };

  const handleDeposit = async () => {
    if (!isConnected || !fullWalletAddress) {
      setError("Wallet not connected. Please connect your wallet first.");
      return;
    }

    if (!amount || parseFloat(amount) < 3) {
      setError("Minimum deposit amount is $3");
      return;
    }

    try {
      setError("");
      isCancelledRef.current = false;
      setStep("signing");
      setProcessingStatus("Creating holding wallet...");

      const apiUrl = getApiUrl();
      const depositAmount = parseFloat(amount);

      console.log(`[Deposit] Starting deposit: ${depositAmount} ${token}`);

      // ============================================
      // STEP 1: Create holding wallet
      // ============================================
      const holdingResponse = await fetch(`${apiUrl}/api/zk/create-holding-wallet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: fullWalletAddress,
          amount: depositAmount,
          token,
        }),
      });

      const holdingResult = await holdingResponse.json();

      if (!holdingResult.success) {
        throw new Error(holdingResult.error || holdingResult.message || "Failed to create holding wallet");
      }

      const holdingWalletAddress = holdingResult.holdingWalletAddress;
      const newDepositId = holdingResult.depositId;
      setDepositId(newDepositId);

      console.log(`[Deposit] Holding wallet: ${holdingWalletAddress}`);
      console.log(`[Deposit] Deposit ID: ${newDepositId}`);

      // ============================================
      // STEP 2: Sign the transaction built by backend
      // ============================================
      setProcessingStatus("Please approve in your wallet...");

      const { Transaction } = await import("@solana/web3.js");

      // Decode base64 transaction from backend
      const txBase64 = holdingResult.transaction;
      const txBytes = Uint8Array.from(atob(txBase64), (c) => c.charCodeAt(0));
      const tx = Transaction.from(txBytes);

      const walletProvider = getWalletProvider();
      if (!walletProvider || !walletProvider.publicKey) {
        throw new Error("Wallet not available for signing");
      }

      const signedTransaction = await walletProvider.signTransaction(tx);

      // ============================================
      // STEP 3: Submit transaction to Solana via backend
      // ============================================
      setStep("submitting");
      setProcessingStatus("Sending transaction to Solana...");

      // Serialize signed tx to base64
      const signedBytes = signedTransaction.serialize();
      let signedBase64 = "";
      const chunkSize = 8192;
      for (let i = 0; i < signedBytes.length; i += chunkSize) {
        signedBase64 += String.fromCharCode(...signedBytes.slice(i, i + chunkSize));
      }
      signedBase64 = btoa(signedBase64);

      const submitResponse = await fetch(`${apiUrl}/api/solana/submit-transaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signedTransaction: signedBase64,
          transactionType: "deposit",
        }),
      });

      const submitResult = await submitResponse.json();

      if (!submitResult.success) {
        throw new Error(submitResult.error || "Failed to submit transaction");
      }

      const signature = submitResult.signature;
      setTxSignature(signature);
      console.log(`[Deposit] Transaction confirmed: ${signature}`);

      // ============================================
      // STEP 5: Wait for funds to arrive in holding wallet,
      //         then auto-split
      // ============================================
      setStep("waitingForFunds");
      setProcessingStatus("Detecting funds in holding wallet...");

      // Give blockchain a moment to finalize
      await new Promise((r) => setTimeout(r, 3000));

      // Poll auto-split-and-exchange
      const splitResult = await pollEndpoint(
        `${apiUrl}/api/zk/auto-split-and-exchange`,
        { depositId: newDepositId },
        (data) => {
          if (data.success && data.numSplits > 0) {
            return { done: true, data };
          }
          if (data.success === false && data.message?.includes("below minimum")) {
            return { done: true, data: { error: data.message } };
          }
          setProcessingStatus(data.message || "Waiting for funds to arrive...");
          return { done: false };
        },
        5000,  // Poll every 5 seconds
        300000 // 5 minute timeout
      );

      if (splitResult.error) {
        throw new Error(splitResult.error);
      }

      const numSplits = splitResult.numSplits || 1;
      setTotalSplits(numSplits);
      setSentSplits(0);

      console.log(`[Deposit] ${numSplits} splits queued`);

      // ============================================
      // STEP 6: Process split queue (send to ChangeNow)
      // ============================================
      setStep("splitting");
      setProcessingStatus(`Sending splits to privacy mixer (0/${numSplits})...`);

      // Poll process-split-queue until all splits are sent
      await pollEndpoint(
        `${apiUrl}/api/zk/process-split-queue`,
        { depositId: newDepositId, wallet: fullWalletAddress },
        (data) => {
          if (data.sentSplits !== undefined) {
            setSentSplits(data.sentSplits);
            setTotalSplits(data.totalSplits || numSplits);
          }

          if (data.allSent) {
            setProcessingStatus(`All ${data.totalSplits || numSplits} splits sent to privacy mixer`);
            return { done: true, data };
          }

          const sent = data.sentSplits || 0;
          const total = data.totalSplits || numSplits;
          setProcessingStatus(`Sending splits to privacy mixer (${sent}/${total})...`);

          return { done: false };
        },
        5000,   // Poll every 5 seconds
        600000  // 10 minute timeout (splits have staggered delays)
      );

      console.log(`[Deposit] All splits sent to ChangeNow`);

      // ============================================
      // STEP 7: Process pending exchanges (ChangeNow -> deposit)
      // ============================================
      setStep("mixerProcessing");
      setTotalExchanges(numSplits);
      setProcessedExchanges(0);
      setProcessingStatus("Waiting for privacy mixer to process...");

      // Poll process-pending-exchanges until ALL exchanges are deposited
      await pollEndpoint(
        `${apiUrl}/api/zk/process-pending-exchanges`,
        { wallet: fullWalletAddress, depositId: newDepositId },
        (data) => {
          // Track progress from backend counts
          if (data.completedExchanges !== undefined) {
            setProcessedExchanges(data.completedExchanges);
          }
          if (data.totalExchanges !== undefined && data.totalExchanges > 0) {
            setTotalExchanges(data.totalExchanges);
          }

          // Backend tells us when ALL exchanges are complete
          if (data.allComplete === true) {
            setProcessingStatus("All exchanges processed!");
            return { done: true, data };
          }

          // Update status message based on exchange states
          if (data.results && data.results.length > 0) {
            const statuses = data.results.map((r: any) => r.status);
            if (statuses.includes("waiting")) {
              setProcessingStatus("Privacy mixer is processing your funds...");
            } else if (statuses.includes("exchanging")) {
              setProcessingStatus("Privacy mixer exchange in progress...");
            } else if (statuses.includes("confirming")) {
              setProcessingStatus("Confirming mixer output...");
            } else if (statuses.includes("waiting_for_funds")) {
              setProcessingStatus("Waiting for mixer to receive funds...");
            }
          } else {
            const completed = data.completedExchanges || 0;
            const total = data.totalExchanges || numSplits;
            setProcessingStatus(`Processing exchanges (${completed}/${total})...`);
          }

          return { done: false };
        },
        10000,   // Poll every 10 seconds
        1800000  // 30 minute timeout (ChangeNow can take time)
      );

      console.log(`[Deposit] All exchanges processed, deposit complete!`);

      // ============================================
      // STEP 8: Success!
      // ============================================
      setStep("success");

      // Refresh balance
      if (refreshBalance) {
        setTimeout(() => refreshBalance(), 2000);
      }
    } catch (err: any) {
      console.error("Deposit error:", err);

      // Handle user rejection gracefully
      if (
        err.message?.includes("rejected") ||
        err.message?.includes("cancelled") ||
        err.message?.includes("User rejected")
      ) {
        setError("Transaction was cancelled");
      } else {
        setError(err.message || "Failed to process deposit");
      }
      setStep("failed");

      // Cleanup polling
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
  };

  const handleReset = () => {
    setAmount("");
    setToken("USDC");
    setStep("form");
    setDepositId("");
    setTxSignature("");
    setError("");
    setProcessingStatus("");
    setTotalSplits(0);
    setSentSplits(0);
    setProcessedExchanges(0);
    setTotalExchanges(0);
    isCancelledRef.current = false;

    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const handleClose = () => {
    if (step === "success" || step === "failed" || step === "form") {
      handleReset();
    }
    isCancelledRef.current = true;
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    onOpenChange(false);
  };

  // Progress bar percentage
  const getProgressPercent = (): number => {
    switch (step) {
      case "form":
        return 0;
      case "signing":
        return 10;
      case "submitting":
        return 20;
      case "waitingForFunds":
        return 30;
      case "splitting":
        return 30 + (totalSplits > 0 ? (sentSplits / totalSplits) * 30 : 0);
      case "mixerProcessing":
        return 60 + (totalExchanges > 0 ? (processedExchanges / totalExchanges) * 35 : 0);
      case "success":
        return 100;
      default:
        return 0;
    }
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
          {/* ==================== FORM ==================== */}
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
                <Select
                  value={token}
                  onValueChange={(value) => setToken(value as "USDC" | "USDT" | "X402")}
                >
                  <SelectTrigger className="bg-secondary border-border h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USDC">
                      <div className="flex items-center gap-2">
                        <img
                          src="https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png"
                          alt="USDC"
                          className="w-5 h-5 rounded-full"
                        />
                        USDC
                      </div>
                    </SelectItem>
                    <SelectItem value="USDT">
                      <div className="flex items-center gap-2">
                        <img
                          src="https://assets.coingecko.com/coins/images/325/small/Tether.png"
                          alt="USDT"
                          className="w-5 h-5 rounded-full"
                        />
                        USDT
                      </div>
                    </SelectItem>
                    <SelectItem value="X402">
                      <div className="flex items-center gap-2">
                        <img
                          src="https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png"
                          alt="X402"
                          className="w-5 h-5 rounded-full"
                        />
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

              {/* Fee Breakdown */}
              {amount && parseFloat(amount) >= 3 && (
                <div className="rounded-xl bg-secondary/50 border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Deposit amount</span>
                    <span className="text-foreground font-medium">${parseFloat(amount).toFixed(2)} {token}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Privacy mixer fee (~0.5%)</span>
                    <span className="text-red-400">-${(parseFloat(amount) * 0.005).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Protocol fee (10%)</span>
                    <span className="text-red-400">-${(parseFloat(amount) * 0.10).toFixed(2)}</span>
                  </div>
                  <div className="border-t border-border pt-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">You will receive (est.)</span>
                    <span className="text-base font-bold text-emerald-400">
                      ~${(parseFloat(amount) * (1 - 0.005 - 0.10)).toFixed(2)} {token}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground/60 leading-tight">
                    Mixer fee varies slightly per split. Actual amount may differ by a few cents.
                  </p>
                </div>
              )}

              {/* Info */}
              <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
                <p className="text-sm text-muted-foreground">
                  Your deposit will be processed through full privacy layers:
                </p>
                <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                  <li>• Deposit to unique holding wallet</li>
                  <li>• Smart split into 2-4 random parts</li>
                  <li>• Each part routed through privacy mixer</li>
                  <li>• Credited to your private balance</li>
                </ul>
                <p className="text-xs text-muted-foreground/70 mt-2">
                  Minimum deposit: $3.00. Processing may take 5-15 minutes.
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <Button
                onClick={handleDeposit}
                disabled={!amount || parseFloat(amount) < 3 || !isConnected}
                className="w-full h-12 bg-primary hover:bg-primary/90"
              >
                <ArrowDownLeft className="w-4 h-4 mr-2" />
                Deposit {amount ? `$${parseFloat(amount).toFixed(2)}` : ""} {token}
              </Button>
            </motion.div>
          )}

          {/* ==================== SIGNING ==================== */}
          {step === "signing" && (
            <motion.div
              key="signing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-12 space-y-4"
            >
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <p className="text-lg font-semibold">Preparing Deposit</p>
              <p className="text-sm text-muted-foreground text-center">
                {processingStatus || "Please approve the transaction in your wallet"}
              </p>
            </motion.div>
          )}

          {/* ==================== SUBMITTING ==================== */}
          {step === "submitting" && (
            <motion.div
              key="submitting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-12 space-y-6"
            >
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <p className="text-lg font-semibold">Submitting Transaction</p>
              <p className="text-sm text-muted-foreground text-center">
                {processingStatus || "Sending to Solana blockchain..."}
              </p>

              {/* Progress bar */}
              <div className="w-full max-w-xs">
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    initial={{ width: "10%" }}
                    animate={{ width: `${getProgressPercent()}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>

              {txSignature && (
                <a
                  href={`https://solscan.io/tx/${txSignature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline"
                >
                  View transaction on Solscan
                </a>
              )}
            </motion.div>
          )}

          {/* ==================== WAITING FOR FUNDS ==================== */}
          {step === "waitingForFunds" && (
            <motion.div
              key="waitingForFunds"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-12 space-y-6"
            >
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <p className="text-lg font-semibold">Detecting Funds</p>

              <div className="w-full max-w-xs space-y-3">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">Transaction signed</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">Submitted to blockchain</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">Transaction confirmed</span>
                </div>
                <div className="flex items-center gap-3">
                  <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
                  <span className="text-sm text-white font-medium">
                    {processingStatus || "Detecting funds in holding wallet..."}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full max-w-xs">
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    animate={{ width: `${getProgressPercent()}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>

              {txSignature && (
                <a
                  href={`https://solscan.io/tx/${txSignature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline"
                >
                  View transaction on Solscan
                </a>
              )}
            </motion.div>
          )}

          {/* ==================== SPLITTING ==================== */}
          {step === "splitting" && (
            <motion.div
              key="splitting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-12 space-y-6"
            >
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <p className="text-lg font-semibold">Privacy Splitting</p>

              <div className="w-full max-w-xs space-y-3">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">Transaction confirmed</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">Funds detected in holding wallet</span>
                </div>
                <div className="flex items-center gap-3">
                  <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
                  <span className="text-sm text-white font-medium">
                    Sending to privacy mixer ({sentSplits}/{totalSplits} splits)
                  </span>
                </div>
              </div>

              {/* Split progress */}
              <div className="w-full max-w-xs">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Splits sent to mixer</span>
                  <span>{sentSplits}/{totalSplits}</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    animate={{
                      width: totalSplits > 0 ? `${(sentSplits / totalSplits) * 100}%` : "0%",
                    }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
                <Clock className="w-3 h-3" />
                <span>Splits are staggered 1-3 minutes apart for privacy</span>
              </div>
            </motion.div>
          )}

          {/* ==================== MIXER PROCESSING ==================== */}
          {step === "mixerProcessing" && (
            <motion.div
              key="mixerProcessing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-12 space-y-6"
            >
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <p className="text-lg font-semibold">Privacy Mixer Processing</p>

              <div className="w-full max-w-xs space-y-3">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">Transaction confirmed</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">
                    All {totalSplits} splits sent to mixer
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
                  <span className="text-sm text-white font-medium">
                    {processingStatus || "Waiting for mixer to process..."}
                  </span>
                </div>
              </div>

              {/* Overall progress */}
              <div className="w-full max-w-xs">
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    animate={{ width: `${getProgressPercent()}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <p className="text-xs text-muted-foreground/70 mt-2 text-center">
                  Privacy mixer may take 5-15 minutes to process
                </p>
              </div>
            </motion.div>
          )}

          {/* ==================== SUCCESS ==================== */}
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
                Your funds have been processed through privacy layers and credited to your private balance.
              </p>
              {txSignature && (
                <a
                  href={`https://solscan.io/tx/${txSignature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  View initial transaction on Solscan
                </a>
              )}
              <Button onClick={handleClose} className="mt-4">
                Close
              </Button>
            </motion.div>
          )}

          {/* ==================== FAILED ==================== */}
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
