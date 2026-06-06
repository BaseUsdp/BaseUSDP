import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import { useWallet, PrivacyLevel } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import TwitterPaymentSettings from "./TwitterPaymentSettings";
import FarcasterAutoCastSettings from "./FarcasterAutoCastSettings";
import TelegramSettings from "./TelegramSettings";
import WebhooksSettings from "./WebhooksSettings";
import BiometricUnlockSettings from "./BiometricUnlockSettings";
import NfcTapToPaySettings from "./NfcTapToPaySettings";
import { getApiUrl } from "@/utils/apiConfig";
import { authService } from "@/services/authService";
import {
  ADDRESS_BOOK_MAX,
  addEntry as addContactEntry,
  listEntries as listContactEntries,
  removeEntry as removeContactEntry,
  type AddressBookEntry,
} from "@/lib/addressBook";
import {
  DEFAULT_SEND_THRESHOLD,
  getSendThreshold,
  setSendThreshold as persistSendThreshold,
} from "@/lib/sendThreshold";
import {
  DEFAULT_PASSKEY_STEPUP_THRESHOLD,
  getPasskeyStepUpThreshold,
  setPasskeyStepUpThreshold as persistPasskeyStepUpThreshold,
} from "@/lib/passkeyStepUp";
import { listDevices as listPasskeyDevices } from "@/services/webauthn";
import { usePushNotifications } from "@/hooks/usePushNotifications";

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

  // Public profile customization fields.
  const [pcBio, setPcBio] = useState("");
  const [pcBanner, setPcBanner] = useState("");
  const [pcTwitter, setPcTwitter] = useState("");
  const [pcFarcaster, setPcFarcaster] = useState("");
  const [pcWebsite, setPcWebsite] = useState("");
  const [pcLoading, setPcLoading] = useState(true);
  const [pcSaving, setPcSaving] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);

  const handleBannerFile = async (file: File | null) => {
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      toast({
        title: "Pick an image",
        description: "JPEG, PNG, WebP, or GIF only.",
        variant: "destructive",
      });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Banner must be 2 MB or smaller.",
        variant: "destructive",
      });
      return;
    }
    const token = authService.getSessionToken();
    if (!token) {
      toast({
        title: "Sign in required",
        variant: "destructive",
      });
      return;
    }
    setBannerUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const res = await fetch(`${getApiUrl()}/api/user/upload-banner`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ data_url: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error || "Upload failed");
      }
      setPcBanner(data.banner_url);
      toast({
        title: "Banner uploaded",
        description: "It's already saved — Save the form to confirm the rest.",
      });
    } catch (err: any) {
      toast({
        title: "Upload failed",
        description: err?.message || "Try a smaller image.",
        variant: "destructive",
      });
    } finally {
      setBannerUploading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const token = authService.getSessionToken();
      if (!token) {
        setPcLoading(false);
        return;
      }
      try {
        const res = await fetch(`${getApiUrl()}/api/user/customize-profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (cancelled || !res.ok || !data.success) return;
        setPcBio(data.bio ?? "");
        setPcBanner(data.banner_url ?? "");
        setPcTwitter(data.twitter_handle ?? "");
        setPcFarcaster(data.farcaster_handle ?? "");
        setPcWebsite(data.website_url ?? "");
      } catch {
        // best-effort load — empty form is fine
      } finally {
        if (!cancelled) setPcLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [fullWalletAddress]);

  const saveProfileCustomization = async () => {
    const token = authService.getSessionToken();
    if (!token) {
      toast({
        title: "Sign in required",
        description: "Connect your wallet to update your profile.",
        variant: "destructive",
      });
      return;
    }
    setPcSaving(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/user/customize-profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bio: pcBio,
          banner_url: pcBanner,
          twitter_handle: pcTwitter,
          farcaster_handle: pcFarcaster,
          website_url: pcWebsite,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error || "Update failed");
      }
      toast({
        title: "Profile updated",
        description: myHandle
          ? `Live at /@${myHandle}`
          : "Your changes are saved.",
      });
    } catch (err: any) {
      toast({
        title: "Couldn't update",
        description: err?.message || "Try again.",
        variant: "destructive",
      });
    } finally {
      setPcSaving(false);
    }
  };

  // Web Push tip notifications.
  const push = usePushNotifications();
  const togglePush = async (next: boolean) => {
    const result = next ? await push.enable() : await push.disable();
    if (!result.ok) {
      toast({
        title: "Couldn't update notifications",
        description: result.error || "Try again.",
        variant: "destructive",
      });
    } else {
      toast({
        title: next ? "Notifications on" : "Notifications off",
        description: next
          ? "You'll get a push the next time a tip lands."
          : "No more push notifications on this device.",
      });
    }
  };

  // MCP plugin opt-in. When true, the user's @handle is resolvable and
  // tippable via the BASEUSDP Base MCP plugin so AI assistants (Claude,
  // ChatGPT) can address them by handle. Off by default.
  const [mcpEnabled, setMcpEnabled] = useState(false);
  const [mcpLoading, setMcpLoading] = useState(true);
  const [mcpSaving, setMcpSaving] = useState(false);

  const loadMcpEnabled = async () => {
    const token = authService.getSessionToken();
    if (!token) {
      setMcpEnabled(false);
      setMcpLoading(false);
      return;
    }
    setMcpLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/user/mcp-settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setMcpEnabled(!!data?.enabled);
    } catch {
      setMcpEnabled(false);
    } finally {
      setMcpLoading(false);
    }
  };

  const toggleMcp = async (next: boolean) => {
    const token = authService.getSessionToken();
    if (!token) {
      toast({
        title: "Sign in required",
        description: "Connect your wallet to manage AI access.",
        variant: "destructive",
      });
      return;
    }
    setMcpSaving(true);
    const prev = mcpEnabled;
    setMcpEnabled(next);
    try {
      const res = await fetch(`${getApiUrl()}/api/user/mcp-settings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ enabled: next }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Update failed");
      }
      toast({
        title: next ? "AI access enabled" : "AI access disabled",
        description: next
          ? "AI assistants can now resolve and tip your @handle via Base MCP."
          : "Your @handle is no longer exposed to AI assistants.",
      });
    } catch (err: any) {
      setMcpEnabled(prev);
      toast({
        title: "Couldn't update",
        description: err?.message || "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setMcpSaving(false);
    }
  };

  useEffect(() => {
    loadMcpEnabled();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullWalletAddress]);

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

  // Send safeguard threshold (#19) — localStorage backed.
  const [sendThresholdInput, setSendThresholdInput] = useState<string>("");
  useEffect(() => {
    setSendThresholdInput(String(getSendThreshold()));
  }, []);

  // Passkey step-up threshold — localStorage backed. Triggers biometric
  // assertion before signing a send when amount >= threshold and a passkey
  // is registered. 0 = disabled.
  const [passkeyStepUpInput, setPasskeyStepUpInput] = useState<string>("");
  const [hasPasskey, setHasPasskey] = useState<boolean>(false);
  useEffect(() => {
    setPasskeyStepUpInput(String(getPasskeyStepUpThreshold()));
  }, []);
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!fullWalletAddress) return;
      try {
        const r = await listPasskeyDevices(fullWalletAddress);
        if (!cancelled) setHasPasskey(r.success && (r.devices?.length ?? 0) > 0);
      } catch {
        if (!cancelled) setHasPasskey(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [fullWalletAddress]);

  const savePasskeyStepUp = () => {
    const trimmed = passkeyStepUpInput.trim();
    if (trimmed === "") {
      persistPasskeyStepUpThreshold(DEFAULT_PASSKEY_STEPUP_THRESHOLD);
      setPasskeyStepUpInput(String(DEFAULT_PASSKEY_STEPUP_THRESHOLD));
      toast({
        title: "Reset to default",
        description: "Passkey step-up disabled.",
      });
      return;
    }
    const parsed = parseFloat(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast({
        title: "Invalid value",
        description: "Enter a non-negative number, or 0 to disable.",
        variant: "destructive",
      });
      setPasskeyStepUpInput(String(getPasskeyStepUpThreshold()));
      return;
    }
    persistPasskeyStepUpThreshold(parsed);
    toast({
      title: "Saved",
      description:
        parsed === 0
          ? "Passkey step-up disabled."
          : `Biometric will be required for sends of $${parsed.toFixed(2)} or more.`,
    });
  };

  const saveSendThreshold = () => {
    const trimmed = sendThresholdInput.trim();
    if (trimmed === "") {
      persistSendThreshold(DEFAULT_SEND_THRESHOLD);
      setSendThresholdInput(String(DEFAULT_SEND_THRESHOLD));
      toast({
        title: "Reset to default",
        description: `Threshold set to $${DEFAULT_SEND_THRESHOLD.toFixed(2)}`,
      });
      return;
    }
    const parsed = parseFloat(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast({
        title: "Invalid value",
        description: "Enter a non-negative number, or 0 to disable.",
        variant: "destructive",
      });
      setSendThresholdInput(String(getSendThreshold()));
      return;
    }
    persistSendThreshold(parsed);
    toast({
      title: "Saved",
      description:
        parsed === 0
          ? "Send safeguard disabled — no confirm step for any amount."
          : `Confirm step will trigger above $${parsed.toFixed(2)}.`,
    });
  };

  // Saved contacts (address book) — localStorage backed.
  const [contacts, setContacts] = useState<AddressBookEntry[]>([]);
  const [contactLabel, setContactLabel] = useState("");
  const [contactValue, setContactValue] = useState("");
  const [contactEmoji, setContactEmoji] = useState("");
  const [contactError, setContactError] = useState<string | null>(null);

  useEffect(() => {
    setContacts(listContactEntries());
    const refresh = () => setContacts(listContactEntries());
    window.addEventListener("address-book:changed", refresh);
    return () => window.removeEventListener("address-book:changed", refresh);
  }, []);

  const addContact = () => {
    const result = addContactEntry({
      label: contactLabel,
      value: contactValue,
      emoji: contactEmoji || undefined,
    });
    if (!result.ok) {
      setContactError(result.error || "Couldn't save");
      return;
    }
    setContactError(null);
    setContactLabel("");
    setContactValue("");
    setContactEmoji("");
    toast({ title: "Contact saved" });
  };

  const removeContact = (id: string, label: string) => {
    removeContactEntry(id);
    toast({ title: `Removed ${label}` });
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

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://baseusdp.com";
  const tipUrl = myHandle ? `${origin}/tip/@${myHandle}` : null;
  const profileUrl = myHandle ? `${origin}/@${myHandle}` : null;

  const copyTipUrl = async () => {
    if (!tipUrl) return;
    try {
      await navigator.clipboard.writeText(tipUrl);
      toast({ title: "Tip URL copied", description: "Drop it in your bio." });
    } catch {
      toast({ title: "Couldn't copy", description: "Clipboard unavailable." });
    }
  };
  const copyProfileUrl = async () => {
    if (!profileUrl) return;
    try {
      await navigator.clipboard.writeText(profileUrl);
      toast({ title: "Profile URL copied", description: "Share your public BASEUSDP page." });
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
        ) : myHandle && tipUrl && profileUrl ? (
          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Public profile
              </p>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/30 p-3">
                <code className="flex-1 truncate text-sm font-mono">{profileUrl}</code>
                <button
                  type="button"
                  onClick={copyProfileUrl}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-secondary/50"
                >
                  <Icon icon="ph:copy-bold" className="h-3.5 w-3.5" />
                  Copy
                </button>
                <a
                  href={profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-secondary/50"
                >
                  <Icon icon="ph:arrow-square-out-bold" className="h-3.5 w-3.5" />
                  Open
                </a>
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Tip form
              </p>
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
            </div>
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


      {/* Public profile customization */}
      {myHandle && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.36 }}
          className="rounded-2xl border border-border bg-card p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-fuchsia-500/20 flex items-center justify-center">
              <Icon icon="ph:user-circle-gear-bold" className="w-5 h-5 text-fuchsia-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-display text-lg font-bold">Customize your public profile</h3>
              <p className="text-xs text-muted-foreground">
                Bio, banner, and socials shown at <span className="font-mono">baseusdp.com/@{myHandle}</span>.
              </p>
            </div>
          </div>

          {pcLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon icon="ph:circle-notch-bold" className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                  Bio <span className="font-normal lowercase text-muted-foreground/70">({pcBio.length}/280)</span>
                </label>
                <textarea
                  value={pcBio}
                  onChange={(e) => setPcBio(e.target.value.slice(0, 280))}
                  rows={3}
                  placeholder="Tell people who you are…"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                  Banner image
                </label>
                {pcBanner && (
                  <div className="mb-2 rounded-lg border border-border overflow-hidden bg-secondary/20">
                    <img
                      src={pcBanner}
                      alt="Banner preview"
                      className="w-full h-24 object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <label
                    className={`inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold cursor-pointer hover:bg-secondary/50 ${
                      bannerUploading ? "opacity-60 pointer-events-none" : ""
                    }`}
                  >
                    {bannerUploading ? (
                      <Icon icon="ph:circle-notch-bold" className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Icon icon="ph:upload-simple-bold" className="h-3.5 w-3.5" />
                    )}
                    {bannerUploading ? "Uploading…" : "Upload image"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        void handleBannerFile(e.target.files?.[0] ?? null);
                        // reset so picking the same file again re-fires
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {pcBanner && (
                    <button
                      type="button"
                      onClick={() => setPcBanner("")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-secondary/50"
                    >
                      <Icon icon="ph:x-bold" className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  JPEG, PNG, WebP, GIF · max 2 MB · or paste a URL below
                </p>
                <input
                  type="url"
                  value={pcBanner}
                  onChange={(e) => setPcBanner(e.target.value)}
                  placeholder="https://…"
                  className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono outline-none focus:border-primary/50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                    X handle
                  </label>
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3">
                    <span className="text-muted-foreground text-sm">@</span>
                    <input
                      type="text"
                      value={pcTwitter}
                      onChange={(e) => setPcTwitter(e.target.value.replace(/^@/, ""))}
                      placeholder="yourhandle"
                      className="flex-1 bg-transparent py-2 text-sm outline-none"
                      maxLength={15}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                    Farcaster
                  </label>
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3">
                    <span className="text-muted-foreground text-sm">@</span>
                    <input
                      type="text"
                      value={pcFarcaster}
                      onChange={(e) => setPcFarcaster(e.target.value.replace(/^@/, "").toLowerCase())}
                      placeholder="yourhandle"
                      className="flex-1 bg-transparent py-2 text-sm outline-none"
                      maxLength={30}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                  Website
                </label>
                <input
                  type="url"
                  value={pcWebsite}
                  onChange={(e) => setPcWebsite(e.target.value)}
                  placeholder="https://yoursite.com"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary/50"
                />
              </div>

              <div className="flex items-center justify-end">
                <Button
                  variant="outline"
                  onClick={saveProfileCustomization}
                  disabled={pcSaving}
                >
                  {pcSaving ? (
                    <>
                      <Icon icon="ph:circle-notch-bold" className="h-4 w-4 animate-spin mr-1.5" />
                      Saving…
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Tip push notifications */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.355 }}
        className="rounded-2xl border border-border bg-card p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center">
            <Icon icon="ph:bell-ringing-bold" className="w-5 h-5 text-sky-500" />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-lg font-bold">Tip notifications</h3>
            <p className="text-xs text-muted-foreground">
              Get a push on this device the moment a tip lands. Works best with BASEUSDP installed as an app.
            </p>
          </div>
        </div>

        {!push.supported ? (
          <p className="text-xs text-muted-foreground">
            Push notifications aren't supported in this browser. iOS users: add BASEUSDP to the home screen first (Share → Add to Home Screen).
          </p>
        ) : push.permission === "denied" ? (
          <p className="text-xs text-amber-500">
            Notifications are blocked at the browser level. Re-enable in your browser site settings, then come back here.
          </p>
        ) : (
          <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/30">
            <div className="flex-1 min-w-0 pr-4">
              <p className="font-medium">Notify me when I get a tip</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Per-device. Detected within a minute of the tip landing.
              </p>
            </div>
            <Switch
              checked={push.enabled}
              disabled={push.busy}
              onCheckedChange={togglePush}
            />
          </div>
        )}
      </motion.div>

      {/* AI assistant access — Base MCP opt-in */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.36 }}
        className="rounded-2xl border border-border bg-card p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
            <Icon icon="ph:robot-bold" className="w-5 h-5 text-violet-500" />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-lg font-bold">AI assistant access</h3>
            <p className="text-xs text-muted-foreground">
              Let AI assistants (Claude, ChatGPT) resolve your @handle and tip you via the Base MCP plugin
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/30">
          <div className="flex-1 min-w-0 pr-4">
            <p className="font-medium">
              Allow AI assistants to find me by @handle
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Exposes your @handle → wallet mapping at <span className="font-mono">baseusdp.com/api/mcp/*</span>.
              Off by default. Toggle off any time.
            </p>
          </div>
          {mcpLoading ? (
            <Icon icon="ph:circle-notch-bold" className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Switch
              checked={mcpEnabled}
              disabled={mcpSaving}
              onCheckedChange={toggleMcp}
            />
          )}
        </div>
      </motion.div>

      {/* Send safeguard (#19) — extra confirm step for large sends */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="rounded-2xl border border-border bg-card p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Icon icon="ph:shield-warning-bold" className="w-5 h-5 text-amber-500" />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-lg font-bold">Send safeguard</h3>
            <p className="text-xs text-muted-foreground">
              Show an extra confirmation when sending more than this amount. Set to 0 to disable.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={sendThresholdInput}
              onChange={(e) => setSendThresholdInput(e.target.value)}
              onBlur={saveSendThreshold}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder={String(DEFAULT_SEND_THRESHOLD)}
              className="w-full rounded-lg border border-border bg-secondary pl-7 pr-3 py-2 text-sm focus:border-primary/50 focus:outline-none"
            />
          </div>
          <Button variant="outline" onClick={saveSendThreshold} className="sm:w-auto">
            Save
          </Button>
        </div>
      </motion.div>

      {/* Passkey step-up — biometric required for large sends */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.36 }}
        className="rounded-2xl border border-border bg-card p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
            <Icon icon="ph:fingerprint-bold" className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-lg font-bold">Passkey step-up</h3>
            <p className="text-xs text-muted-foreground">
              Require a fresh biometric (Touch ID / Face ID / hardware key) before signing sends of this amount or more. Set to 0 to disable.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={passkeyStepUpInput}
              onChange={(e) => setPasskeyStepUpInput(e.target.value)}
              onBlur={savePasskeyStepUp}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder="0"
              className="w-full rounded-lg border border-border bg-secondary pl-7 pr-3 py-2 text-sm focus:border-primary/50 focus:outline-none"
            />
          </div>
          <Button variant="outline" onClick={savePasskeyStepUp} className="sm:w-auto">
            Save
          </Button>
        </div>

        {!hasPasskey && (
          <p className="mt-3 text-xs text-amber-500">
            No passkey registered yet — step-up won't trigger until you register one in the Biometric Unlock section below.
          </p>
        )}
      </motion.div>

      {/* Saved contacts (address book) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="rounded-2xl border border-border bg-card p-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <Icon icon="ph:address-book-bold" className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-lg font-bold">Saved contacts</h3>
            <p className="text-xs text-muted-foreground">
              Quick-pick recipients in the Send form · {contacts.length}/{ADDRESS_BOOK_MAX}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[80px_1fr_1fr_auto]">
          <input
            type="text"
            placeholder="🎁"
            value={contactEmoji}
            onChange={(e) => {
              setContactEmoji(e.target.value);
              setContactError(null);
            }}
            maxLength={4}
            className="rounded-lg border border-border bg-background px-3 py-2 text-center text-sm outline-none focus:border-primary"
          />
          <input
            type="text"
            placeholder="Label (e.g. Alice)"
            value={contactLabel}
            onChange={(e) => {
              setContactLabel(e.target.value);
              setContactError(null);
            }}
            maxLength={32}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <input
            type="text"
            placeholder="0x… or @handle"
            value={contactValue}
            onChange={(e) => {
              setContactValue(e.target.value);
              setContactError(null);
            }}
            className="rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={addContact}
            disabled={!contactLabel.trim() || !contactValue.trim()}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon icon="ph:plus-bold" className="h-4 w-4" />
            Add
          </button>
        </div>

        {contactError && (
          <p className="mt-2 text-xs text-red-500">{contactError}</p>
        )}

        {contacts.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-border bg-secondary/20 px-3 py-4 text-center text-xs text-muted-foreground">
            No saved contacts yet. Add one above to see it as a quick-pick on the Send form.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {contacts.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-secondary/20 px-3 py-2"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary/40 text-sm">
                  {c.emoji || (c.type === "username" ? "@" : "0x")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{c.label}</div>
                  <div className="truncate font-mono text-[11px] text-muted-foreground">
                    {c.type === "username" ? `@${c.value}` : c.value}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeContact(c.id, c.label)}
                  className="inline-flex items-center justify-center rounded-lg border border-border bg-card p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
                  title={`Remove ${c.label}`}
                >
                  <Icon icon="ph:trash-bold" className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* X/Twitter Payment Settings */}
      <TwitterPaymentSettings />

      {/* Farcaster Auto-Cast */}
      <FarcasterAutoCastSettings />

      {/* Telegram Notifications */}
      <TelegramSettings />

      {/* Webhooks — POST to any URL on events */}
      <WebhooksSettings />

      {/* Biometric / WebAuthn unlock */}
      <BiometricUnlockSettings />

      {/* NFC tap-to-pay */}
      <NfcTapToPaySettings />

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
