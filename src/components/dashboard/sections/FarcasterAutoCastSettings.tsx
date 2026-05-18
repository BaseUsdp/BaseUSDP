import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { Switch } from "@/components/ui/switch";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import {
  getAutoCastSettings,
  updateAutoCastSettings,
  type AutoCastSettings,
} from "@/services/farcasterAutoCast";

const FarcasterAutoCastSettings = () => {
  const { fullWalletAddress } = useWallet();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AutoCastSettings | null>(null);
  const [busyKey, setBusyKey] = useState<keyof AutoCastSettings | null>(null);

  useEffect(() => {
    if (!fullWalletAddress) {
      setSettings(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    getAutoCastSettings(fullWalletAddress)
      .then((result) => {
        if (result.success && result.settings) setSettings(result.settings);
      })
      .finally(() => setLoading(false));
  }, [fullWalletAddress]);

  const apply = async (
    key: "enabled" | "on_deposit" | "on_withdraw" | "include_amount",
    value: boolean
  ) => {
    if (!fullWalletAddress || !settings) return;
    const previous = { ...settings };
    setSettings({ ...settings, [key]: value });
    setBusyKey(key);
    const result = await updateAutoCastSettings(fullWalletAddress, { [key]: value });
    setBusyKey(null);
    if (!result.success) {
      setSettings(previous);
      toast({
        title: "Couldn't update setting",
        description: result.error,
        variant: "destructive",
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="rounded-2xl border border-border bg-card p-6"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center">
          <Icon icon="ph:broadcast-bold" className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h3 className="font-display text-lg font-bold">Farcaster auto-cast</h3>
          <p className="text-xs text-muted-foreground">
            Auto-post to Farcaster after a successful deposit or withdrawal
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Icon icon="ph:spinner-bold" className="w-4 h-4 animate-spin" />
          Loading…
        </div>
      ) : !settings?.has_farcaster ? (
        <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 text-sm">
          <p className="font-medium mb-1">No Farcaster account linked yet</p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Open the BASEUSDP mini-app inside Warpcast at least once to link your
            FID to this wallet. After that, this section will let you toggle
            auto-casts on.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <ToggleRow
            label="Auto-cast enabled"
            description={`Posts from @baseusdp mentioning @${settings.farcaster_username}.`}
            value={settings.enabled}
            busy={busyKey === "enabled"}
            onChange={(v) => apply("enabled", v)}
          />

          {settings.enabled && (
            <div className="ml-2 pl-4 border-l border-border space-y-4">
              <ToggleRow
                label="On successful deposits"
                description="Fires once after each shielded deposit completes."
                value={settings.on_deposit}
                busy={busyKey === "on_deposit"}
                onChange={(v) => apply("on_deposit", v)}
              />
              <ToggleRow
                label="On successful withdrawals"
                description="Fires once after each withdrawal settles."
                value={settings.on_withdraw}
                busy={busyKey === "on_withdraw"}
                onChange={(v) => apply("on_withdraw", v)}
              />
              <ToggleRow
                label="Include amount in cast"
                description="Off by default — cast is generic. Turn on to share the dollar amount publicly."
                value={settings.include_amount}
                busy={busyKey === "include_amount"}
                onChange={(v) => apply("include_amount", v)}
              />

              <div className="rounded-lg bg-secondary/50 p-3 text-xs text-muted-foreground">
                <p className="font-medium mb-1 text-foreground">Preview</p>
                <p className="font-mono">
                  @{settings.farcaster_username} just shielded
                  {settings.include_amount ? " $X.XX USDC" : ""} a private
                  deposit on Base via @baseusdp 🛡️
                </p>
              </div>
            </div>
          )}
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
      {busy && <Icon icon="ph:spinner-bold" className="w-4 h-4 animate-spin text-muted-foreground" />}
      <Switch checked={value} onCheckedChange={onChange} disabled={busy} />
    </div>
  </div>
);

export default FarcasterAutoCastSettings;
