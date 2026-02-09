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
 * 
 * X402 flow (Base USDC -> Solana USDC):
 * 1. User signs a message with Phantom to verify wallet ownership
 * 2. Backend creates deposit record & returns Base deposit address
 * 3. User sends USDC on Base to the deposit address
 * 4. Backend detects the transfer, bridges via ChangeNow, credits balance
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDownLeft, Loader2, AlertCircle, CheckCircle2, Clock, ExternalLink } from "lucide-react";
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
import bs58 from "bs58";

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
  | "failed"
  // x402 steps
  | "x402_signing"
  | "x402_waitingForDeposit"
  | "x402_received"
  | "x402_bridging"
  | "x402_success";

const MAX_AMOUNT = 999999.99;

const DepositModal = ({ open, onOpenChange }: DepositModalProps) => {
  const { fullWalletAddress, isConnected, walletType, refreshBalance, privacyLevel } = useWallet();

  const [amount, setAmount] = useState("");

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

  // x402 state
  const [x402DepositAddress, setX402DepositAddress] = useState("");
  const [x402DepositId, setX402DepositId] = useState("");
  const [x402Status, setX402Status] = useState<any>(null);
  // (copied state removed — no longer needed since Phantom sends Base USDC directly)

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
    timeoutMs: number,
    method: "POST" | "GET" = "POST"
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
          const fetchOptions: RequestInit = method === "GET"
            ? { method: "GET", headers: { "Content-Type": "application/json" } }
            : {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
              };

          const response = await fetch(url, fetchOptions);
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

  /**
   * Handle x402 deposit flow (Base USDC -> Solana USDC)
   * Uses Phantom's ethereum provider to send Base USDC automatically
   */
  const handleX402Deposit = async () => {
    if (!isConnected || !fullWalletAddress) {
      setError("Wallet not connected. Please connect your wallet first.");
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount < 5) {
      setError("Minimum x402 deposit amount is $5");
      return;
    }
    if (parsedAmount > MAX_AMOUNT) {
      setError(`Maximum deposit amount is $${MAX_AMOUNT.toLocaleString()}`);
      return;
    }

    try {
      setError("");
      isCancelledRef.current = false;
      setStep("x402_signing");
      setProcessingStatus("Please sign the message in your wallet...");

      const apiUrl = getApiUrl();
      const depositAmount = parsedAmount;

      console.log(`[x402] Starting x402 deposit: $${depositAmount}`);

      // ============================================
      // STEP 1: Sign message with Phantom/Solflare (wallet verification)
      // ============================================
      const timestamp = Date.now();
      const messageToSign = `Void402 x402 Deposit: $${depositAmount.toFixed(2)} USDC from Base to Solana - ${timestamp}`;
      const encodedMessage = new TextEncoder().encode(messageToSign);

      let signatureBase58: string;

      if (walletType === "phantom") {
        const provider = (window as any).phantom?.solana;
        if (!provider) throw new Error("Phantom wallet not found");
        
        const signedMessage = await provider.signMessage(encodedMessage, "utf8");
        if (!signedMessage || !signedMessage.signature) {
          throw new Error("Failed to sign message");
        }
        signatureBase58 = bs58.encode(signedMessage.signature);
      } else if (walletType === "solflare") {
        const provider = (window as any).solflare;
        if (!provider) throw new Error("Solflare wallet not found");
        
        const signedMessage = await provider.signMessage(encodedMessage, "utf8");
        if (!signedMessage || !signedMessage.signature) {
          throw new Error("Failed to sign message");
        }
        signatureBase58 = bs58.encode(signedMessage.signature);
      } else {
        throw new Error("Unsupported wallet type");
      }

      console.log(`[x402] Message signed successfully`);
      setProcessingStatus("Signature verified! Creating deposit...");

      // ============================================
      // STEP 2: Create deposit on backend
      // ============================================
      const createResponse = await fetch(`${apiUrl}/api/x402/create-deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: fullWalletAddress,
          amount: depositAmount,
          wallet_signature: signatureBase58,
          message_to_sign: messageToSign,
        }),
      });

      const createResult = await createResponse.json();

      if (!createResult.success) {
        throw new Error(createResult.error || createResult.message || "Failed to create x402 deposit");
      }

      const newDepositId = createResult.depositId;
      const depositAddress = createResult.depositAddress;

      setX402DepositId(newDepositId);
      setX402DepositAddress(depositAddress);
      setDepositId(newDepositId);

      console.log(`[x402] Deposit created: ${newDepositId}`);
      console.log(`[x402] Deposit address: ${depositAddress}`);

      // ============================================
      // STEP 3: Send Base USDC via Phantom's ethereum provider
      // ============================================
      setStep("x402_waitingForDeposit");
      setProcessingStatus("Please approve the Base USDC transfer in Phantom...");

      // Base chain constants
      const BASE_CHAIN_ID = "0x2105"; // 8453
      const BASE_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

      // Get Phantom's ethereum provider
      const ethProvider = (window as any).phantom?.ethereum;
      if (!ethProvider) {
        throw new Error("Phantom Ethereum provider not found. Please update Phantom to the latest version.");
      }

      // Request accounts (connect to Phantom EVM)
      let accounts: string[];
      try {
        accounts = await ethProvider.request({ method: "eth_requestAccounts" });
      } catch (connectErr: any) {
        throw new Error("Failed to connect to Phantom Ethereum. Please ensure Phantom supports Base network.");
      }

      if (!accounts || accounts.length === 0) {
        throw new Error("No Ethereum accounts found in Phantom");
      }

      console.log(`[x402] Connected to Phantom EVM: ${accounts[0]}`);

      // Switch to Base network
      try {
        await ethProvider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: BASE_CHAIN_ID }],
        });
      } catch (switchErr: any) {
        // If Base isn't added, add it
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

      console.log(`[x402] Switched to Base network`);

      // Build ERC-20 transfer calldata
      // transfer(address to, uint256 amount) = 0xa9059cbb
      const amountWei = BigInt(Math.floor(depositAmount * 1_000_000)); // USDC has 6 decimals
      const amountHex = amountWei.toString(16).padStart(64, "0");
      const toAddressClean = depositAddress.toLowerCase().replace("0x", "").padStart(64, "0");
      const transferData = "0xa9059cbb" + toAddressClean + amountHex;

      setProcessingStatus("Approve the USDC transfer in Phantom...");

      // Send the transaction via Phantom
      const txHash = await ethProvider.request({
        method: "eth_sendTransaction",
        params: [{
          from: accounts[0],
          to: BASE_USDC_ADDRESS,
          data: transferData,
          value: "0x0",
        }],
      });

      console.log(`[x402] Base USDC transfer sent: ${txHash}`);
      setProcessingStatus("Base USDC sent! Processing deposit...");

      // ============================================
      // STEP 4: Trigger process-deposits immediately & poll for status
      // ============================================
      setStep("x402_bridging");
      setProcessingStatus("Base USDC sent! Detecting transfer...");

      // Immediately trigger process-deposits to detect the Base transfer
      // (don't wait for the 2-minute cron — process it NOW)
      console.log(`[x402] Triggering immediate deposit processing...`);
      try {
        fetch(`${apiUrl}/api/x402/process-deposits`, { method: "POST" }).catch(() => {});
      } catch (_) {
        // Fire and forget — the cron will pick it up if this fails
      }

      // Poll check-deposit endpoint, and re-trigger processing periodically
      let triggerCount = 0;
      await pollEndpoint(
        `${apiUrl}/api/x402/check-deposit?depositId=${newDepositId}`,
        {},
        (data) => {
          if (!data.success || !data.deposit) return { done: false };

          const deposit = data.deposit;
          setX402Status(deposit);

          if (deposit.status === "completed") {
            setStep("x402_success");
            return { done: true, data: deposit };
          }

          if (deposit.status === "failed" || deposit.status === "refunded") {
            throw new Error(deposit.description || "Deposit failed");
          }

          if (deposit.status === "received") {
            setStep("x402_received");
            setProcessingStatus(deposit.description || "USDC received on Base! Initiating bridge...");
          } else if (deposit.status === "bridging") {
            setStep("x402_bridging");
            setProcessingStatus(deposit.bridge_progress || deposit.description || "Cross-chain bridge in progress...");
          } else if (deposit.status === "pending") {
            setProcessingStatus("Detecting Base USDC transfer...");
            // Re-trigger process-deposits every 3rd poll while still pending
            triggerCount++;
            if (triggerCount % 3 === 0) {
              console.log(`[x402] Re-triggering deposit processing (attempt ${triggerCount})...`);
              fetch(`${apiUrl}/api/x402/process-deposits`, { method: "POST" }).catch(() => {});
            }
          }

          return { done: false };
        },
        6000,     // Poll every 6 seconds
        3600000,  // 60 minute timeout (cross-chain bridging can take time)
        "GET"
      );

      console.log(`[x402] Deposit complete!`);

      // Refresh balance
      if (refreshBalance) {
        setTimeout(() => refreshBalance(), 2000);
      }
    } catch (err: any) {
      console.error("[x402] Deposit error:", err);

      if (
        err.message?.includes("rejected") ||
        err.message?.includes("cancelled") ||
        err.message?.includes("User rejected")
      ) {
        setError("Transaction was cancelled");
      } else {
        setError(err.message || "Failed to process x402 deposit");
      }
      setStep("failed");

      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
  };

  const handleDeposit = async () => {
    // Route x402 deposits to separate handler
    if (token === "X402") {
      return handleX402Deposit();
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
    setX402DepositAddress("");
    setX402DepositId("");
    setX402Status(null);
    isCancelledRef.current = false;

    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const handleClose = () => {
    if (step === "success" || step === "x402_success" || step === "failed" || step === "form") {
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
      case "x402_success":
        return 100;
      // x402 steps
      case "x402_signing":
        return 10;
      case "x402_waitingForDeposit":
        return 25;
      case "x402_received":
        return 50;
      case "x402_bridging":
        return 75;
      default:
        return 0;
    }
  };

  // Get the minimum deposit amount based on token
  const minDeposit = token === "X402" ? 5 : 3;

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
                        USDC (Solana)
                      </div>
                    </SelectItem>
                    <SelectItem value="USDT">
                      <div className="flex items-center gap-2">
                        <img
                          src="https://assets.coingecko.com/coins/images/325/small/Tether.png"
                          alt="USDT"
                          className="w-5 h-5 rounded-full"
                        />
                        USDT (Solana)
                      </div>
                    </SelectItem>
                    <SelectItem value="X402">
                      <div className="flex items-center gap-2">
                        <img
                          src="https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png"
                          alt="X402"
                          className="w-5 h-5 rounded-full"
                        />
                        x402 (Base USDC)
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

              {/* Fee Breakdown */}
              {amount && parseFloat(amount) >= minDeposit && (
                <div className="rounded-xl bg-secondary/50 border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Deposit amount</span>
                    <span className="text-foreground font-medium">
                      ${parseFloat(amount).toFixed(2)} {token === "X402" ? "USDC (Base)" : token}
                    </span>
                  </div>
                  {/* Fee varies by privacy level */}
                  {(token === "X402" || privacyLevel === "full") && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {token === "X402" ? "Bridge + mixer fee (est.)" : "Privacy mixer fee (est.)"}
                      </span>
                      <span className="text-red-400">-${(parseFloat(amount) * 0.15).toFixed(2)}</span>
                    </div>
                  )}
                  {token !== "X402" && privacyLevel === "partial" && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Single-hop fee</span>
                      <span className="text-emerald-400">$0.00</span>
                    </div>
                  )}
                  {token !== "X402" && privacyLevel === "public" && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Direct transfer (no mixer)</span>
                      <span className="text-emerald-400">$0.00</span>
                    </div>
                  )}
                  <div className="border-t border-border pt-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">You will receive (est.)</span>
                    <span className="text-base font-bold text-emerald-400">
                      {token === "X402" || privacyLevel === "full" 
                        ? `~$${(parseFloat(amount) * 0.85).toFixed(2)} USDC`
                        : `$${parseFloat(amount).toFixed(2)} ${token}`
                      }
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground/60 leading-tight">
                    {token === "X402"
                      ? "Fee is from the cross-chain bridge. No Void402 platform fee. Actual amount may vary slightly."
                      : privacyLevel === "full"
                        ? "The only fee is from the privacy mixer. No Void402 platform fee. Actual amount may vary slightly depending on mixer rates."
                        : privacyLevel === "partial"
                          ? "Partial privacy: Single-hop transfer without mixer. Faster processing, zero fees."
                          : "Public mode: Direct deposit without privacy mixing. Fastest processing, zero fees."
                    }
                  </p>
                  {/* Privacy level indicator */}
                  <div className="flex items-center gap-2 pt-1 border-t border-border/50 mt-2">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Privacy:</span>
                    <span className={`text-[10px] uppercase tracking-wider font-bold ${
                      privacyLevel === "full" ? "text-primary" : 
                      privacyLevel === "partial" ? "text-yellow-400" : "text-muted-foreground"
                    }`}>
                      {privacyLevel.charAt(0).toUpperCase() + privacyLevel.slice(1)}
                    </span>
                  </div>
                </div>
              )}

              {/* Info - changes based on privacy level */}
              <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
                {token === "X402" ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      x402 deposit bridges USDC from Base to your Solana private balance:
                    </p>
                    <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                      <li>• Sign a message to verify your wallet</li>
                      <li>• Send USDC on Base to the provided address</li>
                      <li>• Cross-chain bridge via privacy mixer</li>
                      <li>• Credited to your private USDC balance</li>
                    </ul>
                    <p className="text-xs text-muted-foreground/70 mt-2">
                      Minimum deposit: $5.00. Processing may take 10-30 minutes.
                    </p>
                  </>
                ) : privacyLevel === "full" ? (
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
                ) : privacyLevel === "partial" ? (
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
                {token === "X402"
                  ? `Deposit $${amount ? parseFloat(amount).toFixed(2) : "0.00"} via x402`
                  : `Deposit ${amount ? `$${parseFloat(amount).toFixed(2)}` : ""} ${token}`}
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
              <p className="text-lg font-semibold">
                {privacyLevel === "full" ? "Privacy Splitting" : 
                 privacyLevel === "partial" ? "Processing Transfer" : 
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
                    {privacyLevel === "full" 
                      ? `Sending to privacy mixer (${sentSplits}/${totalSplits} splits)`
                      : privacyLevel === "partial"
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

          {/* ==================== X402: SIGNING MESSAGE ==================== */}
          {step === "x402_signing" && (
            <motion.div
              key="x402_signing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-12 space-y-4"
            >
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <p className="text-lg font-semibold">Verify Wallet</p>
              <p className="text-sm text-muted-foreground text-center">
                {processingStatus || "Please sign the message in your wallet to verify ownership"}
              </p>
            </motion.div>
          )}

          {/* ==================== X402: WAITING FOR DEPOSIT (Phantom sending) ==================== */}
          {step === "x402_waitingForDeposit" && (
            <motion.div
              key="x402_waitingForDeposit"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-12 space-y-6"
            >
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <p className="text-lg font-semibold">Sending Base USDC</p>

              <div className="w-full max-w-xs space-y-3">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">Wallet verified</span>
                </div>
                <div className="flex items-center gap-3">
                  <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
                  <span className="text-sm text-white font-medium">
                    {processingStatus || "Approve the USDC transfer in Phantom..."}
                  </span>
                </div>
              </div>

              <div className="w-full max-w-xs">
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    animate={{ width: `${getProgressPercent()}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* ==================== X402: RECEIVED ==================== */}
          {step === "x402_received" && (
            <motion.div
              key="x402_received"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-12 space-y-6"
            >
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <p className="text-lg font-semibold">USDC Received!</p>

              <div className="w-full max-w-xs space-y-3">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">Wallet verified</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">
                    USDC received on Base
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
                  <span className="text-sm text-white font-medium">
                    {processingStatus || "Initiating cross-chain bridge..."}
                  </span>
                </div>
              </div>

              <div className="w-full max-w-xs">
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    animate={{ width: `${getProgressPercent()}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* ==================== X402: BRIDGING ==================== */}
          {step === "x402_bridging" && (
            <motion.div
              key="x402_bridging"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-12 space-y-6"
            >
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <p className="text-lg font-semibold">Processing x402 Deposit</p>

              <div className="w-full max-w-xs space-y-3">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">Wallet verified</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">Base USDC sent via Phantom</span>
                </div>
                <div className="flex items-center gap-3">
                  {x402Status?.status === "bridging" || x402Status?.status === "received" ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
                  )}
                  <span className={`text-sm ${x402Status?.status === "bridging" || x402Status?.status === "received" ? "text-muted-foreground" : "text-white font-medium"}`}>
                    {x402Status?.status === "bridging" || x402Status?.status === "received" ? "Transfer detected on Base" : "Detecting transfer on Base..."}
                  </span>
                </div>
                {(x402Status?.status === "bridging" || x402Status?.status === "received") && (
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
                    <span className="text-sm text-white font-medium">
                      {processingStatus || "Bridging to Solana..."}
                    </span>
                  </div>
                )}
              </div>

              <div className="w-full max-w-xs">
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    animate={{ width: `${getProgressPercent()}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <p className="text-xs text-muted-foreground/70 mt-2 text-center">
                  Cross-chain bridge may take 5-15 minutes
                </p>
              </div>

              {x402Status?.baseTxHash && (
                <a
                  href={`https://basescan.org/tx/${x402Status.baseTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  View Base transaction <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </motion.div>
          )}

          {/* ==================== X402: SUCCESS ==================== */}
          {step === "x402_success" && (
            <motion.div
              key="x402_success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-12 space-y-4"
            >
              <CheckCircle2 className="w-16 h-16 text-green-500" />
              <p className="text-lg font-semibold">x402 Deposit Successful!</p>
              <p className="text-sm text-muted-foreground text-center">
                Your USDC has been bridged from Base to Solana and credited to your private balance.
              </p>
              {x402Status?.amountCredited && (
                <p className="text-lg font-bold text-emerald-400">
                  +${x402Status.amountCredited.toFixed(2)} USDC
                </p>
              )}
              {x402Status?.baseTxHash && (
                <a
                  href={`https://basescan.org/tx/${x402Status.baseTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  View Base transaction <ExternalLink className="w-3 h-3" />
                </a>
              )}
              <Button onClick={handleClose} className="mt-4">
                Close
              </Button>
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
