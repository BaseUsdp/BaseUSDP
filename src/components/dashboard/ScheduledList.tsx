import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  listScheduledPayments,
  cancelScheduledPayment,
  type ScheduledPayment,
} from "@/services/scheduledPayments";

function buildSendNowUrl(s: ScheduledPayment): string {
  const params = new URLSearchParams({ tab: "payments", "scheduled-id": s.id });
  if (s.recipient_type === "username") {
    params.set("send-handle", `@${s.recipient_value}`);
  } else {
    params.set("send-to", s.recipient_value);
  }
  params.set("send-amount", String(s.amount));
  params.set("send-token", s.token);
  if (s.memo) params.set("send-memo", s.memo);
  return `/dashboard?${params.toString()}`;
}

const ScheduledList = () => {
  const { fullWalletAddress } = useWallet();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState<ScheduledPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const load = async () => {
    if (!fullWalletAddress) return;
    setLoading(true);
    const result = await listScheduledPayments(fullWalletAddress);
    if (result.success) setSchedules(result.schedules);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [fullWalletAddress]);

  const handleCancel = async (s: ScheduledPayment) => {
    if (!fullWalletAddress) return;
    setCancelling(s.id);
    const result = await cancelScheduledPayment(s.id, fullWalletAddress);
    if (result.success) {
      toast({ title: "Schedule cancelled" });
      setSchedules((prev) => prev.filter((x) => x.id !== s.id));
    } else {
      toast({ title: "Failed to cancel", description: result.error, variant: "destructive" });
    }
    setCancelling(null);
  };

  const upcoming = schedules.filter((s) => s.status === "active");
  const past = schedules.filter((s) => s.status === "completed").slice(0, 10);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h3 className="font-display text-lg font-bold mb-1">Upcoming</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Payments you've scheduled. We notify you when each is due — you sign and send.
        </p>

        {loading ? (
          <div className="flex justify-center py-8">
            <Icon icon="ph:spinner-bold" className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : upcoming.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <Icon icon="ph:calendar-blank-bold" className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No scheduled payments. Use the Send tab and toggle "Schedule" or "Recurring."
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map((s) => (
              <ScheduleCard
                key={s.id}
                schedule={s}
                cancelling={cancelling === s.id}
                onCancel={() => handleCancel(s)}
                onSendNow={() => navigate(buildSendNowUrl(s))}
              />
            ))}
          </div>
        )}
      </div>

      {past.length > 0 && (
        <div>
          <h3 className="font-display text-lg font-bold mb-1">Completed</h3>
          <div className="space-y-2">
            {past.map((s) => (
              <ScheduleCard
                key={s.id}
                schedule={s}
                cancelling={false}
                onCancel={() => {}}
                onSendNow={() => {}}
                readonly
              />
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};

interface ScheduleCardProps {
  schedule: ScheduledPayment;
  cancelling: boolean;
  onCancel: () => void;
  onSendNow: () => void;
  readonly?: boolean;
}

const ScheduleCard = ({ schedule: s, cancelling, onCancel, onSendNow, readonly }: ScheduleCardProps) => {
  const recipientLabel =
    s.recipient_type === "username"
      ? `@${s.recipient_value}`
      : `${s.recipient_value.slice(0, 6)}…${s.recipient_value.slice(-4)}`;

  const nextDate = new Date(s.scheduled_for);
  const dateStr = nextDate.toLocaleString();

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
      <div
        className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
          s.is_recurring ? "bg-violet-500/15 text-violet-400" : "bg-sky-500/15 text-sky-400"
        )}
      >
        <Icon
          icon={s.is_recurring ? "ph:arrows-clockwise-bold" : "ph:clock-bold"}
          className="w-5 h-5"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">
            {Number(s.amount).toFixed(2)} {s.token} → <span className="font-mono">{recipientLabel}</span>
          </p>
          {s.is_recurring && (
            <span className="text-[10px] uppercase tracking-wider bg-violet-500/15 text-violet-400 px-1.5 py-0.5 rounded-full font-medium">
              {s.frequency}
            </span>
          )}
          {s.auto_execute && !s.auth_revoked && (
            <span className="text-[10px] uppercase tracking-wider bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded-full font-medium">
              Auto
            </span>
          )}
          {s.is_due && !s.auto_execute && (
            <span className="text-[10px] uppercase tracking-wider bg-yellow-500/15 text-yellow-400 px-1.5 py-0.5 rounded-full font-medium">
              Due now
            </span>
          )}
          {s.retry_count > 0 && s.last_error && (
            <span
              className="text-[10px] uppercase tracking-wider bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded-full font-medium"
              title={s.last_error}
            >
              {s.retry_count} fail{s.retry_count === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {s.status === "completed" ? `Sent ${s.last_sent_at ? new Date(s.last_sent_at).toLocaleString() : ""}` : `Next: ${dateStr}`}
        </p>
        {s.memo && <p className="text-xs text-muted-foreground truncate mt-0.5">{s.memo}</p>}
      </div>
      {!readonly && (
        <div className="flex items-center gap-2 shrink-0">
          {s.is_due && (
            <Button
              size="sm"
              onClick={onSendNow}
              disabled={cancelling}
              className="bg-primary hover:bg-primary/90"
            >
              <Icon icon="ph:paper-plane-tilt-bold" className="w-4 h-4 mr-1.5" />
              Send now
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={cancelling}
            className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-400"
          >
            {cancelling ? (
              <Icon icon="ph:spinner-bold" className="w-4 h-4 animate-spin" />
            ) : (
              "Cancel"
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default ScheduledList;
