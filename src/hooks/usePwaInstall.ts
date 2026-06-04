/**
 * Hook for the PWA install prompt.
 *
 * Captures the browser's `beforeinstallprompt` event and exposes a
 * `promptInstall()` action plus an `available` flag so any component can
 * render an Install button when the install gesture is allowed.
 *
 * Behavior:
 *   - `available` flips true when the browser determines the user can install
 *   - `promptInstall()` fires the native prompt; resolves with the outcome
 *   - `installed` flips true after the appinstalled event (or if the page
 *     is already running in standalone display mode)
 *
 * Browsers that don't fire beforeinstallprompt (Safari/Firefox on desktop,
 * iOS Safari) keep `available=false` — UI should hide the button.
 */

import { useCallback, useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISMISSED_KEY = "baseusdp_pwa_install_dismissed_v1";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // iOS Safari uses navigator.standalone
  return !!(window.navigator as any).standalone;
}

export function usePwaInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(() => isStandalone());
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const onBefore = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onBefore);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBefore);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return "unavailable" as const;
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      setDeferred(null);
      if (outcome === "dismissed") {
        setDismissed(true);
        try {
          localStorage.setItem(DISMISSED_KEY, "1");
        } catch {
          /* localStorage unavailable — silent */
        }
      }
      return outcome;
    } catch {
      return "error" as const;
    }
  }, [deferred]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      /* silent */
    }
  }, []);

  return {
    available: !!deferred && !installed,
    installed,
    dismissed,
    promptInstall,
    dismiss,
  };
}
