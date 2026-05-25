/**
 * /overlay/:handle — public OBS-friendly tip overlay.
 *
 * Streamers paste `https://baseusdp.com/overlay/@theirhandle` into OBS as
 * a Browser Source. The page has a transparent body. Whenever a new tip
 * arrives for the wallet behind @theirhandle, a small card animates in,
 * stays visible for a few seconds, then animates out.
 *
 * Query params (all optional):
 *   ?position=bottom-left|bottom-right|top-left|top-right  (default bottom-left)
 *   ?duration=6                                            (seconds, default 6, range 2-30)
 *   ?min=0                                                 (minimum tip amount to show)
 *   ?accent=#ff8c00                                        (CSS color for the accent bar)
 *   ?obs=true                                              (hide the preview status card — set this once you've pasted the URL into OBS)
 *
 * Implementation:
 *   - Poll /api/overlay/recent every 5s with the latest-seen timestamp.
 *   - Queue new tips into a state array; render with AnimatePresence so
 *     they slide in/out cleanly.
 *   - First mount uses "5 minutes ago" as the since cursor so refreshing
 *     during a stream doesn't double-fire animations.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { Avatar } from "@coinbase/onchainkit/identity";
import { base } from "viem/chains";
import { getApiUrl } from "@/utils/apiConfig";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

interface Tip {
  id: string;
  sender_username: string | null;
  sender_address: string | null;
  amount: number | null;
  token: string;
  memo: string | null;
  created_at: string;
}

const POLL_MS = 5_000;

const POSITION_CLASS: Record<string, string> = {
  "bottom-left": "bottom-6 left-6 items-start",
  "bottom-right": "bottom-6 right-6 items-end",
  "top-left": "top-6 left-6 items-start",
  "top-right": "top-6 right-6 items-end",
};

const Overlay = () => {
  const { handle: rawHandle = "" } = useParams<{ handle: string }>();
  const [params] = useSearchParams();

  const positionRaw = params.get("position") ?? "bottom-left";
  const position = POSITION_CLASS[positionRaw] ? positionRaw : "bottom-left";

  const durationSec = useMemo(() => {
    const raw = Number(params.get("duration") ?? "6");
    if (!Number.isFinite(raw)) return 6;
    return Math.max(2, Math.min(30, raw));
  }, [params]);

  const minAmount = useMemo(() => {
    const raw = Number(params.get("min") ?? "0");
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  }, [params]);

  const accent = params.get("accent") || "#0052FF";
  const obsMode = params.get("obs") === "true";
  const demoMode = params.get("demo") === "1";

  const handleParam = rawHandle.startsWith("@") ? rawHandle.slice(1) : rawHandle;

  // Cursor that grows: we only fetch tips after the latest one we've shown.
  const sinceRef = useRef<string>(new Date(Date.now() - 5 * 60 * 1000).toISOString());
  const seenIdsRef = useRef<Set<string>>(new Set());

  const [visibleTips, setVisibleTips] = useState<Tip[]>([]);
  const [resolvedHandle, setResolvedHandle] = useState<string | null>(null);
  const [missingHandle, setMissingHandle] = useState<boolean>(false);

  // Demo mode: skip the API entirely and inject fake tip cards on a loop so
  // the avatar rendering can be verified visually without sending real tips.
  // Triggered by `?demo=1` on the URL.
  useEffect(() => {
    if (!demoMode) return;
    setMissingHandle(false);
    setResolvedHandle("demo");

    const fixtures: Omit<Tip, "id" | "created_at">[] = [
      {
        sender_username: "jesse",
        sender_address: "0x849151d7D0bF1F34b70d5caD5149D28CC2308bf1",
        amount: 5,
        token: "USDC",
        memo: "great stream!",
      },
      {
        sender_username: null,
        sender_address: "0x0000000000000000000000000000000000000000",
        amount: 1.5,
        token: "USDC",
        memo: null,
      },
      {
        sender_username: "vitalik",
        sender_address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
        amount: 100,
        token: "USDC",
        memo: "love the work",
      },
    ];

    let i = 0;
    const inject = () => {
      const base = fixtures[i % fixtures.length];
      const tip: Tip = {
        ...base,
        id: `demo-${Date.now()}-${i}`,
        created_at: new Date().toISOString(),
      };
      i++;
      setVisibleTips((prev) => [...prev, tip]);
      window.setTimeout(() => {
        setVisibleTips((prev) => prev.filter((t) => t.id !== tip.id));
      }, durationSec * 1000);
    };

    inject();
    const interval = window.setInterval(inject, Math.max(2500, durationSec * 1000 - 500));
    return () => window.clearInterval(interval);
  }, [demoMode, durationSec]);

  useEffect(() => {
    if (demoMode) return;
    if (!handleParam) {
      setMissingHandle(true);
      return;
    }
    setMissingHandle(false);

    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(
          `${getApiUrl()}/api/overlay/recent?username=${encodeURIComponent(handleParam)}` +
            `&since=${encodeURIComponent(sinceRef.current)}`
        );
        if (!res.ok) {
          if (res.status === 404) setMissingHandle(true);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        if (data.handle) setResolvedHandle(data.handle);

        const fresh: Tip[] = (data.tips ?? [])
          .filter((t: Tip) => !seenIdsRef.current.has(t.id))
          .filter((t: Tip) => (t.amount ?? 0) >= minAmount)
          // Oldest first so they animate in roughly chronological order.
          .reverse();

        if (fresh.length === 0) return;

        // Advance cursor to the newest seen timestamp.
        const latest = fresh.reduce(
          (acc: string, t: Tip) => (t.created_at > acc ? t.created_at : acc),
          sinceRef.current
        );
        sinceRef.current = latest;

        for (const tip of fresh) {
          seenIdsRef.current.add(tip.id);
          setVisibleTips((prev) => [...prev, tip]);
          // Schedule its removal.
          window.setTimeout(() => {
            setVisibleTips((prev) => prev.filter((t) => t.id !== tip.id));
          }, durationSec * 1000);
        }
      } catch (err) {
        console.warn("[overlay] poll error:", err);
      }
    };

    poll();
    const interval = window.setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [handleParam, minAmount, durationSec, demoMode]);

  if (missingHandle) {
    return (
      <div className="fixed inset-0 flex items-center justify-center p-6 bg-black/30 text-white">
        <div className="rounded-2xl bg-black/70 p-6 max-w-md text-center">
          <Icon icon="ph:warning-bold" className="w-8 h-8 mx-auto mb-2 text-amber-400" />
          <p className="font-display text-lg mb-1">Unknown handle</p>
          <p className="text-sm text-white/80">
            No BASEUSDP account found for <code>@{handleParam || "—"}</code>.
            Double-check the URL.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fixed inset-0 pointer-events-none flex flex-col ${POSITION_CLASS[position]} gap-3 p-0`}
      style={{ background: "transparent" }}
    >
      <AnimatePresence>
        {visibleTips.map((tip) => (
          <TipCard key={tip.id} tip={tip} accent={accent} />
        ))}
      </AnimatePresence>

      {/* Visible preview card so the page looks intentional in a normal
          browser tab. Streamers add ?obs=true once they've pasted the URL
          into OBS to hide it. */}
      {!obsMode && (
        <div
          className="pointer-events-auto fixed top-6 left-1/2 -translate-x-1/2 rounded-2xl shadow-2xl text-white"
          style={{
            background: "rgba(17,17,17,0.92)",
            padding: "16px 20px",
            maxWidth: "520px",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span style={{ width: 8, height: 8, borderRadius: 9999, background: "#22c55e", display: "inline-block" }} />
            <strong style={{ fontSize: 14 }}>BASEUSDP overlay live</strong>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
              {resolvedHandle ? `@${resolvedHandle}` : handleParam.slice(0, 6) + "…" + handleParam.slice(-4)}
            </span>
          </div>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", margin: 0 }}>
            Waiting for tips. New tips will animate in the {positionRaw.replace("-", " ")} corner.
          </p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 8, marginBottom: 0 }}>
            Paste this URL into OBS / Streamlabs as a Browser Source, then add{" "}
            <code style={{ background: "rgba(255,255,255,0.1)", padding: "1px 6px", borderRadius: 4 }}>
              ?obs=true
            </code>{" "}
            to the URL to hide this banner.
          </p>
        </div>
      )}

      {/* Tiny corner watermark with a dark pill so it's legible on any
          background (including the default white in a non-OBS browser). */}
      <p
        className="pointer-events-auto fixed bottom-2 right-2 text-[10px] font-mono select-none"
        style={{
          background: "rgba(0,0,0,0.45)",
          color: "rgba(255,255,255,0.85)",
          padding: "3px 8px",
          borderRadius: 9999,
        }}
      >
        BASEUSDP overlay {resolvedHandle ? `@${resolvedHandle}` : ""}
      </p>
    </div>
  );
};

interface TipCardProps {
  tip: Tip;
  accent: string;
}

const TipCard = ({ tip, accent }: TipCardProps) => {
  const sender =
    tip.sender_username
      ? `@${tip.sender_username}`
      : tip.sender_address
      ? `${tip.sender_address.slice(0, 6)}…${tip.sender_address.slice(-4)}`
      : "anonymous";

  const amount =
    typeof tip.amount === "number" && Number.isFinite(tip.amount)
      ? `$${tip.amount.toFixed(2)} ${tip.token}`
      : tip.token;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -40, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -40, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className="pointer-events-none rounded-2xl shadow-2xl backdrop-blur-md text-white"
      style={{
        background: "rgba(0,0,0,0.78)",
        borderLeft: `4px solid ${accent}`,
        padding: "14px 18px",
        minWidth: "260px",
        maxWidth: "380px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        {tip.sender_address && ADDRESS_RE.test(tip.sender_address) ? (
          <Avatar
            address={tip.sender_address as `0x${string}`}
            chain={base}
            className="w-6 h-6 rounded-full shrink-0"
          />
        ) : (
          <span style={{ fontSize: 18 }}>💸</span>
        )}
        <span className="font-bold text-base">{sender}</span>
        <span className="text-white/70 text-sm">tipped</span>
        <span className="font-bold text-base" style={{ color: accent }}>
          {amount}
        </span>
      </div>
      {tip.memo && (
        <p className="text-sm text-white/85 italic" style={{ marginTop: 4 }}>
          "{tip.memo}"
        </p>
      )}
    </motion.div>
  );
};

export default Overlay;
