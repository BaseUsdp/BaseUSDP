/**
 * Deposit Modal Component (1:1 with NolviPay Deposit.tsx)
 * 
 * Full privacy deposit flow:
 * 1. Create holding wallet (deterministic per deposit)
 * 2. User signs token transfer to holding wallet
 * 3. Auto-split deposit into 2-4 random parts
 * 4. Each split goes through ChangeNow privacy mixer
 * 5. Mixer output -> Intermediate Wallet -> Pool PDA (smart contract)
 * 6. Balance credited after all splits processed
 * 
 * X402 flow (Base USDC deposit):
 * 1. User signs a message with Phantom to verify wallet ownership
 * 2. Backend creates deposit record & returns Base deposit address
 * 3. User sends USDC on Base to the deposit address
 * 4. Backend detects the transfer, bridges via ChangeNow, credits balance
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
import { getPhantomProvider, getMetaMaskEVMProvider, WalletAdapter } from "@/services/transactionSigningService";

interface DepositModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialAmount?: string;
  initialToken?: "USDC" | "USDT";
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

const MAX_AMOUNT = 999999.99;

const DepositModal = ({ open, onOpenChange, initialAmount, initialToken }: DepositModalProps) => {
  const { fullWalletAddress, isConnected, walletType, refreshBalance, privacyLevel, activeChain } = useWallet();

  const [amount, setAmount] = useState("");

  // Pre-fill from AI Terminal
  useEffect(() => {
    if (open) {
      if (initialAmount) setAmount(initialAmount);
      if (initialToken) setToken(initialToken);
    }
  }, [open, initialAmount, initialToken]);

  // Sanitize amount input — no negatives, max 999,999.99
  const handleAmountChange = (value: string) => {
    let clean = value.replace(/-/g, '');
    if (clean === '' || clean === '.') {
      setAmount(clean);
      return;
    }
    const num = parseFloat(clean);
    if (!isNaN(num) && num > MAX_AMOUNT) {
      clean = MAX_AMOUNT.toString();
    }
    setAmount(clean);
  };
  const [token, setToken] = useState<"USDC" | "USDT">("USDC");
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

  // (x402 state removed — only standard USDC/USDT deposits now)

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
    if (walletType === "metamask") return null; // MetaMask is EVM-only
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
    timeoutMs: number,
    method: "POST" | "GET" = "POST"
  ): Promise<any> => {
    // Clear any leftover interval from a previous polling step
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let resolved = false;

      const poll = async () => {
        if (resolved || isCancelledRef.current) {
          if (!resolved && isCancelledRef.current) reject(new Error("Cancelled"));
          return;
        }

        if (Date.now() - startTime > timeoutMs) {
          if (!resolved) { resolved = true; reject(new Error("Timeout waiting for response")); }
          return;
        }

        try {
          const fetchOptions: RequestInit = method === "GET"
            ? { method: "GET", headers: { "Content-Type": "application/json" } }
            : {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
              };

          const response = await fetch(url, fetchOptions);
          if (!response.ok) {
            console.warn(`Poll response ${response.status}`);
            return; // Retry on next interval
          }
          const data = await response.json();

          if (resolved) return; // Another poll already resolved

          const result = checkFn(data);

          if (result.done && !resolved) {
            resolved = true;
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

  /**
   * Handle Base chain deposit (EVM) — uses the same holding-wallet privacy pipeline as Solana
   * 1. Create holding wallet -> get evmTransaction
   * 2. User signs ERC20 transfer to holding wallet (single tx, no approve needed)
   * 3. Poll auto-split-and-exchange (wait for funds + split)
   * 4. Poll process-split-queue (process splits)
   * 5. If full privacy: poll process-pending-exchanges (wait for mixer)
   * 6. Success
   */
  const handleBaseDeposit = async () => {
    if (!isConnected || !fullWalletAddress) {
      setError("Wallet not connected. Please connect your wallet first.");
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount < 3) {
      setError("Minimum deposit amount is $3");
      return;
    }
    if (parsedAmount > MAX_AMOUNT) {
      setError(`Maximum deposit amount is $${MAX_AMOUNT.toLocaleString()}`);
      return;
    }

    try {
      setError("");
      isCancelledRef.current = false;
      setStep("signing");
      setProcessingStatus("Creating holding wallet...");

      const apiUrl = getApiUrl();
      const depositAmount = parsedAmount;

      console.log(`[Base Deposit] Starting deposit: ${depositAmount} ${token}`);

      // ============================================
      // STEP 1: Create holding wallet (returns evmTransaction)
      // ============================================
      const holdingResponse = await fetch(`${apiUrl}/api/zk/create-holding-wallet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: fullWalletAddress,
          amount: depositAmount,
          token,
          privacy_level: privacyLevel,
        }),
      });

      const holdingResult = await holdingResponse.json();
      if (!holdingResult.success) {
        throw new Error(holdingResult.error || holdingResult.message || "Failed to create holding wallet");
      }

      const newDepositId = holdingResult.depositId;
      setDepositId(newDepositId);
      console.log(`[Base Deposit] Holding wallet: ${holdingResult.holdingWalletAddress}`);
      console.log(`[Base Deposit] Deposit ID: ${newDepositId}`);

      // ============================================
      // STEP 2: User signs EVM transfer to holding wallet
      // ============================================
      setProcessingStatus("Please approve the transfer in your wallet...");

      const ethProvider = (window as any).phantom?.ethereum;
      if (!ethProvider) {
        throw new Error("Phantom Ethereum provider not found. Please update Phantom.");
      }

      // Ensure connected to Base chain
      const BASE_CHAIN_ID = "0x2105";
      try {
        await ethProvider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: BASE_CHAIN_ID }],
        });
      } catch (switchErr: any) {
        if (switchErr.code === 4902) {
          await ethProvider.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: BASE_CHAIN_ID,
              chainName: "Base",
              nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
              rpcUrls: ["https://mainnet.base.org"],
              blockExplorerUrls: ["https://basescan.org"],
            }],
          });
        } else {
          throw new Error("Failed to switch to Base network");
        }
      }

      const accounts = await ethProvider.request({ method: "eth_accounts" });
      if (!accounts || accounts.length === 0) {
        throw new Error("No Ethereum accounts found in Phantom");
      }

      // If user needs to approve the DepositRouter for USDC (one-time)
      if (holdingResult.needsApproval && holdingResult.approveTransaction) {
        setProcessingStatus("One-time USDC approval needed for deposit router...");
        const approveTx = holdingResult.approveTransaction;
        const approveHash = await ethProvider.request({
          method: "eth_sendTransaction",
          params: [{ from: accounts[0], to: approveTx.to, data: approveTx.data, value: approveTx.value }],
        });
        console.log(`[Base Deposit] Approval tx: ${approveHash}`);

        // Wait for approval to confirm
        setProcessingStatus("Waiting for approval confirmation...");
        let approvalConfirmed = false;
        for (let i = 0; i < 30; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          const receipt = await ethProvider.request({
            method: "eth_getTransactionReceipt",
            params: [approveHash],
          });
          if (receipt && receipt.status === "0x1") {
            approvalConfirmed = true;
            break;
          }
          if (receipt && receipt.status === "0x0") {
            throw new Error("USDC approval transaction failed");
          }
        }
        if (!approvalConfirmed) {
          throw new Error("USDC approval timed out");
        }
        console.log(`[Base Deposit] Approval confirmed`);
      }

      // Send deposit via DepositRouter (USDC + ETH gas in single tx)
      setProcessingStatus("Please approve the deposit in your wallet...");
      const evmTx = holdingResult.evmTransaction;
      const txHash = await ethProvider.request({
        method: "eth_sendTransaction",
        params: [{ from: accounts[0], to: evmTx.to, data: evmTx.data, value: evmTx.value }],
      });
      console.log(`[Base Deposit] Deposit tx: ${txHash}`);
      setTxSignature(txHash);

      // ============================================
      // STEP 3: Wait for funds + auto-split
      // ============================================
      setStep("waitingForFunds");
      setProcessingStatus("Detecting funds in holding wallet...");

      await new Promise((r) => setTimeout(r, 5000));

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
        5000,
        300000
      );

      if (splitResult.error) {
        throw new Error(splitResult.error);
      }

      const numSplits = splitResult.numSplits || 1;
      setTotalSplits(numSplits);
      setSentSplits(0);

      console.log(`[Base Deposit] ${numSplits} splits queued`);

      // ============================================
      // STEP 4: Process split queue
      // ============================================
      setStep("splitting");
      const isDirectDeposit = privacyLevel === "public" || privacyLevel === "partial" || (token === "USDT" && privacyLevel === "full");
      setProcessingStatus(
        isDirectDeposit
          ? `Processing splits (0/${numSplits})...`
          : `Sending splits to privacy mixer (0/${numSplits})...`
      );

      let skipMixerStep = false;
      const splitQueueResult = await pollEndpoint(
        `${apiUrl}/api/zk/process-split-queue`,
        { depositId: newDepositId, wallet: fullWalletAddress },
        (data) => {
          if (data.sentSplits !== undefined) {
            setSentSplits(data.sentSplits);
            setTotalSplits(data.totalSplits || numSplits);
          }

          if (data.depositComplete && data.skipMixer) {
            skipMixerStep = true;
            setProcessingStatus("Deposit complete!");
            return { done: true, data };
          }

          if (data.allSent) {
            if (data.skipMixer) {
              skipMixerStep = true;
              setProcessingStatus(`All ${data.totalSplits || numSplits} splits processed!`);
            } else {
              setProcessingStatus(`All ${data.totalSplits || numSplits} splits sent to privacy mixer`);
            }
            return { done: true, data };
          }

          const sent = data.sentSplits || 0;
          const total = data.totalSplits || numSplits;
          setProcessingStatus(
            isDirectDeposit
              ? `Processing splits (${sent}/${total})...`
              : `Sending splits to privacy mixer (${sent}/${total})...`
          );
          return { done: false };
        },
        5000,
        600000
      );

      console.log(`[Base Deposit] Split queue done. skipMixer=${skipMixerStep}`);

      // ============================================
      // STEP 5: Process pending exchanges (full privacy only)
      // ============================================
      if (!skipMixerStep) {
        setStep("mixerProcessing");
        setTotalExchanges(numSplits);
        setProcessedExchanges(0);
        setProcessingStatus("Waiting for privacy mixer to process...");

        // Trigger processing every 30s in the background (supplements the cron)
        const triggerProcessing = () => {
          fetch(`${apiUrl}/api/zk/process-pending-exchanges`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ wallet: fullWalletAddress, depositId: newDepositId }),
          }).catch(() => {});
        };
        triggerProcessing(); // Kick off immediately
        const processingInterval = setInterval(triggerProcessing, 30000);

        // Poll with statusOnly=true for fast status checks (no on-chain work)
        try {
          await pollEndpoint(
            `${apiUrl}/api/zk/process-pending-exchanges`,
            { wallet: fullWalletAddress, depositId: newDepositId, statusOnly: true },
            (data) => {
              if (data.completedExchanges !== undefined) {
                setProcessedExchanges(data.completedExchanges);
              }
              if (data.totalExchanges !== undefined && data.totalExchanges > 0) {
                setTotalExchanges(data.totalExchanges);
              }

              if (data.allComplete === true) {
                setProcessingStatus("All exchanges processed!");
                return { done: true, data };
              }

              const completed = data.completedExchanges || 0;
              const total = data.totalExchanges || numSplits;
              if (total > 0 && completed > 0) {
                setProcessingStatus(`Processing exchanges (${completed}/${total})...`);
              } else if (total > 0) {
                setProcessingStatus("Privacy mixer is processing your funds...");
              } else {
                setProcessingStatus("Waiting for privacy mixer to process...");
              }

              return { done: false };
            },
            8000,    // Poll every 8 seconds
            1800000  // 30 minute timeout
          );
        } finally {
          clearInterval(processingInterval);
        }

        console.log(`[Base Deposit] All exchanges processed, deposit complete!`);
      } else {
        console.log(`[Base Deposit] Skipped mixer step (${privacyLevel} privacy)`);
      }

      // ============================================
      // STEP 6: Success!
      // ============================================
      setStep("success");

      if (refreshBalance) {
        setTimeout(() => refreshBalance(), 2000);
      }
    } catch (err: any) {
      console.error("[Base Deposit] Error:", err);
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

      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
  };

  const handleDeposit = async () => {
    // Route Base chain deposits to EVM handler
    if (activeChain === "base") {
      return handleBaseDeposit();
    }

    if (!isConnected || !fullWalletAddress) {
      setError("Wallet not connected. Please connect your wallet first.");
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount < 3) {
      setError("Minimum deposit amount is $3");
      return;
    }
    if (parsedAmount > MAX_AMOUNT) {
      setError(`Maximum deposit amount is $${MAX_AMOUNT.toLocaleString()}`);
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
          privacy_level: privacyLevel, // "public", "partial", or "full"
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
      // STEP 3: Submit transaction via backend
      // ============================================
      setStep("submitting");
      setProcessingStatus("Sending transaction to Base network...");

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
      // STEP 6: Process split queue (send to mixer or direct)
      // ============================================
      setStep("splitting");
      const isDirectDeposit = privacyLevel === "public" || privacyLevel === "partial" || (token === "USDT" && privacyLevel === "full");
      setProcessingStatus(
        isDirectDeposit 
          ? `Processing splits (0/${numSplits})...`
          : `Sending splits to privacy mixer (0/${numSplits})...`
      );

      // Poll process-split-queue until all splits are sent
      let skipMixerStep = false;
      const splitQueueResult = await pollEndpoint(
        `${apiUrl}/api/zk/process-split-queue`,
        { depositId: newDepositId, wallet: fullWalletAddress },
        (data) => {
          if (data.sentSplits !== undefined) {
            setSentSplits(data.sentSplits);
            setTotalSplits(data.totalSplits || numSplits);
          }

          // Check if this is a direct deposit (public/partial) that's complete
          if (data.depositComplete && data.skipMixer) {
            skipMixerStep = true;
            setProcessingStatus(`Deposit complete!`);
            return { done: true, data };
          }

          if (data.allSent) {
            // For public/partial, allSent means deposit is complete (no mixer)
            if (data.skipMixer) {
              skipMixerStep = true;
              setProcessingStatus(`All ${data.totalSplits || numSplits} splits processed!`);
            } else {
              setProcessingStatus(`All ${data.totalSplits || numSplits} splits sent to privacy mixer`);
            }
            return { done: true, data };
          }

          const sent = data.sentSplits || 0;
          const total = data.totalSplits || numSplits;
          setProcessingStatus(
            isDirectDeposit
              ? `Processing splits (${sent}/${total})...`
              : `Sending splits to privacy mixer (${sent}/${total})...`
          );

          return { done: false };
        },
        5000,   // Poll every 5 seconds
        600000  // 10 minute timeout (splits have staggered delays)
      );

      console.log(`[Deposit] Split queue done. skipMixer=${skipMixerStep}`);

      // ============================================
      // STEP 7: Process pending exchanges (ChangeNow -> deposit)
      // SKIP this step for public/partial (direct deposits)
      // ============================================
      if (!skipMixerStep) {
        setStep("mixerProcessing");
        setTotalExchanges(numSplits);
        setProcessedExchanges(0);
        setProcessingStatus("Waiting for privacy mixer to process...");

        // Trigger processing every 30s in the background (supplements the cron)
        const triggerProcessing = () => {
          fetch(`${apiUrl}/api/zk/process-pending-exchanges`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ wallet: fullWalletAddress, depositId: newDepositId }),
          }).catch(() => {});
        };
        triggerProcessing();
        const processingInterval = setInterval(triggerProcessing, 30000);

        // Poll with statusOnly=true for fast status checks (no on-chain work)
        try {
          await pollEndpoint(
            `${apiUrl}/api/zk/process-pending-exchanges`,
            { wallet: fullWalletAddress, depositId: newDepositId, statusOnly: true },
            (data) => {
              if (data.completedExchanges !== undefined) {
                setProcessedExchanges(data.completedExchanges);
              }
              if (data.totalExchanges !== undefined && data.totalExchanges > 0) {
                setTotalExchanges(data.totalExchanges);
              }

              if (data.allComplete === true) {
                setProcessingStatus("All exchanges processed!");
                return { done: true, data };
              }

              const completed = data.completedExchanges || 0;
              const total = data.totalExchanges || numSplits;
              if (total > 0 && completed > 0) {
                setProcessingStatus(`Processing exchanges (${completed}/${total})...`);
              } else if (total > 0) {
                setProcessingStatus("Privacy mixer is processing your funds...");
              } else {
                setProcessingStatus("Waiting for privacy mixer to process...");
              }

              return { done: false };
            },
            8000,    // Poll every 8 seconds
            1800000  // 30 minute timeout (ChangeNow can take time)
          );
        } finally {
          clearInterval(processingInterval);
        }

        console.log(`[Deposit] All exchanges processed, deposit complete!`);
      } else {
        console.log(`[Deposit] Skipped mixer step (${privacyLevel} privacy)`);
      }

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

  const minDeposit = 3;

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
                  onValueChange={(value) => setToken(value as "USDC" | "USDT")}
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
                        USDC (Base)
                      </div>
                    </SelectItem>
                    <SelectItem value="USDT">
                      <div className="flex items-center gap-2">
                        <img
                          src="https://assets.coingecko.com/coins/images/325/small/Tether.png"
                          alt="USDT"
                          className="w-5 h-5 rounded-full"
                        />
                        USDT (Base)
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
                  onChange={(e) => handleAmountChange(e.target.value)}
                  min="0"
                  max={MAX_AMOUNT}
                  className="bg-secondary border-border h-14 text-2xl font-mono"
                />
              </div>

              {/* USDT full privacy warning */}
              {token === "USDT" && privacyLevel === "full" && (
                <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/30 p-3 flex items-start gap-2">
                  <span className="text-yellow-400 text-sm mt-0.5">&#9888;</span>
                  <p className="text-xs text-yellow-300 leading-tight">
                    Full privacy is not available for USDT. Your deposit will use <strong>partial privacy</strong> (split transfers without mixer). For full privacy with mixer, use USDC.
                  </p>
                </div>
              )}

              {/* Fee Breakdown */}
              {amount && parseFloat(amount) >= minDeposit && (
                <div className="rounded-xl bg-secondary/50 border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Deposit amount</span>
                    <span className="text-foreground font-medium">
                      ${parseFloat(amount).toFixed(2)} {token}
                    </span>
                  </div>
                  {/* Fee varies by privacy level — USDT full privacy is downgraded to partial */}
                  {(token !== "USDT" && privacyLevel === "full") && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Privacy mixer fee (est.)</span>
                      <span className="text-red-400">-${(parseFloat(amount) * 0.15).toFixed(2)}</span>
                    </div>
                  )}
                  {(privacyLevel === "partial" || (token === "USDT" && privacyLevel === "full")) && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Single-hop fee</span>
                      <span className="text-emerald-400">$0.00</span>
                    </div>
                  )}
                  {privacyLevel === "public" && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Direct transfer (no mixer)</span>
                      <span className="text-emerald-400">$0.00</span>
                    </div>
                  )}
                  {activeChain === "base" && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Network gas deposit</span>
                      <span className="text-yellow-400">~{privacyLevel === "public" ? "0.001" : "0.002"} ETH</span>
                    </div>
                  )}
                  <div className="border-t border-border pt-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">You will receive (est.)</span>
                    <span className="text-base font-bold text-emerald-400">
                      {(privacyLevel === "full" && token !== "USDT")
                        ? `~$${(parseFloat(amount) * 0.85).toFixed(2)} ${token}`
                        : `$${parseFloat(amount).toFixed(2)} ${token}`
                      }
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground/60 leading-tight">
                    {(privacyLevel === "full" && token !== "USDT")
                      ? "The only fee is from the privacy mixer. No BASEUSDP platform fee. Actual amount may vary slightly depending on mixer rates."
                      : (privacyLevel === "partial" || (token === "USDT" && privacyLevel === "full"))
                        ? "Partial privacy: Split transfers without mixer. Faster processing, zero fees."
                        : "Public mode: Direct deposit without privacy mixing. Fastest processing, zero fees."
                    }
                    {activeChain === "base" && ` A small ETH deposit (~${privacyLevel === "public" ? "0.001" : "0.002"} ETH) covers network gas for processing. First deposit requires a ${token} approval.`}
                  </p>
                  {/* Privacy level indicator */}
                  <div className="flex items-center gap-2 pt-1 border-t border-border/50 mt-2">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Privacy:</span>
                    <span className={`text-[10px] uppercase tracking-wider font-bold ${
                      (privacyLevel === "full" && token !== "USDT") ? "text-primary" :
                      (privacyLevel === "partial" || (token === "USDT" && privacyLevel === "full")) ? "text-yellow-400" : "text-muted-foreground"
                    }`}>
                      {(token === "USDT" && privacyLevel === "full") ? "Partial (downgraded)" :
                       privacyLevel.charAt(0).toUpperCase() + privacyLevel.slice(1)}
                    </span>
                  </div>
                </div>
              )}

              {/* Info - changes based on privacy level */}
              <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
                {(privacyLevel === "full" && token !== "USDT") ? (
                  <>
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
                  </>
                ) : (privacyLevel === "partial" || (token === "USDT" && privacyLevel === "full")) ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Your deposit will be processed with partial privacy:
                    </p>
                    <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                      <li>• Deposit to unique holding wallet</li>
                      <li>• Single-hop transfer to intermediate wallet</li>
                      <li>• No external mixer — faster processing</li>
                      <li>• Credited to your private balance</li>
                    </ul>
                    <p className="text-xs text-muted-foreground/70 mt-2">
                      Minimum deposit: $3.00. Processing takes ~1-2 minutes.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Your deposit will be processed as a public deposit:
                    </p>
                    <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                      <li>• Deposit to unique holding wallet</li>
                      <li>• Direct transfer to your account</li>
                      <li>• No mixing — fastest processing</li>
                      <li>• Credited to your balance</li>
                    </ul>
                    <p className="text-xs text-muted-foreground/70 mt-2">
                      Minimum deposit: $3.00. Processing takes ~30 seconds.
                    </p>
                  </>
                )}
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
                disabled={!amount || parseFloat(amount) < minDeposit || parseFloat(amount) > MAX_AMOUNT || !isConnected}
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
                {processingStatus || (activeChain === "base" ? "Sending to Base network..." : "Sending transaction...")}
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
                  href={activeChain === "base" ? `https://basescan.org/tx/${txSignature}` : `https://solscan.io/tx/${txSignature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline"
                >
                  {activeChain === "base" ? "View transaction on Basescan" : "View transaction on Solscan"}
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
                  href={activeChain === "base" ? `https://basescan.org/tx/${txSignature}` : `https://solscan.io/tx/${txSignature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline"
                >
                  {activeChain === "base" ? "View transaction on Basescan" : "View transaction on Solscan"}
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
              <p className="text-lg font-semibold">
                {(privacyLevel === "full" && token !== "USDT") ? "Privacy Splitting" :
                 (privacyLevel === "partial" || (token === "USDT" && privacyLevel === "full")) ? "Processing Transfer" :
                 "Direct Deposit"}
              </p>

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
                    {(privacyLevel === "full" && token !== "USDT")
                      ? `Sending to privacy mixer (${sentSplits}/${totalSplits} splits)`
                      : (privacyLevel === "partial" || (token === "USDT" && privacyLevel === "full"))
                        ? "Single-hop transfer in progress..."
                        : "Direct deposit in progress..."
                    }
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
                  href={activeChain === "base" ? `https://basescan.org/tx/${txSignature}` : `https://solscan.io/tx/${txSignature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  {activeChain === "base" ? "View transaction on Basescan" : "View initial transaction on Solscan"}
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
