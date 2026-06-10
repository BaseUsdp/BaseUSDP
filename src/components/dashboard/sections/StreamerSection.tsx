/**
 * Streamer Mode — consolidated dashboard view for creators streaming with
 * the BASEUSDP OBS overlay. One screen surfaces:
 *
 *   - Overlay URL customizer (position / accent / duration / min amount / obs)
 *   - Copy + open buttons + setup instructions for OBS Browser Source
 *   - Live iframe preview of the overlay
 *   - Quick stats (total received, tip count, unique tippers, biggest tip)
 *   - Top tippers list
 *   - Share buttons for /@handle (public profile) and /tip/@handle (tip form)
 *
 * Stats come from /api/x402/creator-stats via the free-for-owner path —
 * the authenticated creator viewing their own data isn't charged.
 */

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { toast } from "sonner";
import { useWallet } from "@/contexts/WalletContext";
import { authService } from "@/services/authService";
import { getApiUrl } from "@/utils/apiConfig";
import { generateStickerPdf } from "@/lib/stickerPdf";

type Position = "bottom-left" | "bottom-right" | "top-left" | "top-right";

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

const POSITIONS: { value: Position; label: string }[] = [
  { value: "bottom-left", label: "Bottom-left" },
  { value: "bottom-right", label: "Bottom-right" },
  { value: "top-left", label: "Top-left" },
  { value: "top-right", label: "Top-right" },
];

const StreamerSection = () => {
  const { fullWalletAddress } = useWallet();
  const [handle, setHandle] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Overlay customizer state.
  const [position, setPosition] = useState<Position>("bottom-left");
  const [accent, setAccent] = useState("#0052FF");
  const [duration, setDuration] = useState(6);
  const [minAmount, setMinAmount] = useState(0);
  const [obsMode, setObsMode] = useState(true);

  // Stats.
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://baseusdp.com";

  // Resolve the creator's own @handle.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!fullWalletAddress) {
        setProfileLoading(false);
        return;
      }
      try {
        const res = await fetch(
          `${getApiUrl()}/api/user/profile?wallet=${encodeURIComponent(fullWalletAddress)}`,
        );
        const data = await res.json();
        if (!cancelled && data?.success && data.profile?.username) {
          setHandle(data.profile.username as string);
        }
      } catch {
        // best-effort
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [fullWalletAddress]);

  // Load rich stats via the free-for-owner creator-stats path.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!handle) return;
      const token = authService.getSessionToken();
      if (!token) {
        setStatsError("Sign in to load your stats.");
        return;
      }
      setStatsLoading(true);
      setStatsError(null);
      try {
        const res = await fetch(
          `${getApiUrl()}/api/x402/creator-stats?handle=${encodeURIComponent(handle)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.success) {
          setStatsError(data?.error || "Couldn't load stats");
        } else {
          setStats(data.stats as Stats);
        }
      } catch (err: any) {
        if (!cancelled) setStatsError(err?.message || "Couldn't load stats");
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [handle]);

  const overlayPath = useMemo(() => {
    if (!handle) return "";
    const params = new URLSearchParams();
    if (position !== "bottom-left") params.set("position", position);
    if (accent && accent !== "#0052FF") params.set("accent", accent);
    if (duration !== 6) params.set("duration", String(duration));
    if (minAmount > 0) params.set("min", String(minAmount));
    if (obsMode) params.set("obs", "true");
    const qs = params.toString();
    return `/overlay/@${handle}${qs ? `?${qs}` : ""}`;
  }, [handle, position, accent, duration, minAmount, obsMode]);

  const overlayUrl = handle ? `${origin}${overlayPath}` : "";
  const profileUrl = handle ? `${origin}/@${handle}` : "";
  const tipUrl = handle ? `${origin}/tip/@${handle}` : "";

  const copy = async (text: string, label: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Clipboard unavailable");
    }
  };

  // Sticker pack generator.
  const [stickerPages, setStickerPages] = useState(1);
  const [stickerBusy, setStickerBusy] = useState(false);

  const downloadStickerPack = async () => {
    if (!handle || !tipUrl) return;
    setStickerBusy(true);
    try {
      await generateStickerPdf({
        handle,
        tipUrl,
        pages: stickerPages,
      });
      toast.success(
        `Sticker pack downloaded (${stickerPages * 8} stickers)`,
      );
    } catch (err: any) {
      toast.error(err?.message || "Couldn't generate PDF");
    } finally {
      setStickerBusy(false);
    }
  };

  if (profileLoading) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <Icon icon="ph:circle-notch-bold" className="w-4 h-4 animate-spin" />
        Loading streamer mode…
      </div>
    );
  }

  if (!handle) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-border bg-card p-6 max-w-md">
          <div className="flex items-center gap-3 mb-3">
            <Icon icon="ph:warning-bold" className="w-5 h-5 text-amber-400" />
            <h2 className="font-display text-lg font-bold">Set a username first</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Streamer Mode needs a @handle to build your overlay URL. Pick a username on the Settings tab → Your tip page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border bg-card p-4 sm:p-6"
      >
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center shrink-0">
            <Icon icon="ph:broadcast-bold" className="w-5 h-5 text-rose-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-lg font-bold">Streamer Mode</h2>
            <p className="text-xs text-muted-foreground">
              Everything you need to take BASEUSDP tips live, in one screen.
            </p>
          </div>
          <span className="text-xs font-mono text-muted-foreground truncate max-w-[40%] sm:max-w-none">@{handle}</span>
        </div>
      </motion.div>

      {/* Stats grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3"
      >
        {[
          { label: "Received", value: stats ? `$${stats.total_received.toFixed(2)}` : "—" },
          { label: "Tips", value: stats ? String(stats.tip_count) : "—" },
          { label: "Tippers", value: stats ? String(stats.unique_tippers) : "—" },
          {
            label: "Top tip",
            value: stats?.top_tippers?.[0]
              ? `$${stats.top_tippers[0].total.toFixed(2)}`
              : "—",
          },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-3 sm:p-4 min-w-0">
            <p className="text-[10px] sm:text-[11px] uppercase tracking-wide text-muted-foreground truncate">{s.label}</p>
            <p className="text-lg sm:text-xl font-bold mt-1 truncate">
              {statsLoading ? "…" : s.value}
            </p>
          </div>
        ))}
      </motion.div>

      {statsError && (
        <p className="text-xs text-amber-500 -mt-3">{statsError}</p>
      )}

      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-4 sm:gap-6">
        {/* Overlay customizer */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-border bg-card p-4 sm:p-6 space-y-5 min-w-0"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-500/20 flex items-center justify-center">
              <Icon icon="ph:monitor-bold" className="w-4 h-4 text-sky-500" />
            </div>
            <div>
              <h3 className="font-display font-bold">OBS overlay</h3>
              <p className="text-xs text-muted-foreground">
                Paste the URL into OBS as a Browser Source (1920×1080, transparent).
              </p>
            </div>
          </div>

          {/* Customizer fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                Position
              </label>
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value as Position)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
              >
                {POSITIONS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div className="min-w-0">
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                Accent
              </label>
              <div className="flex items-center gap-2 min-w-0">
                <input
                  type="color"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  className="h-9 w-10 sm:w-12 rounded-lg border border-border bg-background cursor-pointer shrink-0"
                />
                <input
                  type="text"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  className="flex-1 min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono outline-none focus:border-primary/50"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                Duration (s)
              </label>
              <input
                type="number"
                min={2}
                max={30}
                value={duration}
                onChange={(e) => setDuration(Math.max(2, Math.min(30, Number(e.target.value) || 6)))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                Min amount ($)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={minAmount}
                onChange={(e) => setMinAmount(Math.max(0, Number(e.target.value) || 0))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm select-none cursor-pointer">
            <input
              type="checkbox"
              checked={obsMode}
              onChange={(e) => setObsMode(e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            <span>
              Hide the preview banner (recommended for OBS)
            </span>
          </label>

          {/* URL row */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
              Overlay URL
            </label>
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-secondary/30 p-3">
              <code className="flex-1 min-w-0 basis-full sm:basis-auto truncate text-xs font-mono">{overlayUrl}</code>
              <button
                type="button"
                onClick={() => copy(overlayUrl, "Overlay URL")}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary/50 shrink-0"
              >
                <Icon icon="ph:copy-bold" className="h-3 w-3" />
                Copy
              </button>
              <a
                href={overlayUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary/50 shrink-0"
              >
                <Icon icon="ph:arrow-square-out-bold" className="h-3 w-3" />
                Open
              </a>
            </div>
          </div>

          <div className="rounded-xl bg-secondary/20 p-3 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              OBS setup
            </p>
            <ol className="text-xs text-muted-foreground space-y-0.5 list-decimal pl-5">
              <li>Sources → + → Browser Source</li>
              <li>Paste the URL above, width 1920, height 1080</li>
              <li>Check "Shutdown source when not visible" off, "Refresh when scene becomes active" on</li>
            </ol>
          </div>
        </motion.div>

        {/* Live preview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl border border-border bg-card p-4 sm:p-6 min-w-0"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <Icon icon="ph:play-circle-bold" className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <h3 className="font-display font-bold">Live preview</h3>
              <p className="text-xs text-muted-foreground">
                What viewers will see in OBS as tips land.
              </p>
            </div>
          </div>
          <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-black/80">
            {overlayUrl && (
              <iframe
                key={overlayUrl}
                src={overlayUrl}
                title="Overlay preview"
                className="absolute inset-0 w-full h-full"
              />
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            Preview uses a transparent canvas with a dark backdrop so you can see the tip cards.
          </p>
        </motion.div>
      </div>

      {/* Top tippers */}
      {stats && stats.top_tippers.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border border-border bg-card p-4 sm:p-6 min-w-0"
        >
          <h3 className="font-display font-bold mb-4">Top tippers</h3>
          <div className="space-y-1.5">
            {stats.top_tippers.map((t, i) => (
              <div
                key={t.address}
                className="flex items-center justify-between gap-3 rounded-lg bg-secondary/20 px-3 py-2 text-sm min-w-0"
              >
                <span className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-muted-foreground w-4 shrink-0">{i + 1}.</span>
                  <span className="font-medium truncate">
                    {t.handle ?? `${t.address.slice(0, 6)}…${t.address.slice(-4)}`}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">({t.count})</span>
                </span>
                <span className="font-mono font-semibold shrink-0">${t.total.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Sticker pack PDF */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22 }}
        className="rounded-2xl border border-border bg-card p-4 sm:p-6 min-w-0"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-fuchsia-500/20 flex items-center justify-center shrink-0">
            <Icon icon="ph:sticker-bold" className="w-4 h-4 text-fuchsia-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-bold">Sticker pack PDF</h3>
            <p className="text-xs text-muted-foreground">
              Print-ready A4 sheet with QR + @handle + BASEUSDP branding. 8 stickers per page, dotted cut-guides included.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
              Pages
            </label>
            <input
              type="number"
              min={1}
              max={20}
              value={stickerPages}
              onChange={(e) =>
                setStickerPages(
                  Math.max(1, Math.min(20, Number(e.target.value) || 1)),
                )
              }
              className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              {stickerPages * 8} stickers total
            </p>
          </div>
          <button
            type="button"
            onClick={downloadStickerPack}
            disabled={stickerBusy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 self-end"
          >
            {stickerBusy ? (
              <>
                <Icon icon="ph:circle-notch-bold" className="h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Icon icon="ph:download-simple-bold" className="h-4 w-4" />
                Download PDF
              </>
            )}
          </button>
        </div>
      </motion.div>

      {/* Share URLs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="rounded-2xl border border-border bg-card p-4 sm:p-6 space-y-4 min-w-0"
      >
        <h3 className="font-display font-bold">Share with your audience</h3>
        {[
          { label: "Public profile", url: profileUrl, hint: "Polished landing page with a Tip Me button" },
          { label: "Tip form", url: tipUrl, hint: "Focused tip form (deeplinkable with amount)" },
        ].map((row) => (
          <div key={row.label}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
              {row.label} <span className="font-normal lowercase text-muted-foreground/70">— {row.hint}</span>
            </p>
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-secondary/30 p-3">
              <code className="flex-1 min-w-0 basis-full sm:basis-auto truncate text-sm font-mono">{row.url}</code>
              <button
                type="button"
                onClick={() => copy(row.url, row.label)}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary/50 shrink-0"
              >
                <Icon icon="ph:copy-bold" className="h-3 w-3" />
                Copy
              </button>
              <a
                href={row.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary/50 shrink-0"
              >
                <Icon icon="ph:arrow-square-out-bold" className="h-3 w-3" />
                Open
              </a>
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  );
};

export default StreamerSection;
