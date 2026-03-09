import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@iconify/react";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiUrl } from "@/utils/apiConfig";
import { authService } from "@/services/authService";

interface WithdrawSectionProps {
  showBalance: boolean;
  initialAmount?: string;
  initialToken?: "USDC" | "USDT";
}

type Token = "USDC" | "USDT";

type WithdrawStep = "form" | "confirm" | "processing" | "success" | "error";

const WithdrawSection = ({ showBalance, initialAmount, initialToken }: WithdrawSectionProps) => {
  const { fullWalletAddress, encryptedBalance, refreshBalance, activeChain } = useWallet();
  const [step, setStep] = useState<WithdrawStep>("form");
  const [amount, setAmount] = useState("");

  // Pre-fill from AI Terminal
  useEffect(() => {
    if (initialAmount) setAmount(initialAmount);
    if (initialToken) setToken(initialToken);
  }, [initialAmount, initialToken]);
  const [token, setToken] = useState<Token>("USDC");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [tokenBalances, setTokenBalances] = useState({ usdc: 0, usdt: 0 });
  
  const apiUrl = getApiUrl();

  // Fetch token balances
  useEffect(() => {
    const fetchBalances = async () => {
      if (!fullWalletAddress) return;
      
      try {
        const sessionToken = authService.getSessionToken();
        const headers: HeadersInit = { "Content-Type": "application/json" };
        if (sessionToken) headers["Authorization"] = `Bearer ${sessionToken}`;

        const [usdcRes, usdtRes] = await Promise.all([
          fetch(`${apiUrl}/api/zk/balance/${fullWalletAddress}?token=USDC`, { headers }),
          fetch(`${apiUrl}/api/zk/balance/${fullWalletAddress}?token=USDT`, { headers }),
        ]);

        const usdcData = await usdcRes.json();
        const usdtData = await usdtRes.json();

        setTokenBalances({
          usdc: usdcData.balance || 0,
          usdt: usdtData.balance || 0,
        });
      } catch (err) {
        console.error("Failed to fetch balances:", err);
      }
    };

    fetchBalances();
  }, [fullWalletAddress, apiUrl]);

  const MAX_AMOUNT = 999999.99;
  const availableBalance = token === "USDC" ? tokenBalances.usdc : tokenBalances.usdt;

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

  const handleWithdraw = async () => {
    const parsedAmount = parseFloat(amount);
    if (!fullWalletAddress || !amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (parsedAmount > MAX_AMOUNT) {
      setError(`Maximum withdrawal amount is $${MAX_AMOUNT.toLocaleString()}`);
      return;
    }

    if (parsedAmount > availableBalance) {
      setError("Insufficient balance");
      return;
    }

    setStep("confirm");
  };

  const confirmWithdraw = async () => {
    setStep("processing");
    setError(null);

    try {
      const recipient = fullWalletAddress;
      const authToken = authService.getSessionToken();

      if (!authToken) {
        throw new Error("Not authenticated. Please sign in again.");
      }

      // Generate a unique nonce for this withdrawal
      const nonce = Date.now() + Math.floor(Math.random() * 1000000);

      // Step 1: Upload proof (creates on-chain proof account)
      const uploadResponse = await fetch(`${apiUrl}/api/zk/upload-proof`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          sender_wallet: fullWalletAddress,
          token: token,
          amount: parseFloat(amount),
          nonce: nonce,
          server_sign: true, // Let server sign on behalf of user's intermediate wallet
        }),
      });

      const uploadData = await uploadResponse.json();

      if (!uploadData.success) {
        throw new Error(uploadData.error || "Failed to create withdrawal proof");
      }

      // Step 2: Submit external transfer via relayer
      const withdrawResponse = await fetch(`${apiUrl}/api/zk/withdraw`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          nonce: nonce,
          recipient: recipient,
          sender_wallet: fullWalletAddress,
          token: token,
          amount: parseFloat(amount),
        }),
      });

      const withdrawData = await withdrawResponse.json();

      if (!withdrawData.success) {
        throw new Error(withdrawData.error || "Withdrawal failed");
      }

      setTxSignature(withdrawData.signature);
      setStep("success");

      // Refresh balance after successful withdrawal
      if (refreshBalance) {
        setTimeout(() => refreshBalance(), 1000);
      }
      // Also refresh local token balances
      try {
        const sessionToken = authService.getSessionToken();
        const headers: HeadersInit = { "Content-Type": "application/json" };
        if (sessionToken) headers["Authorization"] = `Bearer ${sessionToken}`;

        const [usdcRes, usdtRes] = await Promise.all([
          fetch(`${apiUrl}/api/zk/balance/${fullWalletAddress}?token=USDC`, { headers }),
          fetch(`${apiUrl}/api/zk/balance/${fullWalletAddress}?token=USDT`, { headers }),
        ]);
        const usdcData = await usdcRes.json();
        const usdtData = await usdtRes.json();
        setTokenBalances({
          usdc: usdcData.balance || 0,
          usdt: usdtData.balance || 0,
        });
      } catch {}
    } catch (err: any) {
      console.error("Withdraw error:", err);
      setError(err.message || "Withdrawal failed");
      setStep("error");
    }
  };

  const resetForm = () => {
    setStep("form");
    setAmount("");
    setError(null);
    setTxSignature(null);
  };

  const setMaxAmount = () => {
    setAmount(Math.min(availableBalance, MAX_AMOUNT).toString());
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
          Withdraw<span className="text-primary">.</span>
        </h1>
        <p className="text-muted-foreground mt-1">
          Withdraw funds from your private balance to your wallet
        </p>
      </div>

      {/* Main Content */}
      <div className="max-w-lg mx-auto">
        <AnimatePresence mode="wait">
          {/* Form Step */}
          {step === "form" && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="rounded-2xl border border-border bg-card/50 backdrop-blur-xl p-6"
            >
              {/* Balance Display */}
              <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-sky-500/10 to-purple-500/10 border border-sky-500/20">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-400">Available Balance</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setToken("USDC")}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                        token === "USDC"
                          ? "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                          : "bg-muted text-neutral-400 hover:bg-white/10"
                      }`}
                    >
                      USDC
                    </button>
                    <button
                      onClick={() => setToken("USDT")}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                        token === "USDT"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-muted text-neutral-400 hover:bg-white/10"
                      }`}
                    >
                      USDT
                    </button>
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground mt-2">
                  {showBalance ? `$${availableBalance.toFixed(2)}` : "••••••"}
                  <span className="text-sm font-normal text-neutral-400 ml-2">{token}</span>
                </p>
              </div>

              {/* Amount Input */}
              <div className="mb-6">
                <Label className="text-neutral-300 mb-2 block">Amount</Label>
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    min="0"
                    max={MAX_AMOUNT}
                    className="bg-muted border-border text-foreground placeholder:text-neutral-500 pr-20"
                  />
                  <button
                    onClick={setMaxAmount}
                    className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 rounded bg-sky-500/20 text-sky-400 text-xs font-medium hover:bg-sky-500/30 transition-colors"
                  >
                    MAX
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <Button
                onClick={handleWithdraw}
                disabled={!amount || parseFloat(amount) <= 0}
                className="w-full bg-gradient-to-r from-sky-600 to-purple-600 hover:from-sky-500 hover:to-purple-500 text-white py-6"
              >
                <Icon icon="ph:arrow-up-right-bold" className="w-5 h-5 mr-2" />
                Withdraw {token}
              </Button>

              {/* Info */}
              <p className="text-xs text-neutral-500 mt-4 text-center">
                Withdrawals are processed through our privacy-preserving relayer.
                Your identity remains hidden.
              </p>
            </motion.div>
          )}

          {/* Confirm Step */}
          {step === "confirm" && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="rounded-2xl border border-border bg-card/50 backdrop-blur-xl p-6"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-sky-500/20 to-purple-500/20 flex items-center justify-center">
                  <Icon icon="ph:shield-check-bold" className="w-8 h-8 text-sky-400" />
                </div>
                <h3 className="text-xl font-semibold">Confirm Withdrawal</h3>
                <p className="text-neutral-400 text-sm mt-1">Please review the details</p>
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between p-3 rounded-lg bg-muted">
                  <span className="text-neutral-400">Amount</span>
                  <span className="text-foreground font-medium">{amount} {token}</span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-muted">
                  <span className="text-neutral-400">Recipient</span>
                  <span className="text-foreground font-mono text-sm">Your Wallet</span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-muted">
                  <span className="text-neutral-400">Network</span>
                  <span className="text-emerald-400">{activeChain === "base" ? "Base" : "Legacy"}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => setStep("form")}
                  variant="outline"
                  className="flex-1 border-border"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmWithdraw}
                  className="flex-1 bg-gradient-to-r from-sky-600 to-purple-600 hover:from-sky-500 hover:to-purple-500"
                >
                  Confirm Withdrawal
                </Button>
              </div>
            </motion.div>
          )}

          {/* Processing Step */}
          {step === "processing" && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="rounded-2xl border border-border bg-card/50 backdrop-blur-xl p-6 text-center"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-sky-500/20 flex items-center justify-center">
                <Icon icon="ph:spinner" className="w-8 h-8 text-sky-400 animate-spin" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Processing Withdrawal</h3>
              <p className="text-neutral-400 text-sm">
                Creating ZK proof and submitting transaction...
              </p>
            </motion.div>
          )}

          {/* Success Step */}
          {step === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="rounded-2xl border border-border bg-card/50 backdrop-blur-xl p-6 text-center"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Icon icon="ph:check-circle-bold" className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Withdrawal Successful!</h3>
              <p className="text-neutral-400 text-sm mb-4">
                {amount} {token} has been sent to the recipient.
              </p>

              {txSignature && (
                <a
                  href={activeChain === "base" ? `https://basescan.org/tx/${txSignature}` : `https://solscan.io/tx/${txSignature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sky-400 hover:text-sky-300 text-sm mb-6"
                >
                  <Icon icon="ph:arrow-square-out" className="w-4 h-4" />
                  {activeChain === "base" ? "View on Basescan" : "View on Solscan"}
                </a>
              )}

              <Button
                onClick={resetForm}
                className="w-full bg-gradient-to-r from-sky-600 to-purple-600 hover:from-sky-500 hover:to-purple-500"
              >
                Make Another Withdrawal
              </Button>
            </motion.div>
          )}

          {/* Error Step */}
          {step === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="rounded-2xl border border-border bg-card/50 backdrop-blur-xl p-6 text-center"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                <Icon icon="ph:x-circle-bold" className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Withdrawal Failed</h3>
              <p className="text-red-400 text-sm mb-6">{error || "An error occurred"}</p>

              <Button
                onClick={resetForm}
                variant="outline"
                className="w-full border-border"
              >
                Try Again
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default WithdrawSection;
