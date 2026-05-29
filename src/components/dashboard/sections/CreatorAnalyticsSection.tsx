import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { createWalletClient, custom } from "viem";
import { base } from "viem/chains";
import { wrapFetchWithPayment } from "x402-fetch";
import { useWallet, getEvmProviderForType } from "@/contexts/WalletContext";
import { getApiUrl } from "@/utils/apiConfig";

interface TopTipper {
  handle: string | null;
  address: string;
  total: number;
  count: number;
}

interface Stats {
  handle: string;
  total_received: number;
  tip_count: number;
  unique_tippers: number;
  top_tippers: TopTipper[];
  first_tip_at: string | null;
  last_tip_at: string | null;
}

const CreatorAnalyticsSection = () => {
  const { isConnected, walletType, fullWalletAddress } = useWallet();
  const [handleInput, setHandleInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [paidTx, setPaidTx] = useState<string | null>(null);

  // Pre-fill with the logged-in user's own handle for convenience.
  useEffect(() => {
    const loadOwnHandle = async () => {
      if (!fullWalletAddress) return;
      try {
        const res = await fetch(
          `${getApiUrl()}/api/user/profile?wallet=${encodeURIComponent(fullWalletAddress)}`,
        );
        const data = await res.json();
        if (data?.success && data.profile?.has_custom_username && data.profile?.username) {
          setHandleInput(data.profile.username);
        }
      } catch {
        // best-effort prefill only
      }
    };
    loadOwnHandle();
  }, [fullWalletAddress]);

  const unlock = async () => {
    const handle = handleInput.trim().replace(/^@/, "");
    if (!handle) {
      setError("Enter a handle to look up.");
      return;
    }
    if (!isConnected || !fullWalletAddress) {
      setError("Connect your wallet first.");
      return;
    }
    const provider = getEvmProviderForType(walletType);
    if (!provider) {
      setError("No EVM wallet provider available.");
      return;
    }

    setError(null);
    setStats(null);
    setPaidTx(null);
    setLoading(true);
    try {
      const walletClient = createWalletClient({
        account: fullWalletAddress as `0x${string}`,
        chain: base,
        transport: custom(provider as any),
      });
      // wrapFetchWithPayment signs the x402 payment (default cap 0.10 USDC;
      // this endpoint charges 0.01) and retries with the X-PAYMENT header.
      const fetchWithPay = wrapFetchWithPayment(fetch, walletClient as any);
      const url = `${getApiUrl()}/api/x402/creator-stats?handle=${encodeURIComponent(handle)}`;
      const res = await fetchWithPay(url);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Request failed (${res.status})`);
      }
      const data = await res.json();
      setStats(data.stats);
      const payHeader = res.headers.get("X-PAYMENT-RESPONSE");
      if (payHeader) {
        try {
          const decoded = JSON.parse(atob(payHeader));
          if (decoded?.transaction) setPaidTx(decoded.transaction);
        } catch {
          /* header is opaque — fine */
        }
      }
    } catch (err: any) {
      const msg = err?.message || "Payment or lookup failed.";
      setError(
        /rejected|denied|user/i.test(msg)
          ? "Payment cancelled in wallet."
          : msg,
      );
    } finally {
      setLoading(false);
    }
  };

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border bg-card p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <Icon icon="ph:chart-line-up-bold" className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-lg font-bold">Creator Analytics</h2>
            <p className="text-xs text-muted-foreground">
              Enriched stats for any opted-in creator. Unlocks for $0.01 USDC, paid from your wallet via x402.
            </p>
          </div>
        </div>

        <div className="flex items-stretch gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3">
            <Icon icon="ph:at-bold" className="h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="handle"
              value={handleInput}
              onChange={(e) => setHandleInput(e.target.value)}
              className="flex-1 bg-transparent py-2 text-sm outline-none"
              maxLength={30}
            />
          </div>
          <button
            type="button"
            onClick={unlock}
            disabled={loading || !handleInput.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <Icon icon="ph:circle-notch-bold" className="h-4 w-4 animate-spin" />
                Paying…
              </>
            ) : (
              <>
                <Icon icon="ph:lock-key-open-bold" className="h-4 w-4" />
                Unlock — $0.01
              </>
            )}
          </button>
        </div>

        {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
      </motion.div>

      {stats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card p-6 space-y-5"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-bold">{stats.handle}</h3>
            {paidTx && (
              <a
                href={`https://basescan.org/tx/${paidTx}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-emerald-500 hover:underline"
              >
                <Icon icon="ph:check-circle-bold" className="h-3.5 w-3.5" />
                Paid $0.01
              </a>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-secondary/30 p-3">
              <p className="text-xs text-muted-foreground">Total received</p>
              <p className="text-lg font-bold">${stats.total_received.toFixed(2)}</p>
            </div>
            <div className="rounded-xl bg-secondary/30 p-3">
              <p className="text-xs text-muted-foreground">Tips</p>
              <p className="text-lg font-bold">{stats.tip_count}</p>
            </div>
            <div className="rounded-xl bg-secondary/30 p-3">
              <p className="text-xs text-muted-foreground">Unique tippers</p>
              <p className="text-lg font-bold">{stats.unique_tippers}</p>
            </div>
          </div>

          {stats.top_tippers.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Top tippers</p>
              <div className="space-y-1.5">
                {stats.top_tippers.map((t, i) => (
                  <div
                    key={t.address}
                    className="flex items-center justify-between rounded-lg bg-secondary/20 px-3 py-2 text-sm"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span className="text-muted-foreground w-4">{i + 1}.</span>
                      <span className="font-medium truncate">
                        {t.handle ?? `${t.address.slice(0, 6)}…${t.address.slice(-4)}`}
                      </span>
                      <span className="text-xs text-muted-foreground">({t.count})</span>
                    </span>
                    <span className="font-mono font-semibold">${t.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>First tip: {fmtDate(stats.first_tip_at)}</span>
            <span>·</span>
            <span>Last tip: {fmtDate(stats.last_tip_at)}</span>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default CreatorAnalyticsSection;
