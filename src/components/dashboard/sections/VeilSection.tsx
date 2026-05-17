import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { useWallet } from "@/contexts/WalletContext";
import { useVeil } from "@/contexts/VeilContext";
import VeilEntryCard from "@/components/veil/VeilEntryCard";
import VeilStatusBadge from "@/components/veil/VeilStatusBadge";
import VeilBalanceCard from "@/components/veil/VeilBalanceCard";
import VeilPrivateBalanceCard from "@/components/veil/VeilPrivateBalanceCard";
import VeilDisclosure from "@/components/veil/VeilDisclosure";
import VeilDepositModal from "@/components/veil/VeilDepositModal";
import VeilWithdrawModal from "@/components/veil/VeilWithdrawModal";
import VeilTransferModal from "@/components/veil/VeilTransferModal";
import {
  fetchVeilQueueBalance,
  fetchVeilStatus,
  type VeilQueueBalance,
  type VeilStatus,
} from "@/services/veilService";

interface VeilSectionProps {
  showBalance: boolean;
}

type ActiveModal = "deposit" | "withdraw" | "transfer" | null;

const VEIL_WHITELIST = new Set([
  "0x7d8d501ddcb0e5fda674d5b356c25fb08d5865c5",
]);

const VEIL_GATED_HINT =
  "Veil Pool is in closed beta — opening to all users soon.";

const VeilSection = ({ showBalance }: VeilSectionProps) => {
  const { fullWalletAddress, isConnected } = useWallet();
  const { keypair, disconnect } = useVeil();
  const [status, setStatus] = useState<VeilStatus | null>(null);
  const [balance, setBalance] = useState<VeilQueueBalance | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ActiveModal>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const lastWalletRef = useRef<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function load() {
      setStatusLoading(true);
      setBalanceLoading(true);
      setError(null);
      try {
        const [statusRes, balanceRes] = await Promise.all([
          fetchVeilStatus(
            isConnected ? fullWalletAddress : undefined,
            controller.signal
          ),
          isConnected && fullWalletAddress
            ? fetchVeilQueueBalance(fullWalletAddress, controller.signal)
            : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setStatus(statusRes);
        setBalance(balanceRes);
        lastWalletRef.current = isConnected ? fullWalletAddress : null;
      } catch (err) {
        if (cancelled) return;
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) {
          setStatusLoading(false);
          setBalanceLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [fullWalletAddress, isConnected, reloadTick]);

  const refresh = () => setReloadTick((t) => t + 1);

  const isWhitelisted =
    !!fullWalletAddress &&
    VEIL_WHITELIST.has(fullWalletAddress.toLowerCase());

  const actions = [
    {
      id: "deposit" as const,
      label: "Deposit",
      icon: "ph:arrow-down-bold",
      desc: "Move USDC or ETH into the shielded set",
      disabled: !isWhitelisted,
      hint: isWhitelisted ? undefined : VEIL_GATED_HINT,
    },
    {
      id: "withdraw" as const,
      label: "Withdraw",
      icon: "ph:arrow-up-bold",
      desc: "Send private balance to a public address",
      disabled: !isWhitelisted,
      hint: isWhitelisted ? undefined : VEIL_GATED_HINT,
    },
    {
      id: "transfer" as const,
      label: "Private transfer",
      icon: "ph:arrows-left-right-bold",
      desc: "Send privately to another Veil user",
      disabled: !isWhitelisted,
      hint: isWhitelisted ? undefined : VEIL_GATED_HINT,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 p-4 sm:p-6"
    >
      {/* Header */}
      <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl font-bold">
              Veil Pool<span className="text-primary">.</span>
            </h1>
            <span
              className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
              style={{
                borderColor: "hsl(var(--beam-green))",
                color: "hsl(var(--beam-green))",
              }}
            >
              Powered by veil.cash
            </span>
          </div>
          <p className="text-muted-foreground mt-1">
            A second private USDC route, powered by veil.cash on Base. Separate
            pool, separate anonymity set, same wallet.
          </p>
        </div>
        {keypair && (
          <button
            type="button"
            onClick={disconnect}
            className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
            style={{
              borderColor: "var(--dash-border)",
              color: "var(--dash-text-muted)",
            }}
          >
            <Icon icon="ph:sign-out-bold" className="h-3.5 w-3.5" />
            Sign out of Veil
          </button>
        )}
      </div>

      <VeilEntryCard />

      <VeilDisclosure />

      {/* Status row */}
      <div className="space-y-3">
        <p
          className="text-[11px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--dash-text-faint)" }}
        >
          Status
        </p>
        <VeilStatusBadge status={status} loading={statusLoading} />
      </div>

      {error && (
        <div
          className="flex items-start gap-2 rounded-lg border px-4 py-3 text-xs"
          style={{
            borderColor: "rgba(239,68,68,0.4)",
            background: "rgba(239,68,68,0.08)",
            color: "#ef4444",
          }}
        >
          <Icon icon="ph:warning-bold" className="mt-0.5 h-4 w-4 shrink-0" />
          <div>{error}</div>
        </div>
      )}

      {/* Action buttons */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {actions.map((a) => (
          <button
            key={a.id}
            type="button"
            disabled={!isConnected || a.disabled}
            onClick={() => setModal(a.id)}
            title={a.hint}
            className="flex items-start gap-3 rounded-xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              borderColor: "var(--dash-border)",
              background: "var(--dash-overlay)",
            }}
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
              style={{
                background: "rgba(0,210,122,0.10)",
                color: "hsl(var(--beam-green))",
              }}
            >
              <Icon icon={a.icon} className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <p
                  className="text-sm font-semibold"
                  style={{ color: "var(--dash-text)" }}
                >
                  {a.label}
                </p>
                {a.disabled && (
                  <span
                    className="rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest"
                    style={{
                      borderColor: "var(--dash-border)",
                      color: "var(--dash-text-muted)",
                    }}
                  >
                    Soon
                  </span>
                )}
              </div>
              <p
                className="mt-0.5 text-[11px] leading-relaxed"
                style={{ color: "var(--dash-text-muted)" }}
              >
                {a.desc}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Balances */}
      {isConnected ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <VeilBalanceCard
            balance={balance}
            loading={balanceLoading}
            showBalance={showBalance}
            walletConnected={isConnected}
          />
          {keypair ? (
            <VeilPrivateBalanceCard showBalance={showBalance} />
          ) : (
            <div
              className="rounded-xl border p-4 text-sm"
              style={{
                borderColor: "var(--dash-border)",
                background: "var(--dash-overlay)",
                color: "var(--dash-text-muted)",
              }}
            >
              <div className="mb-2 flex items-center gap-2">
                <Icon
                  icon="ph:lock-key-bold"
                  className="h-4 w-4"
                  style={{ color: "hsl(var(--beam-amber))" }}
                />
                <span
                  className="text-sm font-semibold"
                  style={{ color: "var(--dash-text)" }}
                >
                  Shielded balance
                </span>
              </div>
              Sign in to Veil (one wallet signature) to decrypt your private
              balance.
            </div>
          )}
        </div>
      ) : (
        <div
          className="rounded-xl border p-4 text-sm"
          style={{
            borderColor: "var(--dash-border)",
            background: "var(--dash-overlay)",
            color: "var(--dash-text-muted)",
          }}
        >
          Connect a wallet to see queue and registration status for this
          address on Veil.
        </div>
      )}

      {/* Contract addresses */}
      {status?.addresses && (
        <details
          className="rounded-xl border p-4"
          style={{
            borderColor: "var(--dash-border)",
            background: "var(--dash-overlay)",
          }}
        >
          <summary
            className="cursor-pointer text-sm font-semibold"
            style={{ color: "var(--dash-text)" }}
          >
            On-chain addresses (Base · chain {status.addresses.chainId})
          </summary>
          <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            {[
              ["Entry", status.addresses.entry],
              ["USDC Pool", status.addresses.usdcPool],
              ["USDC Queue", status.addresses.usdcQueue],
              ["USDC Token", status.addresses.usdcToken],
              ["ETH Pool", status.addresses.ethPool],
              ["ETH Queue", status.addresses.ethQueue],
              ["Forwarder Factory", status.addresses.forwarderFactory],
              ["Relay", status.addresses.relayUrl],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex flex-col rounded-md border px-3 py-2"
                style={{
                  borderColor: "var(--dash-border)",
                  background: "var(--dash-surface)",
                }}
              >
                <span
                  className="text-[10px] uppercase tracking-widest"
                  style={{ color: "var(--dash-text-faint)" }}
                >
                  {label}
                </span>
                <span
                  className="mt-0.5 font-mono text-[11px] break-all"
                  style={{ color: "var(--dash-text)" }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Modals */}
      <VeilDepositModal
        open={modal === "deposit"}
        onClose={() => setModal(null)}
        onDeposited={refresh}
      />
      <VeilWithdrawModal
        open={modal === "withdraw"}
        onClose={() => setModal(null)}
        onWithdrawn={refresh}
      />
      <VeilTransferModal
        open={modal === "transfer"}
        onClose={() => setModal(null)}
        onTransferred={refresh}
      />
    </motion.div>
  );
};

export default VeilSection;
