/**
 * Private (shielded) balance — only meaningful once the user has signed
 * into Veil.  Reads UTXOs client-side via the SDK and decrypts them with
 * the keypair held in VeilContext.  Server never sees the key.
 */
import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import { useVeil } from "@/contexts/VeilContext";

interface Props {
  showBalance: boolean;
}

interface BalanceState {
  usdc: { amount: string; unspent: number } | null;
  eth: { amount: string; unspent: number } | null;
}

const VeilPrivateBalanceCard = ({ showBalance }: Props) => {
  const { keypair } = useVeil();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<BalanceState>({
    usdc: null,
    eth: null,
  });

  useEffect(() => {
    if (!keypair) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const sdk = await import("@veil-cash/sdk");
        const [usdc, eth] = await Promise.all([
          sdk
            .getPrivateBalance({ keypair, pool: "usdc" })
            .catch(() => null),
          sdk
            .getPrivateBalance({ keypair, pool: "eth" })
            .catch(() => null),
        ]);
        if (cancelled) return;
        setBalance({
          usdc: usdc
            ? { amount: usdc.privateBalance, unspent: usdc.unspentCount }
            : null,
          eth: eth
            ? { amount: eth.privateBalance, unspent: eth.unspentCount }
            : null,
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [keypair]);

  if (!keypair) return null;

  const fmt = (raw: string | undefined, decimals: number) => {
    if (!raw) return "0";
    const n = Number(raw);
    if (!Number.isFinite(n)) return "0";
    return n.toLocaleString(undefined, {
      minimumFractionDigits: n === 0 ? 0 : decimals,
      maximumFractionDigits: decimals,
    });
  };

  const row = (
    symbol: string,
    icon: string,
    data: BalanceState["usdc"],
    decimals: number
  ) => {
    const display = loading
      ? "Loading…"
      : !showBalance
      ? "••••"
      : fmt(data?.amount, decimals);

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
              {data
                ? `${data.unspent} unspent UTXO${data.unspent === 1 ? "" : "s"}`
                : "Shielded set"}
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
            Private
          </p>
        </div>
      </div>
    );
  };

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
            icon="ph:lock-key-bold"
            className="h-4 w-4"
            style={{ color: "hsl(var(--beam-green))" }}
          />
          <h3
            className="text-sm font-semibold"
            style={{ color: "var(--dash-text)" }}
          >
            Shielded balance
          </h3>
        </div>
        <p
          className="text-[10px] uppercase tracking-widest"
          style={{ color: "var(--dash-text-faint)" }}
        >
          Decrypted locally
        </p>
      </div>
      <div className="space-y-2">
        {row("USDC", "cryptocurrency:usdc", balance.usdc, 2)}
        {row("ETH", "cryptocurrency:eth", balance.eth, 4)}
      </div>
      {error && (
        <div
          className="mt-3 flex items-start gap-2 rounded-md border px-3 py-2 text-[11px]"
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
    </motion.div>
  );
};

export default VeilPrivateBalanceCard;
