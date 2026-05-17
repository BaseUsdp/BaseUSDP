import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import { useWallet, PrivacyLevel } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import TwitterPaymentSettings from "./TwitterPaymentSettings";
import { getApiUrl } from "@/utils/apiConfig";

const SETTINGS_STORAGE_KEY = "void402_settings";

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
  const { privacyLevel, setPrivacyLevel, activeChain, fullWalletAddress } = useWallet();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState(loadSettings().notifications);
  const [autoApprove, setAutoApprove] = useState(loadSettings().autoApprove);
  const [saved, setSaved] = useState(false);
  const [myHandle, setMyHandle] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [handleInput, setHandleInput] = useState("");
  const [handleError, setHandleError] = useState<string | null>(null);
  const [handleSaving, setHandleSaving] = useState(false);

  // Look up the current wallet's profile so we can surface their tip URL.
  // Only show the URL when the user has set a *custom* username — auto-
  // generated truncated placeholders aren't real handles.
  const loadProfile = async () => {
    if (!fullWalletAddress) {
      setMyHandle(null);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    try {
      const res = await fetch(
        `${getApiUrl()}/api/user/profile?wallet=${encodeURIComponent(fullWalletAddress)}`
      );
      const data = await res.json();
      if (data?.success && data.profile?.has_custom_username && data.profile?.username) {
        setMyHandle(data.profile.username);
      } else {
        setMyHandle(null);
      }
    } catch {
      setMyHandle(null);
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullWalletAddress]);

  const validateHandle = (value: string): string | null => {
    if (value.length < 3) return "At least 3 characters";
    if (value.length > 20) return "20 characters max";
    if (!/^[a-zA-Z0-9]/.test(value)) return "Must start with a letter or number";
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(value)) {
      return "Letters, numbers, underscores, and hyphens only";
    }
    return null;
  };

  const saveHandle = async () => {
    if (!fullWalletAddress) return;
    const trimmed = handleInput.trim().replace(/^@/, "");
    const err = validateHandle(trimmed);
    if (err) {
      setHandleError(err);
      return;
    }
    setHandleError(null);
    setHandleSaving(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/user/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet_address: fullWalletAddress, username: trimmed }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setHandleError(data.error || "Couldn't save username");
        return;
      }
      toast({
        title: "Username set",
        description: `@${trimmed} is yours. Your tip page is live.`,
      });
      setHandleInput("");
      await loadProfile();
    } catch {
      setHandleError("Network error — try again");
    } finally {
      setHandleSaving(false);
    }
  };

  const tipUrl = myHandle
    ? `${typeof window !== "undefined" ? window.location.origin : "https://baseusdp.com"}/tip/@${myHandle}`
    : null;

  const copyTipUrl = async () => {
    if (!tipUrl) return;
    try {
      await navigator.clipboard.writeText(tipUrl);
      toast({ title: "Tip URL copied", description: "Drop it in your bio." });
    } catch {
      toast({ title: "Couldn't copy", description: "Clipboard unavailable." });
    }
  };
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

      {/* Tip jar / username card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="rounded-2xl border border-border bg-card p-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center">
            <Icon icon="ph:hand-coins-bold" className="w-5 h-5 text-pink-500" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold">Your tip page</h3>
            <p className="text-xs text-muted-foreground">
              Public URL anyone can use to send you a tip on BASEUSDP
            </p>
          </div>
        </div>

        {profileLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Icon icon="ph:circle-notch-bold" className="h-4 w-4 animate-spin" />
            Loading profile…
          </div>
        ) : myHandle && tipUrl ? (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/30 p-3">
            <code className="flex-1 truncate text-sm font-mono">{tipUrl}</code>
            <button
              type="button"
              onClick={copyTipUrl}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-secondary/50"
            >
              <Icon icon="ph:copy-bold" className="h-3.5 w-3.5" />
              Copy
            </button>
            <a
              href={tipUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-secondary/50"
            >
              <Icon icon="ph:arrow-square-out-bold" className="h-3.5 w-3.5" />
              Open
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              You don't have a username yet. Pick one (3–20 chars) to unlock
              your public tip page at <span className="font-mono">baseusdp.com/tip/@you</span>.
            </p>
            <div className="flex items-stretch gap-2">
              <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3">
                <Icon icon="ph:at-bold" className="h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="yourhandle"
                  value={handleInput}
                  onChange={(e) => {
                    setHandleInput(e.target.value);
                    setHandleError(null);
                  }}
                  className="flex-1 bg-transparent py-2 text-sm outline-none"
                  maxLength={20}
                />
              </div>
              <button
                type="button"
                onClick={saveHandle}
                disabled={handleSaving || handleInput.trim().length < 3}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {handleSaving ? (
                  <Icon icon="ph:circle-notch-bold" className="h-4 w-4 animate-spin" />
                ) : (
                  <Icon icon="ph:check-bold" className="h-4 w-4" />
                )}
                Save
              </button>
            </div>
            {handleError && (
              <p className="text-xs text-red-500">{handleError}</p>
            )}
          </div>
        )}
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
