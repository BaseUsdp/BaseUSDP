import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, Shield, QrCode, CheckCircle2, Loader2, AlertCircle, ExternalLink, Copy, X, AtSign, User } from "lucide-react";
import { useWallet, PrivacyLevel } from "@/contexts/WalletContext";
import PrivacyLevelSelector from "../PrivacyLevelSelector";
import X402PaymentModal from "../X402PaymentModal";
import PayX402Modal from "../PayX402Modal";
import X402RequestsManagement from "../X402RequestsManagement";
import {
  getMetaMaskEVMProvider,
} from "@/services/transactionSigningService";
import { executeZKTransfer } from "@/services/api";
import { getApiUrl } from "@/utils/apiConfig";

interface PaymentsSectionProps {
  showBalance: boolean;
  initialTab?: string;
}

type RecipientType = "address" | "username";
type TransactionStep = "form" | "preview" | "signing" | "encrypting" | "pending" | "success" | "failed";

const PaymentsSection = ({ showBalance, initialTab }: PaymentsSectionProps) => {
  const { encryptedBalance, privacyLevel, walletType, isConnected, fullWalletAddress, activeChain } = useWallet();
  const apiUrl = getApiUrl();

  const [activeTab, setActiveTab] = useState(initialTab || "send");
  const [x402CreateModalOpen, setX402CreateModalOpen] = useState(false);

  // Sync with initialTab when navigated from outside
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  const [payX402ModalOpen, setPayX402ModalOpen] = useState(false);

  // Send form state
  const [recipientType, setRecipientType] = useState<RecipientType>("address");
  const [recipient, setRecipient] = useState("");
  const [usernameInput, setUsernameInput] = useState("");
  const [resolvedWallet, setResolvedWallet] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [selectedPrivacy, setSelectedPrivacy] = useState<PrivacyLevel>(privacyLevel);
  const [step, setStep] = useState<TransactionStep>("form");
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");

  // Username lookup effect (debounced)
  useEffect(() => {
    if (recipientType !== "username" || !usernameInput || usernameInput.length < 2) {
      setResolvedWallet(null);
      setLookupError(null);
      return;
    }

    setIsLookingUp(true);
    const timeoutId = setTimeout(async () => {
      try {
        const cleanUsername = usernameInput.startsWith("@") ? usernameInput.substring(1) : usernameInput;
        const response = await fetch(`${apiUrl}/api/user/lookup?username=${encodeURIComponent(cleanUsername)}`);
        const data = await response.json();

        if (data.success) {
          // Use sentinel value — actual wallet address is resolved server-side in the transfer API
          setResolvedWallet("username_resolved");
          setLookupError(null);
        } else {
          setResolvedWallet(null);
          setLookupError("Username not found");
        }
      } catch {
        setResolvedWallet(null);
        setLookupError("Failed to lookup username");
      } finally {
        setIsLookingUp(false);
      }
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [usernameInput, recipientType, apiUrl]);

  // Get effective recipient wallet address
  const getEffectiveRecipient = (): string => {
    if (recipientType === "username") {
      return resolvedWallet || "";
    }
    return recipient;
  };

  // Validate wallet address (chain-aware)
  const isValidAddress = (address: string) => {
    if (activeChain === "base") {
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    }
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    return base58Regex.test(address);
  };

  const handlePreview = () => {
    const effectiveRecipient = getEffectiveRecipient();
    
    if (!effectiveRecipient || !amount) {
      if (recipientType === "username" && !resolvedWallet) {
        setError("Please enter a valid username");
        return;
      }
      setError("Please fill in all fields");
      return;
    }
    
    if (!isValidAddress(effectiveRecipient)) {
      setError("Invalid recipient address");
      return;
    }
    
    if (parseFloat(amount) <= 0) {
      setError("Amount must be greater than 0");
      return;
    }
    
    setError("");
    setStep("preview");
  };

  const handleConfirm = async () => {
    if (!isConnected || !fullWalletAddress || !walletType) {
      setError("Wallet not connected. Please connect your wallet first.");
      setStep("failed");
      return;
    }

    try {
      setStep("signing");

      const displayRecipient = recipientType === "username"
        ? `@${usernameInput.startsWith("@") ? usernameInput.substring(1) : usernameInput}`
        : recipient;
      const message = `Authorize USDP transfer:\nAmount: ${amount} USDC\nTo: ${displayRecipient}\nTimestamp: ${Date.now()}`;

      let walletSignature: string;
      try {
        if (activeChain === "base") {
          // EVM signing via Phantom ethereum provider or MetaMask
          const ethereumProvider = walletType === "phantom"
            ? (window as any).phantom?.ethereum
            : getMetaMaskEVMProvider();
          if (!ethereumProvider) throw new Error("EVM wallet provider not found");
          const accounts = await ethereumProvider.request({ method: "eth_accounts" });
          if (!accounts || accounts.length === 0) throw new Error("No accounts connected");
          const hexMessage = "0x" + Array.from(new TextEncoder().encode(message)).map((b: number) => b.toString(16).padStart(2, "0")).join("");
          walletSignature = await ethereumProvider.request({
            method: "personal_sign",
            params: [hexMessage, accounts[0]],
          });
        } else {
          throw new Error("Unsupported chain");
        }
      } catch (signError: any) {
        if (signError.message?.includes("reject") || signError.message?.includes("User rejected") || signError.message?.includes("User cancelled")) {
          setError("Transaction cancelled. You rejected the signature request.");
          setStep("failed");
          return;
        }
        throw signError;
      }

      setStep("encrypting");
      const nonce = Date.now() + Math.floor(Math.random() * 1000000);
      const transferPayload: any = {
        sender_wallet: fullWalletAddress,
        token: "USDC",
        amount: parseFloat(amount),
        nonce: nonce,
        wallet_signature: walletSignature,
        message_to_sign: message,
      };

      if (recipientType === "username" && usernameInput) {
        transferPayload.recipient_username = usernameInput.startsWith("@") ? usernameInput.substring(1) : usernameInput;
      } else {
        transferPayload.recipient_wallet = recipient;
        transferPayload.force_external = true; // Wallet address = always external transfer
      }

      const result = await executeZKTransfer(transferPayload);

      if (result.success && result.signature) {
        setTxHash(result.signature);
        setStep("pending");
        await new Promise(resolve => setTimeout(resolve, 1000));
        setStep("success");
      } else {
        const errorStep = result.step || "unknown";
        let errorMessage = result.error || "Transaction failed";
        
        if (errorStep === "build") {
          errorMessage = `Failed to build transaction: ${errorMessage}`;
        } else if (errorStep === "sign") {
          if (errorMessage.includes("reject") || errorMessage.includes("User rejected")) {
            errorMessage = "Transaction cancelled. You rejected the signature request.";
          } else {
            errorMessage = `Signing failed: ${errorMessage}`;
          }
        } else if (errorStep === "submit") {
          if (errorMessage.includes("insufficient funds")) {
            errorMessage = "Insufficient funds. Please ensure you have enough ETH for fees and tokens for the transfer.";
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
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      
      if (errorMessage.includes("User rejected") || errorMessage.includes("reject")) {
        setError("Transaction cancelled. You rejected the signature request.");
      } else if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
        setError("Network error. Please check your connection and try again.");
      } else if (errorMessage.includes("insufficient")) {
        setError("Insufficient funds. Please ensure you have enough ETH for fees and tokens for the transfer.");
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
    setLookupError(null);
    setAmount("");
    setStep("form");
    setTxHash("");
    setError("");
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
          Confidential Payments<span className="text-primary">.</span>
        </h1>
        <p className="text-muted-foreground mt-1">
          Send, receive, and manage encrypted payments
        </p>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-secondary/50 p-1">
          <TabsTrigger value="send" className="gap-2">
            <Icon icon="ph:paper-plane-tilt-bold" className="w-4 h-4" />
            Send
          </TabsTrigger>
          <TabsTrigger value="x402" className="gap-2">
            <Icon icon="ph:download-bold" className="w-4 h-4" />
            Requests
          </TabsTrigger>
          <TabsTrigger value="pay" className="gap-2 opacity-40 cursor-not-allowed" disabled>
            <Icon icon="ph:credit-card-bold" className="w-4 h-4" />
            Pay Request
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full">Soon</span>
          </TabsTrigger>
        </TabsList>

        {/* Send Tab - Inline Form */}
        <TabsContent value="send" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-xl mx-auto"
          >
            <div className="rounded-2xl border border-border bg-card p-6">
              {/* Header */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Send className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold">Send Encrypted Payment</h3>
                </div>
              </div>

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
                        <div className="mt-2 text-xs">
                          {resolvedWallet ? (
                            <p className="text-green-500 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              User found
                            </p>
                          ) : lookupError ? (
                            <p className="text-destructive">{lookupError}</p>
                          ) : null}
                        </div>
                      )}
                    </div>

                    {/* Amount */}
                    <div>
                      <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">
                        Amount (USDC)
                      </label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="bg-secondary border-border h-14 text-2xl font-mono"
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        Available: ${encryptedBalance}
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
                        (recipientType === "address" && !recipient) ||
                        (recipientType === "username" && (!resolvedWallet || isLookingUp))
                      }
                      className="w-full h-12 bg-gradient-to-r from-sky-600 to-purple-600 hover:from-sky-500 hover:to-purple-500 text-white"
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
                            <span className="text-primary font-medium block">@{usernameInput.startsWith("@") ? usernameInput.substring(1) : usernameInput}</span>
                          ) : (
                            <span className="font-mono text-sm text-muted-foreground">
                              {recipient.length > 20 ? `${recipient.slice(0, 6)}...${recipient.slice(-6)}` : recipient}
                            </span>
                          )}
                        </div>
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
                      <Button onClick={handleConfirm} className="flex-1 bg-gradient-to-r from-sky-600 to-purple-600 hover:from-sky-500 hover:to-purple-500 text-white">
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
                          href={activeChain === "base" ? `https://basescan.org/tx/${txHash}` : `https://solscan.io/tx/${txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 hover:bg-primary/10 rounded"
                        >
                          <ExternalLink className="w-4 h-4 text-muted-foreground" />
                        </a>
                      </div>
                    </div>

                    <Button onClick={handleReset} className="w-full">
                      Send Another Payment
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

                    <Button onClick={handleReset} className="w-full bg-gradient-to-r from-sky-600 to-purple-600 hover:from-sky-500 hover:to-purple-500 text-white">
                      Try Again
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </TabsContent>

        {/* x402 Requests Tab */}
        <TabsContent value="x402">
          <X402RequestsManagement onCreateNew={() => setX402CreateModalOpen(true)} />
        </TabsContent>

        {/* Pay Request Tab */}
        <TabsContent value="pay">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto"
          >
            <div className="rounded-2xl border border-border bg-card p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-accent/20 flex items-center justify-center mx-auto mb-6">
                <Icon icon="ph:credit-card-bold" className="w-8 h-8 text-accent" />
              </div>
              <h3 className="text-2xl font-display font-bold mb-3">Pay Request</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Enter a payment ID or scan a QR code to pay an existing payment request with encrypted funds.
              </p>
              <Button 
                onClick={() => setPayX402ModalOpen(true)}
                className="bg-accent hover:bg-accent/90 h-12 px-8"
              >
                <Icon icon="ph:credit-card-bold" className="w-5 h-5 mr-2" />
                Pay a Request
              </Button>
            </div>
          </motion.div>
        </TabsContent>

      </Tabs>

      {/* Modals */}
      <X402PaymentModal open={x402CreateModalOpen} onOpenChange={setX402CreateModalOpen} />
      <PayX402Modal open={payX402ModalOpen} onOpenChange={setPayX402ModalOpen} />
    </motion.div>
  );
};

export default PaymentsSection;
