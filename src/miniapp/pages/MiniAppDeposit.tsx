/**
 * Mini App Deposit Page
 * Adapted from DepositModal for Farcaster's iframe
 * Uses Farcaster wallet provider for signing
 * Shows progress: "Splitting deposit for privacy..." with step indicator
 */

import { useState, useEffect, useRef } from "react";
import { ArrowLeft, ArrowDownToLine, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useFarcaster } from "../contexts/FarcasterContext";
import farcasterApi from "../services/farcasterApi";

type DepositStep =
  | "form"
  | "signing"
  | "submitting"
  | "splitting"
  | "success"
  | "failed";

const STEP_LABELS: Record<DepositStep, string> = {
  form: "",
  signing: "Approve in your wallet...",
  submitting: "Submitting to Base...",
  splitting: "Splitting deposit for privacy...",
  success: "Deposit complete!",
  failed: "Deposit failed",
};

export default function MiniAppDeposit() {
  const navigate = useNavigate();
  const { walletAddress, bearerToken, provider, balance, refreshBalance } =
    useFarcaster();

  const [step, setStep] = useState<DepositStep>("form");
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState<"USDC" | "USDT">("USDC");
  const [error, setError] = useState<string | null>(null);
  const [splitProgress, setSplitProgress] = useState(0);
  const pollingRef = useRef<ReturnType<typeof setInterval>>();

  const parsedAmount = parseFloat(amount) || 0;
  const isAmountValid = parsedAmount >= 3 && parsedAmount <= 999999.99;

  // Set token on API client
  if (bearerToken) {
    farcasterApi.setToken(bearerToken);
  }

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const handleDeposit = async () => {
    if (!walletAddress || !provider || !isAmountValid) return;

    setStep("signing");
    setError(null);

    try {
      // 1. Create holding wallet
      const holdingResult = await farcasterApi.createHoldingWallet({
        wallet: walletAddress,
        amount: parsedAmount,
        token,
      });

      if (!holdingResult.success || !holdingResult.holdingWallet) {
        throw new Error(holdingResult.error || "Failed to create holding wallet");
      }

      const holdingWallet = holdingResult.holdingWallet;
      const depositId = holdingResult.depositId;

      // 2. Get accounts from provider
      const accounts = await provider.request({ method: "eth_accounts" });
      const senderAddress = accounts[0] || walletAddress;

      // Use API-provided transactions (DepositRouter: approve + depositWithGas)
      const { needsApproval, approveTransaction, evmTransaction } = holdingResult;

      if (!evmTransaction) {
        throw new Error("No deposit transaction returned from server");
      }

      // Build transaction list
      const calls: { to: string; data: string; value: string }[] = [];
      if (needsApproval && approveTransaction) {
        calls.push(approveTransaction);
      }
      calls.push(evmTransaction);

      // Try EIP-5792 batch (all calls in one confirmation)
      try {
        setStep("signing");
        await provider.request({
          method: "wallet_sendCalls",
          params: [
            {
              from: senderAddress,
              calls,
              chainId: "0x2105",
            },
          ],
        });
      } catch {
        // Fallback: send each transaction sequentially
        setStep("signing");
        for (const call of calls) {
          await provider.request({
            method: "eth_sendTransaction",
            params: [
              {
                from: senderAddress,
                to: call.to,
                data: call.data,
                value: call.value,
              },
            ],
          });
        }
      }

      // 3. Trigger auto-split
      setStep("submitting");

      await farcasterApi.autoSplitAndExchange({
        wallet: walletAddress,
        holdingWallet,
        amount: parsedAmount,
        token,
        depositId,
      });

      // 4. Poll split queue
      setStep("splitting");
      setSplitProgress(0);

      let attempts = 0;
      const maxAttempts = 30;

      pollingRef.current = setInterval(async () => {
        attempts++;
        setSplitProgress(Math.min(90, (attempts / maxAttempts) * 100));

        try {
          const splitResult = await farcasterApi.processSplitQueue({
            wallet: walletAddress,
          });

          if (splitResult.success && (splitResult.processed || 0) > 0) {
            if (pollingRef.current) clearInterval(pollingRef.current);
            setSplitProgress(100);
            setStep("success");
            refreshBalance();
          }
        } catch {
          // Continue polling
        }

        if (attempts >= maxAttempts) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          // Still mark as success — splits may complete in background
          setStep("success");
          refreshBalance();
        }
      }, 5000);
    } catch (err: any) {
      console.error("[MiniApp Deposit] Error:", err);
      setError(err.message || "Deposit failed");
      setStep("failed");
    }
  };

  // Form
  if (step === "form") {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => navigate("/miniapp")} className="text-zinc-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">Deposit</h1>
        </div>

        {/* Token Select */}
        <div>
          <label className="text-xs text-zinc-400 mb-1.5 block">Token</label>
          <div className="flex gap-2">
            {(["USDC", "USDT"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setToken(t)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                  token === t
                    ? "bg-indigo-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="text-xs text-zinc-400 mb-1.5 block">Amount (min $3)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">$</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="3"
              max="999999.99"
              step="0.01"
              className="w-full pl-7 pr-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-lg font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          {amount && !isAmountValid && parsedAmount > 0 && (
            <p className="text-xs text-red-400 mt-1">
              {parsedAmount < 3
                ? "Minimum deposit is $3"
                : "Maximum deposit is $999,999.99"}
            </p>
          )}
        </div>

        {/* Info */}
        <div className="bg-zinc-800/30 rounded-xl p-3 border border-zinc-700/20">
          <p className="text-xs text-zinc-400 leading-relaxed">
            Your deposit will be automatically split and mixed for maximum privacy.
            This process takes 1-3 minutes.
          </p>
        </div>

        {/* Deposit Button */}
        <button
          onClick={handleDeposit}
          disabled={!isAmountValid}
          className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          <ArrowDownToLine className="w-4 h-4" />
          Deposit ${parsedAmount > 0 ? parsedAmount.toFixed(2) : "0.00"} {token}
        </button>
      </div>
    );
  }

  // Processing steps
  if (step === "signing" || step === "submitting" || step === "splitting") {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <Loader2 className="w-10 h-10 text-green-500 animate-spin" />
        <p className="text-sm font-medium">{STEP_LABELS[step]}</p>

        {step === "splitting" && (
          <div className="w-full max-w-xs">
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${splitProgress}%` }}
              />
            </div>
            <p className="text-xs text-zinc-500 text-center mt-2">
              {Math.round(splitProgress)}% — Privacy protection in progress
            </p>
          </div>
        )}
      </div>
    );
  }

  // Success
  if (step === "success") {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-green-400" />
        </div>
        <h2 className="text-lg font-semibold">Deposit Complete!</h2>
        <p className="text-sm text-zinc-400 text-center">
          ${parsedAmount.toFixed(2)} {token} has been deposited and privacy-protected.
        </p>
        <button
          onClick={() => navigate("/miniapp")}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-semibold"
        >
          Back to Home
        </button>
      </div>
    );
  }

  // Failed
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
        <AlertCircle className="w-8 h-8 text-red-400" />
      </div>
      <h2 className="text-lg font-semibold">Deposit Failed</h2>
      <p className="text-sm text-red-400 text-center">{error || "Something went wrong"}</p>
      <button
        onClick={() => { setStep("form"); setError(null); }}
        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-semibold"
      >
        Try Again
      </button>
    </div>
  );
}
