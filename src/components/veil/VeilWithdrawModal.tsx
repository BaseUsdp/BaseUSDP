/**
 * Veil withdraw modal — pulls private USDC/ETH out of the pool to a public
 * address.  The ZK proof is built client-side and submitted to Veil's relay,
 * so the user never pays gas.
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Icon } from "@iconify/react";
import { useVeil } from "@/contexts/VeilContext";
import VeilConnectGate from "./VeilConnectGate";

type Token = "USDC" | "ETH";
type Step = "idle" | "proving" | "submitting" | "done" | "error";

interface Props {
  open: boolean;
  onClose: () => void;
  onWithdrawn?: () => void;
}

const VeilWithdrawModal = ({ open, onClose, onWithdrawn }: Props) => {
  const { keypair } = useVeil();
  const [token, setToken] = useState<Token>("USDC");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [progress, setProgress] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const reset = () => {
    setAmount("");
    setRecipient("");
    setStep("idle");
    setProgress("");
    setError(null);
    setTxHash(null);
  };

  const close = () => {
    if (step === "proving" || step === "submitting") return;
    reset();
    onClose();
  };

  const amountNum = parseFloat(amount || "0");
  const recipientValid = /^0x[a-fA-F0-9]{40}$/.test(recipient);
  const canSubmit =
    !!keypair && amountNum > 0 && recipientValid && step === "idle";

  const handleSubmit = async () => {
    if (!keypair) return;
    setError(null);
    setTxHash(null);
    setStep("proving");
    setProgress("Building proof…");
    try {
      const sdk = await import("@veil-cash/sdk");
      const result = await sdk.withdraw({
        amount,
        recipient: recipient as `0x${string}`,
        keypair,
        pool: token === "USDC" ? "usdc" : "eth",
        provingKeyPath: "/veil-keys",
        onProgress: (stage, detail) => {
          if (stage === "submitting") setStep("submitting");
          setProgress(detail ? `${stage} · ${detail}` : stage);
        },
      });
      setTxHash(result.transactionHash);
      setStep("done");
      onWithdrawn?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setStep("error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? close() : undefined)}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon icon="ph:arrow-up-bold" className="h-5 w-5" />
            Withdraw from Veil Pool
          </DialogTitle>
        </DialogHeader>

        {!keypair ? (
          <VeilConnectGate
            title="Sign in to Veil to access private balance"
            description="Withdrawing requires decrypting your private UTXOs and generating a ZK proof locally. We need your Veil keypair, which is derived from a single wallet signature."
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
                <p className="font-semibold">Withdrawal broadcast</p>
                <p className="text-xs opacity-80">
                  Veil's relay submitted your withdrawal on-chain.
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

            <label className="block">
              <span
                className="mb-1 block text-[11px] font-bold uppercase tracking-widest"
                style={{ color: "var(--dash-text-faint)" }}
              >
                Public recipient
              </span>
              <input
                type="text"
                placeholder="0x…"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="w-full rounded-lg border px-3 py-3 font-mono text-sm outline-none"
                style={{
                  borderColor: "var(--dash-border)",
                  background: "var(--dash-surface)",
                  color: "var(--dash-text)",
                }}
              />
            </label>

            <div
              className="rounded-lg border px-3 py-2.5 text-xs"
              style={{
                borderColor: "var(--dash-border)",
                background: "var(--dash-surface)",
                color: "var(--dash-text-muted)",
              }}
            >
              <Icon
                icon="ph:lightning-bold"
                className="mr-1.5 inline h-3.5 w-3.5"
                style={{ color: "hsl(var(--beam-amber))" }}
              />
              Proof is built in your browser and submitted to Veil's relay.
              Withdrawals are gasless on your wallet.
            </div>

            {(step === "proving" || step === "submitting") && (
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
                <span>{progress || "Working…"}</span>
              </div>
            )}

            {error && (
              <div
                className="flex items-start gap-2 rounded-lg border px-3 py-2 text-xs"
                style={{
                  borderColor: "rgba(239,68,68,0.4)",
                  background: "rgba(239,68,68,0.08)",
                  color: "#ef4444",
                }}
              >
                <Icon icon="ph:warning-bold" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="break-all">{error}</span>
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
                ? `Withdraw ${token}`
                : "Working…"}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default VeilWithdrawModal;
