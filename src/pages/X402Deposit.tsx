/**
 * X402 Deposit Page
 * Standalone page for x402 Base USDC deposits via Phantom EVM
 * 
 * URL format: /x402-deposit?depositAddress=0x...&amount=100&depositId=...
 */
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Icon } from "@iconify/react";

// Constants
const BASE_CHAIN_ID = "0x2105"; // 8453
const BASE_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

type StepState = "pending" | "active" | "done" | "error";

interface Step {
  id: string;
  label: string;
  state: StepState;
}

const X402Deposit = () => {
  const [searchParams] = useSearchParams();
  const depositAddress = searchParams.get("depositAddress") || "";
  const amount = parseFloat(searchParams.get("amount") || "0");
  const depositId = searchParams.get("depositId") || "";

  const [steps, setSteps] = useState<Step[]>([
    { id: "connect", label: "Connect to Phantom EVM", state: "pending" },
    { id: "network", label: "Switch to Base network", state: "pending" },
    { id: "approve", label: "Approve USDC transfer", state: "pending" },
    { id: "confirm", label: "Transaction confirmed", state: "pending" },
  ]);
  const [statusText, setStatusText] = useState("Tap below to send Base USDC via Phantom");
  const [showSpinner, setShowSpinner] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const updateStep = (stepId: string, state: StepState) => {
    setSteps((prev) =>
      prev.map((step) => (step.id === stepId ? { ...step, state } : step))
    );
  };

  const startTransfer = async () => {
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      // Validate params
      if (!depositAddress || amount <= 0) {
        throw new Error("Invalid deposit parameters. Please return to the app and try again.");
      }

      // Step 1: Get Phantom's Ethereum provider
      updateStep("connect", "active");
      setStatusText("Connecting to Phantom EVM...");
      setShowSpinner(true);

      const ethProvider = (window as any).phantom?.ethereum;
      if (!ethProvider) {
        throw new Error(
          "Phantom Ethereum provider not found. Make sure you are opening this page inside Phantom's browser."
        );
      }

      let accounts: string[];
      try {
        accounts = await ethProvider.request({ method: "eth_requestAccounts" });
      } catch {
        throw new Error("Failed to connect to Phantom EVM. Please try again.");
      }

      if (!accounts || accounts.length === 0) {
        throw new Error("No Ethereum accounts found in Phantom.");
      }

      console.log("[x402] Connected to Phantom EVM:", accounts[0]);
      updateStep("connect", "done");

      // Step 2: Switch to Base network
      updateStep("network", "active");
      setStatusText("Switching to Base network...");

      try {
        await ethProvider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: BASE_CHAIN_ID }],
        });
      } catch (switchErr: any) {
        // If Base isn't added yet, add it
        if (switchErr.code === 4902) {
          await ethProvider.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: BASE_CHAIN_ID,
                chainName: "Base",
                nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
                rpcUrls: ["https://mainnet.base.org"],
                blockExplorerUrls: ["https://basescan.org"],
              },
            ],
          });
        } else {
          throw new Error("Failed to switch to Base network.");
        }
      }

      console.log("[x402] Switched to Base network");
      updateStep("network", "done");

      // Step 3: Build ERC-20 transfer calldata and send
      updateStep("approve", "active");
      setStatusText("Approve the USDC transfer...");

      const amountWei = BigInt(Math.floor(amount * 1_000_000)); // USDC = 6 decimals
      const amountHex = amountWei.toString(16).padStart(64, "0");
      const toClean = depositAddress.toLowerCase().replace("0x", "").padStart(64, "0");
      const transferData = "0xa9059cbb" + toClean + amountHex;

      console.log("[x402] Sending transfer:", {
        from: accounts[0],
        to: BASE_USDC_ADDRESS,
        data: transferData,
      });

      const hash = await ethProvider.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: accounts[0],
            to: BASE_USDC_ADDRESS,
            data: transferData,
            value: "0x0",
          },
        ],
      });

      console.log("[x402] Transaction sent:", hash);
      updateStep("approve", "done");

      // Step 4: Confirmed
      updateStep("confirm", "done");
      setTxHash(hash);
      setIsSuccess(true);
      setShowSpinner(false);
    } catch (err: any) {
      const msg = err.message || "Transaction failed. Please try again.";
      console.error("[x402] Error:", msg);
      setErrorMessage(msg);
      setShowSpinner(false);

      // Mark current active step as error
      setSteps((prev) =>
        prev.map((step) => (step.state === "active" ? { ...step, state: "error" } : step))
      );

      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-5" style={{
      background: "radial-gradient(ellipse 140% 70% at 50% -5%, #330165, #110B1E, #08080C)",
    }}>
      <div className="max-w-[420px] w-full rounded-2xl p-7 border border-white/10" style={{
        background: "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
        backdropFilter: "blur(12px)",
      }}>
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-[22px] font-bold tracking-tight">
            <span className="text-violet-500">Void</span>402
          </h1>
          <p className="text-[13px] text-zinc-400 mt-1">x402 Base USDC Transfer</p>
        </div>

        {/* Deposit Info Card */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 mb-5">
          <div className="flex justify-between items-center py-2.5 border-b border-white/5">
            <span className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Amount</span>
            <span className="text-emerald-500 text-base font-semibold font-mono">
              {amount > 0 ? `$${amount.toFixed(2)} USDC` : "—"}
            </span>
          </div>
          <div className="flex justify-between items-center py-2.5 border-b border-white/5">
            <span className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Send to</span>
            <span className="text-zinc-100 text-[10px] font-mono font-medium text-right max-w-[55%] break-all leading-relaxed">
              {depositAddress || "Not provided"}
            </span>
          </div>
          <div className="flex justify-between items-center py-2.5 border-b border-white/5">
            <span className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Network</span>
            <span className="text-zinc-100 text-[13px] font-semibold font-mono">Base</span>
          </div>
          <div className="flex justify-between items-center py-2.5">
            <span className="text-zinc-500 text-xs font-medium uppercase tracking-wider">Token</span>
            <span className="text-zinc-100 text-[13px] font-semibold font-mono">USDC</span>
          </div>
        </div>

        {/* Step Checklist */}
        <div className="mb-4">
          {steps.map((step) => (
            <div
              key={step.id}
              className={`flex items-center gap-3 py-2.5 text-[13px] transition-colors ${
                step.state === "active"
                  ? "text-zinc-100 font-medium"
                  : step.state === "done"
                  ? "text-emerald-500"
                  : step.state === "error"
                  ? "text-red-500"
                  : "text-zinc-600"
              }`}
            >
              <span className="w-[22px] h-[22px] flex items-center justify-center flex-shrink-0 text-sm">
                {step.state === "done" ? (
                  <Icon icon="ph:check-bold" className="text-emerald-500" />
                ) : step.state === "error" ? (
                  <Icon icon="ph:x-bold" className="text-red-500" />
                ) : step.state === "active" ? (
                  <span
                    className="w-2 h-2 rounded-full bg-violet-500 animate-pulse"
                    style={{ boxShadow: "0 0 8px rgba(124,58,237,0.5)" }}
                  />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-zinc-700" />
                )}
              </span>
              <span>{step.label}</span>
            </div>
          ))}
        </div>

        {/* Status Area */}
        <div className="text-center py-4 min-h-[60px] flex flex-col items-center justify-center gap-3">
          {isSuccess ? (
            <>
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center text-[28px] mx-auto mb-3">
                <Icon icon="ph:check-bold" className="text-emerald-500 w-7 h-7" />
              </div>
              <p className="text-zinc-100 text-base font-semibold">USDC Sent Successfully!</p>
              {txHash && (
                <div className="font-mono text-[11px] text-violet-500 break-all bg-violet-500/10 px-3 py-2 rounded-lg mt-2">
                  {txHash}
                </div>
              )}
              <p className="text-zinc-400 text-[13px] mt-2 leading-relaxed">
                Your deposit is being processed.<br />Return to the app to track progress.
              </p>
            </>
          ) : (
            <>
              {showSpinner && (
                <div
                  className="w-7 h-7 border-[3px] border-violet-500/20 border-t-violet-500 rounded-full animate-spin"
                />
              )}
              <p className="text-zinc-400 text-[13px] leading-relaxed">{statusText}</p>
            </>
          )}
        </div>

        {/* Error Box */}
        {errorMessage && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mt-3">
            <p className="text-red-500 text-xs text-center leading-relaxed">{errorMessage}</p>
          </div>
        )}

        {/* Action Buttons */}
        {!isSuccess && (
          <button
            onClick={startTransfer}
            disabled={isProcessing}
            className={`w-full py-3.5 rounded-xl text-[15px] font-semibold text-white mt-3 transition-all ${
              isProcessing
                ? "bg-violet-500/30 cursor-not-allowed"
                : "bg-violet-500 hover:bg-violet-600 active:scale-[0.98]"
            }`}
          >
            {isProcessing ? "Processing..." : errorMessage ? "Retry" : "Send USDC"}
          </button>
        )}

        {isSuccess && (
          <a
            href={`baseusdp://x402-sent?depositId=${depositId}&txHash=${txHash}`}
            className="block w-full py-3.5 rounded-xl text-[15px] font-semibold text-zinc-100 mt-3 text-center border border-white/10 hover:bg-white/5 transition-all"
          >
            Return to USDP
          </a>
        )}
      </div>
    </div>
  );
};

export default X402Deposit;
