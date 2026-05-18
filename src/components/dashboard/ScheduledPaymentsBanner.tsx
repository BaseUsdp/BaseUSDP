import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  listScheduledPayments,
  cancelScheduledPayment,
  type ScheduledPayment,
} from "@/services/scheduledPayments";

const POLL_INTERVAL_MS = 60_000;

const ScheduledPaymentsBanner = () => {
  const { fullWalletAddress } = useWallet();
  const navigate = useNavigate();
  const [due, setDue] = useState<ScheduledPayment[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [working, setWorking] = useState<string | null>(null);

  useEffect(() => {
    if (!fullWalletAddress) return;
    let cancelled = false;

    const load = async () => {
      const result = await listScheduledPayments(fullWalletAddress, { dueOnly: true });
      if (cancelled) return;
      if (result.success) setDue(result.schedules);
    };

    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [fullWalletAddress]);

  const visible = due.filter((s) => !dismissed.has(s.id));
  if (visible.length === 0) return null;

  const handleSendNow = (s: ScheduledPayment) => {
    const params = new URLSearchParams({ tab: "payments", "scheduled-id": s.id });
    if (s.recipient_type === "username") {
      params.set("send-handle", `@${s.recipient_value}`);
    } else {
      params.set("send-to", s.recipient_value);
    }
    params.set("send-amount", String(s.amount));
    params.set("send-token", s.token);
    if (s.memo) params.set("send-memo", s.memo);
    navigate(`/dashboard?${params.toString()}`);
  };

  const handleSkip = async (s: ScheduledPayment) => {
    if (!fullWalletAddress) return;
    setWorking(s.id);
    const result = await cancelScheduledPayment(s.id, fullWalletAddress);
    if (result.success) {
      setDue((prev) => prev.filter((x) => x.id !== s.id));
    }
    setWorking(null);
  };

  const handleDismiss = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  return (
    <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 space-y-2">
      <AnimatePresence initial={false}>
        {visible.map((s) => {
          const recipientLabel =
            s.recipient_type === "username"
              ? `@${s.recipient_value}`
              : `${s.recipient_value.slice(0, 6)}…${s.recipient_value.slice(-4)}`;
          const isWorking = working === s.id;
          return (
            <motion.div
              key={s.id}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={cn(
                "rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 flex items-center gap-3",
                "shadow-sm"
              )}
            >
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                <Icon
                  icon={s.is_recurring ? "ph:arrows-clockwise-bold" : "ph:clock-bold"}
                  className="w-5 h-5 text-primary"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {s.is_recurring ? "Recurring payment" : "Scheduled payment"} due —{" "}
                  <span className="font-bold">
                    {Number(s.amount).toFixed(2)} {s.token}
                  </span>{" "}
                  to <span className="font-mono">{recipientLabel}</span>
                </p>
                {s.memo && (
                  <p className="text-xs text-muted-foreground truncate">{s.memo}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  onClick={() => handleSendNow(s)}
                  disabled={isWorking}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Icon icon="ph:paper-plane-tilt-bold" className="w-4 h-4 mr-1.5" />
                  Send now
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSkip(s)}
                  disabled={isWorking}
                >
                  {isWorking ? (
                    <Icon icon="ph:spinner-bold" className="w-4 h-4 animate-spin" />
                  ) : s.is_recurring ? (
                    "Cancel schedule"
                  ) : (
                    "Skip"
                  )}
                </Button>
                <button
                  onClick={() => handleDismiss(s.id)}
                  className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                  title="Dismiss for this session"
                >
                  <Icon icon="ph:x-bold" className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default ScheduledPaymentsBanner;
