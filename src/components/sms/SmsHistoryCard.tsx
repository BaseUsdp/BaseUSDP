/**
 * Lists the inbox of console-mode SMS messages (local dev) so a developer
 * can copy the claim URL from the dashboard without grepping logs.
 *
 * In Twilio mode this card shows a single line saying real SMS were sent.
 */

import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";
import { getSmsInbox } from "@/services/smsService";
import { postSmsRefund } from "@/services/smsService";
import type { InboxEntry } from "@/lib/sms/types";

interface SmsHistoryCardProps {
  reloadTick: number;
  onMutated: () => void;
}

const SmsHistoryCard = ({ reloadTick, onMutated }: SmsHistoryCardProps) => {
  const [mode, setMode] = useState<"console" | "twilio">("console");
  const [messages, setMessages] = useState<InboxEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refundingToken, setRefundingToken] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getSmsInbox(ctrl.signal);
        if (cancelled) return;
        setMode(res.mode);
        setMessages(res.messages);
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
  }, [reloadTick]);

  async function handleRefund(token: string) {
    setRefundingToken(token);
    try {
      await postSmsRefund(token);
      onMutated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRefundingToken(null);
    }
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text).catch(() => undefined);
  }

  return (
    <div
      className="rounded-xl border p-5 space-y-3"
      style={{
        borderColor: "var(--dash-border)",
        background: "var(--dash-overlay)",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon
            icon="ph:tray-bold"
            className="h-4 w-4"
            style={{ color: "hsl(var(--beam-cyan))" }}
          />
          <h3
            className="text-sm font-semibold"
            style={{ color: "var(--dash-text)" }}
          >
            Local SMS inbox
          </h3>
        </div>
        <span
          className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
          style={{
            borderColor: "var(--dash-border)",
            color: "var(--dash-text-muted)",
          }}
        >
          {mode === "console" ? "Console mode" : "Twilio mode"}
        </span>
      </div>

      {mode === "twilio" && (
        <p className="text-xs" style={{ color: "var(--dash-text-muted)" }}>
          Gateway is live — these SMS were dispatched through Twilio and
          delivered to the recipient's phone. Mirrored here for testing.
        </p>
      )}

      {error && (
        <div
          className="text-xs"
          style={{ color: "#ef4444" }}
        >
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--dash-text-muted)" }}>
          <Icon icon="ph:spinner-bold" className="h-3.5 w-3.5 animate-spin" />
          Loading…
        </div>
      )}

      {!loading && messages.length === 0 && (
        <p className="text-xs" style={{ color: "var(--dash-text-faint)" }}>
          No SMS sent yet. Send your first one above.
        </p>
      )}

      {messages.length > 0 && (
        <ul className="space-y-2">
          {messages.map((m) => {
            const claimUrl =
              typeof window !== "undefined"
                ? `${window.location.origin}/claim/${m.claimToken}`
                : `/claim/${m.claimToken}`;
            return (
              <li
                key={`${m.claimToken}-${m.sentAt}`}
                className="rounded-md border p-3"
                style={{
                  borderColor: "var(--dash-border)",
                  background: "var(--dash-surface)",
                }}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span
                    className="font-mono text-xs"
                    style={{ color: "var(--dash-text)" }}
                  >
                    {m.to}
                  </span>
                  <span
                    className="text-[10px]"
                    style={{ color: "var(--dash-text-faint)" }}
                  >
                    {new Date(m.sentAt).toLocaleString()}
                  </span>
                </div>
                <p
                  className="mt-1 text-xs leading-relaxed"
                  style={{ color: "var(--dash-text-muted)" }}
                >
                  {m.body}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => copy(claimUrl)}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px]"
                    style={{
                      borderColor: "var(--dash-border)",
                      color: "var(--dash-text)",
                    }}
                  >
                    <Icon icon="ph:copy-bold" className="h-3 w-3" />
                    Copy claim URL
                  </button>
                  <a
                    href={`/claim/${m.claimToken}`}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px]"
                    style={{
                      borderColor: "var(--dash-border)",
                      color: "var(--dash-text)",
                    }}
                  >
                    <Icon icon="ph:arrow-square-out-bold" className="h-3 w-3" />
                    Open claim page
                  </a>
                  <button
                    type="button"
                    onClick={() => handleRefund(m.claimToken)}
                    disabled={refundingToken === m.claimToken}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] disabled:opacity-50"
                    style={{
                      borderColor: "var(--dash-border)",
                      color: "var(--dash-text-muted)",
                    }}
                  >
                    <Icon
                      icon={
                        refundingToken === m.claimToken
                          ? "ph:spinner-bold"
                          : "ph:arrow-counter-clockwise-bold"
                      }
                      className={`h-3 w-3 ${
                        refundingToken === m.claimToken ? "animate-spin" : ""
                      }`}
                    />
                    Refund (after expiry)
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default SmsHistoryCard;
