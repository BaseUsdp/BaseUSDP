import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import {
  listDevices,
  registerDevice,
  deleteDevice,
  type WebAuthnDevice,
} from "@/services/webauthn";
import {
  isBiometricEnabled,
  setBiometricEnabled,
  getIdleMinutes,
  setIdleMinutes,
  isBrowserWebAuthnSupported,
  BIOMETRIC_PREFS_EVENT,
  IDLE_MIN_BOUND,
  IDLE_MAX_BOUND,
} from "@/lib/biometricPrefs";

const formatRelative = (iso: string | null) => {
  if (!iso) return "never";
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const m = Math.floor(diffMs / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
};

const defaultDeviceLabel = () => {
  const ua = navigator.userAgent;
  if (/Macintosh/.test(ua)) return "Mac";
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android device";
  if (/Windows/.test(ua)) return "Windows PC";
  return "This device";
};

const BiometricUnlockSettings = () => {
  const { fullWalletAddress } = useWallet();
  const { toast } = useToast();
  const [supported] = useState(isBrowserWebAuthnSupported());
  const [enabled, setEnabled] = useState(isBiometricEnabled());
  const [idleMin, setIdleMin] = useState(getIdleMinutes());
  const [idleInput, setIdleInput] = useState(String(getIdleMinutes()));
  const [devices, setDevices] = useState<WebAuthnDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    if (!fullWalletAddress) {
      setDevices([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const result = await listDevices(fullWalletAddress);
    if (result.success && result.devices) setDevices(result.devices);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullWalletAddress]);

  useEffect(() => {
    const sync = () => {
      setEnabled(isBiometricEnabled());
      setIdleMin(getIdleMinutes());
      setIdleInput(String(getIdleMinutes()));
    };
    window.addEventListener(BIOMETRIC_PREFS_EVENT, sync);
    return () => window.removeEventListener(BIOMETRIC_PREFS_EVENT, sync);
  }, []);

  const handleToggleEnabled = (next: boolean) => {
    if (next && devices.length === 0) {
      toast({
        title: "Register a device first",
        description: "Add at least one biometric device before turning the lock on.",
      });
      return;
    }
    setBiometricEnabled(next);
    setEnabled(next);
  };

  const commitIdle = () => {
    const parsed = parseInt(idleInput, 10);
    if (!Number.isFinite(parsed) || parsed < IDLE_MIN_BOUND || parsed > IDLE_MAX_BOUND) {
      setIdleInput(String(idleMin));
      toast({
        title: "Invalid value",
        description: `Idle minutes must be between ${IDLE_MIN_BOUND} and ${IDLE_MAX_BOUND}.`,
        variant: "destructive",
      });
      return;
    }
    setIdleMinutes(parsed);
    setIdleMin(parsed);
  };

  const handleRegister = async () => {
    if (!fullWalletAddress) return;
    setRegistering(true);
    const result = await registerDevice(fullWalletAddress, defaultDeviceLabel());
    setRegistering(false);
    if (result.success) {
      toast({ title: "Device registered", description: "Biometric unlock is ready." });
      await load();
      // First device — auto-enable the master toggle so it's actually useful.
      if (!enabled) {
        setBiometricEnabled(true);
        setEnabled(true);
      }
    } else {
      toast({ title: "Couldn't register", description: result.error, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!fullWalletAddress) return;
    setBusyId(id);
    const result = await deleteDevice(fullWalletAddress, id);
    setBusyId(null);
    if (result.success) {
      setDevices((prev) => prev.filter((d) => d.id !== id));
      toast({ title: "Device removed" });
      // If that was the last device, force-disable the master toggle so the
      // user doesn't end up locked out with no way to unlock.
      if (devices.length === 1) {
        setBiometricEnabled(false);
        setEnabled(false);
      }
    } else {
      toast({ title: "Couldn't remove", description: result.error, variant: "destructive" });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45 }}
      className="rounded-2xl border border-border bg-card p-6"
    >
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
          <Icon icon="ph:fingerprint-bold" className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-lg font-bold">Biometric unlock</h3>
          <p className="text-xs text-muted-foreground">
            Re-open the dashboard with Touch ID / Face ID / Windows Hello instead of
            re-signing your wallet each time.
          </p>
        </div>
      </div>

      {!supported && (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          Your browser doesn't support WebAuthn. Try a recent version of Chrome,
          Safari, Edge, or Firefox.
        </div>
      )}

      {supported && (
        <>
          <div className="mt-4 flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Enable biometric lock</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                When on, the dashboard locks after the idle window below. Off keeps
                your devices registered but never locks the UI.
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={handleToggleEnabled}
              disabled={devices.length === 0 && !enabled}
            />
          </div>

          {enabled && (
            <div className="mt-4 flex items-center justify-between gap-4 pt-3 border-t border-border">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Lock after (minutes idle)</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Between {IDLE_MIN_BOUND} and {IDLE_MAX_BOUND}. Default 15.
                </p>
              </div>
              <Input
                type="number"
                min={IDLE_MIN_BOUND}
                max={IDLE_MAX_BOUND}
                value={idleInput}
                onChange={(e) => setIdleInput(e.target.value)}
                onBlur={commitIdle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                className="w-24 bg-background"
              />
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-border space-y-3">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-medium">Registered devices</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegister}
                disabled={registering || !fullWalletAddress}
              >
                {registering ? (
                  <>
                    <Icon icon="ph:spinner-bold" className="w-4 h-4 mr-2 animate-spin" />
                    Registering…
                  </>
                ) : (
                  <>
                    <Icon icon="ph:plus-bold" className="w-4 h-4 mr-2" />
                    Add this device
                  </>
                )}
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Icon icon="ph:spinner-bold" className="w-4 h-4 animate-spin" />
                Loading…
              </div>
            ) : devices.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">
                No devices yet. Click "Add this device" to enroll Touch ID / Face ID
                / Windows Hello on the browser you're using right now.
              </p>
            ) : (
              <ul className="space-y-2">
                {devices.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-background/40 p-3"
                  >
                    <Icon
                      icon="ph:fingerprint-bold"
                      className="w-4 h-4 text-emerald-400 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {d.device_label || "Unnamed device"}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Added {formatRelative(d.created_at)} · Last used{" "}
                        {formatRelative(d.last_used_at)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-400 shrink-0"
                      onClick={() => handleDelete(d.id)}
                      disabled={busyId === d.id}
                    >
                      <Icon icon="ph:trash-bold" className="w-4 h-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </motion.div>
  );
};

export default BiometricUnlockSettings;
