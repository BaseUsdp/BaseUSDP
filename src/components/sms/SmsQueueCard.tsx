/**
 * Surfaces the locally-queued (offline-signed) sends. Lets the user retry
 * or discard each entry, and explains what happens automatically when the
 * connection returns.
 */

import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";
import {
  drainQueue,
  listQueued,
  removeQueued,
  subscribeQueue,
} from "@/lib/sms/offlineQueue";
import type { QueuedSend } from "@/lib/sms/types";

interface SmsQueueCardProps {
  onChanged: () => void;
}

const SmsQueueCard = ({ onChanged }: SmsQueueCardProps) => {
  const [entries, setEntries] = useState<QueuedSend[]>(() => listQueued());
  const [draining, setDraining] = useState(false);

  useEffect(() => {
    const unsub = subscribeQueue(() => setEntries(listQueued()));
    return () => {
      unsub();
    };
  }, []);

  if (entries.length === 0) return null;

  async function handleDrain() {
    setDraining(true);
    try {
      await drainQueue();
      setEntries(listQueued());
      onChanged();
    } finally {
      setDraining(false);
    }
  }

  return (
    <div
      className="rounded-xl border p-5 space-y-3"
      style={{
        borderColor: "hsl(var(--beam-amber))",
        background: "rgba(245,158,11,0.06)",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon
            icon="ph:queue-bold"
            className="h-4 w-4"
            style={{ color: "hsl(var(--beam-amber))" }}
          />
          <h3
            className="text-sm font-semibold"
            style={{ color: "var(--dash-text)" }}
          >
            Queued sends ({entries.length})
          </h3>
        </div>
        <button
          type="button"
          onClick={handleDrain}
          disabled={draining}
          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] disabled:opacity-50"
          style={{
            borderColor: "hsl(var(--beam-amber))",
            color: "hsl(var(--beam-amber))",
          }}
        >
          <Icon
            icon={draining ? "ph:spinner-bold" : "ph:paper-plane-tilt-bold"}
            className={`h-3 w-3 ${draining ? "animate-spin" : ""}`}
          />
          {draining ? "Sending…" : "Send all now"}
        </button>
      </div>

      <p className="text-[11px]" style={{ color: "var(--dash-text-muted)" }}>
        These sends were signed by your wallet while offline. They'll dispatch
        automatically when you reconnect, or you can trigger them above.
      </p>

      <ul className="space-y-2">
        {entries.map((entry) => (
          <li
            key={entry.id}
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
                {entry.phoneE164} · ${entry.amount}
              </span>
              <span
                className="text-[10px]"
                style={{ color: "var(--dash-text-faint)" }}
              >
                queued {new Date(entry.queuedAt).toLocaleTimeString()}
              </span>
            </div>
            {entry.note && (
              <p
                className="mt-1 text-xs italic"
                style={{ color: "var(--dash-text-muted)" }}
              >
                "{entry.note}"
              </p>
            )}
            {entry.lastError && (
              <p
                className="mt-1 text-[11px]"
                style={{ color: "#ef4444" }}
              >
                Last attempt: {entry.lastError} (attempts: {entry.attempts})
              </p>
            )}
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  removeQueued(entry.id);
                  onChanged();
                }}
                className="text-[11px]"
                style={{ color: "var(--dash-text-faint)" }}
              >
                Discard
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SmsQueueCard;
