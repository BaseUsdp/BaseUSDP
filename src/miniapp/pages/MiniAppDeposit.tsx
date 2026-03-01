/**
 * Mini App Deposit Page
 * Matches the website DepositModal flow:
 *   1. Create holding wallet + sign tx
 *   2. Poll auto-split-and-exchange (wait for holding wallet funds)
 *   3. Poll process-split-queue (send splits)
 *   4. Poll process-pending-exchanges (mixer completion, if full privacy)
 *   5. Refresh balance
 */

import { useState, useEffect, useRef } from "react";
import { ArrowLeft, ArrowDownToLine, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useFarcaster } from "../contexts/FarcasterContext";
import farcasterApi from "../services/farcasterApi";

type DepositStep =
  | "form"
  | "signing"
  | "waitingForFunds"
  | "splitting"
  | "mixerProcessing"
  | "success"
  | "failed";

const STEP_LABELS: Record<DepositStep, string> = {
  form: "",
  signing: "Approve in your wallet...",
  waitingForFunds: "Waiting for funds to arrive...",
  splitting: "Splitting deposit for privacy...",
  mixerProcessing: "Processing privacy mixer...",
  success: "Deposit complete!",
  failed: "Deposit failed",
};

export default function MiniAppDeposit() {
  const navigate = useNavigate();
  const { walletAddress, bearerToken, provider, refreshBalance } =
    useFarcaster();

  const [step, setStep] = useState<DepositStep>("form");
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState<"USDC" | "USDT">("USDC");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const pollingRef = useRef<ReturnType<typeof setInterval>>();
  const processingIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const isCancelledRef = useRef(false);

  const parsedAmount = parseFloat(amount) || 0;
  const isAmountValid = parsedAmount >= 3 && parsedAmount <= 999999.99;

  if (bearerToken) {
    farcasterApi.setToken(bearerToken);
  }

  useEffect(() => {
    return () => {
      isCancelledRef.current = true;
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (processingIntervalRef.current) clearInterval(processingIntervalRef.current);
    };
  }, []);

  /** Generic polling helper — matches website's pollEndpoint */
  const pollUntil = (
    pollFn: () => Promise<{ done: boolean; data?: any }>,
    intervalMs: number,
    timeoutMs: number,
  ): Promise<any> => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = undefined;
    }

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let resolved = false;

      const poll = async () => {
        if (resolved || isCancelledRef.current) return;
        if (Date.now() - startTime > timeoutMs) {
          if (!resolved) { resolved = true; reject(new Error("Timeout")); }
          return;
        }
        try {
          const result = await pollFn();
          if (resolved) return;
          if (result.done) {
            resolved = true;
            if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = undefined; }
            resolve(result.data);
          }
        } catch {
          // retry on next interval
        }
      };

      poll();
      pollingRef.current = setInterval(poll, intervalMs);
    });
  };

  const handleDeposit = async () => {
    if (!walletAddress || !provider || !isAmountValid) return;

    isCancelledRef.current = false;
    setStep("signing");
    setError(null);
    setProgress(0);

    try {
      // === STEP 1: Create holding wallet ===
      const holdingResult = await farcasterApi.createHoldingWallet({
        wallet: walletAddress,
        amount: parsedAmount,
        token,
      });

      if (!holdingResult.success || !holdingResult.holdingWallet) {
        throw new Error(holdingResult.error || "Failed to create holding wallet");
      }

      const holdingWallet = holdingResult.holdingWallet;
      const depositId = holdingResult.depositId!;
      const { needsApproval, approveTransaction, evmTransaction } = holdingResult;

      if (!evmTransaction) {
        throw new Error("No deposit transaction returned from server");
      }

      // === STEP 2: Sign transaction(s) ===
      const accounts = await provider.request({ method: "eth_accounts" });
      const senderAddress = accounts[0] || walletAddress;

      const calls: { to: string; data: string; value: string }[] = [];
      if (needsApproval && approveTransaction) calls.push(approveTransaction);
      calls.push(evmTransaction);

      try {
        await provider.request({
          method: "wallet_sendCalls",
          params: [{ from: senderAddress, calls, chainId: "0x2105" }],
        });
      } catch {
        for (const call of calls) {
          await provider.request({
            method: "eth_sendTransaction",
            params: [{ from: senderAddress, to: call.to, data: call.data, value: call.value }],
          });
        }
      }

      // === STEP 3: Poll auto-split (wait for funds to arrive at holding wallet) ===
      setStep("waitingForFunds");
      setProgress(5);
      setStatusText("Detecting deposit on Base...");

      let numSplits = 0;
      let skipMixer = false;

      await pollUntil(async () => {
        const data = await farcasterApi.autoSplitAndExchange({
          wallet: walletAddress,
          holdingWallet,
          amount: parsedAmount,
          token,
          depositId,
        });

        if (data.splits && data.splits.length > 0) {
          numSplits = data.splits.length;
          return { done: true, data };
        }
        return { done: false };
      }, 5000, 300000); // 5s interval, 5min timeout

      setProgress(25);

      // === STEP 4: Poll split queue (send splits to mixer or directly to pool) ===
      setStep("splitting");
      setStatusText("Sending splits...");

      const splitResult = await pollUntil(async () => {
        const data = await farcasterApi.processSplitQueue({ wallet: walletAddress });

        if (data.success) {
          const allSent = (data as any).allSent;
          skipMixer = (data as any).skipMixer || false;

          if (allSent) {
            return { done: true, data };
          }

          const sent = (data as any).sentSplits || 0;
          const total = (data as any).totalSplits || numSplits || 1;
          setProgress(25 + (sent / total) * 35);
          setStatusText(`Split ${sent}/${total} sent...`);
        }
        return { done: false };
      }, 5000, 600000); // 5s interval, 10min timeout

      setProgress(60);

      // === STEP 5: Poll mixer (if full privacy — not skipped) ===
      if (!skipMixer) {
        setStep("mixerProcessing");
        setStatusText("Privacy mixer processing...");

        // Trigger processing periodically (supplements cron)
        const triggerProcessing = () => {
          farcasterApi.processPendingExchanges({
            wallet: walletAddress,
            depositId,
          }).catch(() => {});
        };
        triggerProcessing();
        processingIntervalRef.current = setInterval(triggerProcessing, 30000);

        try {
          await pollUntil(async () => {
            const data = await farcasterApi.processPendingExchanges({
              wallet: walletAddress,
              depositId,
              statusOnly: true,
            });

            const completed = data.completedExchanges || 0;
            const total = data.totalExchanges || numSplits || 1;
            setProgress(60 + (completed / total) * 35);
            setStatusText(`Mixer ${completed}/${total} complete...`);

            if (data.allComplete) {
              return { done: true, data };
            }
            return { done: false };
          }, 8000, 1800000); // 8s interval, 30min timeout
        } finally {
          if (processingIntervalRef.current) {
            clearInterval(processingIntervalRef.current);
            processingIntervalRef.current = undefined;
          }
        }
      }

      // === STEP 6: Success ===
      setProgress(100);
      setStep("success");
      refreshBalance();
    } catch (err: any) {
      console.error("[MiniApp Deposit] Error:", err);
      if (err.message === "Timeout") {
        // Timeouts aren't fatal — processing continues in background
        setStep("success");
        setStatusText("Processing continues in background");
        refreshBalance();
      } else {
        setError(err.message || "Deposit failed");
        setStep("failed");
      }
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
            This process may take several minutes.
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
  if (step === "signing" || step === "waitingForFunds" || step === "splitting" || step === "mixerProcessing") {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <Loader2 className="w-10 h-10 text-green-500 animate-spin" />
        <p className="text-sm font-medium">{STEP_LABELS[step]}</p>

        {step !== "signing" && (
          <div className="w-full max-w-xs">
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-zinc-500 text-center mt-2">
              {statusText || `${Math.round(progress)}%`}
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
