/**
 * Private Link send card.
 *
 * Flow (no SMS, no off-chain dispatch):
 *  1. Validate amount + check USDC balance on Base.
 *  2. If allowance < amount, prompt USDC.approve(escrow, maxUint256).
 *  3. Prompt escrow.depositFor(claimToken, amount).
 *  4. After confirmation, show the claim URL with copy + native-share buttons
 *     so the sender can deliver it however they want (WhatsApp, Telegram,
 *     iMessage, email, etc).
 */

import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
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
  amount: string;
  note: string | null;
}

type Phase =
  | "idle"
  | "checking-allowance"
  | "approving"
  | "depositing"
  | "done";

const SmsSendCard = ({ onSent }: SmsSendCardProps) => {
  const { fullWalletAddress, isConnected, walletType } = useWallet();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SuccessState | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
  const [copyOk, setCopyOk] = useState(false);

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

  const amountValid =
    amount.length === 0 ||
    (/^\d+(\.\d{1,6})?$/.test(amount) && Number(amount) > 0);
  const canSubmit =
    isConnected &&
    phase === "idle" &&
    amountValid &&
    Number(amount) > 0 &&
    !!SMS_ESCROW_ADDRESS;

  async function waitForTx(hash: `0x${string}`) {
    await publicClient.waitForTransactionReceipt({
      hash,
      confirmations: 1,
    } as any);
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
    // VeilWalletType is the superset of every WalletType the connect flow
    // supports, so the cast is safe and routes to the correct injected
    // provider (metamask / phantom / coinbase / okx / bitget / tokenpocket
    // / imtoken / mathwallet).
    const wtype = walletType as VeilWalletType;

    let amountUnits: bigint;
    try {
      amountUnits = parseUsdc(amount);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return;
    }

    const claimToken = generateClaimToken();
    const trimmedNote = note.trim() ? note.trim().slice(0, 140) : null;

    try {
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

      if (allowance < amountUnits) {
        setPhase("approving");
        const approveHash = await sendTransaction(wtype, {
          from: sender,
          to: USDC_ADDRESS,
          data: encodeApprove(SMS_ESCROW_ADDRESS as `0x${string}`),
        });
        await waitForTx(approveHash);
      }

      setPhase("depositing");
      const depositHash = await sendTransaction(wtype, {
        from: sender,
        to: SMS_ESCROW_ADDRESS as `0x${string}`,
        data: encodeDepositFor(claimToken, amountUnits),
      });
      await waitForTx(depositHash);

      setResult({
        claimToken,
        claimUrl: `${window.location.origin}/claim/${claimToken}`,
        depositTxHash: depositHash,
        amount,
        note: trimmedNote,
      });
      setPhase("done");
      setAmount("");
      setNote("");
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("idle");
    }
  }

  async function copyUrl() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.claimUrl);
      setCopyOk(true);
      setTimeout(() => setCopyOk(false), 1500);
    } catch {
      // ignore
    }
  }

  async function shareUrl() {
    if (!result) return;
    const data = {
      title: "BASEUSDP — private claim link",
      text: result.note
        ? `I sent you $${result.amount} USDC — "${result.note}"`
        : `I sent you $${result.amount} USDC`,
      url: result.claimUrl,
    };
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share(data);
      } catch {
        // user cancelled — no-op
      }
    } else {
      void copyUrl();
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
      case "done":
        return "Send another";
      default:
        return "Generate claim link";
    }
  })();

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full min-w-0 rounded-xl border p-4 sm:p-5 space-y-4"
      style={{
        borderColor: "var(--dash-border)",
        background: "var(--dash-overlay)",
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Icon
            icon="ph:link-bold"
            className="h-4 w-4 shrink-0"
            style={{ color: "hsl(var(--beam-cyan))" }}
          />
          <h3
            className="truncate text-sm font-semibold"
            style={{ color: "var(--dash-text)" }}
          >
            Generate a private claim link
          </h3>
        </div>
        {usdcBalance !== null && (
          <span
            className="shrink-0 text-[11px]"
            style={{ color: "var(--dash-text-faint)" }}
          >
            Wallet USDC: ${usdcBalance}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr,2fr]">
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
          <div className="break-words">{error}</div>
        </div>
      )}

      {result && (
        <div
          className="space-y-3 rounded-md border p-3 text-xs"
          style={{
            borderColor: "hsl(var(--beam-green))",
            background: "rgba(0,210,122,0.08)",
            color: "var(--dash-text)",
          }}
        >
          <div className="flex items-center gap-2">
            <Icon
              icon="ph:check-circle-bold"
              className="h-4 w-4 shrink-0"
              style={{ color: "hsl(var(--beam-green))" }}
            />
            <span className="font-semibold">
              ${result.amount} USDC locked · claim link ready
            </span>
          </div>

          <div
            className="rounded-md border px-3 py-2 font-mono text-[11px] break-all [overflow-wrap:anywhere]"
            style={{
              borderColor: "var(--dash-border)",
              background: "var(--dash-surface)",
              color: "var(--dash-text-muted)",
            }}
          >
            {result.claimUrl}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={copyUrl}
              className="inline-flex w-full items-center justify-center gap-1 rounded-md border px-3 py-1.5 text-[11px] font-semibold"
              style={{
                borderColor: "hsl(var(--beam-green))",
                color: "hsl(var(--beam-green))",
              }}
            >
              <Icon
                icon={copyOk ? "ph:check-bold" : "ph:copy-bold"}
                className="h-3 w-3 shrink-0"
              />
              <span className="truncate">
                {copyOk ? "Copied!" : "Copy link"}
              </span>
            </button>
            <button
              type="button"
              onClick={shareUrl}
              className="inline-flex w-full items-center justify-center gap-1 rounded-md border px-3 py-1.5 text-[11px] font-semibold"
              style={{
                borderColor: "var(--dash-border)",
                color: "var(--dash-text)",
              }}
            >
              <Icon
                icon="ph:share-network-bold"
                className="h-3 w-3 shrink-0"
              />
              <span className="truncate">Share…</span>
            </button>
          </div>

          <a
            href={`https://basescan.org/tx/${result.depositTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] underline underline-offset-2"
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
          <Icon icon="ph:link-bold" className="h-4 w-4" />
        )}
        {buttonLabel}
      </button>

      <p
        className="text-[10px] leading-relaxed"
        style={{ color: "var(--dash-text-faint)" }}
      >
        First send from this wallet requires a one-time USDC approval (a
        second wallet popup). Subsequent sends only sign the deposit.
        Anyone with the link can claim — share it via any channel you trust.
        Unclaimed deposits refund to you after 24 hours via the
        permissionless on-chain `refund()`.
      </p>
    </form>
  );
};

export default SmsSendCard;
