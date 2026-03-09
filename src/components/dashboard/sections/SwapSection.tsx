import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSwap } from "@/hooks/useSwap";
import {
  formatTokenAmount,
  BASE_TOKENS,
} from "@/services/clawncherSwapService";
import TokenSelector from "../TokenSelector";
import { cn } from "@/lib/utils";

interface SwapSectionProps {
  showBalance: boolean;
}

const SLIPPAGE_PRESETS = [100, 200, 300]; // 1%, 2%, 3%

const SwapSection = ({ showBalance }: SwapSectionProps) => {
  const { isConnected } = useWallet();
  const swap = useSwap();
  const [showSlippage, setShowSlippage] = useState(false);
  const [customSlippage, setCustomSlippage] = useState("");

  // Fetch price when inputs change
  useEffect(() => {
    if (swap.sellAmount && parseFloat(swap.sellAmount) > 0) {
      swap.fetchPrice();
    }
  }, [swap.sellAmount, swap.sellToken, swap.buyToken, swap.slippageBps]);

  const handleSlippagePreset = (bps: number) => {
    swap.setSlippageBps(bps);
    setCustomSlippage("");
  };

  const handleCustomSlippage = (val: string) => {
    setCustomSlippage(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0 && num <= 50) {
      swap.setSlippageBps(Math.round(num * 100));
    }
  };

  const handleMaxAmount = () => {
    if (swap.sellBalance) {
      swap.setSellAmount(swap.sellBalance);
    }
  };

  const isActionDisabled =
    !isConnected ||
    !swap.sellAmount ||
    parseFloat(swap.sellAmount) <= 0 ||
    swap.step === "quoting" ||
    swap.step === "swapping";

  const getActionLabel = () => {
    switch (swap.step) {
      case "quoting":
        return "Getting Price...";
      case "swapping":
        return "Swapping...";
      case "quoted":
        return "Swap";
      default:
        return "Get Quote";
    }
  };

  const handleAction = () => {
    if (swap.step === "quoted") {
      swap.doSwap();
    } else {
      swap.fetchPrice();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Page Header */}
      <div className="mb-2">
        <h1 className="font-display text-3xl font-bold">
          Token Swap<span className="text-primary">.</span>
        </h1>
        <p className="text-muted-foreground mt-1">
          Swap tokens on Base — powered by Clawncher
        </p>
      </div>

      {/* Swap Card */}
      <div className="max-w-md mx-auto">
        <AnimatePresence mode="wait">
          {swap.step === "success" ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="rounded-2xl border border-border bg-card/50 backdrop-blur-xl p-6 text-center"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Icon
                  icon="ph:check-circle-bold"
                  className="w-8 h-8 text-emerald-400"
                />
              </div>
              <h3 className="text-xl font-semibold mb-2">Swap Successful!</h3>
              <p className="text-neutral-400 text-sm mb-4">
                Your tokens have been swapped successfully.
              </p>

              {swap.txHash && (
                <a
                  href={`https://basescan.org/tx/${swap.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sky-400 hover:text-sky-300 text-sm mb-6"
                >
                  <Icon icon="ph:arrow-square-out" className="w-4 h-4" />
                  View on Basescan
                </a>
              )}

              <Button
                onClick={swap.reset}
                className="w-full bg-gradient-to-r from-sky-600 to-purple-600 hover:from-sky-500 hover:to-purple-500"
              >
                Swap Again
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="rounded-2xl border border-border bg-card/50 backdrop-blur-xl p-6 space-y-4"
            >
              {/* Sell Side */}
              <div
                className="rounded-xl p-4"
                style={{ background: "var(--dash-surface)" }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="text-xs font-medium"
                    style={{ color: "var(--dash-text-muted)" }}
                  >
                    You Pay
                  </span>
                  {swap.sellBalance !== null && (
                    <span
                      className="text-xs"
                      style={{ color: "var(--dash-text-faint)" }}
                    >
                      Balance:{" "}
                      {showBalance ? swap.sellBalance : "****"}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <TokenSelector
                    selected={swap.sellToken}
                    onSelect={swap.setSellToken}
                    exclude={swap.buyToken.address}
                  />
                  <div className="flex-1 relative">
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={swap.sellAmount}
                      onChange={(e) => swap.setSellAmount(e.target.value)}
                      min="0"
                      className="bg-transparent border-none text-right text-lg font-medium pr-14 focus-visible:ring-0"
                      style={{ color: "var(--dash-text)" }}
                    />
                    <button
                      onClick={handleMaxAmount}
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 text-[10px] font-medium hover:bg-sky-500/30 transition-colors"
                    >
                      MAX
                    </button>
                  </div>
                </div>
              </div>

              {/* Flip Button */}
              <div className="flex justify-center -my-2 relative z-10">
                <button
                  onClick={swap.flipTokens}
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-sky-500/20"
                  style={{
                    background: "var(--dash-surface)",
                    border: "1px solid var(--dash-border)",
                  }}
                >
                  <Icon
                    icon="ph:arrows-down-up-bold"
                    className="w-4 h-4 text-sky-400"
                  />
                </button>
              </div>

              {/* Buy Side */}
              <div
                className="rounded-xl p-4"
                style={{ background: "var(--dash-surface)" }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="text-xs font-medium"
                    style={{ color: "var(--dash-text-muted)" }}
                  >
                    You Receive
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <TokenSelector
                    selected={swap.buyToken}
                    onSelect={swap.setBuyToken}
                    exclude={swap.sellToken.address}
                  />
                  <div className="flex-1">
                    <div
                      className="text-right text-lg font-medium py-2 px-3"
                      style={{
                        color: swap.priceResult
                          ? "var(--dash-text)"
                          : "var(--dash-text-faint)",
                      }}
                    >
                      {swap.priceResult
                        ? formatTokenAmount(
                            swap.priceResult.buyAmount,
                            swap.buyToken.decimals
                          )
                        : "0.00"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Quote Details */}
              {swap.priceResult && swap.step === "quoted" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="rounded-xl p-3 space-y-2"
                  style={{
                    background: "var(--dash-surface)",
                    border: "1px solid var(--dash-border)",
                  }}
                >
                  <div className="flex justify-between text-xs">
                    <span style={{ color: "var(--dash-text-muted)" }}>
                      Rate
                    </span>
                    <span style={{ color: "var(--dash-text)" }}>
                      1 {swap.sellToken.symbol} ={" "}
                      {swap.priceResult.sellAmount > 0n
                        ? (
                            Number(swap.priceResult.buyAmount) /
                            Number(swap.priceResult.sellAmount) *
                            (10 ** swap.sellToken.decimals / 10 ** swap.buyToken.decimals)
                          ).toFixed(
                            swap.buyToken.decimals > 6 ? 6 : swap.buyToken.decimals
                          )
                        : "0"}{" "}
                      {swap.buyToken.symbol}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span style={{ color: "var(--dash-text-muted)" }}>
                      Min. Received
                    </span>
                    <span style={{ color: "var(--dash-text)" }}>
                      {formatTokenAmount(
                        swap.priceResult.minBuyAmount,
                        swap.buyToken.decimals
                      )}{" "}
                      {swap.buyToken.symbol}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span style={{ color: "var(--dash-text-muted)" }}>
                      Est. Gas
                    </span>
                    <span style={{ color: "var(--dash-text)" }}>
                      {formatTokenAmount(swap.priceResult.totalNetworkFee, 18)}{" "}
                      ETH
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span style={{ color: "var(--dash-text-muted)" }}>
                      Slippage
                    </span>
                    <span style={{ color: "var(--dash-text)" }}>
                      {swap.slippageBps / 100}%
                    </span>
                  </div>
                </motion.div>
              )}

              {/* Slippage Settings */}
              <div>
                <button
                  onClick={() => setShowSlippage(!showSlippage)}
                  className="flex items-center gap-1 text-xs transition-colors"
                  style={{ color: "var(--dash-text-muted)" }}
                >
                  <Icon icon="ph:gear-bold" className="w-3.5 h-3.5" />
                  Slippage: {swap.slippageBps / 100}%
                  <Icon
                    icon="ph:caret-down-bold"
                    className={cn(
                      "w-3 h-3 transition-transform",
                      showSlippage && "rotate-180"
                    )}
                  />
                </button>
                {showSlippage && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="flex items-center gap-2 mt-2"
                  >
                    {SLIPPAGE_PRESETS.map((bps) => (
                      <button
                        key={bps}
                        onClick={() => handleSlippagePreset(bps)}
                        className={cn(
                          "px-3 py-1 rounded-lg text-xs font-medium transition-colors",
                          swap.slippageBps === bps
                            ? "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                            : "bg-muted text-neutral-400 hover:bg-white/10"
                        )}
                      >
                        {bps / 100}%
                      </button>
                    ))}
                    <Input
                      type="number"
                      placeholder="Custom"
                      value={customSlippage}
                      onChange={(e) => handleCustomSlippage(e.target.value)}
                      className="w-20 h-7 text-xs bg-muted border-border"
                      min="0.01"
                      max="50"
                      step="0.1"
                    />
                  </motion.div>
                )}
              </div>

              {/* Error */}
              {swap.error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-sm text-red-400">{swap.error}</p>
                </div>
              )}

              {/* Action Button */}
              <Button
                onClick={handleAction}
                disabled={isActionDisabled}
                className="w-full bg-gradient-to-r from-sky-600 to-purple-600 hover:from-sky-500 hover:to-purple-500 text-white py-6"
              >
                {(swap.step === "quoting" || swap.step === "swapping") && (
                  <Icon
                    icon="ph:spinner"
                    className="w-5 h-5 mr-2 animate-spin"
                  />
                )}
                {swap.step === "quoted" && (
                  <Icon
                    icon="ph:arrows-left-right-bold"
                    className="w-5 h-5 mr-2"
                  />
                )}
                {getActionLabel()}
              </Button>

              {/* Info */}
              <p
                className="text-xs text-center"
                style={{ color: "var(--dash-text-faint)" }}
              >
                Swaps are executed directly on Base via Clawncher (0x
                aggregation). Not connected to privacy pools.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default SwapSection;
