import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Shield, QrCode, CheckCircle2, Loader2, AlertCircle, ExternalLink, Copy, X, AtSign, User } from "lucide-react";
import { useWallet, PrivacyLevel } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import PrivacyLevelSelector from "./PrivacyLevelSelector";
import { cn } from "@/lib/utils";
import {
  getPhantomProvider,
  getMetaMaskEVMProvider,
  WalletAdapter,
} from "@/services/transactionSigningService";
import { executeZKTransfer, getZKBalance } from "@/services/api";
import { getApiUrl } from "@/utils/apiConfig";

const MAX_AMOUNT = 999999.99;

type RecipientType = "address" | "username";

interface SendPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialRecipient?: string;
  initialAmount?: string;
  initialToken?: "USDC" | "USDT";
}

type TransactionStep = "form" | "preview" | "signing" | "encrypting" | "pending" | "success" | "failed";

const SendPaymentModal = ({ open, onOpenChange, initialRecipient, initialAmount, initialToken }: SendPaymentModalProps) => {
  const { encryptedBalance, privacyLevel, walletType, isConnected, fullWalletAddress, refreshBalance, activeChain } = useWallet();
  const apiUrl = getApiUrl();
  
  const [recipientType, setRecipientType] = useState<RecipientType>("address");
  const [recipient, setRecipient] = useState("");
  const [usernameInput, setUsernameInput] = useState("");
  const [resolvedWallet, setResolvedWallet] = useState<string | null>(null);
  const [walletHint, setWalletHint] = useState<string | null>(null);
  const [recipientHasDeposited, setRecipientHasDeposited] = useState<boolean>(true);
  const [isSelfSend, setIsSelfSend] = useState<boolean>(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState<"USDC" | "USDT">("USDC");
  const [selectedPrivacy, setSelectedPrivacy] = useState<PrivacyLevel>(privacyLevel);
  const [step, setStep] = useState<TransactionStep>("form");
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [tokenBalances, setTokenBalances] = useState<{ usdc: number; usdt: number }>({ usdc: 0, usdt: 0 });

  // Pre-fill from AI Terminal or external caller
  useEffect(() => {
    if (open) {
      if (initialRecipient) {
        const isAddress = initialRecipient.startsWith("0x") || initialRecipient.length >= 32;
        if (isAddress) {
          setRecipientType("address");
          setRecipient(initialRecipient);
        } else {
          setRecipientType("username");
          setUsernameInput(initialRecipient.replace(/^@/, ""));
        }
      }
      if (initialAmount) {
        setAmount(initialAmount);
      }
      if (initialToken) {
        setSelectedToken(initialToken);
      }
    }
  }, [open, initialRecipient, initialAmount, initialToken]);

  // Fetch per-token balances
  useEffect(() => {
    const fetchBalances = async () => {
      if (!isConnected || !fullWalletAddress) return;
      try {
        const [usdcResult, usdtResult] = await Promise.all([
          getZKBalance(fullWalletAddress, 'USDC').catch(() => ({ balance: 0 })),
          getZKBalance(fullWalletAddress, 'USDT').catch(() => ({ balance: 0 })),
        ]);
        setTokenBalances({
          usdc: usdcResult?.balance || 0,
          usdt: usdtResult?.balance || 0,
        });
      } catch {
        // keep defaults
      }
    };
    if (open) fetchBalances();
  }, [isConnected, fullWalletAddress, open]);

  const availableBalance = selectedToken === "USDC" ? tokenBalances.usdc : tokenBalances.usdt;

  // Sanitize amount input — no negatives, max 999,999.99
  const handleAmountChange = (value: string) => {
    // Strip any minus signs
    let clean = value.replace(/-/g, '');
    // Allow empty or valid number
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

  // Fetch current user's username to prevent self-sends
  useEffect(() => {
    const fetchOwnUsername = async () => {
      if (!isConnected || !fullWalletAddress) {
        setCurrentUsername(null);
        return;
      }
      try {
        const response = await fetch(`${apiUrl}/api/user/profile?wallet=${encodeURIComponent(fullWalletAddress)}`);
        const data = await response.json();
        if (data.success && data.profile?.username && data.profile?.has_custom_username) {
          setCurrentUsername(data.profile.username.toLowerCase());
        }
      } catch {
        setCurrentUsername(null);
      }
    };
    fetchOwnUsername();
  }, [isConnected, fullWalletAddress, apiUrl]);

  // Username lookup effect (debounced)
  useEffect(() => {
    if (recipientType !== "username" || !usernameInput || usernameInput.length < 2) {
      setResolvedWallet(null);
      setWalletHint(null);
      setRecipientHasDeposited(true);
      setIsSelfSend(false);
      setLookupError(null);
      return;
    }

    // Check for self-send before making the API call
    const cleanUsername = usernameInput.startsWith("@") ? usernameInput.substring(1) : usernameInput;
    if (currentUsername && cleanUsername.toLowerCase() === currentUsername) {
      setResolvedWallet(null);
      setWalletHint(null);
      setRecipientHasDeposited(true);
      setIsSelfSend(true);
      setLookupError(null);
      setIsLookingUp(false);
      return;
    }

    setIsSelfSend(false);
    setIsLookingUp(true);
    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(`${apiUrl}/api/user/lookup?username=${encodeURIComponent(cleanUsername)}`);
        const data = await response.json();

        if (data.success) {
          // PRIVACY: We no longer receive the full wallet address from lookup
          // The transfer API resolves usernames server-side
          setResolvedWallet("username_resolved"); // Sentinel value — actual address resolved server-side
          setWalletHint(data.wallet_hint || null);
          setRecipientHasDeposited(data.has_deposited !== false);
          setLookupError(null);
        } else {
          setResolvedWallet(null);
          setWalletHint(null);
          setRecipientHasDeposited(true);
          setLookupError("Username not found");
        }
      } catch {
        setResolvedWallet(null);
        setWalletHint(null);
        setLookupError("Failed to lookup username");
      } finally {
        setIsLookingUp(false);
      }
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [usernameInput, recipientType, apiUrl, currentUsername]);

  // Get effective recipient wallet address
  const getEffectiveRecipient = (): string => {
    if (recipientType === "username") {
      return resolvedWallet || "";
    }
    return recipient;
  };

  // Get the appropriate wallet provider based on connected wallet type
  const getWalletProvider = useCallback((): WalletAdapter | null => {
    if (!isConnected || !walletType) {
      return null;
    }
    
    if (walletType === "phantom") {
      const provider = getPhantomProvider();
      // Ensure provider has required interface
      if (provider && provider.publicKey) {
        return {
          ...provider,
          connected: true,
          publicKey: provider.publicKey,
        } as WalletAdapter;
      }
    } else if (walletType === "metamask") {
      // MetaMask is EVM-only, no Solana WalletAdapter needed
      return null;
    }
    return null;
  }, [walletType, isConnected]);

  // Validate address based on active chain
  const isValidAddress = (address: string) => {
    if (activeChain === "base") {
      // EVM addresses: 0x + 40 hex chars
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    }
    // Solana addresses are base58 encoded and typically 32-44 characters
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    return base58Regex.test(address);
  };

  const handlePreview = () => {
    if (!amount) {
      setError("Please fill in all fields");
      return;
    }
    
    if (recipientType === "username") {
      // For username transfers: just need a resolved username
      if (!resolvedWallet || !usernameInput) {
        setError("Please enter a valid username");
        return;
      }
      if (isSelfSend) {
        setError("You cannot send to yourself");
        return;
      }
      if (!recipientHasDeposited) {
        setError("This user hasn't deposited yet — they must deposit before they can receive transfers");
        return;
      }
    } else {
      // For address transfers: validate the address
      if (!recipient) {
        setError("Please enter a recipient address");
        return;
      }
      if (!isValidAddress(recipient)) {
        setError("Invalid recipient address");
        return;
      }
      // Prevent sending to own wallet address
      if (fullWalletAddress && recipient === fullWalletAddress) {
        setError("You cannot send to yourself");
        return;
      }
    }
    
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Amount must be greater than 0");
      return;
    }
    if (parsedAmount > MAX_AMOUNT) {
      setError(`Maximum amount is $${MAX_AMOUNT.toLocaleString()}`);
      return;
    }
    if (parsedAmount > availableBalance) {
      setError(`Insufficient ${selectedToken} balance. Available: $${availableBalance.toFixed(2)}`);
      return;
    }
    
    setError("");
    setStep("preview");
  };

  const handleConfirm = async () => {
    // Check wallet connection from context first
    if (!isConnected || !fullWalletAddress || !walletType) {
      setError("Wallet not connected. Please connect your wallet first.");
      setStep("failed");
      return;
    }

    // Get the wallet provider (Solana-specific; Base uses phantom.ethereum directly)
    const wallet = getWalletProvider();

    if (activeChain !== "base" && (!wallet || !wallet.publicKey)) {
      setError("Wallet not connected. Please connect your wallet first.");
      setStep("failed");
      return;
    }

    try {
      // Step 1: Sign message for authorization (Stripe-like UX)
      setStep("signing");
      
      // Create message to sign
      const effectiveRecipient = getEffectiveRecipient();
      const displayRecipient = recipientType === "username" ? `@${usernameInput}` : effectiveRecipient;
      const message = `Authorize USDP transfer:\nAmount: ${amount} ${selectedToken}\nTo: ${displayRecipient}\nTimestamp: ${Date.now()}`;
      
      // Sign message with wallet (chain-aware)
      let walletSignature: string;
      try {
        if (activeChain === "base") {
          // EVM signing via Phantom's ethereum provider
          const ethProvider = (window as any).phantom?.ethereum;
          if (!ethProvider) throw new Error("Phantom Ethereum provider not found");

          const accounts = await ethProvider.request({ method: "eth_accounts" });
          if (!accounts || accounts.length === 0) throw new Error("No Ethereum accounts found");

          // personal_sign returns hex signature
          walletSignature = await ethProvider.request({
            method: "personal_sign",
            params: [message, accounts[0]],
          });
        } else {
          // Solana signing
          const encodedMessage = new TextEncoder().encode(message);

          if (walletType === "phantom") {
            const provider = (window as any).phantom?.solana;
            if (!provider) throw new Error("Phantom wallet not found");

            const signedMessage = await provider.signMessage(encodedMessage, "utf8");
            if (!signedMessage || !signedMessage.signature) {
              throw new Error("Failed to sign message");
            }
            const bs58 = (await import("bs58")).default;
            walletSignature = bs58.encode(signedMessage.signature);
          } else if (walletType === "metamask") {
            const provider = getMetaMaskEVMProvider();
            if (!provider) throw new Error("MetaMask wallet not found");

            const accounts = await provider.request({ method: 'eth_accounts' });
            walletSignature = await provider.request({
              method: 'personal_sign',
              params: [message, accounts[0]],
            });
          } else {
            throw new Error("Unsupported wallet type");
          }
        }
      } catch (signError: any) {
        if (signError.message?.includes("reject") || signError.message?.includes("User rejected") || signError.message?.includes("User cancelled")) {
          setError("Transaction cancelled. You rejected the signature request.");
          setStep("failed");
          return;
        }
        throw signError;
      }

      // Step 2: Execute ZK transfer (backend handles proof generation and relayer)
      setStep("encrypting");
      const nonce = Date.now() + Math.floor(Math.random() * 1000000);
      
      // PRIVACY: For username transfers, send the username so the backend resolves it server-side
      // The frontend never sees or sends the recipient's full wallet address
      const transferPayload: any = {
        sender_wallet: fullWalletAddress,
        token: selectedToken,
        amount: parseFloat(amount),
        nonce: nonce,
        wallet_signature: walletSignature,
        message_to_sign: message,
      };
      
      if (recipientType === "username" && usernameInput) {
        transferPayload.recipient_username = usernameInput;
      } else {
        transferPayload.recipient_wallet = effectiveRecipient;
        transferPayload.force_external = true; // Solana address = always external transfer
      }
      
      const result = await executeZKTransfer(transferPayload);

      // Check if wallet disconnected during transaction (skip for Base - Solana wallet not used)
      if (activeChain !== "base" && (!wallet?.connected || !wallet?.publicKey)) {
        setError("Wallet disconnected during transaction. Please reconnect and try again.");
        setStep("failed");
        return;
      }

      if (result.success && result.signature) {
        // Transaction succeeded!
        setTxHash(result.signature);
        
        // Show pending step briefly
        setStep("pending");
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setStep("success");

        // Refresh balance after successful transfer
        if (refreshBalance) {
          setTimeout(() => refreshBalance(), 1000);
        }
      } else {
        // Transaction failed
        const errorStep = result.step || "unknown";
        let errorMessage = result.error || "Transaction failed";
        
        // Add context based on which step failed
        if (errorStep === "build") {
          errorMessage = `Failed to build transaction: ${errorMessage}`;
        } else if (errorStep === "sign") {
          // Check if user rejected the signature
          if (errorMessage.includes("reject") || errorMessage.includes("User rejected")) {
            errorMessage = "Transaction cancelled. You rejected the signature request.";
          } else {
            errorMessage = `Signing failed: ${errorMessage}`;
          }
        } else if (errorStep === "submit") {
          // Handle specific submission errors
          if (errorMessage.includes("insufficient funds")) {
            errorMessage = "Insufficient funds. Please ensure you have enough ETH for gas fees and USDC for the transfer.";
          } else if (errorMessage.includes("network") || errorMessage.includes("ECONNREFUSED")) {
            errorMessage = "Network error. Please check your connection and try again.";
          } else if (errorMessage.includes("expired") || errorMessage.includes("blockhash")) {
            errorMessage = "Transaction expired. Please try again.";
          } else {
            errorMessage = `Submission failed: ${errorMessage}`;
          }
        }
        
        setError(errorMessage);
        setStep("failed");
      }
    } catch (err) {
      console.error("Transaction error:", err);
      
      // Handle specific error types
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      
      if (errorMessage.includes("User rejected") || errorMessage.includes("reject")) {
        setError("Transaction cancelled. You rejected the signature request.");
      } else if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
        setError("Network error. Please check your connection and try again.");
      } else if (errorMessage.includes("insufficient")) {
        setError("Insufficient funds. Please ensure you have enough ETH for gas fees and USDC for the transfer.");
      } else {
        setError(errorMessage);
      }
      
      setStep("failed");
    }
  };

  const handleReset = () => {
    setRecipient("");
    setUsernameInput("");
    setResolvedWallet(null);
    setWalletHint(null);
    setRecipientHasDeposited(true);
    setIsSelfSend(false);
    setLookupError(null);
    setAmount("");
    setSelectedToken("USDC");
    setStep("form");
    setTxHash("");
    setError("");
  };

  const handleClose = () => {
    handleReset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Send className="w-4 h-4 text-primary" />
            </div>
            {step === "form" && "Send Encrypted Payment"}
            {step === "preview" && "Confirm Transaction"}
            {(step === "signing" || step === "encrypting" || step === "pending") && "Processing"}
            {step === "success" && "Transaction Successful"}
            {step === "failed" && "Transaction Failed"}
          </DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {/* Form Step */}
          {step === "form" && (
            <motion.div
              key="form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              {/* Recipient Type Selector */}
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">
                  Send To
                </label>
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => setRecipientType("address")}
                    className={cn(
                      "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
                      recipientType === "address"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                    )}
                  >
                    <QrCode className="w-4 h-4" />
                    {activeChain === "base" ? "Base Address" : "Address"}
                  </button>
                  <button
                    onClick={() => setRecipientType("username")}
                    className={cn(
                      "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
                      recipientType === "username"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                    )}
                  >
                    <AtSign className="w-4 h-4" />
                    Username
                  </button>
                </div>

                {/* Address Input */}
                {recipientType === "address" && (
                  <div className="relative">
                    <Input
                      placeholder={activeChain === "base" ? "Enter Base address (0x...)" : "Enter wallet address"}
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      className="bg-secondary border-border h-12 pr-12"
                    />
                    <button className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-primary/10 rounded">
                      <QrCode className="w-5 h-5 text-muted-foreground" />
                    </button>
                  </div>
                )}

                {/* Username Input */}
                {recipientType === "username" && (
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <AtSign className="w-5 h-5" />
                    </div>
                    <Input
                      placeholder="username"
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value.replace(/@/g, ""))}
                      className="bg-secondary border-border h-12 pl-10 pr-12"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {isLookingUp && (
                        <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                      )}
                      {!isLookingUp && resolvedWallet && (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      )}
                      {!isLookingUp && lookupError && usernameInput && (
                        <AlertCircle className="w-4 h-4 text-destructive" />
                      )}
                    </div>
                  </div>
                )}

                {/* Username Lookup Result */}
                {recipientType === "username" && usernameInput && !isLookingUp && (
                  <div className="mt-2 text-xs space-y-1">
                    {isSelfSend ? (
                      <p className="text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        You cannot send to yourself
                      </p>
                    ) : resolvedWallet ? (
                      <>
                        <p className="text-green-500 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          User found
                        </p>
                        {!recipientHasDeposited && (
                          <p className="text-amber-500 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            This user hasn't deposited yet — they must deposit before they can receive transfers
                          </p>
                        )}
                      </>
                    ) : lookupError ? (
                      <p className="text-destructive">{lookupError}</p>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Token Selector */}
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">
                  Token
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedToken("USDC")}
                    className={cn(
                      "flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
                      selectedToken === "USDC"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                    )}
                  >
                    <img src="https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png" alt="USDC" className="w-5 h-5 rounded-full" />
                    USDC
                  </button>
                  <button
                    onClick={() => setSelectedToken("USDT")}
                    className={cn(
                      "flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2",
                      selectedToken === "USDT"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                    )}
                  >
                    <img src="https://assets.coingecko.com/coins/images/325/small/Tether.png" alt="USDT" className="w-5 h-5 rounded-full" />
                    USDT
                  </button>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">
                  Amount ({selectedToken})
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
                <p className="text-xs text-muted-foreground mt-2">
                  Available: ${availableBalance.toFixed(2)} {selectedToken}
                </p>
              </div>

              {/* Privacy Level */}
              <PrivacyLevelSelector onChange={setSelectedPrivacy} />

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <Button
                onClick={handlePreview}
                disabled={
                  !amount ||
                  (recipientType === "address" && (!recipient || recipient === fullWalletAddress)) ||
                  (recipientType === "username" && (!resolvedWallet || isLookingUp || !recipientHasDeposited || isSelfSend))
                }
                className="w-full h-12 bg-primary hover:bg-primary/90"
              >
                Preview Transaction
              </Button>
            </motion.div>
          )}

          {/* Preview Step */}
          {step === "preview" && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              <div className="rounded-xl bg-secondary p-4 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Recipient</span>
                  <div className="text-right">
                    {recipientType === "username" && usernameInput ? (
                      <span className="text-primary font-medium">@{usernameInput}</span>
                    ) : (
                      <span className="font-mono text-sm text-muted-foreground">
                        {(() => {
                          const addr = getEffectiveRecipient();
                          return addr.length > 20 ? `${addr.slice(0, 4)}••••${addr.slice(-4)}` : addr;
                        })()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Token</span>
                  <span className="font-medium">{selectedToken}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-bold">
                    {selectedPrivacy === "public" ? `$${amount}` : "Encrypted"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Privacy Level</span>
                  <span className="capitalize">{selectedPrivacy}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Est. Gas Fee</span>
                  <span>~$0.02</span>
                </div>
              </div>

              <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    This transaction uses ZK proofs for privacy. 
                    The amount and recipient will be hidden based on your privacy level.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep("form")} className="flex-1">
                  Back
                </Button>
                <Button onClick={handleConfirm} className="flex-1 bg-primary hover:bg-primary/90">
                  Confirm & Sign
                </Button>
              </div>
            </motion.div>
          )}

          {/* Processing Steps */}
          {(step === "signing" || step === "encrypting" || step === "pending") && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-8 text-center"
            >
              <div className="relative w-20 h-20 mx-auto mb-6">
                <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  {step === "signing" && <Send className="w-8 h-8 text-primary" />}
                  {step === "encrypting" && <Shield className="w-8 h-8 text-primary" />}
                  {step === "pending" && <Loader2 className="w-8 h-8 text-primary animate-spin" />}
                </div>
              </div>
              
              <h3 className="text-lg font-bold mb-2">
                {step === "signing" && "Waiting for Signature..."}
                {step === "encrypting" && "Encrypting Transaction..."}
                {step === "pending" && "Transaction Pending..."}
              </h3>
              <p className="text-muted-foreground text-sm">
                {step === "signing" && "Please confirm the transaction in your wallet"}
                {step === "encrypting" && "Generating ZK proof for your transaction"}
                {step === "pending" && "Waiting for block confirmation"}
              </p>

              {/* Progress Steps */}
              <div className="flex justify-center gap-2 mt-6">
                <div className={cn(
                  "w-3 h-3 rounded-full transition-colors",
                  step === "signing" ? "bg-primary" : "bg-primary/30"
                )} />
                <div className={cn(
                  "w-3 h-3 rounded-full transition-colors",
                  step === "encrypting" ? "bg-primary" : step === "pending" ? "bg-primary/30" : "bg-secondary"
                )} />
                <div className={cn(
                  "w-3 h-3 rounded-full transition-colors",
                  step === "pending" ? "bg-primary" : "bg-secondary"
                )} />
              </div>
            </motion.div>
          )}

          {/* Success Step */}
          {step === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="py-6 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              
              <h3 className="text-lg font-bold mb-2">Transaction Successful!</h3>
              <p className="text-muted-foreground text-sm mb-6">
                Your encrypted payment has been confirmed
              </p>

              <div className="rounded-xl bg-secondary p-4 mb-6">
                <p className="text-xs text-muted-foreground mb-2">Transaction Signature</p>
                <div className="flex items-center justify-center gap-2">
                  <span className="font-mono text-sm truncate max-w-[200px]">{txHash}</span>
                  <button 
                    onClick={() => navigator.clipboard.writeText(txHash)}
                    className="p-1 hover:bg-primary/10 rounded"
                  >
                    <Copy className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <a
                    href={`https://basescan.org/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 hover:bg-primary/10 rounded"
                  >
                    <ExternalLink className="w-4 h-4 text-muted-foreground" />
                  </a>
                </div>
              </div>

              <Button onClick={handleClose} className="w-full">
                Done
              </Button>
            </motion.div>
          )}

          {/* Failed Step */}
          {step === "failed" && (
            <motion.div
              key="failed"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="py-6 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-4">
                <X className="w-8 h-8 text-destructive" />
              </div>
              
              <h3 className="text-lg font-bold mb-2">Transaction Failed</h3>
              <p className="text-muted-foreground text-sm mb-6">
                {error || "Something went wrong"}
              </p>

              <div className="flex gap-3">
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={() => setStep("form")} className="flex-1 bg-primary hover:bg-primary/90">
                  Try Again
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};

export default SendPaymentModal;
