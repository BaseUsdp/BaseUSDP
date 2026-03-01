/**
 * Mini App Send Payment Page
 * Adapted from SendPaymentModal — same state machine:
 * form → preview → signing → encrypting → success
 *
 * Key differences vs main app:
 * - Supports Farcaster username recipient (via FarcasterRecipientInput)
 * - Uses Farcaster's EIP-1193 provider for signing
 * - After success: offers "Share" button to compose privacy-safe cast
 */

import { useState, useCallback } from "react";
import { ArrowLeft, Send, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useFarcaster } from "../contexts/FarcasterContext";
import { FarcasterRecipientInput } from "../components/FarcasterRecipientInput";
import { ShareCastButton } from "../components/ShareCastButton";
import farcasterApi from "../services/farcasterApi";

type SendStep = "form" | "preview" | "signing" | "encrypting" | "success" | "failed";

interface RecipientInfo {
  type: "orb402" | "farcaster";
  username: string;
  orb402Username?: string;
  hasDeposited?: boolean;
}

export default function MiniAppSend() {
  const navigate = useNavigate();
  const { walletAddress, bearerToken, provider, balance, refreshBalance } = useFarcaster();

  const [step, setStep] = useState<SendStep>("form");
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState<"USDC" | "USDT">("USDC");
  const [recipient, setRecipient] = useState<RecipientInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Set token on API client
  if (bearerToken) {
    farcasterApi.setToken(bearerToken);
  }

  const selectedBalance = token === "USDC" ? (balance?.usdc || 0) : (balance?.usdt || 0);
  const parsedAmount = parseFloat(amount) || 0;
  const isAmountValid = parsedAmount > 0 && parsedAmount <= selectedBalance && parsedAmount <= 999999.99;

  const handleRecipientResolved = useCallback(
    (info: RecipientInfo | null) => setRecipient(info),
    []
  );

  const handlePreview = () => {
    if (!recipient || !isAmountValid) return;
    setStep("preview");
  };

  const handleSend = async () => {
    if (!walletAddress || !provider || !recipient) return;

    setStep("signing");
    setError(null);

    try {
      // Build the transfer request
      const nonce = Date.now();
      const messageToSign = `ORB402 Transfer: ${parsedAmount} ${token} | Nonce: ${nonce}`;

      // Sign with Farcaster wallet
      const accounts = await provider.request({ method: "eth_accounts" });
      const senderAddress = accounts[0] || walletAddress;

      const msgHex = Array.from(new TextEncoder().encode(messageToSign))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const signature = await provider.request({
        method: "personal_sign",
        params: [`0x${msgHex}`, senderAddress],
      });

      setStep("encrypting");

      // Determine recipient identifier
      const transferParams: any = {
        sender_wallet: senderAddress,
        token,
        amount: parsedAmount,
        nonce,
        wallet_signature: signature,
        message_to_sign: messageToSign,
      };

      // Use ORB402 username if available (for internal transfer), otherwise wallet
      if (recipient.type === "orb402" || recipient.orb402Username) {
        transferParams.recipient_username =
          recipient.orb402Username || recipient.username;
      } else {
        // For Farcaster users without ORB402 account, use their Farcaster username
        // The backend will handle resolution
        transferParams.recipient_username = `fc:${recipient.username}`;
      }

      const result = await farcasterApi.executeZKTransfer(transferParams);

      if (!result.success) {
        throw new Error(result.error || "Transfer failed");
      }

      setStep("success");
      refreshBalance();
    } catch (err: any) {
      console.error("[MiniApp Send] Error:", err);
      setError(err.message || "Transfer failed");
      setStep("failed");
    }
  };

  // Form step
  if (step === "form") {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => navigate("/miniapp")} className="text-zinc-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">Send Payment</h1>
        </div>

        {/* Recipient */}
        <div>
          <label className="text-xs text-zinc-400 mb-1.5 block">Recipient</label>
          <FarcasterRecipientInput onRecipientResolved={handleRecipientResolved} />
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
          <p className="text-xs text-zinc-500 mt-1">
            Available: ${selectedBalance.toFixed(2)}
          </p>
        </div>

        {/* Amount */}
        <div>
          <label className="text-xs text-zinc-400 mb-1.5 block">Amount</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">$</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="0.01"
              max="999999.99"
              step="0.01"
              className="w-full pl-7 pr-4 py-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl text-lg font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          {amount && !isAmountValid && parsedAmount > 0 && (
            <p className="text-xs text-red-400 mt-1">
              {parsedAmount > selectedBalance
                ? "Insufficient balance"
                : "Invalid amount"}
            </p>
          )}
        </div>

        {/* Send Button */}
        <button
          onClick={handlePreview}
          disabled={!recipient || !isAmountValid}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-xl text-sm font-semibold transition-colors"
        >
          Review Transfer
        </button>
      </div>
    );
  }

  // Preview step
  if (step === "preview") {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => setStep("form")} className="text-zinc-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">Confirm Transfer</h1>
        </div>

        <div className="bg-zinc-800/50 rounded-2xl p-4 space-y-3 border border-zinc-700/30">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Amount</span>
            <span className="font-mono font-semibold">${parsedAmount.toFixed(2)} {token}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">To</span>
            <span className="text-white">
              {recipient?.type === "farcaster" ? `@${recipient.username}` : recipient?.username}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Privacy</span>
            <span className="text-green-400">Full (ZK Protected)</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setStep("form")}
            className="flex-1 py-3 bg-zinc-800 rounded-xl text-sm font-medium text-zinc-300 hover:bg-zinc-700"
          >
            Back
          </button>
          <button
            onClick={handleSend}
            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-semibold"
          >
            Send Now
          </button>
        </div>
      </div>
    );
  }

  // Signing / Encrypting steps
  if (step === "signing" || step === "encrypting") {
    return (
      <div className="flex flex-col items-center justify-center p-8 h-80">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
        <p className="text-sm font-medium">
          {step === "signing" ? "Signing transaction..." : "Encrypting & sending..."}
        </p>
        <p className="text-xs text-zinc-500 mt-1">
          {step === "signing"
            ? "Approve in your wallet"
            : "Processing with ZK proofs"}
        </p>
      </div>
    );
  }

  // Success step
  if (step === "success") {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-green-400" />
        </div>
        <h2 className="text-lg font-semibold">Payment Sent!</h2>
        <p className="text-sm text-zinc-400 text-center">
          ${parsedAmount.toFixed(2)} {token} sent privately to{" "}
          {recipient?.type === "farcaster" ? `@${recipient.username}` : recipient?.username}
        </p>

        <ShareCastButton className="w-full" />

        <button
          onClick={() => navigate("/miniapp")}
          className="w-full py-3 bg-zinc-800 rounded-xl text-sm font-medium text-zinc-300 hover:bg-zinc-700"
        >
          Back to Home
        </button>
      </div>
    );
  }

  // Failed step
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
        <AlertCircle className="w-8 h-8 text-red-400" />
      </div>
      <h2 className="text-lg font-semibold">Transfer Failed</h2>
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
