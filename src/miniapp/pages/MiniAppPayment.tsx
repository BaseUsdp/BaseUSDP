/**
 * Mini App Payment Page (opened from cast embed)
 * Route: /miniapp/pay/:id
 *
 * When opened via cast_embed: extracts payment ID from URL
 * Loads payment details from GET /api/payments/{id} — details visible ONLY inside iframe after auth
 * If user is recipient: shows "Payment received" confirmation
 * If user is payer: shows amount + "Pay Now" button → triggers ZK transfer
 */

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, CheckCircle, CreditCard, AlertCircle, Shield } from "lucide-react";
import { useFarcaster } from "../contexts/FarcasterContext";
import farcasterApi from "../services/farcasterApi";

type PaymentPageStep = "loading" | "details" | "signing" | "success" | "failed" | "not_found";

export default function MiniAppPayment() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { walletAddress, bearerToken, provider, refreshBalance } = useFarcaster();

  const [step, setStep] = useState<PaymentPageStep>("loading");
  const [payment, setPayment] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  if (bearerToken) {
    farcasterApi.setToken(bearerToken);
  }

  // Load payment details
  useEffect(() => {
    if (!id) {
      setStep("not_found");
      return;
    }

    async function loadPayment() {
      try {
        const result = await farcasterApi.getPaymentStatus(id!);
        if (result.payment) {
          setPayment(result.payment);
          setStep("details");
        } else {
          setStep("not_found");
        }
      } catch {
        setStep("not_found");
      }
    }

    loadPayment();
  }, [id]);

  const isRecipient =
    payment?.user_wallet?.toLowerCase() === walletAddress?.toLowerCase() ||
    payment?.recipient?.toLowerCase() === walletAddress?.toLowerCase();

  const isSettled = payment?.status === "settled";

  const handlePay = async () => {
    if (!walletAddress || !provider || !payment) return;

    setStep("signing");
    setError(null);

    try {
      const nonce = Date.now();
      const messageToSign = `BASEUSDP Payment: ${payment.amount} ${payment.token || "USDC"} | Payment: ${id} | Nonce: ${nonce}`;

      const accounts = await provider.request({ method: "eth_accounts" });
      const senderAddress = accounts[0] || walletAddress;

      const signature = await provider.request({
        method: "personal_sign",
        params: [
          `0x${Buffer.from(messageToSign).toString("hex")}`,
          senderAddress,
        ],
      });

      // Execute transfer to payment recipient
      const transferResult = await farcasterApi.executeZKTransfer({
        sender_wallet: senderAddress,
        recipient_wallet: payment.recipient || payment.user_wallet,
        token: payment.token || "USDC",
        amount: payment.amount,
        nonce,
        wallet_signature: signature,
        message_to_sign: messageToSign,
      });

      if (!transferResult.success) {
        throw new Error(transferResult.error || "Payment failed");
      }

      // Settle the payment request
      await farcasterApi.settlePayment(id!, senderAddress, transferResult.signature);

      setStep("success");
      refreshBalance();
    } catch (err: any) {
      console.error("[MiniApp Payment] Error:", err);
      setError(err.message || "Payment failed");
      setStep("failed");
    }
  };

  // Loading
  if (step === "loading") {
    return (
      <div className="flex flex-col items-center justify-center p-8 h-80">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
        <p className="text-sm text-zinc-400">Loading payment details...</p>
      </div>
    );
  }

  // Not found
  if (step === "not_found") {
    return (
      <div className="flex flex-col items-center justify-center p-8 h-80 space-y-3">
        <AlertCircle className="w-8 h-8 text-zinc-500" />
        <p className="text-sm text-zinc-400">Payment not found</p>
        <button
          onClick={() => navigate("/miniapp")}
          className="text-xs text-indigo-400"
        >
          Go to Home
        </button>
      </div>
    );
  }

  // Payment details
  if (step === "details") {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <CreditCard className="w-5 h-5 text-indigo-400" />
          <h1 className="text-lg font-semibold">Payment Request</h1>
        </div>

        <div className="bg-zinc-800/50 rounded-2xl p-4 space-y-3 border border-zinc-700/30">
          {payment.service_name && (
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Service</span>
              <span className="text-white">{payment.service_name}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Amount</span>
            <span className="font-mono font-semibold">
              ${Number(payment.amount).toFixed(2)} {payment.token || "USDC"}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Status</span>
            <span
              className={
                isSettled ? "text-green-400" : "text-yellow-400"
              }
            >
              {isSettled ? "Settled" : "Pending"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 pt-1 border-t border-zinc-700/30">
            <Shield className="w-3 h-3" />
            Protected by ZK proofs
          </div>
        </div>

        {/* Already settled */}
        {isSettled && (
          <div className="bg-green-500/10 rounded-xl p-3 text-center">
            <CheckCircle className="w-5 h-5 text-green-400 mx-auto mb-1" />
            <p className="text-sm text-green-400">This payment has been settled</p>
          </div>
        )}

        {/* Recipient viewing */}
        {isRecipient && !isSettled && (
          <div className="bg-indigo-500/10 rounded-xl p-3 text-center">
            <p className="text-sm text-indigo-300">
              Waiting for payment...
            </p>
          </div>
        )}

        {/* Payer can pay */}
        {!isRecipient && !isSettled && (
          <button
            onClick={handlePay}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-semibold transition-colors"
          >
            Pay ${Number(payment.amount).toFixed(2)} {payment.token || "USDC"}
          </button>
        )}

        <button
          onClick={() => navigate("/miniapp")}
          className="w-full py-3 bg-zinc-800 rounded-xl text-sm font-medium text-zinc-300 hover:bg-zinc-700"
        >
          Back to Home
        </button>
      </div>
    );
  }

  // Signing
  if (step === "signing") {
    return (
      <div className="flex flex-col items-center justify-center p-8 h-80">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
        <p className="text-sm font-medium">Processing payment...</p>
        <p className="text-xs text-zinc-500 mt-1">Approve in your wallet</p>
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
        <h2 className="text-lg font-semibold">Payment Sent!</h2>
        <p className="text-sm text-zinc-400 text-center">
          ${Number(payment?.amount).toFixed(2)} {payment?.token || "USDC"} paid privately
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
      <h2 className="text-lg font-semibold">Payment Failed</h2>
      <p className="text-sm text-red-400 text-center">{error || "Something went wrong"}</p>
      <button
        onClick={() => setStep("details")}
        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-semibold"
      >
        Try Again
      </button>
    </div>
  );
}
