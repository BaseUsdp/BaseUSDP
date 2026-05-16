/**
 * Veil private transfer modal — sends shielded USDC/ETH to another
 * Veil-registered address.  Both parties stay inside the pool; only
 * commitments and nullifiers appear on-chain.
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
type Step =
  | "idle"
  | "checking"
  | "proving"
  | "submitting"
  | "done"
  | "error";

interface Props {
  open: boolean;
  onClose: () => void;
  onTransferred?: () => void;
}

const VeilTransferModal = ({ open, onClose, onTransferred }: Props) => {
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
    if (["checking", "proving", "submitting"].includes(step)) return;
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

    try {
      const sdk = await import("@veil-cash/sdk");

      // Pre-check recipient registration.
      setStep("checking");
      setProgress("Checking recipient registration…");
      const reg = await sdk.checkRecipientRegistration(
        recipient as `0x${string}`
      );
      if (!reg.isRegistered) {
        setError(
          "Recipient is not registered on Veil. They must complete a first deposit before they can receive private transfers."
        );
        setStep("error");
        return;
      }

      setStep("proving");
      setProgress("Building proof…");
      const result = await sdk.transfer({
        amount,
        recipientAddress: recipient as `0x${string}`,
        senderKeypair: keypair,
        pool: token === "USDC" ? "usdc" : "eth",
        onProgress: (stage, detail) => {
          if (stage === "submitting") setStep("submitting");
          setProgress(detail ? `${stage} · ${detail}` : stage);
        },
      });
      setTxHash(result.transactionHash);
      setStep("done");
      onTransferred?.();
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
            <Icon icon="ph:arrows-left-right-bold" className="h-5 w-5" />
            Private transfer · Veil Pool
          </DialogTitle>
        </DialogHeader>

        {!keypair ? (
          <VeilConnectGate
            title="Sign in to Veil to send"
            description="Transferring inside the pool requires your Veil keypair to decrypt source UTXOs and build the ZK proof. The signature stays in your browser."
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
              <Icon
                icon="ph:check-circle-bold"
                className="mt-0.5 h-5 w-5 shrink-0"
              />
              <div className="space-y-1">
                <p className="font-semibold">Transfer sent privately</p>
                <p className="text-xs opacity-80">
                  Only commitments and nullifiers appear on-chain. Amount and
                  recipient are hidden.
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
                Recipient address · must be Veil-registered
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
                icon="ph:lock-bold"
                className="mr-1.5 inline h-3.5 w-3.5"
                style={{ color: "hsl(var(--beam-green))" }}
              />
              Both parties stay inside the pool. The amount is never revealed
              on-chain, only commitments and nullifiers.
            </div>

            {(step === "checking" ||
              step === "proving" ||
              step === "submitting") && (
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
                <Icon
                  icon="ph:warning-bold"
                  className="mt-0.5 h-3.5 w-3.5 shrink-0"
                />
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
                ? `Send ${token} privately`
                : "Working…"}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default VeilTransferModal;
