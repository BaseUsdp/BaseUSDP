import { useState, useCallback, useRef, useEffect } from "react";
import { useWallet } from "@/contexts/WalletContext";
import {
  ClawnchSwapper,
  parseTokenAmount,
  formatTokenAmount,
  BASE_TOKENS,
  type SwapPriceResult,
  type TokenInfo,
} from "@/services/clawncherSwapService";
import type { Address } from "viem";

export type SwapStep =
  | "idle"
  | "quoting"
  | "quoted"
  | "swapping"
  | "success"
  | "error";

export function useSwap() {
  const { fullWalletAddress } = useWallet();

  const [step, setStep] = useState<SwapStep>("idle");
  const [sellToken, setSellToken] = useState<TokenInfo>(BASE_TOKENS[0]); // ETH
  const [buyToken, setBuyToken] = useState<TokenInfo>(BASE_TOKENS[1]); // USDC
  const [sellAmount, setSellAmount] = useState("");
  const [slippageBps, setSlippageBps] = useState(300); // 3%
  const [priceResult, setPriceResult] = useState<SwapPriceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [sellBalance, setSellBalance] = useState<string | null>(null);

  const swapperRef = useRef<ClawnchSwapper | null>(null);
  const quoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize swapper when wallet is available
  const getSwapper = useCallback((): ClawnchSwapper | null => {
    const provider = (window as any).ethereum;
    if (!provider) return null;

    if (!swapperRef.current) {
      swapperRef.current = new ClawnchSwapper(provider);
    }
    return swapperRef.current;
  }, []);

  // Fetch sell token balance
  const fetchBalance = useCallback(async () => {
    const swapper = getSwapper();
    if (!swapper || !fullWalletAddress) {
      setSellBalance(null);
      return;
    }

    try {
      const bal = await swapper.getBalance(
        sellToken.address,
        fullWalletAddress as Address
      );
      setSellBalance(formatTokenAmount(bal, sellToken.decimals));
    } catch {
      setSellBalance(null);
    }
  }, [getSwapper, fullWalletAddress, sellToken]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  // Debounced price fetch
  const fetchPrice = useCallback(async () => {
    if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current);

    const amount = parseTokenAmount(sellAmount, sellToken.decimals);
    if (amount <= 0n) {
      setPriceResult(null);
      setStep("idle");
      return;
    }

    quoteTimerRef.current = setTimeout(async () => {
      const swapper = getSwapper();
      if (!swapper) {
        setError("No wallet provider found. Please connect MetaMask.");
        return;
      }

      setStep("quoting");
      setError(null);

      try {
        const result = await swapper.getPrice({
          sellToken: sellToken.address,
          buyToken: buyToken.address,
          sellAmount: amount,
          slippageBps,
        });
        setPriceResult(result);
        setStep("quoted");
      } catch (err: any) {
        console.error("Price fetch error:", err);
        setError(err.message || "Failed to get price");
        setPriceResult(null);
        setStep("error");
      }
    }, 500);
  }, [sellAmount, sellToken, buyToken, slippageBps, getSwapper]);

  // Execute swap
  const doSwap = useCallback(async () => {
    const swapper = getSwapper();
    if (!swapper) {
      setError("No wallet provider found.");
      return;
    }

    const amount = parseTokenAmount(sellAmount, sellToken.decimals);
    if (amount <= 0n) {
      setError("Enter a valid amount.");
      return;
    }

    setStep("swapping");
    setError(null);

    try {
      const result = await swapper.swap({
        sellToken: sellToken.address,
        buyToken: buyToken.address,
        sellAmount: amount,
        slippageBps,
      });

      setTxHash(result.txHash);
      setStep("success");
      fetchBalance();
    } catch (err: any) {
      console.error("Swap error:", err);
      setError(err.message || "Swap failed");
      setStep("error");
    }
  }, [sellAmount, sellToken, buyToken, slippageBps, getSwapper, fetchBalance]);

  const flipTokens = useCallback(() => {
    const tmp = sellToken;
    setSellToken(buyToken);
    setBuyToken(tmp);
    setPriceResult(null);
    setStep("idle");
  }, [sellToken, buyToken]);

  const reset = useCallback(() => {
    setStep("idle");
    setPriceResult(null);
    setError(null);
    setTxHash(null);
    setSellAmount("");
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current);
    };
  }, []);

  return {
    step,
    sellToken,
    buyToken,
    sellAmount,
    slippageBps,
    priceResult,
    error,
    txHash,
    sellBalance,
    setSellToken,
    setBuyToken,
    setSellAmount,
    setSlippageBps,
    fetchPrice,
    doSwap,
    flipTokens,
    reset,
  };
}
