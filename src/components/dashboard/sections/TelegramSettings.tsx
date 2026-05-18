import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import {
  getTelegramStatus,
  initTelegramLink,
  updateTelegramSettings,
  unlinkTelegram,
  type TelegramLinkStatus,
} from "@/services/telegram";

const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || "baseusdp_bot";

const TelegramSettings = () => {
  const { fullWalletAddress } = useWallet();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<TelegramLinkStatus | null>(null);
  const [generating, setGenerating] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = async () => {
    if (!fullWalletAddress) {
      setStatus(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const result = await getTelegramStatus(fullWalletAddress);
    if (result.success && result.status) setStatus(result.status);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [fullWalletAddress]);

  // While a linking code is active and the user hasn't linked yet, poll every
  // 5s so the UI flips to "linked" when the user completes /start in Telegram.
  useEffect(() => {
    if (!status?.linking_code || status.linked || !fullWalletAddress) return;
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [status?.linking_code, status?.linked, fullWalletAddress]);

  const handleGenerateCode = async () => {
    if (!fullWalletAddress) return;
    setGenerating(true);
    const result = await initTelegramLink(fullWalletAddress);
    setGenerating(false);
    if (result.success) {
      toast({ title: "Linking code generated", description: "Paste it in Telegram or click the link." });
      await load();
    } else {
      toast({ title: "Couldn't generate code", description: result.error, variant: "destructive" });
    }
  };

  const handleUnlink = async () => {
    if (!fullWalletAddress) return;
    const result = await unlinkTelegram(fullWalletAddress);
    if (result.success) {
      toast({ title: "Telegram unlinked" });
      await load();
    } else {
      toast({ title: "Couldn't unlink", description: result.error, variant: "destructive" });
    }
  };

  const apply = async (
    key: "enabled" | "notify_incoming" | "notify_outgoing" | "notify_x402",
    value: boolean
  ) => {
    if (!fullWalletAddress || !status) return;
    const previous = { ...status };
    setStatus({ ...status, [key]: value });
    setBusyKey(key);
    const result = await updateTelegramSettings(fullWalletAddress, { [key]: value });
    setBusyKey(null);
    if (!result.success) {
      setStatus(previous);
      toast({ title: "Couldn't update", description: result.error, variant: "destructive" });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="rounded-2xl border border-border bg-card p-6"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-sky-500/15 flex items-center justify-center">
          <Icon icon="ph:paper-plane-tilt-bold" className="w-5 h-5 text-sky-400" />
        </div>
        <div>
          <h3 className="font-display text-lg font-bold">Telegram notifications</h3>
          <p className="text-xs text-muted-foreground">
            Get a Telegram DM the moment an incoming payment lands
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Icon icon="ph:spinner-bold" className="w-4 h-4 animate-spin" />
          Loading…
        </div>
      ) : !status?.linked ? (
        <div className="space-y-3">
          {!status?.linking_code ? (
            <>
              <p className="text-sm text-muted-foreground">
                Click below to generate a one-time link code, then open the bot in
                Telegram. Code is valid for 10 minutes.
              </p>
              <Button
                onClick={handleGenerateCode}
                disabled={generating}
                className="bg-primary hover:bg-primary/90"
              >
                {generating ? (
                  <>
                    <Icon icon="ph:spinner-bold" className="w-4 h-4 mr-2 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Icon icon="ph:paper-plane-tilt-bold" className="w-4 h-4 mr-2" />
                    Generate link code
                  </>
                )}
              </Button>
            </>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl bg-primary/10 border border-primary/30 p-4">
                <p className="text-xs text-muted-foreground mb-1">Your one-time code</p>
                <div className="flex items-center gap-3">
                  <code className="font-mono text-2xl tracking-widest text-primary">
                    {status.linking_code}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(status.linking_code!);
                      toast({ title: "Code copied" });
                    }}
                    className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary"
                  >
                    <Icon icon="ph:copy-bold" className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground/80 mt-2">
                  Expires{" "}
                  {status.linking_code_expires_at
                    ? new Date(status.linking_code_expires_at).toLocaleTimeString()
                    : "soon"}
                  .
                </p>
              </div>

              <Button
                asChild
                className="w-full bg-sky-500 hover:bg-sky-500/90 text-white"
              >
                <a
                  href={`https://t.me/${BOT_USERNAME}?start=${status.linking_code}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon icon="ph:paper-plane-tilt-bold" className="w-4 h-4 mr-2" />
                  Open Telegram &amp; link
                </a>
              </Button>

              <p className="text-xs text-muted-foreground">
                Or in Telegram, message <code>@{BOT_USERNAME}</code> with{" "}
                <code>/start {status.linking_code}</code>. This panel will refresh
                automatically when linking completes.
              </p>

              <Button variant="outline" size="sm" onClick={handleGenerateCode} disabled={generating}>
                Regenerate code
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <Icon icon="ph:check-circle-bold" className="w-4 h-4 text-emerald-400" />
            <span>
              Linked
              {status.telegram_username ? (
                <>
                  {" "}as <span className="font-mono">@{status.telegram_username}</span>
                </>
              ) : (
                ""
              )}
              .
            </span>
          </div>

          <ToggleRow
            label="Notifications enabled"
            description="Master switch — turn off to pause every Telegram message."
            value={status.enabled}
            busy={busyKey === "enabled"}
            onChange={(v) => apply("enabled", v)}
          />

          {status.enabled && (
            <div className="ml-2 pl-4 border-l border-border space-y-4">
              <ToggleRow
                label="Incoming payments"
                description="DM you when a private payment lands."
                value={status.notify_incoming}
                busy={busyKey === "notify_incoming"}
                onChange={(v) => apply("notify_incoming", v)}
              />
              <ToggleRow
                label="Outgoing confirmations"
                description="DM you a confirmation after a payment you sent settles."
                value={status.notify_outgoing}
                busy={busyKey === "notify_outgoing"}
                onChange={(v) => apply("notify_outgoing", v)}
              />
              <ToggleRow
                label="x402 settlements"
                description="DM you when one of your payment links / requests is paid."
                value={status.notify_x402}
                busy={busyKey === "notify_x402"}
                onChange={(v) => apply("notify_x402", v)}
              />
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-400"
            onClick={handleUnlink}
          >
            <Icon icon="ph:link-break-bold" className="w-4 h-4 mr-2" />
            Unlink Telegram
          </Button>
        </div>
      )}
    </motion.div>
  );
};

interface ToggleRowProps {
  label: string;
  description: string;
  value: boolean;
  busy: boolean;
  onChange: (next: boolean) => void;
}

const ToggleRow = ({ label, description, value, busy, onChange }: ToggleRowProps) => (
  <div className="flex items-start justify-between gap-4">
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
    </div>
    <div className="flex items-center gap-2 shrink-0 pt-0.5">
      {busy && (
        <Icon icon="ph:spinner-bold" className="w-4 h-4 animate-spin text-muted-foreground" />
      )}
      <Switch checked={value} onCheckedChange={onChange} disabled={busy} />
    </div>
  </div>
);

export default TelegramSettings;
