import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { createWalletClient, custom } from "viem";
import { base } from "viem/chains";
import { wrapFetchWithPayment } from "x402-fetch";
import { useWallet, getEvmProviderForType } from "@/contexts/WalletContext";
import { getApiUrl } from "@/utils/apiConfig";
import { authService } from "@/services/authService";

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

  // Bulk-resolve state.
  const [bulkInput, setBulkInput] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkResults, setBulkResults] = useState<
    { handle: string; address?: string; error?: string }[] | null
  >(null);
  const [bulkPaidTx, setBulkPaidTx] = useState<string | null>(null);
  const [bulkFree, setBulkFree] = useState(false);

  // Leaderboard state.
  type LbWindow = "day" | "week" | "month" | "all";
  interface LbEntry {
    rank: number;
    handle: string | null;
    address: string | null;
    received: number;
    tip_count: number;
    unique_tippers: number;
  }
  interface LbData {
    window: LbWindow;
    total_creators: number;
    total_volume: number;
    total_tippers: number;
    leaderboard: LbEntry[];
  }
  const [lbWindow, setLbWindow] = useState<LbWindow>("week");
  const [lbLoading, setLbLoading] = useState(false);
  const [lbError, setLbError] = useState<string | null>(null);
  const [lbData, setLbData] = useState<LbData | null>(null);
  const [lbFree, setLbFree] = useState(false);
  const [lbPaidTx, setLbPaidTx] = useState<string | null>(null);

  const loadLeaderboard = async (windowParam: LbWindow) => {
    if (!isConnected || !fullWalletAddress) {
      setLbError("Connect your wallet first.");
      return;
    }
    const provider = getEvmProviderForType(walletType);
    if (!provider) {
      setLbError("No EVM wallet provider available.");
      return;
    }
    setLbError(null);
    setLbData(null);
    setLbPaidTx(null);
    setLbFree(false);
    setLbLoading(true);
    try {
      const walletClient = createWalletClient({
        account: fullWalletAddress as `0x${string}`,
        chain: base,
        transport: custom(provider as any),
      });
      const fetchWithPay = wrapFetchWithPayment(fetch, walletClient as any);
      const token = authService.getSessionToken();
      const url = `${getApiUrl()}/api/x402/leaderboard?window=${windowParam}&limit=10`;
      const res = await fetchWithPay(
        url,
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Request failed (${res.status})`);
      }
      const data = await res.json();
      setLbData({
        window: data.window,
        total_creators: data.total_creators,
        total_volume: data.total_volume,
        total_tippers: data.total_tippers,
        leaderboard: data.leaderboard ?? [],
      });
      setLbFree(!!data.free);
      const payHeader = res.headers.get("X-PAYMENT-RESPONSE");
      if (payHeader) {
        try {
          const decoded = JSON.parse(atob(payHeader));
          if (decoded?.transaction) setLbPaidTx(decoded.transaction);
        } catch {
          /* opaque header — fine */
        }
      }
    } catch (err: any) {
      const msg = err?.message || "Couldn't load leaderboard.";
      setLbError(
        /rejected|denied|user/i.test(msg)
          ? "Payment cancelled in wallet."
          : msg,
      );
    } finally {
      setLbLoading(false);
    }
  };

  // Auto-load on mount + window change.
  useEffect(() => {
    if (fullWalletAddress && isConnected) {
      void loadLeaderboard(lbWindow);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullWalletAddress, isConnected, lbWindow]);

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
      // The bearer token lets the server grant free access when you're
      // viewing your *own* analytics — in that case it returns 200 directly
      // and no payment / wallet prompt happens.
      const fetchWithPay = wrapFetchWithPayment(fetch, walletClient as any);
      const url = `${getApiUrl()}/api/x402/creator-stats?handle=${encodeURIComponent(handle)}`;
      const token = authService.getSessionToken();
      const res = await fetchWithPay(
        url,
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
      );
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

  const unlockBulk = async () => {
    // Split on commas, spaces, newlines; drop empties and strip leading @
    const handles = bulkInput
      .split(/[\s,]+/)
      .map((h) => h.trim().replace(/^@/, ""))
      .filter((h) => h.length > 0);
    if (handles.length === 0) {
      setBulkError("Enter one or more handles, separated by commas or newlines.");
      return;
    }
    if (handles.length > 50) {
      setBulkError("Max 50 handles per call.");
      return;
    }
    if (!isConnected || !fullWalletAddress) {
      setBulkError("Connect your wallet first.");
      return;
    }
    const provider = getEvmProviderForType(walletType);
    if (!provider) {
      setBulkError("No EVM wallet provider available.");
      return;
    }

    setBulkError(null);
    setBulkResults(null);
    setBulkPaidTx(null);
    setBulkFree(false);
    setBulkLoading(true);
    try {
      const walletClient = createWalletClient({
        account: fullWalletAddress as `0x${string}`,
        chain: base,
        transport: custom(provider as any),
      });
      const fetchWithPay = wrapFetchWithPayment(fetch, walletClient as any);
      const token = authService.getSessionToken();
      const url = `${getApiUrl()}/api/x402/bulk-resolve`;
      const res = await fetchWithPay(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ handles }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Request failed (${res.status})`);
      }
      const data = await res.json();
      setBulkResults(data.results ?? []);
      setBulkFree(!!data.free);
      const payHeader = res.headers.get("X-PAYMENT-RESPONSE");
      if (payHeader) {
        try {
          const decoded = JSON.parse(atob(payHeader));
          if (decoded?.transaction) setBulkPaidTx(decoded.transaction);
        } catch {
          /* opaque header — fine */
        }
      }
    } catch (err: any) {
      const msg = err?.message || "Payment or lookup failed.";
      setBulkError(
        /rejected|denied|user/i.test(msg)
          ? "Payment cancelled in wallet."
          : msg,
      );
    } finally {
      setBulkLoading(false);
    }
  };

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

      {/* Platform leaderboard — third x402 endpoint */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-2xl border border-border bg-card p-4 sm:p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
            <Icon icon="ph:trophy-bold" className="w-5 h-5 text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-lg font-bold">Platform leaderboard</h2>
            <p className="text-xs text-muted-foreground">
              Top creators on BASEUSDP by tips received. $0.10 USDC per call via x402 (free for the platform owner).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-secondary/30 p-1">
            {(["day", "week", "month", "all"] as LbWindow[]).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setLbWindow(w)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold capitalize transition-colors ${
                  lbWindow === w
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : "text-muted-foreground hover:bg-white/5"
                }`}
              >
                {w}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => loadLeaderboard(lbWindow)}
            disabled={lbLoading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary/50 disabled:opacity-50"
          >
            {lbLoading ? (
              <Icon icon="ph:circle-notch-bold" className="h-3 w-3 animate-spin" />
            ) : (
              <Icon icon="ph:arrow-clockwise-bold" className="h-3 w-3" />
            )}
            Refresh
          </button>
        </div>

        {lbError && <p className="text-xs text-red-500 mb-3">{lbError}</p>}

        {lbData && (
          <>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="rounded-xl bg-secondary/20 p-3 min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">Volume</p>
                <p className="text-sm sm:text-base font-bold mt-0.5 truncate">${lbData.total_volume.toFixed(2)}</p>
              </div>
              <div className="rounded-xl bg-secondary/20 p-3 min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">Creators</p>
                <p className="text-sm sm:text-base font-bold mt-0.5 truncate">{lbData.total_creators}</p>
              </div>
              <div className="rounded-xl bg-secondary/20 p-3 min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">Tippers</p>
                <p className="text-sm sm:text-base font-bold mt-0.5 truncate">{lbData.total_tippers}</p>
              </div>
            </div>

            <div className="flex items-center justify-end mb-2">
              {lbFree ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-500">
                  <Icon icon="ph:check-circle-bold" className="h-3.5 w-3.5" />
                  Free (owner)
                </span>
              ) : lbPaidTx ? (
                <a
                  href={`https://basescan.org/tx/${lbPaidTx}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-emerald-500 hover:underline"
                >
                  <Icon icon="ph:check-circle-bold" className="h-3.5 w-3.5" />
                  Paid $0.10
                </a>
              ) : null}
            </div>

            {lbData.leaderboard.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                No tips in this window yet.
              </p>
            ) : (
              <div className="space-y-1.5">
                {lbData.leaderboard.map((e) => (
                  <div
                    key={`${e.rank}-${e.address ?? "anon"}`}
                    className="flex items-center justify-between gap-3 rounded-lg bg-secondary/20 px-3 py-2 text-sm min-w-0"
                  >
                    <span className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className={`w-6 text-center text-xs font-bold shrink-0 ${
                          e.rank === 1
                            ? "text-amber-400"
                            : e.rank === 2
                            ? "text-slate-300"
                            : e.rank === 3
                            ? "text-amber-700"
                            : "text-muted-foreground"
                        }`}
                      >
                        #{e.rank}
                      </span>
                      <span className="font-medium truncate">
                        {e.handle ?? "anonymous"}
                      </span>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {e.tip_count} tips · {e.unique_tippers} tippers
                      </span>
                    </span>
                    <span className="font-mono font-semibold shrink-0">
                      ${e.received.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </motion.div>

      {/* Bulk handle resolution — second x402 endpoint */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border border-border bg-card p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center">
            <Icon icon="ph:list-magnifying-glass-bold" className="w-5 h-5 text-sky-500" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-lg font-bold">Bulk handle resolution</h2>
            <p className="text-xs text-muted-foreground">
              Paste up to 50 @handles (commas or newlines) and get back wallet addresses. $0.05 USDC per call via x402.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <textarea
            placeholder="@jesse, @vitalik, @alice ..."
            value={bulkInput}
            onChange={(e) => setBulkInput(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
          />
          <button
            type="button"
            onClick={unlockBulk}
            disabled={bulkLoading || !bulkInput.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {bulkLoading ? (
              <>
                <Icon icon="ph:circle-notch-bold" className="h-4 w-4 animate-spin" />
                Resolving…
              </>
            ) : (
              <>
                <Icon icon="ph:lock-key-open-bold" className="h-4 w-4" />
                Resolve — $0.05
              </>
            )}
          </button>
        </div>

        {bulkError && <p className="mt-3 text-xs text-red-500">{bulkError}</p>}

        {bulkResults && (
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground">
                {bulkResults.length} result{bulkResults.length === 1 ? "" : "s"}
              </p>
              {bulkFree ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-500">
                  <Icon icon="ph:check-circle-bold" className="h-3.5 w-3.5" />
                  Free (owner)
                </span>
              ) : bulkPaidTx ? (
                <a
                  href={`https://basescan.org/tx/${bulkPaidTx}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-emerald-500 hover:underline"
                >
                  <Icon icon="ph:check-circle-bold" className="h-3.5 w-3.5" />
                  Paid $0.05
                </a>
              ) : null}
            </div>
            <div className="space-y-1.5">
              {bulkResults.map((r) => (
                <div
                  key={r.handle + (r.address ?? r.error ?? "")}
                  className="flex items-center justify-between rounded-lg bg-secondary/20 px-3 py-2 text-sm"
                >
                  <span className="font-medium">{r.handle}</span>
                  {r.address ? (
                    <span className="font-mono text-xs text-muted-foreground">
                      {r.address.slice(0, 6)}…{r.address.slice(-4)}
                    </span>
                  ) : (
                    <span className="text-xs text-red-400">not found</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default CreatorAnalyticsSection;
