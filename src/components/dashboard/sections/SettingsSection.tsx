import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import { useWallet, PrivacyLevel } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import TwitterPaymentSettings from "./TwitterPaymentSettings";

const SETTINGS_STORAGE_KEY = "baseusdp_settings";

interface UserSettings {
  notifications: {
    payments: boolean;
    transactions: boolean;
    security: boolean;
  };
  autoApprove: boolean;
}

function loadSettings(): UserSettings {
  try {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return {
    notifications: { payments: true, transactions: true, security: true },
    autoApprove: false,
  };
}

const SettingsSection = () => {
  const { privacyLevel, setPrivacyLevel, activeChain } = useWallet();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState(loadSettings().notifications);
  const [autoApprove, setAutoApprove] = useState(loadSettings().autoApprove);
  const [saved, setSaved] = useState(false);
  // When user clicks a privacy button, save immediately
  const handlePrivacySelect = (level: PrivacyLevel) => {
    setPrivacyLevel(level); // This saves to localStorage via WalletContext
  };

  const privacyLevels: { id: PrivacyLevel; label: string; description: string; icon: string; disabled: boolean }[] = [
    { id: "public", label: "Public", description: "Fully visible transactions", icon: "ph:eye-bold", disabled: false },
    { id: "partial", label: "Partial", description: "Amount hidden, parties visible", icon: "ph:eye-slash-bold", disabled: false },
    { id: "full", label: "Full", description: "Maximum privacy with ZK proofs", icon: "ph:lock-bold", disabled: false },
  ];

  const handleSave = () => {
    const settings: UserSettings = { notifications, autoApprove };
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    // Privacy level is already saved when clicked, just show confirmation
    setSaved(true);
    toast({
      title: "Settings saved",
      description: "Your preferences have been updated.",
    });
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 max-w-4xl"
    >
      <div className="mb-2">
        <h1 className="font-display text-3xl font-bold">
          Settings<span className="text-primary">.</span>
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure your privacy, network, and security preferences
        </p>
      </div>

      {/* Privacy Settings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border bg-card p-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Icon icon="ph:shield-check-bold" className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold">Privacy Settings</h3>
            <p className="text-xs text-muted-foreground">Configure your default privacy level</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {privacyLevels.map((level) => (
            <button
              key={level.id}
              onClick={() => handlePrivacySelect(level.id)}
              className={cn(
                "p-4 rounded-xl border-2 text-left transition-all relative",
                privacyLevel === level.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
            >
              <Icon icon={level.icon} className={cn(
                "w-6 h-6 mb-3",
                privacyLevel === level.id ? "text-primary" : "text-muted-foreground"
              )} />
              <p className={cn("font-bold", privacyLevel === level.id && "text-primary")}>{level.label}</p>
              <p className="text-xs text-muted-foreground mt-1">{level.description}</p>
            </button>
          ))}
        </div>

        <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
          <p className="text-sm text-muted-foreground">
            <strong>Public:</strong> Direct deposits with no mixing — lowest fees, fastest processing.<br />
            <strong>Partial:</strong> Single-hop mixing — moderate privacy, reduced fees.<br />
            <strong>Full:</strong> Multi-layer mixing through privacy mixer — maximum privacy, standard fees.
          </p>
        </div>
      </motion.div>

      {/* Network Settings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border border-border bg-card p-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <Icon icon="ph:globe-bold" className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold">Network Settings</h3>
            <p className="text-xs text-muted-foreground">Manage network connection</p>
          </div>
        </div>

        <div className="rounded-xl bg-secondary/50 p-4 flex items-center justify-between">
          <div>
            <p className="font-medium">Current Network</p>
            <p className="text-sm text-muted-foreground">{activeChain === "base" ? "Base" : "Legacy"}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm text-green-500 font-medium">Connected</span>
          </div>
        </div>
      </motion.div>

      {/* Notification Settings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl border border-border bg-card p-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
            <Icon icon="ph:bell-bold" className="w-5 h-5 text-yellow-500" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold">Notifications</h3>
            <p className="text-xs text-muted-foreground">Manage notification preferences</p>
          </div>
        </div>

        <div className="space-y-4">
          {Object.entries(notifications).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between p-3 rounded-xl bg-secondary/30">
              <span className="font-medium capitalize">{key} Notifications</span>
              <Switch
                checked={value}
                onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, [key]: checked }))}
              />
            </div>
          ))}
        </div>
      </motion.div>

      {/* Security Settings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-2xl border border-border bg-card p-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
            <Icon icon="ph:lock-bold" className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold">Security</h3>
            <p className="text-xs text-muted-foreground">Configure security preferences</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/30">
            <div>
              <p className="font-medium">Auto-approve small transactions</p>
              <p className="text-xs text-muted-foreground">Skip confirmation for transactions under $10</p>
            </div>
            <Switch checked={autoApprove} onCheckedChange={setAutoApprove} />
          </div>
        </div>
      </motion.div>

      {/* X/Twitter Payment Settings */}
      <TwitterPaymentSettings />

      {/* Save Button */}
      <Button
        className="w-full h-12 bg-primary hover:bg-primary/90"
        onClick={handleSave}
      >
        {saved ? (
          <>
            <Icon icon="ph:check-bold" className="w-4 h-4 mr-2" />
            Saved!
          </>
        ) : (
          <>
            <Icon icon="ph:floppy-disk-bold" className="w-4 h-4 mr-2" />
            Save Settings
          </>
        )}
      </Button>
    </motion.div>
  );
};

export default SettingsSection;
