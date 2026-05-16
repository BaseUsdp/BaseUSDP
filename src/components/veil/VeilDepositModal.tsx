/**
 * Veil deposit modal — USDC or ETH.
 *
 * Flow:
 *   1. Require Veil session (sign-derived keypair).
 *   2. If wallet not yet registered on Veil → register tx (one-time).
 *   3. If USDC and allowance insufficient → approve tx (scoped to amount).
 *   4. Deposit tx (0.3 % fee added on-chain; first deposit free per address).
 */

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Icon } from "@iconify/react";
import { useWallet } from "@/contexts/WalletContext";
import { useVeil } from "@/contexts/VeilContext";
import VeilConnectGate from "./VeilConnectGate";
import {
  sendTransaction,
  readUsdcAllowance,
  type VeilWalletType,
} from "@/lib/veil/provider";
import {
  fetchVeilStatus,
  type VeilStatus,
} from "@/services/veilService";

type Token = "USDC" | "ETH";
type Step =
  | "idle"
  | "registering"
  | "approving"
  | "depositing"
  | "done"
  | "error";

interface Props {
  open: boolean;
  onClose: () => void;
  onDeposited?: () => void;
}

const VeilDepositModal = ({ open, onClose, onDeposited }: Props) => {
  const { fullWalletAddress, walletType, isConnected } = useWallet();
  const { keypair, depositKey } = useVeil();
  const [token, setToken] = useState<Token>("USDC");
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [status, setStatus] = useState<VeilStatus | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const isRegistered = status?.registration?.isRegistered ?? false;
  const isVerified = status?.eligibility?.isAllowed ?? false;
  const wtype: VeilWalletType =
    walletType === "metamask" || walletType === "phantom" ? walletType : null;

  useEffect(() => {
    if (!open || !isConnected || !fullWalletAddress) return;
    let cancelled = false;
    fetchVeilStatus(fullWalletAddress)
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, isConnected, fullWalletAddress]);

  const reset = () => {
    setAmount("");
    setStep("idle");
    setErrorMsg(null);
    setTxHash(null);
  };

  const close = () => {
    if (step === "registering" || step === "approving" || step === "depositing") return;
    reset();
    onClose();
  };

  const ammoutNumber = parseFloat(amount || "0");
  const canSubmit =
    keypair !== null &&
    !!fullWalletAddress &&
    ammoutNumber > 0 &&
    !["registering", "approving", "depositing"].includes(step);

  const handleSubmit = async () => {
    if (!keypair || !depositKey || !fullWalletAddress) return;
    setErrorMsg(null);
    setTxHash(null);
    try {
      const sdk = await import("@veil-cash/sdk");

      // Step 1: register if needed.
      if (!isRegistered) {
        setStep("registering");
        const regTx = sdk.buildRegisterTx(
          depositKey,
          fullWalletAddress as `0x${string}`
        );
        await sendTransaction(wtype, {
          from: fullWalletAddress as `0x${string}`,
          to: regTx.to,
          data: regTx.data,
        });
      }

      // Step 2: USDC approve if needed.
      if (token === "USDC") {
        setStep("approving");
        const addresses = sdk.ADDRESSES;
        const decimals = 6;
        const amountWei = BigInt(Math.floor(ammoutNumber * 10 ** decimals));
        const allowance = await readUsdcAllowance(
          wtype,
          fullWalletAddress as `0x${string}`,
          addresses.entry,
          addresses.usdcToken
        );
        // Need slightly more than amount due to 0.3% fee added on top.
        const required = (amountWei * 1010n) / 1000n;
        if (allowance < required) {
          // Approve a hair above what the deposit will consume.
          const approveAmount = (Number(required) / 10 ** decimals).toFixed(
            decimals
          );
          const approveTx = sdk.buildApproveUSDCTx({ amount: approveAmount });
          await sendTransaction(wtype, {
            from: fullWalletAddress as `0x${string}`,
            to: approveTx.to,
            data: approveTx.data,
          });
        }
      }

      // Step 3: deposit.
      setStep("depositing");
      const depTx = sdk.buildDepositTx({
        depositKey,
        amount,
        token,
      });
      const hash = await sendTransaction(wtype, {
        from: fullWalletAddress as `0x${string}`,
        to: depTx.to,
        data: depTx.data,
        value: depTx.value,
      });
      setTxHash(hash);
      setStep("done");
      onDeposited?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      setStep("error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? close() : undefined)}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon icon="ph:vault-bold" className="h-5 w-5" />
            Deposit to Veil Pool
          </DialogTitle>
        </DialogHeader>

        {!keypair ? (
          <VeilConnectGate
            title="Sign in to Veil to continue"
            description="Veil derives a keypair from a single wallet signature. This proves you can decrypt funds you deposit. The signature stays in your browser."
          />
        ) : step === "done" ? (
          <div className="space-y-3 py-2 text-sm">
            <div
              className="flex items-start gap-3 rounded-lg border px-4 py-3"
              style={{
                borderColor: "rgba(0,210,122,0.4)",
                background: "rgba(0,210,122,0.08)",
                color: "#10b981",
              }}
            >
              <Icon icon="ph:check-circle-bold" className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="space-y-1">
                <p className="font-semibold">Deposit submitted</p>
                <p className="text-xs opacity-80">
                  Funds enter Veil's queue and clear into the shielded set in
                  about 8 minutes.
                </p>
              </div>
            </div>
            {txHash && (
              <a
                href={`https://basescan.org/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block break-all rounded-md border px-3 py-2 text-xs underline"
                style={{
                  borderColor: "var(--dash-border)",
                  color: "var(--dash-text)",
                }}
              >
                {txHash}
              </a>
            )}
            <button
              type="button"
              onClick={close}
              className="w-full rounded-lg border px-4 py-3 text-sm font-semibold"
              style={{
                borderColor: "var(--dash-border)",
                color: "var(--dash-text)",
              }}
            >
              Close
            </button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Token selector */}
            <div className="grid grid-cols-2 gap-2">
              {(["USDC", "ETH"] as Token[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setToken(t)}
                  className="rounded-lg border px-4 py-3 text-sm font-semibold"
                  style={{
                    borderColor:
                      token === t
                        ? "hsl(var(--beam-green))"
                        : "var(--dash-border)",
                    background:
                      token === t ? "rgba(0,210,122,0.08)" : "transparent",
                    color: "var(--dash-text)",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Amount */}
            <label className="block">
              <span
                className="mb-1 block text-[11px] font-bold uppercase tracking-widest"
                style={{ color: "var(--dash-text-faint)" }}
              >
                Amount ({token})
              </span>
              <input
                type="number"
                inputMode="decimal"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-lg border px-3 py-3 text-lg outline-none"
                style={{
                  borderColor: "var(--dash-border)",
                  background: "var(--dash-surface)",
                  color: "var(--dash-text)",
                }}
              />
            </label>

            {/* Verification status */}
            {!isVerified && status?.eligibility !== undefined && (
              <div
                className="rounded-lg border px-3 py-2.5 text-xs leading-relaxed"
                style={{
                  borderColor: "rgba(245,158,11,0.4)",
                  background: "rgba(245,158,11,0.06)",
                  color: "var(--dash-text-muted)",
                }}
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <Icon
                    icon="ph:shield-warning-bold"
                    className="h-4 w-4 shrink-0"
                    style={{ color: "#f59e0b" }}
                  />
                  <span
                    className="text-sm font-semibold"
                    style={{ color: "var(--dash-text)" }}
                  >
                    This deposit will be screened by 0xbow
                  </span>
                </div>
                <p>
                  Your wallet isn't pre-verified. Funds enter a 0xbow KYT
                  screening queue (usually ≤15 min, max 5 days) before joining
                  the shielded set. For instant deposits, pre-verify with one
                  of:
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <a
                    href="https://www.coinbase.com/onchain-verify"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border px-2.5 py-1 text-[11px] underline-offset-2 hover:underline"
                    style={{
                      borderColor: "var(--dash-border)",
                      color: "var(--dash-text)",
                    }}
                  >
                    Coinbase ↗
                  </a>
                  <a
                    href="https://www.binance.com/en/babt"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border px-2.5 py-1 text-[11px] underline-offset-2 hover:underline"
                    style={{
                      borderColor: "var(--dash-border)",
                      color: "var(--dash-text)",
                    }}
                  >
                    Binance BABT ↗
                  </a>
                  <a
                    href="https://ethos.network"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border px-2.5 py-1 text-[11px] underline-offset-2 hover:underline"
                    style={{
                      borderColor: "var(--dash-border)",
                      color: "var(--dash-text)",
                    }}
                  >
                    Ethos Score ↗
                  </a>
                </div>
              </div>
            )}

            {/* Info rows */}
            <ul
              className="space-y-1.5 rounded-lg border px-3 py-2.5 text-xs"
              style={{
                borderColor: "var(--dash-border)",
                background: "var(--dash-surface)",
                color: "var(--dash-text-muted)",
              }}
            >
              <li className="flex justify-between">
                <span>Protocol fee</span>
                <span style={{ color: "var(--dash-text)" }}>
                  0.3% (first deposit per address free)
                </span>
              </li>
              <li className="flex justify-between">
                <span>Queue → shielded set</span>
                <span style={{ color: "var(--dash-text)" }}>
                  {isVerified ? "≈ 8 min" : "≈ 15 min (screening)"}
                </span>
              </li>
              <li className="flex justify-between">
                <span>Wallet registered</span>
                <span style={{ color: "var(--dash-text)" }}>
                  {isRegistered ? "Yes" : "Will register on first deposit"}
                </span>
              </li>
              <li className="flex justify-between">
                <span>Verification</span>
                <span style={{ color: "var(--dash-text)" }}>
                  {isVerified ? "Verified" : "0xbow KYT at deposit"}
                </span>
              </li>
            </ul>

            {/* Step status */}
            {step !== "idle" && step !== "error" && (
              <div
                className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs"
                style={{
                  borderColor: "var(--dash-border)",
                  background: "var(--dash-surface)",
                  color: "var(--dash-text)",
                }}
              >
                <Icon
                  icon="ph:circle-notch-bold"
                  className="h-3.5 w-3.5 animate-spin"
                  style={{ color: "hsl(var(--beam-green))" }}
                />
                <span>
                  {step === "registering" && "Registering deposit key…"}
                  {step === "approving" && "Approving USDC…"}
                  {step === "depositing" && "Submitting deposit…"}
                </span>
              </div>
            )}

            {errorMsg && (
              <div
                className="flex items-start gap-2 rounded-lg border px-3 py-2 text-xs"
                style={{
                  borderColor: "rgba(239,68,68,0.4)",
                  background: "rgba(239,68,68,0.08)",
                  color: "#ef4444",
                }}
              >
                <Icon icon="ph:warning-bold" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="break-all">{errorMsg}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full rounded-lg px-4 py-3 text-sm font-semibold transition-opacity disabled:opacity-50"
              style={{
                background: "hsl(var(--beam-green))",
                color: "#0a0a0a",
              }}
            >
              {step === "idle" || step === "error"
                ? `Deposit ${token}`
                : "Working…"}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default VeilDepositModal;
