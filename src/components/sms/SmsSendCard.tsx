/**
 * On-chain SMS send.
 *  - Validates inputs + checks user's USDC balance on Base.
 *  - If allowance < amount, prompts USDC.approve(escrow, maxUint256).
 *  - Prompts escrow.depositFor(claimToken, amount).
 *  - After the deposit confirms, POSTs phoneE164 + claimToken to
 *    /api/sms/dispatch so Twilio actually sends the message.
 */

import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { isValidE164, normalizeE164 } from "@/lib/sms/phone";
import { generateClaimToken } from "@/lib/sms/token";
import {
  SMS_ESCROW_ADDRESS,
  USDC_ADDRESS,
  encodeApprove,
  encodeDepositFor,
  parseUsdc,
  publicClient,
  readAllowance,
  readUsdcBalance,
} from "@/lib/sms/contracts";
import { sendTransaction, type VeilWalletType } from "@/lib/veil/provider";

interface SmsSendCardProps {
  onSent: () => void;
}

interface SuccessState {
  claimToken: `0x${string}`;
  claimUrl: string;
  depositTxHash: `0x${string}`;
  consoleMode: boolean;
}

type Phase =
  | "idle"
  | "checking-allowance"
  | "approving"
  | "depositing"
  | "dispatching"
  | "done";

const SmsSendCard = ({ onSent }: SmsSendCardProps) => {
  const { fullWalletAddress, isConnected, walletType } = useWallet();
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SuccessState | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);

  // Pull the connected wallet's USDC balance on Base so the user knows
  // what they have to work with before signing.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!fullWalletAddress) return;
      try {
        const bal = await readUsdcBalance(fullWalletAddress as `0x${string}`);
        if (!cancelled) {
          setUsdcBalance((Number(bal) / 1e6).toFixed(2));
        }
      } catch {
        if (!cancelled) setUsdcBalance(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fullWalletAddress, result]);

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
    phase === "idle" &&
    isValidE164(phone) &&
    amountValid &&
    Number(amount) > 0 &&
    !!SMS_ESCROW_ADDRESS;

  async function waitForTx(hash: `0x${string}`) {
    await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 } as any);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isConnected || !fullWalletAddress) return;
    setError(null);
    setResult(null);
    if (!SMS_ESCROW_ADDRESS) {
      setError("VITE_SMS_ESCROW_ADDRESS not configured");
      return;
    }

    const sender = fullWalletAddress as `0x${string}`;
    const wtype: VeilWalletType =
      walletType === "metamask" || walletType === "phantom"
        ? walletType
        : null;

    let e164: string;
    let amountUnits: bigint;
    try {
      e164 = normalizeE164(phone);
      amountUnits = parseUsdc(amount);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return;
    }

    const claimToken = generateClaimToken();
    const trimmedNote = note.trim() ? note.trim().slice(0, 140) : null;

    try {
      // Step 1: balance + allowance
      setPhase("checking-allowance");
      const [bal, allowance] = await Promise.all([
        readUsdcBalance(sender),
        readAllowance(sender),
      ]);
      if (bal < amountUnits) {
        throw new Error(
          `Insufficient USDC on Base. Have ${(Number(bal) / 1e6).toFixed(2)}, need ${amount}.`
        );
      }

      // Step 2: approve if needed
      if (allowance < amountUnits) {
        setPhase("approving");
        const approveHash = await sendTransaction(wtype, {
          from: sender,
          to: USDC_ADDRESS,
          data: encodeApprove(SMS_ESCROW_ADDRESS as `0x${string}`),
        });
        await waitForTx(approveHash);
      }

      // Step 3: deposit
      setPhase("depositing");
      const depositHash = await sendTransaction(wtype, {
        from: sender,
        to: SMS_ESCROW_ADDRESS as `0x${string}`,
        data: encodeDepositFor(claimToken, amountUnits),
      });
      await waitForTx(depositHash);

      // Step 4: dispatch SMS via backend (which verifies the on-chain deposit)
      setPhase("dispatching");
      const dispatchRes = await fetch("/api/sms/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimToken,
          phoneE164: e164,
          note: trimmedNote,
        }),
      });
      const dispatchJson = await dispatchRes.json().catch(() => ({}));
      if (!dispatchRes.ok) {
        throw new Error(
          (dispatchJson as any).error ?? `dispatch failed (${dispatchRes.status})`
        );
      }

      setResult({
        claimToken,
        claimUrl:
          (dispatchJson as any).claimUrl ??
          `${window.location.origin}/claim/${claimToken}`,
        depositTxHash: depositHash,
        consoleMode: Boolean((dispatchJson as any).consoleMode),
      });
      setPhase("done");
      reset();
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("idle");
    }
  }

  const buttonLabel = (() => {
    switch (phase) {
      case "checking-allowance":
        return "Checking allowance…";
      case "approving":
        return "Approve USDC in wallet…";
      case "depositing":
        return "Confirm deposit in wallet…";
      case "dispatching":
        return "Sending SMS…";
      case "done":
        return "Sent — send another";
      default:
        return "Sign & send SMS";
    }
  })();

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border p-5 space-y-4"
      style={{
        borderColor: "var(--dash-border)",
        background: "var(--dash-overlay)",
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
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
            Send USDC by SMS — on-chain
          </h3>
        </div>
        {usdcBalance !== null && (
          <span
            className="text-[11px]"
            style={{ color: "var(--dash-text-faint)" }}
          >
            Wallet USDC on Base: ${usdcBalance}
          </span>
        )}
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
              On-chain escrow opened · SMS dispatched
            </span>
          </div>
          <div
            className="break-all font-mono text-[11px]"
            style={{ color: "var(--dash-text-muted)" }}
          >
            {result.claimUrl}
          </div>
          <a
            href={`https://basescan.org/tx/${result.depositTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 underline underline-offset-2"
            style={{ color: "var(--dash-text-faint)" }}
          >
            <Icon icon="ph:arrow-square-out-bold" className="h-3 w-3" />
            Deposit tx on Basescan
          </a>
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {phase !== "idle" && phase !== "done" ? (
          <Icon icon="ph:spinner-bold" className="h-4 w-4 animate-spin" />
        ) : (
          <Icon icon="ph:paper-plane-tilt-bold" className="h-4 w-4" />
        )}
        {buttonLabel}
      </button>

      <p
        className="text-[10px] leading-relaxed"
        style={{ color: "var(--dash-text-faint)" }}
      >
        First send from this wallet requires a one-time USDC approval (a
        second wallet popup). Subsequent sends only sign the deposit. The
        recipient pays the gas to claim and receives the USDC minus the
        pool's 0.5% maintenance fee. Unclaimed escrows refund to you after
        24 hours via permissionless `refund()`.
      </p>
    </form>
  );
};

export default SmsSendCard;
