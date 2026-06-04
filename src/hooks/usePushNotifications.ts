/**
 * Hook for the Web Push tip-notification opt-in.
 *
 * Provides:
 *   - `supported`           Browser supports the relevant APIs.
 *   - `permission`          Current Notification.permission state.
 *   - `enabled`             True when a subscription exists for this device.
 *   - `enable()`            Request permission + subscribe + persist server-side.
 *   - `disable()`           Unsubscribe + delete the row server-side.
 *
 * Subscription is keyed to the SW registration on this device. Multiple
 * devices = multiple rows in push_subscriptions.
 */

import { useCallback, useEffect, useState } from "react";
import { authService } from "@/services/authService";
import { getApiUrl } from "@/utils/apiConfig";

const VAPID_PUBLIC_KEY =
  (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ?? "";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const buffer = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buffer[i] = raw.charCodeAt(i);
  return buffer;
}

export function usePushNotifications() {
  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    !!VAPID_PUBLIC_KEY;

  const [permission, setPermission] = useState<NotificationPermission>(
    () => (supported ? Notification.permission : "default"),
  );
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  // Detect existing subscription on mount.
  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!cancelled) setEnabled(!!sub);
      } catch {
        if (!cancelled) setEnabled(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supported]);

  const enable = useCallback(async (): Promise<{
    ok: boolean;
    error?: string;
  }> => {
    if (!supported) return { ok: false, error: "Push not supported in this browser" };
    const token = authService.getSessionToken();
    if (!token) return { ok: false, error: "Sign in first" };
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        return { ok: false, error: "Notification permission denied" };
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      const json = sub.toJSON();
      const res = await fetch(`${getApiUrl()}/api/push/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(json),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        try { await sub.unsubscribe(); } catch { /* noop */ }
        return { ok: false, error: data?.error || "Failed to register subscription" };
      }
      setEnabled(true);
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || "Failed to enable notifications" };
    } finally {
      setBusy(false);
    }
  }, [supported]);

  const disable = useCallback(async (): Promise<{
    ok: boolean;
    error?: string;
  }> => {
    if (!supported) return { ok: false, error: "Push not supported" };
    const token = authService.getSessionToken();
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        try { await sub.unsubscribe(); } catch { /* noop */ }
        if (token) {
          try {
            await fetch(`${getApiUrl()}/api/push/unsubscribe`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ endpoint }),
            });
          } catch { /* best-effort */ }
        }
      }
      setEnabled(false);
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || "Failed to disable notifications" };
    } finally {
      setBusy(false);
    }
  }, [supported]);

  return { supported, permission, enabled, busy, enable, disable };
}
