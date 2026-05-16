/**
 * SMS send form. Handles:
 *  - E.164 validation and client-side keccak256 hashing
 *  - Wallet personal_sign of the send commitment
 *  - Online: POST /api/sms/send and surface the claim link
 *  - Offline: persist the signed payload to localStorage and queue it
 */

import { Icon } from "@iconify/react";
import { useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { hashPhone, isValidE164, normalizeE164 } from "@/lib/sms/phone";
import { generateClaimToken } from "@/lib/sms/token";
import { buildSendCommitment } from "@/lib/sms/messages";
import { personalSign, type VeilWalletType } from "@/lib/veil/provider";
import { postSmsSend, type SmsSendPayload } from "@/services/smsService";
import { enqueueSend } from "@/lib/sms/offlineQueue";
import type { SmsSendResult } from "@/lib/sms/types";

interface SmsSendCardProps {
  onSent: () => void;
}

const SmsSendCard = ({ onSent }: SmsSendCardProps) => {
  const { fullWalletAddress, isConnected, walletType } = useWallet();
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SmsSendResult | null>(null);
  const [queuedNote, setQueuedNote] = useState<string | null>(null);

  const reset = () => {
    setPhone("");
    setAmount("");
    setNote("");
  };

  const phoneValid = phone.length === 0 || isValidE164(phone);
  const amountValid =
    amount.length === 0 ||
    (/^\d+(\.\d{1,6})?$/.test(amount) && Number(amount) > 0);
  const canSubmit =
    isConnected &&
    !submitting &&
    isValidE164(phone) &&
    amountValid &&
    Number(amount) > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isConnected || !fullWalletAddress) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    setQueuedNote(null);

    try {
      const e164 = normalizeE164(phone);
      const phoneHash = hashPhone(e164);
      const claimToken = generateClaimToken();
      const commitment = buildSendCommitment({
        phoneHash,
        amount,
        claimToken,
      });

      const wtype: VeilWalletType =
        walletType === "metamask" || walletType === "phantom"
          ? walletType
          : null;
      const sig = await personalSign(wtype, fullWalletAddress, commitment);

      const payload: SmsSendPayload = {
        phoneHash,
        amount,
        sender: fullWalletAddress as `0x${string}`,
        senderSig: sig as `0x${string}`,
        phoneE164: e164,
        claimToken,
        note: note.trim() ? note.trim() : null,
      };

      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueSend({
          phoneE164: e164,
          phoneHash,
          amount,
          sender: fullWalletAddress as `0x${string}`,
          senderSig: sig as `0x${string}`,
          claimToken,
          note: note.trim() ? note.trim() : null,
        });
        setQueuedNote(
          "You're offline — the signed send was queued and will dispatch automatically when you reconnect."
        );
        reset();
        onSent();
        return;
      }

      const sent = await postSmsSend(payload);
      setResult(sent);
      reset();
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border p-5 space-y-4"
      style={{
        borderColor: "var(--dash-border)",
        background: "var(--dash-overlay)",
      }}
    >
      <div className="flex items-center gap-2">
        <Icon
          icon="ph:paper-plane-tilt-bold"
          className="h-4 w-4"
          style={{ color: "hsl(var(--beam-cyan))" }}
        />
        <h3
          className="text-sm font-semibold"
          style={{ color: "var(--dash-text)" }}
        >
          Send USDC by SMS
        </h3>
      </div>

      <div className="space-y-1.5">
        <label
          className="text-[11px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--dash-text-faint)" }}
        >
          Recipient phone (E.164)
        </label>
        <input
          type="tel"
          inputMode="tel"
          placeholder="+14155550123"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-md border bg-transparent px-3 py-2 text-sm font-mono focus:outline-none"
          style={{
            borderColor: phoneValid
              ? "var(--dash-border)"
              : "rgba(239,68,68,0.5)",
            color: "var(--dash-text)",
          }}
        />
        {!phoneValid && (
          <p className="text-[11px]" style={{ color: "#ef4444" }}>
            Must be in E.164 format, e.g. +14155550123
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label
            className="text-[11px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--dash-text-faint)" }}
          >
            Amount (USDC)
          </label>
          <input
            type="text"
            inputMode="decimal"
            placeholder="10.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none"
            style={{
              borderColor: amountValid
                ? "var(--dash-border)"
                : "rgba(239,68,68,0.5)",
              color: "var(--dash-text)",
            }}
          />
        </div>
        <div className="space-y-1.5">
          <label
            className="text-[11px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--dash-text-faint)" }}
          >
            Note (optional)
          </label>
          <input
            type="text"
            maxLength={140}
            placeholder="for coffee"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm focus:outline-none"
            style={{
              borderColor: "var(--dash-border)",
              color: "var(--dash-text)",
            }}
          />
        </div>
      </div>

      {error && (
        <div
          className="flex items-start gap-2 rounded-md border px-3 py-2 text-xs"
          style={{
            borderColor: "rgba(239,68,68,0.4)",
            background: "rgba(239,68,68,0.08)",
            color: "#ef4444",
          }}
        >
          <Icon
            icon="ph:warning-bold"
            className="mt-0.5 h-3.5 w-3.5 shrink-0"
          />
          <div>{error}</div>
        </div>
      )}

      {queuedNote && (
        <div
          className="flex items-start gap-2 rounded-md border px-3 py-2 text-xs"
          style={{
            borderColor: "hsl(var(--beam-amber))",
            background: "rgba(245,158,11,0.08)",
            color: "hsl(var(--beam-amber))",
          }}
        >
          <Icon
            icon="ph:queue-bold"
            className="mt-0.5 h-3.5 w-3.5 shrink-0"
          />
          <div>{queuedNote}</div>
        </div>
      )}

      {result && (
        <div
          className="space-y-2 rounded-md border p-3 text-xs"
          style={{
            borderColor: "hsl(var(--beam-green))",
            background: "rgba(0,210,122,0.08)",
            color: "var(--dash-text)",
          }}
        >
          <div className="flex items-center gap-2">
            <Icon
              icon="ph:check-circle-bold"
              className="h-4 w-4"
              style={{ color: "hsl(var(--beam-green))" }}
            />
            <span className="font-semibold">
              {result.consoleMode
                ? "Escrow created (console-mode SMS — see Local inbox below)"
                : "SMS dispatched"}
            </span>
          </div>
          <div
            className="break-all font-mono text-[11px]"
            style={{ color: "var(--dash-text-muted)" }}
          >
            {result.claimUrl}
          </div>
          <div style={{ color: "var(--dash-text-faint)" }}>
            Auto-refunds to you at {new Date(result.expiresAt).toLocaleString()}
            .
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? (
          <>
            <Icon icon="ph:spinner-bold" className="h-4 w-4 animate-spin" />
            Signing & sending…
          </>
        ) : (
          <>
            <Icon icon="ph:paper-plane-tilt-bold" className="h-4 w-4" />
            Sign & send SMS
          </>
        )}
      </button>
    </form>
  );
};

export default SmsSendCard;
