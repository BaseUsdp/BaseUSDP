import { useEffect, useRef, useState } from "react";

/**
 * Tracks user activity (mousemove / keydown / click / touchstart / scroll)
 * and fires `onIdle` once the idle window passes without any event. Resets
 * the timer on every observed event. Disabled when `enabled === false`.
 *
 * Returns a `markActive()` callback the caller can use to manually reset
 * the timer (e.g. after a successful unlock).
 */
export function useIdleLock({
  enabled,
  idleMinutes,
  onIdle,
}: {
  enabled: boolean;
  idleMinutes: number;
  onIdle: () => void;
}): { markActive: () => void } {
  const timerRef = useRef<number | null>(null);
  const onIdleRef = useRef(onIdle);
  // Track the latest threshold so an in-flight schedule respects user changes.
  const [thresholdMs, setThresholdMs] = useState(Math.max(60_000, idleMinutes * 60_000));

  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  useEffect(() => {
    setThresholdMs(Math.max(60_000, idleMinutes * 60_000));
  }, [idleMinutes]);

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const schedule = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        onIdleRef.current();
      }, thresholdMs);
    };

    const reset = () => {
      schedule();
    };

    schedule();

    const events: (keyof WindowEventMap)[] = [
      "mousemove",
      "keydown",
      "click",
      "touchstart",
      "scroll",
      "visibilitychange",
    ];
    for (const e of events) window.addEventListener(e, reset, { passive: true });

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = null;
      for (const e of events) window.removeEventListener(e, reset);
    };
  }, [enabled, thresholdMs]);

  const markActive = () => {
    if (!enabled) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      onIdleRef.current();
    }, thresholdMs);
  };

  return { markActive };
}
