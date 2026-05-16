import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import type { VeilQueueBalance } from "@/services/veilService";

interface Props {
  balance: VeilQueueBalance | null;
  loading: boolean;
  showBalance: boolean;
  walletConnected: boolean;
}

const fmt = (amount: string, decimals = 4) => {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: n === 0 ? 0 : decimals,
    maximumFractionDigits: decimals,
  });
};

const TokenRow = ({
  symbol,
  icon,
  amount,
  pendingCount,
  showBalance,
  loading,
  walletConnected,
  decimals,
}: {
  symbol: string;
  icon: string;
  amount: string;
  pendingCount: number;
  showBalance: boolean;
  loading: boolean;
  walletConnected: boolean;
  decimals: number;
}) => {
  const display = !walletConnected
    ? "—"
    : loading
    ? "Loading…"
    : !showBalance
    ? "••••"
    : fmt(amount, decimals);

  return (
    <div
      className="flex items-center justify-between rounded-lg border px-4 py-3"
      style={{
        borderColor: "var(--dash-border)",
        background: "var(--dash-surface)",
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{
            background: "rgba(0,210,122,0.10)",
            color: "hsl(var(--beam-green))",
          }}
        >
          <Icon icon={icon} className="h-4 w-4" />
        </div>
        <div>
          <p
            className="text-sm font-semibold"
            style={{ color: "var(--dash-text)" }}
          >
            {symbol}
          </p>
          <p
            className="text-[11px]"
            style={{ color: "var(--dash-text-muted)" }}
          >
            {pendingCount > 0
              ? `${pendingCount} pending deposit${pendingCount > 1 ? "s" : ""}`
              : "Queue balance"}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p
          className="text-base font-semibold tabular-nums"
          style={{ color: "var(--dash-text)" }}
        >
          {display}
        </p>
        <p
          className="text-[10px] uppercase tracking-widest"
          style={{ color: "var(--dash-text-faint)" }}
        >
          Queue
        </p>
      </div>
    </div>
  );
};

const VeilBalanceCard = ({
  balance,
  loading,
  showBalance,
  walletConnected,
}: Props) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-xl border p-4"
      style={{
        borderColor: "var(--dash-border)",
        background: "var(--dash-overlay)",
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon
            icon="ph:vault-bold"
            className="h-4 w-4"
            style={{ color: "hsl(var(--beam-green))" }}
          />
          <h3 className="text-sm font-semibold" style={{ color: "var(--dash-text)" }}>
            Veil queue balances
          </h3>
        </div>
        <p
          className="text-[10px] uppercase tracking-widest"
          style={{ color: "var(--dash-text-faint)" }}
        >
          Public on-chain
        </p>
      </div>
      <div className="space-y-2">
        <TokenRow
          symbol="USDC"
          icon="cryptocurrency:usdc"
          amount={balance?.usdc.queueAmount ?? "0"}
          pendingCount={balance?.usdc.pendingCount ?? 0}
          showBalance={showBalance}
          loading={loading}
          walletConnected={walletConnected}
          decimals={2}
        />
        <TokenRow
          symbol="ETH"
          icon="cryptocurrency:eth"
          amount={balance?.eth.queueAmount ?? "0"}
          pendingCount={balance?.eth.pendingCount ?? 0}
          showBalance={showBalance}
          loading={loading}
          walletConnected={walletConnected}
          decimals={4}
        />
      </div>

      <div
        className="mt-4 rounded-md border px-3 py-2 text-[11px]"
        style={{
          borderColor: "var(--dash-border)",
          background: "var(--dash-surface)",
          color: "var(--dash-text-muted)",
        }}
      >
        <Icon
          icon="ph:lock-bold"
          className="mr-1.5 inline h-3.5 w-3.5"
          style={{ color: "hsl(var(--beam-amber))" }}
        />
        Private (shielded) balance is only visible after you sign in with
        Veil. Coming in the next phase.
      </div>
    </motion.div>
  );
};

export default VeilBalanceCard;
