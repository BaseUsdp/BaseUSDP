import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { useWallet } from "@/contexts/WalletContext";
import WalletConnectButton from "@/components/WalletConnectButton";
import { getSmsStatus, postSmsClaim } from "@/services/smsService";
import { buildClaimCommitment } from "@/lib/sms/messages";
import { isValidClaimToken } from "@/lib/sms/token";
import { personalSign, type VeilWalletType } from "@/lib/veil/provider";
import type { EscrowPublic } from "@/lib/sms/types";

const STATUS_LABELS: Record<EscrowPublic["status"], string> = {
  pending: "Ready to claim",
  claimed: "Claimed",
  refunded: "Refunded to sender",
  expired: "Expired — can be refunded",
};

const SmsClaim = () => {
  const { token } = useParams<{ token: string }>();
  const { isConnected, fullWalletAddress, walletType } = useWallet();
  const [escrow, setEscrow] = useState<EscrowPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);

  const tokenValid = useMemo(
    () => Boolean(token && isValidClaimToken(token)),
    [token]
  );

  useEffect(() => {
    if (!tokenValid || !token) return;
    const ctrl = new AbortController();
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getSmsStatus(token, ctrl.signal);
        if (cancelled) return;
        setEscrow(res);
      } catch (err) {
        if (cancelled) return;
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [tokenValid, token]);

  async function handleClaim() {
    if (!token || !isConnected || !fullWalletAddress) return;
    setClaiming(true);
    setError(null);
    try {
      const commitment = buildClaimCommitment({
        claimToken: token,
        recipient: fullWalletAddress,
      });
      const wtype: VeilWalletType =
        walletType === "metamask" || walletType === "phantom"
          ? walletType
          : null;
      const sig = await personalSign(wtype, fullWalletAddress, commitment);
      const res = await postSmsClaim(token, {
        recipient: fullWalletAddress as `0x${string}`,
        recipientSig: sig as `0x${string}`,
      });
      setEscrow(res.escrow);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: "var(--dash-bg, #0a0a0a)" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl border p-6 space-y-5"
        style={{
          borderColor: "var(--dash-border)",
          background: "var(--dash-surface)",
        }}
      >
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-xs"
          style={{ color: "var(--dash-text-faint)" }}
        >
          <Icon icon="ph:arrow-left-bold" className="h-3.5 w-3.5" />
          BASEUSDP
        </Link>

        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest" style={{ color: "hsl(var(--beam-cyan))" }}>
            <Icon icon="ph:lock-key-bold" className="h-3.5 w-3.5" />
            Private USDC claim
          </div>
          <h1
            className="font-display mt-2 text-2xl font-bold"
            style={{ color: "var(--dash-text)" }}
          >
            Claim your SMS payment
          </h1>
          <p
            className="mt-1 text-xs leading-relaxed"
            style={{ color: "var(--dash-text-muted)" }}
          >
            Connect a wallet to receive these funds. The sender authorized this
            claim against the phone number that received the SMS — no other
            wallet can claim it.
          </p>
        </div>

        {!tokenValid && (
          <div
            className="rounded-md border p-3 text-xs"
            style={{
              borderColor: "rgba(239,68,68,0.4)",
              background: "rgba(239,68,68,0.08)",
              color: "#ef4444",
            }}
          >
            Invalid claim link.
          </div>
        )}

        {tokenValid && loading && (
          <div className="flex items-center gap-2 text-sm" style={{ color: "var(--dash-text-muted)" }}>
            <Icon icon="ph:spinner-bold" className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        )}

        {tokenValid && error && (
          <div
            className="rounded-md border p-3 text-xs"
            style={{
              borderColor: "rgba(239,68,68,0.4)",
              background: "rgba(239,68,68,0.08)",
              color: "#ef4444",
            }}
          >
            {error}
          </div>
        )}

        {escrow && (
          <div className="space-y-3">
            <div
              className="rounded-lg border p-4"
              style={{
                borderColor: "var(--dash-border)",
                background: "var(--dash-overlay)",
              }}
            >
              <div
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: "var(--dash-text-faint)" }}
              >
                Amount
              </div>
              <div
                className="font-display text-3xl font-bold"
                style={{ color: "var(--dash-text)" }}
              >
                ${escrow.amount}{" "}
                <span
                  className="text-base font-semibold"
                  style={{ color: "var(--dash-text-muted)" }}
                >
                  USDC
                </span>
              </div>
              {escrow.note && (
                <p
                  className="mt-2 text-xs italic"
                  style={{ color: "var(--dash-text-muted)" }}
                >
                  "{escrow.note}"
                </p>
              )}
              <div
                className="mt-3 grid grid-cols-2 gap-2 text-[11px]"
                style={{ color: "var(--dash-text-muted)" }}
              >
                <div>
                  <div className="font-semibold uppercase tracking-widest" style={{ color: "var(--dash-text-faint)" }}>From</div>
                  <div className="font-mono break-all" style={{ color: "var(--dash-text)" }}>
                    {escrow.sender.slice(0, 6)}…{escrow.sender.slice(-4)}
                  </div>
                </div>
                <div>
                  <div className="font-semibold uppercase tracking-widest" style={{ color: "var(--dash-text-faint)" }}>Expires</div>
                  <div style={{ color: "var(--dash-text)" }}>
                    {new Date(escrow.expiresAt).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            <div
              className="rounded-md border px-3 py-2 text-[11px]"
              style={{
                borderColor: "var(--dash-border)",
                background: "var(--dash-surface)",
                color: "var(--dash-text-muted)",
              }}
            >
              Status:{" "}
              <span
                className="font-semibold"
                style={{
                  color:
                    escrow.status === "pending"
                      ? "hsl(var(--beam-green))"
                      : escrow.status === "claimed"
                      ? "hsl(var(--beam-cyan))"
                      : "hsl(var(--beam-amber))",
                }}
              >
                {STATUS_LABELS[escrow.status]}
              </span>
            </div>

            {escrow.status === "pending" && (
              <>
                {!isConnected ? (
                  <div className="flex flex-col items-stretch gap-2">
                    <WalletConnectButton variant="navbar" />
                    <p
                      className="text-center text-[11px]"
                      style={{ color: "var(--dash-text-faint)" }}
                    >
                      Any wallet works — MetaMask, Coinbase Wallet, Phantom EVM,
                      WalletConnect.
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleClaim}
                    disabled={claiming}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {claiming ? (
                      <>
                        <Icon
                          icon="ph:spinner-bold"
                          className="h-4 w-4 animate-spin"
                        />
                        Claiming…
                      </>
                    ) : (
                      <>
                        <Icon icon="ph:check-circle-bold" className="h-4 w-4" />
                        Sign & claim
                      </>
                    )}
                  </button>
                )}
              </>
            )}

            {escrow.status === "claimed" && escrow.recipient && (
              <div
                className="rounded-md border p-3 text-xs"
                style={{
                  borderColor: "hsl(var(--beam-green))",
                  background: "rgba(0,210,122,0.08)",
                  color: "var(--dash-text)",
                }}
              >
                Claimed by {escrow.recipient.slice(0, 6)}…
                {escrow.recipient.slice(-4)} on{" "}
                {escrow.settledAt
                  ? new Date(escrow.settledAt).toLocaleString()
                  : "—"}
                .
              </div>
            )}

            {escrow.status === "refunded" && (
              <div
                className="rounded-md border p-3 text-xs"
                style={{
                  borderColor: "var(--dash-border)",
                  background: "var(--dash-overlay)",
                  color: "var(--dash-text-muted)",
                }}
              >
                These funds were refunded to the sender.
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default SmsClaim;
